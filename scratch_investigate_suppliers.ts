import { db } from './src/db';
import { purchaseOrders, purchaseOrderLines } from './src/db/schema';
import { eq, sql, isNull } from 'drizzle-orm';

async function investigateSuppliers() {
    console.log("--- Detailed Supplier Audit ---");
    
    const poNullCount = await db.select({ count: sql`count(*)` })
        .from(purchaseOrders)
        .where(isNull(purchaseOrders.supplierName));
    
    console.log(`Purchase Orders with NULL supplierName: ${poNullCount[0].count}`);

    const poUnknownCount = await db.select({ count: sql`count(*)` })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.supplierName, 'Unknown'));
    
    console.log(`Purchase Orders with 'Unknown' supplierName: ${poUnknownCount[0].count}`);

    const lineUnknownCount = await db.select({ count: sql`count(*)` })
        .from(purchaseOrderLines)
        .where(eq(purchaseOrderLines.supplierName, 'Unknown'));
    
    console.log(`PO Lines with 'Unknown' supplierName: ${lineUnknownCount[0].count}`);
}

investigateSuppliers().catch(console.error);
