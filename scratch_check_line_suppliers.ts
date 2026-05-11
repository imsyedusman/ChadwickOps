import { db } from './src/db';
import { purchaseOrders, purchaseOrderLines } from './src/db/schema';
import { eq, isNotNull, and } from 'drizzle-orm';

async function checkLineSuppliers() {
    console.log("Checking if line items have supplier names for POs that have them...");
    
    const results = await db.select({
        poId: purchaseOrders.id,
        poSupplier: purchaseOrders.supplierName,
        lineId: purchaseOrderLines.id,
        lineSupplier: purchaseOrderLines.supplierName
    })
    .from(purchaseOrderLines)
    .innerJoin(purchaseOrders, eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id))
    .where(isNotNull(purchaseOrders.supplierName))
    .limit(10);
    
    console.table(results);
}

checkLineSuppliers().catch(console.error);
