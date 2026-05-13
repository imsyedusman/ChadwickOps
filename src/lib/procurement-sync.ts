import { db } from '../db';
import { projects, purchaseOrders, purchaseOrderLines, procurementSyncLogs, systemConfig, procurementFailures } from '../db/schema';
import { WorkGuruClient, WorkGuruPurchaseOrder, WorkGuruPurchaseLine } from './workguru';
import { eq, sql, inArray, desc, and, notInArray, count } from 'drizzle-orm';

export class ProcurementSyncService {
  private client: WorkGuruClient;

  constructor(apiKey: string, apiSecret: string) {
    this.client = new WorkGuruClient(apiKey, apiSecret);
  }

  private async sleep(ms: number) {
    const jitter = Math.floor(Math.random() * 300);
    return new Promise(resolve => setTimeout(resolve, ms + jitter));
  }

  /**
   * Fast Initial Retries: 2s -> 5s -> 10s -> 20s
   */
  private async withRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 4, poInfo?: { id: string, number?: string }): Promise<T | null> {
    const retrySequence = [2000, 5000, 10000, 20000];
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const status = error.response?.status || error.status;
        const isRetryable = status === 429 || status === 503 || status === 504 || error.code === 'ECONNABORTED';
        
        if (isRetryable && attempt <= maxRetries) {
          const delay = retrySequence[attempt - 1];
          console.warn(`[ProcurementSync] ${status === 429 ? 'Rate limit' : 'Error'} on ${label}. Attempt ${attempt}/${maxRetries}. Waiting ${delay/1000}s...`);
          await this.sleep(delay);
          continue;
        }

        // Final failure - log to DB
        if (poInfo) {
            await this.logFailure({
                poId: poInfo.id,
                poNumber: poInfo.number,
                endpoint: label,
                httpStatus: status,
                retryCount: attempt - 1,
                errorMessage: error.message,
                responseSnippet: error.response?.data ? JSON.stringify(error.response.data).substring(0, 1000) : null,
                category: this.categorizeError(error)
            });
        }

        console.error(`[ProcurementSync] ${label} failed after ${attempt} attempts:`, error.message);
        return null;
      }
    }
    return null;
  }

  private parseDate(dateStr?: string | null): Date | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  public extractItems<T>(data: any, entityName: string): T[] {
    const result = data?.result;
    let items: T[] | undefined;
    if (Array.isArray(result)) items = result;
    else if (result && Array.isArray(result.items)) items = result.items;
    else if (data && Array.isArray(data.items)) items = data.items;

    if (!items) throw new Error(`Invalid response for ${entityName}`);
    return items;
  }

  async runSync(mode: 'INCREMENTAL' | 'FULL' | 'RETRY_FAILED' = 'INCREMENTAL') {
    const startTime = new Date();
    console.log(`[ProcurementSync] Starting ${mode} sync...`);

    const metrics = {
        totalFetched: 0,
        totalHydrated: 0,
        totalFailed: 0,
        totalSkipped: 0,
        retryCount: 0
    };

    try {
        const localProjects = await db.select({ id: projects.id, workguruId: projects.workguruId }).from(projects);
        const projectMap = new Map(localProjects.map(p => [p.workguruId, p.id]));

        let posToSync: WorkGuruPurchaseOrder[] = [];
        if (mode === 'FULL') {
            const data = await this.withRetry(() => this.client.getPurchaseOrders({ MaxResultCount: 5000, Sorting: 'CreationTime DESC' }), 'Fetch All POs');
            if (data) posToSync = this.extractItems<WorkGuruPurchaseOrder>(data, 'PurchaseOrder');
        } else if (mode === 'RETRY_FAILED') {
            const failedItems = await db.select({ 
                id: purchaseOrders.workguruId, 
                number: purchaseOrders.poNumber 
            })
            .from(purchaseOrders)
            .where(inArray(purchaseOrders.hydrationStatus, ['FAILED', 'SUMMARY_ONLY']));
            
            posToSync = failedItems.map(item => ({ 
                id: Number(item.id), 
                number: item.number 
            } as any));
            
            console.log(`[ProcurementSync] RETRY_FAILED mode: Found ${posToSync.length} items to retry.`);
        } else {
            const data = await this.withRetry(() => this.client.getPurchaseOrders({ MaxResultCount: 200, Sorting: 'LastModificationTime DESC' }), 'Fetch Recent POs');
            if (data) posToSync = this.extractItems<WorkGuruPurchaseOrder>(data, 'PurchaseOrder');
        }

        // Add any items from retry queue if in incremental mode
        if (mode === 'INCREMENTAL') {
            const queueConfig = await db.query.systemConfig.findFirst({ where: eq(systemConfig.key, 'PROCUREMENT_RETRY_QUEUE') });
            const queue = (queueConfig?.value as { id: string; number?: string }[]) || [];
            for (const item of queue) {
                if (!posToSync.find(p => (p.id || p.id_Internal || p.PurchaseOrderID)?.toString() === item.id)) {
                    posToSync.push({ id: Number(item.id), number: item.number } as any);
                    metrics.retryCount++;
                }
            }
        }

        metrics.totalFetched = posToSync.length;
        let processedCount = 0;
        let failedIds: { id: string; number?: string }[] = [];

        for (const remotePo of posToSync) {
            const poIdStr = (remotePo.id || remotePo.id_Internal || remotePo.PurchaseOrderID)?.toString();
            if (!poIdStr) continue;

            const listSupplierName = remotePo.supplierName || remotePo.SupplierName;
            const syncResult = await this.syncPurchaseOrder(poIdStr, remotePo.number, projectMap, listSupplierName);
            
            if (syncResult.status === 'HYDRATED') {
                metrics.totalHydrated++;
                processedCount++;
            } else if (syncResult.status === 'SKIPPED') {
                metrics.totalSkipped++;
            } else {
                metrics.totalFailed++;
                failedIds.push({ id: poIdStr, number: remotePo.number });
            }

            // Update Progress
            await this.updateProgress(processedCount + metrics.totalFailed, metrics.totalFetched, remotePo.number || 'Unknown');
        }

        // 3. Reconciliation Pass for transient failures (immediate retry)
        if (failedIds.length > 0) {
            console.log(`[ProcurementSync] Entering Reconciliation Pass for ${failedIds.length} items...`);
            const remainingFailed: { id: string; number?: string }[] = [];
            for (const item of failedIds) {
                const syncResult = await this.syncPurchaseOrder(item.id, item.number, projectMap);
                if (syncResult.status === 'HYDRATED') {
                    metrics.totalHydrated++;
                    metrics.totalFailed--;
                    processedCount++;
                } else {
                    remainingFailed.push(item);
                }
                await this.updateProgress(processedCount + remainingFailed.length, metrics.totalFetched, `Retry ${item.id}`);
            }
            failedIds = remainingFailed;
        }

        // 4. Update Retry Queue
        await this.handleFailedItems(failedIds);

        const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000);
        const status = metrics.totalFailed === 0 ? 'SUCCESS' : 'PARTIAL';
        const details = `Processed ${processedCount} POs. Hydrated: ${metrics.totalHydrated}. Failures: ${metrics.totalFailed}. Duration: ${duration}s. Mode: ${mode}.`;

        await db.insert(procurementSyncLogs).values({ 
            status, 
            details, 
            timestamp: new Date(),
            totalFetched: metrics.totalFetched,
            totalHydrated: metrics.totalHydrated,
            totalFailed: metrics.totalFailed,
            totalSkipped: metrics.totalSkipped,
            retryCount: metrics.retryCount
        });
        await db.delete(systemConfig).where(eq(systemConfig.key, 'PROCUREMENT_SYNC_PROGRESS'));

        return { success: status === 'SUCCESS', ...metrics, duration };

    } catch (error) {
        console.error('[ProcurementSync] Sync Failed:', error);
        await db.delete(systemConfig).where(eq(systemConfig.key, 'PROCUREMENT_SYNC_PROGRESS'));
        await db.insert(procurementSyncLogs).values({
            status: 'FAILURE',
            details: error instanceof Error ? error.message : String(error),
            timestamp: new Date()
        });
        throw error;
    }
  }

  private async syncPurchaseOrder(
    poIdStr: string, 
    poNumber: string | undefined, 
    projectMap: Map<string, number>, 
    listSupplierName?: string
  ): Promise<{ status: 'HYDRATED' | 'SUMMARY_ONLY' | 'FAILED' | 'SKIPPED' }> {
    try {
        if (poIdStr === '1196897') {
            console.log(`[DEBUG-BENCHMARK] Starting hydration for benchmark PO 1196897 (${poNumber})`);
        }

        // 1. Fetch Detail
        const detailData = await this.withRetry(
            () => this.client.getPurchaseOrderById(poIdStr), 
            `Fetch PO Detail ${poNumber || poIdStr}`,
            4,
            { id: poIdStr, number: poNumber }
        );
        
        // If we can't even get the detail, we at least want to track that this PO exists if we have basic info
        if (!detailData) {
            // Check if we already have it in DB
            const existing = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.workguruId, poIdStr) });
            if (!existing && poNumber) {
                // If it's new and we failed, we should still try to find which project it belongs to if possible
                // But without detail we don't know the projectId reliably unless we search all projects or it was in list?
                // Actually, the list fetch doesn't usually have projectId. 
                // So we'll have to mark it as FAILED and retry later.
                return { status: 'FAILED' };
            }
            return { status: 'FAILED' };
        }

        const detail = detailData.result || detailData;
        const sName = detail.supplierName || detail.SupplierName || detail.supplier?.name || detail.Supplier?.Name || listSupplierName || 'Unknown';
        const projectIdStr = detail.projectId?.toString();
        const localProjectId = projectIdStr ? projectMap.get(projectIdStr) : null;

        if (!localProjectId) {
            // PO exists but project not in our DB (likely archived or not synced yet)
            return { status: 'SKIPPED' };
        }

        // 2. Upsert PO Header
        const [dbPo] = await db.insert(purchaseOrders).values({
            workguruId: poIdStr,
            projectId: localProjectId,
            poNumber: poNumber || detail.number || detail.Number || 'Unknown',
            total: Number(detail.total || detail.Total || 0),
            status: detail.status || detail.Status || 'Approved',
            issueDate: this.parseDate(detail.issueDate || detail.IssueDate) || new Date(),
            receivedDate: this.parseDate(detail.receivedDate || detail.ReceivedDate),
            expectedDate: this.parseDate(detail.expectedDate || detail.ExpectedDate),
            supplierName: sName,
            hydrationStatus: 'SUMMARY_ONLY',
            updatedAt: new Date(),
        }).onConflictDoUpdate({
            target: purchaseOrders.workguruId,
            set: {
                poNumber: poNumber || detail.number || detail.Number || 'Unknown',
                total: Number(detail.total || detail.Total || 0),
                status: detail.status || detail.Status || 'Approved',
                issueDate: this.parseDate(detail.issueDate || detail.IssueDate) || new Date(),
                receivedDate: this.parseDate(detail.receivedDate || detail.ReceivedDate),
                expectedDate: this.parseDate(detail.expectedDate || detail.ExpectedDate),
                supplierName: sName,
                updatedAt: new Date(),
            }
        }).returning({ id: purchaseOrders.id });

        // 3. Sync Lines
        const remoteLines = detail.products || detail.purchaseOrderLineItems || [];
        const lineIdsToKeep = new Set<string>();

        if (remoteLines.length === 0) {
            // Strict check: if PO is NOT a draft/cancelled, it SHOULD have lines.
            const poStatus = (detail.status || detail.Status || '').toLowerCase();
            const shouldHaveLines = !['draft', 'cancelled', 'void'].includes(poStatus);
            
            if (shouldHaveLines) {
                console.error(`[ProcurementSync] PO ${poNumber || poIdStr} has 0 lines but status is ${poStatus}. Marking as FAILED.`);
                await this.logFailure({
                    poId: poIdStr,
                    poNumber: poNumber || detail.number,
                    endpoint: 'Line Hydration',
                    errorMessage: `Expected lines for status ${poStatus} but found 0.`,
                    category: 'EMPTY_LINES'
                });
                return { status: 'FAILED' };
            }
            console.warn(`[ProcurementSync] PO ${poNumber || poIdStr} has 0 lines (Status: ${poStatus}).`);
        }

        for (const remoteLine of remoteLines) {
            const lineIdStr = remoteLine.id?.toString();
            if (!lineIdStr) continue;
            lineIdsToKeep.add(lineIdStr);

            await db.insert(purchaseOrderLines).values({
                workguruId: lineIdStr,
                purchaseOrderId: dbPo.id,
                projectId: localProjectId,
                poNumber: poNumber || detail.number || detail.Number || 'Unknown',
                supplierName: sName,
                productId: remoteLine.productId || remoteLine.productID || null,
                name: remoteLine.name || remoteLine.Name || 'Unknown',
                description: remoteLine.description || remoteLine.Description || '',
                quantity: Number(remoteLine.quantity || remoteLine.Quantity || 0),
                receivedQuantity: Number(remoteLine.receivedQuantity || remoteLine.ReceivedQuantity || 0),
                invoicedQuantity: Number(remoteLine.invoicedQuantity || remoteLine.InvoicedQuantity || 0),
                unitPrice: Number(remoteLine.unitPrice || remoteLine.UnitPrice || remoteLine.unitAmount || remoteLine.UnitAmount || remoteLine.Price || 0),
                total: Number(remoteLine.total || remoteLine.Total || remoteLine.LineAmount || remoteLine.lineAmount || 0),
                updatedAt: new Date(),
            }).onConflictDoUpdate({
                target: purchaseOrderLines.workguruId,
                set: {
                    quantity: Number(remoteLine.quantity || remoteLine.Quantity || 0),
                    receivedQuantity: Number(remoteLine.receivedQuantity || remoteLine.ReceivedQuantity || 0),
                    invoicedQuantity: Number(remoteLine.invoicedQuantity || remoteLine.InvoicedQuantity || 0),
                    unitPrice: Number(remoteLine.unitPrice || remoteLine.UnitPrice || remoteLine.unitAmount || remoteLine.UnitAmount || remoteLine.Price || 0),
                    total: Number(remoteLine.total || remoteLine.Total || remoteLine.LineAmount || remoteLine.lineAmount || 0),
                    updatedAt: new Date(),
                }
            });
        }

        if (lineIdsToKeep.size > 0) {
            await db.delete(purchaseOrderLines)
                .where(and(
                    eq(purchaseOrderLines.purchaseOrderId, dbPo.id),
                    notInArray(purchaseOrderLines.workguruId, Array.from(lineIdsToKeep))
                ));
        }

        // 4. Finalize Hydration Status
        await db.update(purchaseOrders)
            .set({ hydrationStatus: 'HYDRATED', lastError: null, retryCount: 0 })
            .where(eq(purchaseOrders.id, dbPo.id));

        if (poIdStr === '1196897') {
            console.log(`[DEBUG-BENCHMARK] Successfully hydrated benchmark PO 1196897. Lines count: ${remoteLines.length}`);
        }

        await this.sleep(1500); // Respect rate-limit (60req/min) - increased to 1.5s
        return { status: 'HYDRATED' };
    } catch (err: any) {
        console.error(`[ProcurementSync] Failed to sync PO ${poNumber || poIdStr}:`, err.message);
        
        // If we have a record in DB, update its failure status
        const existing = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.workguruId, poIdStr) });
        if (existing) {
            await db.update(purchaseOrders)
                .set({ 
                    hydrationStatus: 'FAILED', 
                    lastError: err.message, 
                    retryCount: sql`${purchaseOrders.retryCount} + 1` 
                })
                .where(eq(purchaseOrders.id, existing.id));
        }
        
        return { status: 'FAILED' };
    }
  }


  private async updateProgress(current: number, total: number, lastPo: string) {
    await db.insert(systemConfig).values({
        key: 'PROCUREMENT_SYNC_PROGRESS',
        value: { current, total, percent: Math.round((current / total) * 100), lastPo },
        updatedAt: new Date()
    }).onConflictDoUpdate({
        target: systemConfig.key,
        set: { value: { current, total, percent: Math.round((current / total) * 100), lastPo }, updatedAt: new Date() }
    });
  }

  private async handleFailedItems(currentFailed: { id: string; number?: string }[]) {
    // 1. Load existing retry queue
    const queueConfig = await db.query.systemConfig.findFirst({ where: eq(systemConfig.key, 'PROCUREMENT_RETRY_QUEUE') });
    let queue = (queueConfig?.value as { id: string; number?: string; attempts: number }[]) || [];

    // 2. Load permanent failures (we still keep them, but maybe we don't retry them every time)
    const permConfig = await db.query.systemConfig.findFirst({ where: eq(systemConfig.key, 'PROCUREMENT_PERMANENT_FAILURES') });
    let permFailures = (permConfig?.value as string[]) || [];

    // 3. Update queue based on current failures
    // Items that failed this time should be added/updated in the queue
    for (const item of currentFailed) {
        const existingIdx = queue.findIndex(q => q.id === item.id);
        if (existingIdx >= 0) {
            queue[existingIdx].attempts = (queue[existingIdx].attempts || 0) + 1;
            // Move to permanent failure if too many attempts? 
            // The user said "DO NOT abandon it permanently after a few retries", 
            // so we'll increase the limit or just keep retrying less frequently.
            if (queue[existingIdx].attempts >= 10) {
                if (!permFailures.includes(item.id)) permFailures.push(item.id);
            }
        } else {
            queue.push({ id: item.id, number: item.number, attempts: 1 });
        }
    }

    // 4. Remove items that were NOT in the current failed list but ARE in the queue 
    // Wait, if they were in the queue but didn't fail this time, it means they SUCCEEDED this time.
    // However, we only know they succeeded if they were ATTEMPTED.
    // In runSync, we add all queue items to posToSync. 
    // So if they are not in currentFailed, they must have succeeded.
    const currentFailedIds = currentFailed.map(f => f.id);
    queue = queue.filter(q => currentFailedIds.includes(q.id));

    await db.insert(systemConfig).values({
        key: 'PROCUREMENT_RETRY_QUEUE',
        value: queue,
        updatedAt: new Date()
    }).onConflictDoUpdate({
        target: systemConfig.key,
        set: { value: queue, updatedAt: new Date() }
    });

    await db.insert(systemConfig).values({
        key: 'PROCUREMENT_PERMANENT_FAILURES',
        value: permFailures,
        updatedAt: new Date()
    }).onConflictDoUpdate({
        target: systemConfig.key,
        set: { value: permFailures, updatedAt: new Date() }
    });
  }

  private categorizeError(error: any): string {
      const status = error.response?.status || error.status;
      if (status === 429) return 'RATE_LIMIT';
      if (status === 401 || status === 403) return 'AUTH';
      if (status === 504 || error.code === 'ECONNABORTED' || error.message.includes('timeout')) return 'TIMEOUT';
      if (error.message.includes('Unexpected token') || error.message.includes('JSON')) return 'MALFORMED';
      if (error.message.includes('insert') || error.message.includes('database')) return 'DB_ERROR';
      return 'UNKNOWN';
  }

  private async logFailure(data: {
      poId: string,
      poNumber?: string,
      endpoint: string,
      httpStatus?: number,
      retryCount?: number,
      errorMessage?: string,
      responseSnippet?: string | null,
      category?: string
  }) {
      try {
          await db.insert(procurementFailures).values({
              poId: data.poId,
              poNumber: data.poNumber || null,
              endpoint: data.endpoint,
              httpStatus: data.httpStatus || null,
              retryCount: data.retryCount || 0,
              errorMessage: data.errorMessage || null,
              responseSnippet: data.responseSnippet || null,
              category: data.category || 'UNKNOWN',
              timestamp: new Date()
          });
      } catch (logErr) {
          console.error('[ProcurementSync] Failed to log failure to DB:', logErr);
      }
  }

}
