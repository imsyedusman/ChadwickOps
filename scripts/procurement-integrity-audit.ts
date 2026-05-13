import { db } from '../src/db';
import { purchaseOrders, purchaseOrderLines, systemConfig } from '../src/db/schema';
import { decrypt } from '../src/lib/crypto';
import { WorkGuruClient } from '../src/lib/workguru';
import { eq, sql } from 'drizzle-orm';

async function runAudit() {
    console.log('--- PROCUREMENT DATA INTEGRITY AUDIT ---');
    console.log('Timestamp:', new Date().toISOString());

    // 1. Setup API Client
    const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });
    if (!config) throw new Error('API Credentials not found');
    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const client = new WorkGuruClient(decrypt(apiKey), decrypt(apiSecret));

    // 2. Fetch Remote Counts
    console.log('\nFetching remote data from WorkGuru...');
    const remotePoData = await client.getPurchaseOrders({ MaxResultCount: 5000 });
    const remotePOs = remotePoData?.result?.items || remotePoData?.items || [];
    
    console.log(`Remote PO Count: ${remotePOs.length}`);

    // 3. Fetch Local Counts
    console.log('\nFetching local data from Database...');
    const localPOCount = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders);
    const localLineCount = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrderLines);
    const incompleteHydration = await db.select({ count: sql<number>`count(*)` })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.hydrationStatus, 'SUMMARY_ONLY'));
    const failedHydration = await db.select({ count: sql<number>`count(*)` })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.hydrationStatus, 'FAILED'));

    console.log(`Local PO Count: ${localPOCount[0].count}`);
    console.log(`Local Line Count: ${localLineCount[0].count}`);
    console.log(`POs awaiting hydration: ${incompleteHydration[0].count}`);
    console.log(`POs with failed hydration: ${failedHydration[0].count}`);

    // 4. Detailed Analysis
    const remotePoIds = new Set<string>(
        remotePOs
            .map((p: any) => (p.id || p.id_Internal || p.PurchaseOrderID)?.toString())
            .filter((id: any): id is string => !!id)
    );
    const localPOs = await db.select({ workguruId: purchaseOrders.workguruId, poNumber: purchaseOrders.poNumber }).from(purchaseOrders);
    const localPoIds = new Set<string>(localPOs.map(p => p.workguruId).filter((id): id is string => !!id));

    const missingLocally = Array.from(remotePoIds).filter(id => !localPoIds.has(id));
    
    if (missingLocally.length > 0) {
        console.log(`\n[!] MISSING LOCALLY (${missingLocally.length} items):`);
        missingLocally.slice(0, 10).forEach(id => {
            const remotePo = remotePOs.find((p: any) => (p.id || p.id_Internal || p.PurchaseOrderID)?.toString() === id);
            console.log(`  - ID: ${id}, Number: ${remotePo?.number || 'Unknown'}`);
        });
        if (missingLocally.length > 10) console.log(`  ... and ${missingLocally.length - 10} more.`);
    } else {
        console.log('\n[✓] All remote POs exist in local database.');
    }

    // 5. Line Count Verification (Sample)
    console.log('\n[Sample Line Verification]');
    const sampleSize = 5;
    const hydratedPOs = await db.select().from(purchaseOrders)
        .where(eq(purchaseOrders.hydrationStatus, 'HYDRATED'))
        .limit(sampleSize);

    for (const po of hydratedPOs) {
        const localLines = await db.select({ count: sql<number>`count(*)` })
            .from(purchaseOrderLines)
            .where(eq(purchaseOrderLines.purchaseOrderId, po.id));
        
        console.log(`PO ${po.poNumber || po.workguruId}: Local Lines = ${localLines[0].count}`);
    }

    console.log('\n--- AUDIT COMPLETE ---');
}

runAudit().catch(console.error);
