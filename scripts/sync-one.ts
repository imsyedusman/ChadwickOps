import { db } from '../src/db';
import { systemConfig } from '../src/db/schema';
import { decrypt } from '../src/lib/crypto';
import { ProcurementSyncService } from '../src/lib/procurement-sync';
import { eq } from 'drizzle-orm';

async function syncOne(id: string) {
    const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });
    if (!config) throw new Error('API Credentials not found');
    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    
    const service = new ProcurementSyncService(decrypt(apiKey), decrypt(apiSecret));
    
    // We need to simulate the projectMap
    const localProjects = await db.query.projects.findMany({ columns: { id: true, workguruId: true } });
    const projectMap = new Map(localProjects.map(p => [p.workguruId, p.id]));

    console.log(`Syncing PO ${id}...`);
    const result = await (service as any).syncPurchaseOrder(id, undefined, projectMap);
    console.log('Result:', JSON.stringify(result, null, 2));
}

syncOne('1196897').catch(console.error);
