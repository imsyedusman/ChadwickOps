"use server";

import { revalidatePath } from 'next/cache';
import { SyncService } from '@/lib/sync';
import { db } from '@/db';
import { systemConfig } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';

export async function handleSyncProject(workguruId: string) {
  console.log(`[Action] Triggering manual sync for WG ID: ${workguruId}`);

  try {
    // 1. Fetch credentials from DB
    const configRes = await db.select().from(systemConfig).where(eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS')).limit(1);
    const config = configRes[0];
    if (!config) throw new Error('API credentials not found');

    const { apiKey, apiSecret } = config.value as { apiKey: string, apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    // 2. Initialize SyncService with raw credentials (matching its constructor)
    const syncService = new SyncService(decryptedKey, decryptedSecret);

    // 3. Execute Sync
    const result = await syncService.syncProjectById(workguruId);
    
    if (!result) {
        throw new Error('Sync failed to return project details');
    }

    // 4. Revalidate path to refresh dashboard data
    revalidatePath('/dashboard');

    return { 
      success: true, 
      projectNumber: result.projectNumber,
      total: result.total 
    };
  } catch (error: any) {
    console.error(`[Action] Manual sync failed for ${workguruId}:`, error.message);
    return { success: false, error: error.message };
  }
}
