import { ProcurementSyncService } from './src/lib/procurement-sync';

import { db } from './src/db';
import { eq } from 'drizzle-orm';
import { systemConfig } from './src/db/schema';
import { decrypt } from './src/lib/crypto';

async function runProcurementSync() {
    console.log("--- Manually Triggering Procurement Sync ---");
    
    const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config) throw new Error('API Credentials not found');
    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    
    const service = new ProcurementSyncService(
        decrypt(apiKey),
        decrypt(apiSecret)
    );
    
    // We'll sync just a few recent ones to see the logs
    await service.runSync('INCREMENTAL');
    console.log("Sync Complete.");
}

runProcurementSync().catch(console.error);
