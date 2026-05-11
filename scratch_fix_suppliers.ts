import { db } from './src/db';
import { purchaseOrders, purchaseOrderLines } from './src/db/schema';
import { eq, sql } from 'drizzle-orm';

async function fixSupplierData() {
    console.log("--- Fixing Supplier Data Integrity in DB ---");
    
    // 1. Identify POs that have a supplier name but their lines are 'Unknown'
    const subquery = db.select({
        id: purchaseOrders.id,
        supplierName: purchaseOrders.supplierName
    }).from(purchaseOrders).where(sql`${purchaseOrders.supplierName} IS NOT NULL`).as('po_data');

    // Drizzle update with join is a bit tricky, we'll do it via raw SQL for efficiency if needed,
    // or a simple loop for safety since it's a few hundred rows.
    
    const targets = await db.select({
        lineId: purchaseOrderLines.id,
        correctName: purchaseOrders.supplierName
    })
    .from(purchaseOrderLines)
    .innerJoin(purchaseOrders, eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id))
    .where(and(
        eq(purchaseOrderLines.supplierName, 'Unknown'),
        sql`${purchaseOrders.supplierName} IS NOT NULL`
    ));

    console.log(`Found ${targets.length} lines to fix.`);

    for (const target of targets) {
        await db.update(purchaseOrderLines)
            .set({ supplierName: target.correctName })
            .where(eq(purchaseOrderLines.id, target.lineId));
    }

    console.log("Data fix complete.");
}

// Helper to use 'and' which might not be imported correctly in my thought
import { and } from 'drizzle-orm';

fixSupplierData().catch(console.error);
