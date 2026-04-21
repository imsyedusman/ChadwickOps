'use server';

import { db } from '@/db';
import { systemConfig, syncLogs } from '@/db/schema';
import { SyncService } from '@/lib/sync';
import { WorkGuruClient } from '@/lib/workguru';
import { encrypt, decrypt } from '@/lib/crypto';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { StageService } from '@/lib/stages';

export async function triggerSync() {
  return handleSync();
}

export async function triggerFullSync() {
  return handleSync();
}

async function handleSync() {
  const mode = 'FULL';
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

    const syncService = new SyncService(decryptedKey, decryptedSecret);
    const result = await syncService.runSync(mode);
    
    revalidatePath('/');
    return { success: true, mode, stats: result.stats };
  } catch (error) {
    console.error(`WorkGuru Sync error:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function testApiConnection(apiKey: string, apiSecret: string) {
  console.log('[SyncAction] Testing Connection...');
  try {
    const client = new WorkGuruClient(apiKey, apiSecret);
    await client.authenticate();
    
    return { 
      success: true, 
      message: "Connection successful!",
      details: "Token received. Credentials validated."
    };
  } catch (error: any) {
    console.error('[SyncAction] Test Connection failed:', error.status, error.apiMessage || error.message);
    
    // Explicitly check for our custom auth error message or status
    const isAuthError = error.status === 401 || error.status === 403 || error.message?.includes('Authentication failed');
    
    if (isAuthError) {
      return { 
        success: false, 
        error: "Authentication failed. Please check API Key and Secret.",
        details: error.apiMessage || error.message
      };
    }
    
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout') || error.message?.includes('Network Error')) {
      return { 
        success: false, 
        error: "Unable to reach WorkGuru API. Please check your internet connection.",
        details: "Network timeout or connection refused."
      };
    }

    return { 
      success: false, 
      error: "Invalid response from WorkGuru API.",
      details: error.apiMessage || error.message || "Unknown communication error."
    };
  }
}

export async function updateApiCredentials(apiKey: string, apiSecret: string) {
  try {
    // Validate credentials BEFORE saving
    const testResult = await testApiConnection(apiKey, apiSecret);
    if (!testResult.success) {
      return testResult;
    }

    const encryptedKey = encrypt(apiKey);
    const encryptedSecret = encrypt(apiSecret);

    await db.insert(systemConfig).values({
      key: 'WORKGURU_API_CREDENTIALS',
      value: { apiKey: encryptedKey, apiSecret: encryptedSecret },
    }).onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: { apiKey: encryptedKey, apiSecret: encryptedSecret }, updatedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function initializeSystem() {
  const stageService = new StageService();
  await stageService.seedDefaultStages();
  await stageService.seedDefaultMappings();
  return { success: true };
}

export async function getLatestSyncStatus() {
  try {
    const latestLog = await db.query.syncLogs.findFirst({
      orderBy: [desc(syncLogs.timestamp)],
    });
    return { success: true, data: latestLog };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getSyncProgress() {
  try {
    const config = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'SYNC_PROGRESS'),
    });
    
    if (!config) return { success: true, active: false };
    
    return { 
      success: true, 
      active: true, 
      progress: config.value as { processed: number; total: number; mode: string } 
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
