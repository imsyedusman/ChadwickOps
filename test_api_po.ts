
import { db } from './src/db';
import { systemConfig, projects, purchaseOrders } from './src/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { decrypt } from './src/lib/crypto';
import { WorkGuruClient } from './src/lib/workguru';

async function testApi() {
  const config = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
  });
  if (!config) {
      console.log('No credentials found');
      return;
  }
  const { apiKey, apiSecret } = config.value as any;
  const decryptedKey = decrypt(apiKey);
  const decryptedSecret = decrypt(apiSecret);
  
  const client = new WorkGuruClient(decryptedKey, decryptedSecret);
  
  // Find a Received PO in our DB that has no receivedDate
  const dbPoRes = await db.select({
      workguruId: purchaseOrders.workguruId,
      projectWorkGuruId: projects.workguruId
  })
  .from(purchaseOrders)
  .leftJoin(projects, eq(purchaseOrders.projectId, projects.id))
  .where(and(eq(purchaseOrders.status, 'Received'), isNull(purchaseOrders.receivedDate)))
  .limit(1);
  
  if (dbPoRes.length === 0) {
      console.log('No Received POs without dates found in DB');
      return;
  }
  
  const dbPo = dbPoRes[0];
  const projectWorkGuruId = dbPo.projectWorkGuruId as string;
  console.log(`Fetching POs for Project ${projectWorkGuruId} (PO Number: ${dbPo.workguruId})`);
  
  const poRes = await client.getProjectPurchaseOrders(projectWorkGuruId);
  const pos = poRes.result?.items || poRes.items || poRes.result || [];
  
  const targetPo = pos.find((p: any) => String(p.id || p.id_Internal || p.PurchaseOrderID) === String(dbPo.workguruId));
  console.log('Raw PO Data from API:', JSON.stringify(targetPo, null, 2));
}

testApi().catch(console.error);
