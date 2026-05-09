
import { db } from './src/db';
import { purchaseOrders } from './src/db/schema';
import { sql, eq, isNotNull } from 'drizzle-orm';

async function quickStats() {
  const statuses = await db.select({ 
    status: purchaseOrders.status, 
    count: sql<number>`count(*)` 
  }).from(purchaseOrders).groupBy(purchaseOrders.status);
  
  console.log('PO Statuses:', JSON.stringify(statuses, null, 2));

  const receivedWithDate = await db.select({
    count: sql<number>`count(*)`
  })
  .from(purchaseOrders)
  .where(and(eq(purchaseOrders.status, 'Received'), isNotNull(purchaseOrders.receivedDate)));

  const receivedWithoutDate = await db.select({
    count: sql<number>`count(*)`
  })
  .from(purchaseOrders)
  .where(and(eq(purchaseOrders.status, 'Received'), isNull(purchaseOrders.receivedDate)));

  console.log('Received POs WITH date:', receivedWithDate[0].count);
  console.log('Received POs WITHOUT date:', receivedWithoutDate[0].count);
}

import { and, isNull } from 'drizzle-orm';
quickStats().catch(console.error);
