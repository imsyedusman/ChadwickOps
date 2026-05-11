import { db } from './src/db';
import { purchaseOrders } from './src/db/schema';
import { isNotNull } from 'drizzle-orm';

async function checkValidSuppliers() {
    console.log("Checking for any valid supplier names in purchaseOrders...");
    const results = await db.select({
        id: purchaseOrders.id,
        workguruId: purchaseOrders.workguruId,
        supplierName: purchaseOrders.supplierName
    })
    .from(purchaseOrders)
    .where(isNotNull(purchaseOrders.supplierName))
    .limit(10);
    
    console.table(results);
}

checkValidSuppliers().catch(console.error);
