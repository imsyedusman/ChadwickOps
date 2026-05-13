'use server';

import { db } from '@/db';
import { systemConfig, procurementSyncLogs, purchaseOrders } from '@/db/schema';
import { ProcurementSyncService } from '@/lib/procurement-sync';
import { decrypt } from '@/lib/crypto';
import { eq, desc, inArray, count } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function triggerProcurementSync(mode: 'INCREMENTAL' | 'FULL' | 'RETRY_FAILED' = 'INCREMENTAL') {
  try {
    const config = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config) {
      throw new Error('WorkGuru API Credentials not configured');
    }

    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    const syncService = new ProcurementSyncService(decryptedKey, decryptedSecret);
    const result = await syncService.runSync(mode);
    
    revalidatePath('/procurement');
    return { success: true, mode, stats: result };
  } catch (error) {
    console.error(`Procurement Sync error:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getLatestProcurementSyncStatus() {
  try {
    const latestLog = await db.query.procurementSyncLogs.findFirst({
      orderBy: [desc(procurementSyncLogs.timestamp)],
    });
    
    const integrityStats = await db.select({
        status: purchaseOrders.hydrationStatus,
        count: count()
    }).from(purchaseOrders).where(inArray(purchaseOrders.hydrationStatus, ['FAILED', 'SUMMARY_ONLY'])).groupBy(purchaseOrders.hydrationStatus);

    const summaryOnlyCount = Number(integrityStats.find(s => s.status === 'SUMMARY_ONLY')?.count || 0);
    const failedCount = Number(integrityStats.find(s => s.status === 'FAILED')?.count || 0);

    return { 
        success: true, 
        data: latestLog,
        stats: {
            summaryOnlyCount,
            failedCount
        }
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getProcurementSyncProgress() {
  try {
    const config = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'PROCUREMENT_SYNC_PROGRESS'),
    });
    
    if (!config) return { success: true, active: false };
    
    return { 
      success: true, 
      active: true, 
      progress: config.value as { current: number; total: number; percent: number; lastPo: string } 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
