import { db } from './src/db';
import { purchaseOrders, purchaseOrderLines } from './src/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';

async function investigateSuppliers() {
    console.log("--- Investigating Supplier Data in DB (Deep Dive) ---");
    
    // Find lines with 'Unknown'
    const unknownLines = await db.select({
        id: purchaseOrderLines.id,
        poId: purchaseOrderLines.purchaseOrderId,
        supplierName: purchaseOrderLines.supplierName
    })
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.supplierName, 'Unknown'))
    .limit(10);
    
    console.log("Lines with 'Unknown' Supplier:");
    console.table(unknownLines);

    if (unknownLines.length > 0) {
        const poIds = unknownLines.map(l => l.poId);
        const pos = await db.select({
            id: purchaseOrders.id,
            workguruId: purchaseOrders.workguruId,
            supplierName: purchaseOrders.supplierName
        })
        .from(purchaseOrders)
        .where(inArray(purchaseOrders.id, poIds));
        
        console.log("Parent Purchase Orders for those lines:");
        console.table(pos);
    }
}

investigateSuppliers().catch(console.error);
