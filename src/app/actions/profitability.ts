'use server';

import { db } from '@/db';
import { systemConfig } from '@/db/schema';
import { ProfitabilitySyncService } from '@/lib/profitability-sync';
import { decrypt } from '@/lib/crypto';
import { eq } from 'drizzle-orm';
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
