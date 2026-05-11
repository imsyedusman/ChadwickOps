import { db } from '@/db';
import { projects, purchaseOrders, purchaseOrderLines, procurementSyncLogs, systemConfig } from '@/db/schema';
import { WorkGuruClient, WorkGuruPurchaseOrder, WorkGuruPurchaseLine } from './workguru';
import { eq, sql, inArray, desc, and, notInArray } from 'drizzle-orm';

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
  private async withRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 4): Promise<T | null> {
    const retrySequence = [2000, 5000, 10000, 20000];
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const status = error.response?.status || error.status;
        const isRetryable = status === 429 || status === 503;
        
        if (isRetryable && attempt <= maxRetries) {
          const delay = retrySequence[attempt - 1];
          console.warn(`[ProcurementSync] ${status === 429 ? 'Rate limit' : 'Error'} on ${label}. Attempt ${attempt}/${maxRetries}. Waiting ${delay/1000}s...`);
          await this.sleep(delay);
          continue;
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

  async runSync(mode: 'INCREMENTAL' | 'FULL' = 'INCREMENTAL') {
    const startTime = new Date();
    console.log(`[ProcurementSync] Starting ${mode} sync...`);

    try {
        const localProjects = await db.select({ id: projects.id, workguruId: projects.workguruId }).from(projects);
        const projectMap = new Map(localProjects.map(p => [p.workguruId, p.id]));

        let posToSync: WorkGuruPurchaseOrder[] = [];
        if (mode === 'FULL') {
            const data = await this.withRetry(() => this.client.getPurchaseOrders({ MaxResultCount: 5000, Sorting: 'CreationTime DESC' }), 'Fetch All POs');
            if (data) posToSync = this.extractItems<WorkGuruPurchaseOrder>(data, 'PurchaseOrder');
        } else {
            const data = await this.withRetry(() => this.client.getPurchaseOrders({ MaxResultCount: 200, Sorting: 'LastModificationTime DESC' }), 'Fetch Recent POs');
            if (data) posToSync = this.extractItems<WorkGuruPurchaseOrder>(data, 'PurchaseOrder');
        }

        const totalToProcess = posToSync.length;
        let processedCount = 0;
        let lineCount = 0;
        let failedIds: string[] = [];

        for (const remotePo of posToSync) {
            const poIdStr = (remotePo.id || remotePo.id_Internal || remotePo.PurchaseOrderID)?.toString();
            if (!poIdStr) continue;

            const listSupplierName = remotePo.supplierName || remotePo.SupplierName;
            const success = await this.syncPurchaseOrder(poIdStr, remotePo.number, projectMap, listSupplierName);
            if (success) {
                processedCount++;
            } else {
                failedIds.push(poIdStr);
            }

            // Update Progress
            await this.updateProgress(processedCount + failedIds.length, totalToProcess, remotePo.number || 'Unknown');
        }

        // 3. Reconciliation Pass for transient failures
        if (failedIds.length > 0) {
            console.log(`[ProcurementSync] Entering Reconciliation Pass for ${failedIds.length} items...`);
            const remainingFailed: string[] = [];
            for (const id of failedIds) {
                const success = await this.syncPurchaseOrder(id, `RETRY-${id}`, projectMap);
                if (success) processedCount++;
                else remainingFailed.push(id);
                await this.updateProgress(processedCount + remainingFailed.length, totalToProcess, `Retry ${id}`);
            }
            failedIds = remainingFailed;
        }

        // 4. Update Retry Queue and Permanent Failures
        await this.handleFailedItems(failedIds);

        const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000);
        const status = failedIds.length === 0 ? 'SUCCESS' : 'PARTIAL';
        const details = `Processed ${processedCount} POs. Failures: ${failedIds.length}. Duration: ${duration}s. Mode: ${mode}.`;

        await db.insert(procurementSyncLogs).values({ status, details, timestamp: new Date() });
        await db.delete(systemConfig).where(eq(systemConfig.key, 'PROCUREMENT_SYNC_PROGRESS'));

        return { success: status === 'SUCCESS', processedCount, failedCount: failedIds.length, duration };

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

  private async syncPurchaseOrder(poIdStr: string, poNumber: string | undefined, projectMap: Map<string, number>, listSupplierName?: string): Promise<boolean> {
    try {
        const detailData = await this.withRetry(() => this.client.getPurchaseOrderById(poIdStr), `Fetch PO Detail ${poNumber || poIdStr}`);
        if (!detailData) return false;

        const detail = detailData.result || detailData;
        
        const sName = detail.supplierName || detail.SupplierName || detail.supplier?.name || detail.Supplier?.Name || listSupplierName || 'Unknown';
        
        if (sName === 'Unknown') {
            console.log(`[ProcurementSync] WARNING: Could not find supplier name for PO ${poIdStr}. Raw keys:`, Object.keys(detail));
        }

        const projectIdStr = detail.projectId?.toString();
        const localProjectId = projectIdStr ? projectMap.get(projectIdStr) : null;

        if (localProjectId) {
            const [dbPo] = await db.insert(purchaseOrders).values({
                workguruId: poIdStr,
                projectId: localProjectId,
                total: Number(detail.total || detail.Total || 0),
                status: detail.status || detail.Status || 'Approved',
                issueDate: this.parseDate(detail.issueDate || detail.IssueDate) || new Date(),
                receivedDate: this.parseDate(detail.receivedDate || detail.ReceivedDate),
                expectedDate: this.parseDate(detail.expectedDate || detail.ExpectedDate),
                supplierName: sName,
                updatedAt: new Date(),
            }).onConflictDoUpdate({
                target: purchaseOrders.workguruId,
                set: {
                    total: Number(detail.total || detail.Total || 0),
                    status: detail.status || detail.Status || 'Approved',
                    issueDate: this.parseDate(detail.issueDate || detail.IssueDate) || new Date(),
                    receivedDate: this.parseDate(detail.receivedDate || detail.ReceivedDate),
                    expectedDate: this.parseDate(detail.expectedDate || detail.ExpectedDate),
                    supplierName: sName,
                    updatedAt: new Date(),
                }
            }).returning({ id: purchaseOrders.id });

            const remoteLines = detail.products || detail.purchaseOrderLineItems || [];
            const lineIdsToKeep = new Set<string>();

            for (const remoteLine of remoteLines) {
                const lineIdStr = remoteLine.id?.toString();
                if (!lineIdStr) continue;
                lineIdsToKeep.add(lineIdStr);

                await db.insert(purchaseOrderLines).values({
                    workguruId: lineIdStr,
                    purchaseOrderId: dbPo.id,
                    projectId: localProjectId,
                    poNumber: poNumber || 'Unknown',
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
        }
        await this.sleep(300); // Small rate-limit protection
        return true;
    } catch (err) {
        return false;
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

  private async handleFailedItems(failedIds: string[]) {
    if (failedIds.length === 0) {
        await db.delete(systemConfig).where(eq(systemConfig.key, 'PROCUREMENT_RETRY_QUEUE'));
        return;
    }

    // Load existing retry queue
    const queueConfig = await db.query.systemConfig.findFirst({ where: eq(systemConfig.key, 'PROCUREMENT_RETRY_QUEUE') });
    let queue = (queueConfig?.value as { id: string; attempts: number }[]) || [];

    // Load permanent failures
    const permConfig = await db.query.systemConfig.findFirst({ where: eq(systemConfig.key, 'PROCUREMENT_PERMANENT_FAILURES') });
    let permFailures = (permConfig?.value as string[]) || [];

    const newQueue: { id: string; attempts: number }[] = [];

    for (const id of failedIds) {
        const existing = queue.find(q => q.id === id);
        const attempts = (existing?.attempts || 0) + 1;

        if (attempts >= 5) {
            if (!permFailures.includes(id)) permFailures.push(id);
        } else {
            newQueue.push({ id, attempts });
        }
    }

    // Carry over remaining items in queue that weren't in this sync's failed list (if any)
    for (const item of queue) {
        if (!failedIds.includes(item.id) && !permFailures.includes(item.id)) {
            // This item was in queue but wasn't attempted this sync? Keep it.
        }
    }

    await db.insert(systemConfig).values({
        key: 'PROCUREMENT_RETRY_QUEUE',
        value: newQueue,
        updatedAt: new Date()
    }).onConflictDoUpdate({
        target: systemConfig.key,
        set: { value: newQueue, updatedAt: new Date() }
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
}
