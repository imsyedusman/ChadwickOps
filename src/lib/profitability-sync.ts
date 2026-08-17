import { db } from '@/db';
import { profitabilityData, projects } from '@/db/schema';
import { WorkGuruClient } from './workguru';
import { sql, inArray } from 'drizzle-orm';

export class ProfitabilitySyncService {
  private client: WorkGuruClient;

  constructor(apiKey: string, apiSecret: string) {
    this.client = new WorkGuruClient(apiKey, apiSecret);
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async withRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 3): Promise<T | null> {
    const actualMax = Math.max(maxRetries, 50);

    for (let attempt = 1; attempt <= actualMax; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        const err = error as { response?: { status?: number }; status?: number };
        const status = err.response?.status || err.status;
        const isRateLimit = status === 429;
        const isRetryable = isRateLimit || status === 503;
        
        if (isRetryable && attempt < actualMax) {
          let delay: number;
          if (isRateLimit) {
            delay = Math.min(30000 + (attempt * 2000), 60000);
            console.warn(`[ProfitabilitySync] Rate limit (429) hit on ${label}. Attempt ${attempt}/${actualMax}. Waiting ${delay/1000}s before retrying SAME project...`);
          } else {
            delay = Math.pow(2, attempt) * 1000;
            console.warn(`[ProfitabilitySync] Service error (${status}) hit on ${label}. Attempt ${attempt}/${actualMax}. Retrying in ${delay/1000}s...`);
          }
          
          await this.sleep(delay);
          continue;
        }
        
        if (attempt === actualMax) {
          console.error(`[ProfitabilitySync] ${label} exhausted all ${actualMax} retries. Final error:`, error instanceof Error ? error.message : String(error));
          return null;
        }
        
        console.error(`[ProfitabilitySync] ${label} encountered non-retryable error (${status}):`, error instanceof Error ? error.message : String(error));
        return null;
      }
    }
    return null;
  }

  private extractItems<T>(data: any, entityName: string): T[] {
    const result = data?.result;
    let items: T[] | undefined;

    if (Array.isArray(result)) {
      items = result;
    } else if (result && Array.isArray(result.items)) {
      items = result.items;
    } else if (data && Array.isArray(data.items)) {
      items = data.items;
    }

    if (!items) {
      console.error(`[ProfitabilitySync] Invalid ${entityName} response structure. Full data head:`, JSON.stringify(data).substring(0, 500));
      throw new Error(`Invalid WorkGuru response: could not find items array for ${entityName}`);
    }
    
    console.log(`[ProfitabilitySync] ${entityName} Items length:`, items.length);
    return items;
  }

  private getAuFyStart(): string {
    const now = new Date();
    let year = now.getFullYear();
    // In JS, getMonth() is 0-indexed (0 = Jan, 6 = Jul)
    if (now.getMonth() < 6) {
      year -= 1;
    }
    // Set to July 1st of the calculated year
    return new Date(Date.UTC(year, 6, 1)).toISOString();
  }

  async runSync() {
    console.log('[ProfitabilitySync] Starting sync...');
    
    const stats = {
      activeProcessed: 0,
      historicalProcessed: 0,
      errors: 0
    };

    try {
      // 1. Fetch Active Projects
      // We'll use a very wide date range for active projects to catch any that are currently active
      // regardless of when they started. 
      const now = new Date().toISOString();
      const tenYearsAgo = new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000).toISOString();
      
      console.log(`[ProfitabilitySync] Fetching active projects from WorkGuru...`);
      const activeResponse = await this.withRetry(() => this.client.getProjectProfitSummary(tenYearsAgo, now), 'Active Projects Summary');
      const activeItems = this.extractItems<any>(activeResponse, 'ProjectProfitSummary');
      
      // Get local projects to filter only those that exist in our WIP sync
      const localProjects = await db.query.projects.findMany({
        columns: { projectNumber: true, id: true }
      });
      const localProjectNumbers = new Set(localProjects.map(p => p.projectNumber));
      
      const filteredActive = activeItems.filter(item => item.ProjectNo && localProjectNumbers.has(item.ProjectNo));
      
      const activeRecordsToUpsert = [];
      const processedActiveProjectNumbers = new Set<string>();
      const batchSizeApi = 10;
      
      for (let i = 0; i < filteredActive.length; i += batchSizeApi) {
          const chunk = filteredActive.slice(i, i + batchSizeApi);
          const chunkPromises = chunk.map(async (item) => {
              const forecastMaterialsCost = (Number(item.ProductForecastCost) || 0) + (Number(item.PurchaseForecastCost) || 0);

              processedActiveProjectNumbers.add(item.ProjectNo);

              return {
                  projectNumber: item.ProjectNo,
                  quotedProfit: item.ForecastDollarProfit ? Number(item.ForecastDollarProfit) : 0,
                  actualProfit: item.DollarProfit ? Number(item.DollarProfit) : 0,
                  invoicedAmount: item.TotalInvoiced ? Number(item.TotalInvoiced) : (item.Total ? Number(item.Total) : 0),
                  totalCost: item.TotalCost ? Number(item.TotalCost) : null,
                  labourCost: item.TaskCost != null ? Number(item.TaskCost) : null,
                  materialsCost: item.ProductCost != null ? Number(item.ProductCost) : null,
                  purchasesCost: item.PurchaseCost != null ? Number(item.PurchaseCost) : null,
                  estimatedLabourCost: item.TaskForecastCost != null ? Number(item.TaskForecastCost) : null,
                  estimatedMaterialsCost: forecastMaterialsCost > 0 ? forecastMaterialsCost : null,
                  estimatedTotalCost: item.TotalForecastCost != null ? Number(item.TotalForecastCost) : null,
                  estimatedInvoicedAmount: item.TotalForecastRevenue != null ? Number(item.TotalForecastRevenue) : null,
                  completionDate: null,
                  isHistorical: false,
                  lastSyncedAt: new Date()
              };
          });
          const resolvedChunk = await Promise.all(chunkPromises);
          activeRecordsToUpsert.push(...resolvedChunk);
          // Simple rate limiting (60 req / 60 sec = 1 req/sec. 10 reqs = 10 secs)
          await new Promise(r => setTimeout(r, 2000));
      }

      if (activeRecordsToUpsert.length > 0) {
        console.log(`[ProfitabilitySync] Upserting ${activeRecordsToUpsert.length} active records...`);
        
        // Batch upsert to handle PostgreSQL limits
        const batchSize = 100;
        for (let i = 0; i < activeRecordsToUpsert.length; i += batchSize) {
          const batch = activeRecordsToUpsert.slice(i, i + batchSize);
          await db.insert(profitabilityData)
            .values(batch)
            .onConflictDoUpdate({
              target: profitabilityData.projectNumber,
              set: {
                quotedProfit: sql`EXCLUDED.quoted_profit`,
                actualProfit: sql`EXCLUDED.actual_profit`,
                invoicedAmount: sql`EXCLUDED.invoiced_amount`,
                totalCost: sql`EXCLUDED.total_cost`,
                labourCost: sql`EXCLUDED.labour_cost`,
                materialsCost: sql`EXCLUDED.materials_cost`,
                purchasesCost: sql`EXCLUDED.purchases_cost`,
                estimatedLabourCost: sql`EXCLUDED.estimated_labour_cost`,
                estimatedMaterialsCost: sql`EXCLUDED.estimated_materials_cost`,
                estimatedTotalCost: sql`EXCLUDED.estimated_total_cost`,
                estimatedInvoicedAmount: sql`EXCLUDED.estimated_invoiced_amount`,
                completionDate: sql`EXCLUDED.completion_date`,
                isHistorical: sql`EXCLUDED.is_historical`,
                lastSyncedAt: sql`EXCLUDED.last_synced_at`,
              }
            });
          stats.activeProcessed += batch.length;
        }
      }

      // 2. Fetch Historical Projects
      // Use the same 10-year window as active projects to catch older completions
      const tenYearsAgoHistorical = new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000).toISOString();
      console.log(`[ProfitabilitySync] Fetching historical projects from WorkGuru (Start: ${tenYearsAgoHistorical})...`);
      
      const historicalResponse = await this.withRetry(() => this.client.getAllProjectsCompletedInDateRange(tenYearsAgoHistorical, now), 'Historical Projects Summary');
      const historicalItems = this.extractItems<any>(historicalResponse, 'CompletedProjects');
      
      const filteredHistorical = historicalItems.filter(item => item.ProjectNo && !processedActiveProjectNumbers.has(item.ProjectNo));
      
      const historicalRecordsToUpsert = [];
      const batchSizeApiHist = 10;
      
      for (let i = 0; i < filteredHistorical.length; i += batchSizeApiHist) {
          const chunk = filteredHistorical.slice(i, i + batchSizeApiHist);
          const chunkPromises = chunk.map(async (item) => {
              const forecastMaterialsCost = (Number(item.ProductForecastCost) || 0) + (Number(item.PurchaseForecastCost) || 0);

              const total = Number(item.Total) || 0;
              const forecastCost = Number(item.ForecastCost) || 0;
              const totalCostSummary = Number(item.TotalCost) || 0;
              
              const quotedProfit = total - forecastCost;
              const actualProfit = total - totalCostSummary;
              
              let completionDate = null;
              if (item.ISOCompletedDate) {
                  completionDate = new Date(item.ISOCompletedDate);
              } else if (item.CompletedDate && item.CompletedDate !== 'N/A') {
                  const parts = item.CompletedDate.split('/');
                  if (parts.length === 3) {
                      completionDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                  }
              }

              return {
                  projectNumber: item.ProjectNo,
                  quotedProfit: quotedProfit,
                  actualProfit: actualProfit,
                  invoicedAmount: total,
                  totalCost: item.TotalCost != null ? Number(item.TotalCost) : null,
                  labourCost: item.TaskCost != null ? Number(item.TaskCost) : null,
                  materialsCost: item.ProductCost != null ? Number(item.ProductCost) : null,
                  purchasesCost: item.PurchaseCost != null ? Number(item.PurchaseCost) : null,
                  estimatedLabourCost: item.TaskForecastCost != null ? Number(item.TaskForecastCost) : null,
                  estimatedMaterialsCost: forecastMaterialsCost > 0 ? forecastMaterialsCost : null,
                  estimatedTotalCost: item.TotalForecastCost != null ? Number(item.TotalForecastCost) : null,
                  estimatedInvoicedAmount: item.TotalForecastRevenue != null ? Number(item.TotalForecastRevenue) : null,
                  completionDate: completionDate && !isNaN(completionDate.getTime()) ? completionDate : null,
                  isHistorical: true,
                  lastSyncedAt: new Date()
              };
          });
          const resolvedChunk = await Promise.all(chunkPromises);
          historicalRecordsToUpsert.push(...resolvedChunk);
          await new Promise(r => setTimeout(r, 2000));
      }

      if (historicalRecordsToUpsert.length > 0) {
        console.log(`[ProfitabilitySync] Upserting ${historicalRecordsToUpsert.length} historical records...`);
        
        const batchSize = 100;
        for (let i = 0; i < historicalRecordsToUpsert.length; i += batchSize) {
          const batch = historicalRecordsToUpsert.slice(i, i + batchSize);
          await db.insert(profitabilityData)
            .values(batch)
            .onConflictDoUpdate({
              target: profitabilityData.projectNumber,
              set: {
                quotedProfit: sql`EXCLUDED.quoted_profit`,
                actualProfit: sql`EXCLUDED.actual_profit`,
                invoicedAmount: sql`EXCLUDED.invoiced_amount`,
                totalCost: sql`EXCLUDED.total_cost`,
                labourCost: sql`EXCLUDED.labour_cost`,
                materialsCost: sql`EXCLUDED.materials_cost`,
                purchasesCost: sql`EXCLUDED.purchases_cost`,
                estimatedLabourCost: sql`EXCLUDED.estimated_labour_cost`,
                estimatedMaterialsCost: sql`EXCLUDED.estimated_materials_cost`,
                estimatedTotalCost: sql`EXCLUDED.estimated_total_cost`,
                estimatedInvoicedAmount: sql`EXCLUDED.estimated_invoiced_amount`,
                completionDate: sql`EXCLUDED.completion_date`,
                isHistorical: sql`EXCLUDED.is_historical`,
                lastSyncedAt: sql`EXCLUDED.last_synced_at`,
              }
            });
          stats.historicalProcessed += batch.length;
        }
      }
      
      console.log(`[ProfitabilitySync] Sync complete. Active: ${stats.activeProcessed}, Historical: ${stats.historicalProcessed}`);
      return { success: true, stats };
      
    } catch (error) {
      console.error(`[ProfitabilitySync] Error:`, error);
      stats.errors += 1;
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', stats };
    }
  }
}
