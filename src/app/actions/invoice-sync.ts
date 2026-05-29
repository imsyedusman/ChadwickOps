'use server';

import { db } from '@/db';
import { systemConfig } from '@/db/schema';
import { invoiceSyncLogs } from '@/db/schema';
import { InvoiceSyncService } from '@/lib/invoice-sync';
import { decrypt } from '@/lib/crypto';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { validateSession } from '@/lib/auth-helpers';

export async function triggerInvoiceSync() {
  const session = await validateSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

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

    const syncService = new InvoiceSyncService(decryptedKey, decryptedSecret);
    
    // Run for 3 months back by default
    const stats = await syncService.runSync(3);
    
    // Log the sync result to the dedicated table (assuming it's created in schema.ts)
    await db.insert(invoiceSyncLogs).values({
      status: 'SUCCESS',
      totalFetched: stats.fetched,
      totalUpserted: stats.upserted,
      details: `Skipped ${stats.skipped} invoices not matching local projects.`,
    });

    revalidatePath('/');
    return { success: true, stats };
  } catch (error) {
    console.error(`[InvoiceSyncAction] Error:`, error);
    
    // Try to log the failure
    try {
        await db.insert(invoiceSyncLogs).values({
            status: 'FAILURE',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    } catch (e) {
        // Ignore logging error if table isn't ready
    }

    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getLatestInvoiceSyncStatus() {
  const session = await validateSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const latestLog = await db.query.invoiceSyncLogs.findFirst({
      orderBy: [desc(invoiceSyncLogs.timestamp)],
    });
    return { success: true, data: latestLog };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
