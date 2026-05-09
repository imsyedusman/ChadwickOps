
import { db } from './src/db';
import { systemConfig } from './src/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from './src/lib/crypto';
import { WorkGuruClient } from './src/lib/workguru';

async function investigatePO1078() {
  const config = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
  });
  if (!config) return;
  const client = new WorkGuruClient(decrypt(config.value.apiKey), decrypt(config.value.apiSecret));
  
  const poId = '1191816';
  
  // 1. Try to find a GetPurchaseOrderById equivalent or use the project-based one
  // We know it's in a project. Let's find which project it belongs to first if possible.
  // Or just use the global GetPurchaseOrders if it exists.
  
  console.log(`Investigating PO ${poId}...`);
  
  // Try GetPurchaseOrderById (guessed)
  try {
      const auth = await (client as any).getAuthHeader();
      const res = await (client as any).axios.get(`https://api.workguru.io/api/services/app/PurchaseOrder/GetPurchaseOrderById`, {
          headers: auth,
          params: { id: poId }
      });
      console.log('GetPurchaseOrderById Response:', JSON.stringify(res.data, null, 2));
  } catch (e: any) {
      console.log('GetPurchaseOrderById failed or not found.');
  }

  // 2. Use the known GetPurchaseOrders with filter
  const poRes = await client.getProjectPurchaseOrders(''); // Passing empty string might get all or fail
  // Wait, let's see if there is a GetPurchaseOrders (Global)
  
  // Actually, I'll just check the project it belongs to.
  const project = await db.query.projects.findFirst({
      where: eq(db.query.purchaseOrders.workguruId, poId), // Wait, this syntax is wrong
  });
  // I'll use SQL
  const poInDb = await db.select().from(db.query.purchaseOrders).where(eq(db.query.purchaseOrders.workguruId, poId)).limit(1);
}

// I'll rewrite to be more direct.
