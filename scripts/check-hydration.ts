import { db } from '../src/db';
import { purchaseOrders } from '../src/db/schema';
import { sql } from 'drizzle-orm';

async function run() {
    const counts = await db.select({ 
        status: purchaseOrders.hydrationStatus, 
        count: sql<number>`count(*)` 
    }).from(purchaseOrders).groupBy(purchaseOrders.hydrationStatus);
    
    console.log('--- Hydration Status Counts ---');
    console.log(JSON.stringify(counts, null, 2));

    const totalLines = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders);
    console.log(`Total POs: ${totalLines[0].count}`);
}

run().catch(console.error);
