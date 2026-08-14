import { db } from '@/db';
import { profitabilityData, projects } from '@/db/schema';
import { WorkGuruClient } from './workguru';
import { sql, inArray } from 'drizzle-orm';

export class ProfitabilitySyncService {
  private client: WorkGuruClient;

  constructor(apiKey: string, apiSecret: string) {
    this.client = new WorkGuruClient(apiKey, apiSecret);
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
      const activeResponse = await this.client.getProjectProfitSummary(tenYearsAgo, now);
      const activeItems = this.extractItems<any>(activeResponse, 'ProjectProfitSummary');
      
      // Get local projects to filter only those that exist in our WIP sync
      const localProjects = await db.query.projects.findMany({
        columns: { projectNumber: true, id: true }
      });
      const localProjectNumbers = new Set(localProjects.map(p => p.projectNumber));
      
        const activeRecordsToUpsert = activeItems
        .filter(item => item.ProjectNo && localProjectNumbers.has(item.ProjectNo))
        .map(item => ({
          projectNumber: item.ProjectNo,
          quotedProfit: item.ForecastDollarProfit ? Number(item.ForecastDollarProfit) : 0,
          actualProfit: item.DollarProfit ? Number(item.DollarProfit) : 0,
          completionDate: null, // Active projects usually aren't completed
          isHistorical: false,
          lastSyncedAt: new Date()
        }));

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
                completionDate: sql`EXCLUDED.completion_date`,
                isHistorical: sql`EXCLUDED.is_historical`,
                lastSyncedAt: sql`EXCLUDED.last_synced_at`,
              }
            });
          stats.activeProcessed += batch.length;
        }
      }

      // 2. Fetch Historical Projects
      const fyStart = this.getAuFyStart();
      console.log(`[ProfitabilitySync] Fetching historical projects from WorkGuru (Start: ${fyStart})...`);
      
      const historicalResponse = await this.client.getAllProjectsCompletedInDateRange(fyStart, now);
      const historicalItems = this.extractItems<any>(historicalResponse, 'CompletedProjects');
      
      const historicalRecordsToUpsert = historicalItems
        .filter(item => item.ProjectNo)
        .map(item => {
          // Quoted Profit = Total - ForecastCost
          // Actual Profit = Total - TotalCost
          const total = Number(item.Total) || 0;
          const forecastCost = Number(item.ForecastCost) || 0;
          const totalCost = Number(item.TotalCost) || 0;
          
          const quotedProfit = total - forecastCost;
          const actualProfit = total - totalCost;
          
          let completionDate = null;
          if (item.ISOCompletedDate) {
              completionDate = new Date(item.ISOCompletedDate);
          } else if (item.CompletedDate && item.CompletedDate !== 'N/A') {
              // try to parse DD/MM/YYYY if format is like that
              const parts = item.CompletedDate.split('/');
              if (parts.length === 3) {
                  completionDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
              }
          }
          
          return {
            projectNumber: item.ProjectNo,
            quotedProfit: quotedProfit,
            actualProfit: actualProfit,
            completionDate: completionDate && !isNaN(completionDate.getTime()) ? completionDate : null,
            isHistorical: true,
            lastSyncedAt: new Date()
          };
        });

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
