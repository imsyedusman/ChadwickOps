import { db } from './src/db';
import { eq, desc } from 'drizzle-orm';
import { systemConfig, purchaseOrderLines, purchaseOrders } from './src/db/schema';
import { decrypt } from './src/lib/crypto';
import { ProcurementSyncService } from './src/lib/procurement-sync';

async function verifyProcurementSync() {
    console.log('--- Procurement Sync Verification ---');

    const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config) throw new Error('API Credentials not found');
    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    
    const syncService = new ProcurementSyncService(decrypt(apiKey), decrypt(apiSecret));

    console.log('\n1. Triggering Incremental Sync...');
    const result = await syncService.runSync('INCREMENTAL');
    console.log('Sync Result:', result);

    console.log('\n2. Verifying Purchase Order Lines in DB...');
    const lines = await db.select().from(purchaseOrderLines).limit(10);
    console.table(lines.map(l => ({
        id: l.workguruId,
        po: l.poNumber,
        prod: l.name,
        qty: l.quantity,
        rec: l.receivedQuantity,
        out: l.quantity - l.receivedQuantity,
        proj: l.projectId
    })));

    console.log('\n3. Verifying PO Headers (Expected Dates)...');
    const pos = await db.select().from(purchaseOrders).where(eq(purchaseOrders.status, 'Approved')).limit(5);
    console.table(pos.map(p => ({
        id: p.workguruId,
        status: p.status,
        expected: p.expectedDate,
        total: p.total
    })));

    console.log('\n--- Verification Complete ---');
}

verifyProcurementSync().catch(console.error);
