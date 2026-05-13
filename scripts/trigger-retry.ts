import { db } from '../src/db';
import { systemConfig } from '../src/db/schema';
import { decrypt } from '../src/lib/crypto';
import { ProcurementSyncService } from '../src/lib/procurement-sync';
import { eq } from 'drizzle-orm';

async function runRetry() {
    const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });
    if (!config) throw new Error('API Credentials not found');
    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    
    const service = new ProcurementSyncService(decrypt(apiKey), decrypt(apiSecret));
    console.log('Starting RETRY_FAILED sync...');
    const result = await service.runSync('RETRY_FAILED');
    console.log('Final Result:', JSON.stringify(result, null, 2));
}

runRetry().catch(console.error);
