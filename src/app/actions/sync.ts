'use server';

import { db } from '@/db';
import { systemConfig, syncLogs } from '@/db/schema';
import { SyncService } from '@/lib/sync';
import { encrypt, decrypt } from '@/lib/crypto';
import { eq } from 'drizzle-orm';
import { StageService } from '@/lib/stages';

export async function triggerSync() {
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
    await syncService.runFullSync();
    
    return { success: true };
  } catch (error) {
    console.error('Sync error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateApiCredentials(apiKey: string, apiSecret: string) {
  try {
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
