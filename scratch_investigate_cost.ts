import { db } from './src/db';
import { purchaseOrderLines, purchaseOrders } from './src/db/schema';
import { eq, sql } from 'drizzle-orm';

async function verifyProcurementData() {
    console.log('--- Procurement Data Investigation ---');
    
    // 1. Check a sample of PO lines
    const lines = await db.select().from(purchaseOrderLines).limit(10);
    console.log('Sample PO Lines:');
    lines.forEach(l => {
        console.log(`- Line: ${l.name}, Qty: ${l.quantity}, Rec: ${l.receivedQuantity}, UnitPrice: ${l.unitPrice}`);
    });

    // 2. Check totals
    const totals = await db.select({
        count: sql<number>`count(*)`,
        totalPrice: sql<number>`sum(${purchaseOrderLines.unitPrice})`,
        avgPrice: sql<number>`avg(${purchaseOrderLines.unitPrice})`,
        nonZeroPriceCount: sql<number>`count(case when ${purchaseOrderLines.unitPrice} > 0 then 1 end)`
    }).from(purchaseOrderLines);
    
    console.log('\nGlobal Totals:');
    console.log(JSON.stringify(totals, null, 2));

    // 3. Check join with POs
    const joined = await db.select({
        lineName: purchaseOrderLines.name,
        poId: purchaseOrders.id,
        expectedDate: purchaseOrders.expectedDate
    })
    .from(purchaseOrderLines)
    .innerJoin(purchaseOrders, eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id))
    .limit(5);

    console.log('\nJoin Sample:');
    console.log(JSON.stringify(joined, null, 2));

    process.exit(0);
}

verifyProcurementData();
