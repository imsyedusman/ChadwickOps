import { db } from '@/db';
import { invoices, projects } from '@/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { WorkGuruClient } from './workguru';
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { SYDNEY_TZ } from './reports';

export class InvoiceSyncService {
  private client: WorkGuruClient;

  constructor(apiKey: string, apiSecret: string) {
    this.client = new WorkGuruClient(apiKey, apiSecret);
  }

  /**
   * Syncs invoices for a rolling window globally.
   * Fetches the current month and the previous `monthsBack` months.
   */
  public async runSync(monthsBack = 3) {
    const startTime = new Date();
    console.log('[InvoiceSync] Starting global invoice sync...');

    const stats = {
      fetched: 0,
      upserted: 0,
      skipped: 0,
      deleted: 0,
    };

    try {
      // 1. Calculate Date Range (Sydney Time)
      const nowSydney = toZonedTime(new Date(), SYDNEY_TZ);
      const startDate = startOfMonth(subMonths(nowSydney, monthsBack));
      const endDate = endOfMonth(nowSydney);

      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      console.log(`[InvoiceSync] Fetching invoices from ${startStr} to ${endStr}`);

      // 2. Fetch from WorkGuru Global Endpoint
      const response = await this.client.getInvoicesByDateRange(startStr, endStr);
      const items: any[] = response?.result || [];
      stats.fetched = items.length;

      if (items.length === 0) {
        console.log('[InvoiceSync] No invoices found in this period.');
        return stats;
      }

      // 3. Build Project Lookup Map
      // We need to map ProjectNo (e.g., "12426-01") to our local database projects.id
      const allProjects = await db.select({ id: projects.id, projectNumber: projects.projectNumber }).from(projects);
      const projectMap = new Map<string, number>();
      const groupMap = new Map<string, number>();

      for (const p of allProjects) {
        if (p.projectNumber) {
          const num = p.projectNumber.trim().toLowerCase();
          projectMap.set(num, p.id);

          const parts = num.split('-');
          if (parts.length > 1) {
             const group = parts[0];
             if (parts[1] === '01' || !groupMap.has(group)) {
                 groupMap.set(group, p.id);
             }
          }
        }
      }

      // 4. Prepare Upserts
      const upserts = [];

      for (const item of items) {
        let localProjectId: number | undefined;
        
        const projectNo = item.ProjectNo?.toString().trim().toLowerCase();
        if (projectNo) {
           localProjectId = projectMap.get(projectNo);
        }

        if (!localProjectId) {
           const rawGroupName = item.ProjectGroupName?.toString().trim().toLowerCase() || '';
           const groupParts = rawGroupName.split(/\s|-/); // Split by space or hyphen
           const groupNumber = groupParts[0]; // e.g. '12290'
           if (groupNumber) {
               localProjectId = groupMap.get(groupNumber);
           }
        }

        if (!localProjectId) {
          // If we don't have the project locally at all, skip it safely.
          stats.skipped++;
          continue;
        }

        const workguruId = item.Id?.toString();
        if (!workguruId) {
          stats.skipped++;
          continue;
        }

        // Parse Date safely (Pivot report provides a clean ISO 'Date' field like '2026-05-01')
        const issueDateStr = item.Date || item.IssueDate;
        let issueDate = new Date();
        if (item.Date) {
           issueDate = new Date(item.Date);
        } else {
           // Fallback if 'Date' doesn't exist but 'IssueDate' does
           const finalTry = new Date(issueDateStr);
           if (!isNaN(finalTry.getTime())) {
               issueDate = finalTry;
           }
        }

        const total = Number(item.Total) || 0;
        const status = item.Status || 'Draft';
        const invoiceNumber = item.InvoiceNumber || null;

        upserts.push({
          workguruId,
          invoiceNumber,
          projectId: localProjectId,
          total,
          status,
          issueDate,
          updatedAt: new Date(),
        });
      }

      console.log(`[InvoiceSync] Found ${upserts.length} invoices matching local projects. Upserting...`);

      // 5. Batch Upsert
      if (upserts.length > 0) {
        // We chunk the upserts to avoid running into pg parameter limits if there are thousands of invoices
        const CHUNK_SIZE = 500;
        for (let i = 0; i < upserts.length; i += CHUNK_SIZE) {
          const chunk = upserts.slice(i, i + CHUNK_SIZE);
          
          await db.transaction(async (tx) => {
            for (const row of chunk) {
              await tx.insert(invoices).values(row).onConflictDoUpdate({
                target: invoices.workguruId,
                set: {
                  invoiceNumber: row.invoiceNumber,
                  total: row.total,
                  status: row.status,
                  issueDate: row.issueDate,
                  updatedAt: new Date(),
                }
              });
            }
          });
          stats.upserted += chunk.length;
        }
      }
      
      // 6. Cleanup Ghost Invoices
      // Find invoices in the DB that fall within our date window but are NOT in the fetched items list.
      const validWorkguruIds = Array.from(new Set(upserts.map(u => u.workguruId)));
      
      const dbInvoices = await db.select({ id: invoices.id, workguruId: invoices.workguruId })
        .from(invoices)
        .where(
          and(
            sql`issue_date >= ${startStr}::date`,
            sql`issue_date <= ${endStr}::date`
          )
        );

      const ghostIds = dbInvoices
        .filter(inv => inv.workguruId && !validWorkguruIds.includes(inv.workguruId))
        .map(inv => inv.id);

      if (ghostIds.length > 0) {
        console.log(`[InvoiceSync] Found ${ghostIds.length} ghost invoices. Deleting...`);
        const CHUNK_SIZE = 100;
        for (let i = 0; i < ghostIds.length; i += CHUNK_SIZE) {
            const chunk = ghostIds.slice(i, i + CHUNK_SIZE);
            await db.delete(invoices).where(inArray(invoices.id, chunk));
        }
        stats.deleted = ghostIds.length;
      }
      
      console.log(`[InvoiceSync] Completed successfully. Fetched: ${stats.fetched}, Upserted: ${stats.upserted}, Skipped: ${stats.skipped}, Deleted: ${stats.deleted}`);
    } catch (error) {
      console.error('[InvoiceSync] Fatal error:', error);
      throw error;
    }

    return stats;
  }
}
