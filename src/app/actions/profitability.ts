'use server';

import { db } from '@/db';
import { systemConfig } from '@/db/schema';
import { ProfitabilitySyncService } from '@/lib/profitability-sync';
import { decrypt } from '@/lib/crypto';
import { eq } from 'drizzle-orm';
import { WorkGuruClient } from '@/lib/workguru';
import { revalidatePath } from 'next/cache';
import { validateSession } from '@/lib/auth-helpers';

export async function triggerProfitabilitySync() {
  const session = await validateSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const config = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config || !config.value) {
      throw new Error('WorkGuru API Credentials not configured');
    }

    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    const syncService = new ProfitabilitySyncService(decryptedKey, decryptedSecret);
    const result = await syncService.runSync();
    
    if (result.success) {
      revalidatePath('/profitability');
      return { success: true, stats: result.stats };
    } else {
      return { success: false, error: result.error, stats: result.stats };
    }
  } catch (error) {
    console.error(`[ProfitabilitySync Action] Error:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getLiveProjectDetails(workguruId: string) {
  const session = await validateSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const config = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config || !config.value) {
      throw new Error('WorkGuru API Credentials not configured');
    }

    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);
    const client = new WorkGuruClient(decryptedKey, decryptedSecret);

    console.log(`[Drawer] Fetching live details for ${workguruId}`);
    
    // Attempt to fetch details and tasks in parallel
    const [detailsResp, tasksResp] = await Promise.all([
      client.getProjectDetails(workguruId).catch(e => {
        console.warn(`[Drawer] Failed to get Project details:`, e.message);
        return { result: null };
      }),
      client.getProjectTasks(workguruId).catch(e => {
        console.warn(`[Drawer] Failed to get Project tasks:`, e.message);
        return { result: { items: [] } };
      })
    ]);

    const details = detailsResp?.result || {};
    const tasks = Array.isArray(tasksResp?.result) ? tasksResp.result : 
                  Array.isArray(tasksResp) ? tasksResp : 
                  (tasksResp?.result?.items || tasksResp?.items || []);
    
    let completedTasks = 0;

    tasks.forEach((t: any) => {
        if (t.status === 'Completed' || t.Status === 'Completed' || t.status === 'Closed' || t.Status === 'Closed') {
            completedTasks++;
        }
    });

    return {
      success: true,
      data: {
        totalInvoiced: Number(details.totalInvoiced) || 0,
        totalCost: Number(details.cost) || 0,
        costTime: Number(details.taskCosts) || 0,
        costMaterials: Number(details.productCosts) || 0,
        costPurchases: Number(details.purchaseCosts) || 0,
        grossTotal: Number(details.total) || 0,
        supplierCredits: Number(details.supplierCreditNotes) || 0, // Assuming it might be here
        wipValue: Number(details.wipByActual) || 0,
        
        totalTasks: tasks.length,
        completedTasks,
        totalBudgetHours: Number(details.forecastTime) || 0,
        totalActualHours: Number(details.totalTime) || 0,
      }
    };

  } catch (error) {
    console.error(`[Drawer Action] Error:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

