import { SyncService } from './src/lib/sync';
import { db } from './src/db';
import { systemConfig } from './src/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from './src/lib/crypto';
import * as dotenv from 'dotenv';

// Manually load env since we'll run with tsx but might not have --env-file in some environments
// or just use process.env which will be populated by --env-file if we use it.

async function runSync() {
    console.log('=== RUNNING FULL SYNC FOR VERIFICATION ===');
    try {
        const config = await db.query.systemConfig.findFirst({
            where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
        });

        if (!config) {
            console.error('No API credentials found');
            return;
        }

        const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
        const decryptedKey = decrypt(apiKey);
        const decryptedSecret = decrypt(apiSecret);

        const syncService = new SyncService(decryptedKey, decryptedSecret);
        
        console.log('Step 1: Running Quick Sync (mode: QUICK)...');
        // runSync handles fetching projects and passing them to syncProjects correctly
        const result = await syncService.runSync('QUICK');
        console.log('Quick Sync Result:', JSON.stringify(result, null, 2));

        console.log('\nStep 2: Processing Deep Sync Queue (Enrichment)...');
        // We might need to manually trigger enrichment for the projects we care about 
        // to avoid waiting for the whole queue.
        await syncService.runDeepSyncQueue();
        console.log('Deep Sync complete.');

    } catch (error: any) {
        console.error('Sync failed:', error.message);
    } finally {
        process.exit(0);
    }
}

runSync();
