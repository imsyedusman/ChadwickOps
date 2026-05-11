import { ProcurementSyncService } from './src/lib/procurement-sync';
import { db } from './src/db';
import { purchaseOrders } from './src/db/schema';
import { isNull } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function fixMissingSuppliers() {
    console.log("--- Syncing POs with NULL Supplier Names ---");
    const service = new ProcurementSyncService(
        process.env.WORKGURU_API_KEY!,
        process.env.WORKGURU_API_SECRET!
    );
    
    const targets = await db.select({
        workguruId: purchaseOrders.workguruId
    })
    .from(purchaseOrders)
    .where(isNull(purchaseOrders.supplierName))
    .limit(50); // Just do 50 for testing
    
    console.log(`Found ${targets.length} targets to re-sync.`);
    
    const projectMap = new Map(); // We'll let the service fetch the projects or pass what we know
    // Actually, syncPurchaseOrder needs the projectMap.
    // I'll just use a hack to get a few synced.
    
    const localProjects = await db.query.projects.findMany();
    const pMap = new Map(localProjects.map(p => [p.workguruId, p.id]));

    for (const t of targets) {
        process.stdout.write(`Syncing ${t.workguruId}... `);
        const success = await (service as any).syncPurchaseOrder(t.workguruId, undefined, pMap);
        console.log(success ? "Success" : "Failed");
    }
    
    console.log("Targeted sync complete.");
}

fixMissingSuppliers().catch(console.error);
