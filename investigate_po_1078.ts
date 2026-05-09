
import { db } from './src/db';
import { purchaseOrders, projects, systemConfig } from './src/db/schema';
import { eq, sql } from 'drizzle-orm';
import { decrypt } from './src/lib/crypto';
import axios from 'axios';

async function investigatePO1078() {
  const config = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
  });
  if (!config) return;
  const { apiKey, apiSecret } = config.value as any;
  const decKey = decrypt(apiKey);
  const decSecret = decrypt(apiSecret);

  // Authenticate
  const authRes = await axios.post('https://api.workguru.io/api/ClientTokenAuth/Authenticate/api/client/v1/tokenauth', {
    apiKey: decKey,
    secret: decSecret,
  });
  const token = authRes.data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  const poId = '1191816';
  console.log(`Investigating PO ${poId} via multiple endpoints...`);

  // 1. Try PurchaseOrder/GetPurchaseOrder
  try {
    const res = await axios.get('https://api.workguru.io/api/services/app/PurchaseOrder/GetPurchaseOrder', {
      headers,
      params: { id: poId }
    });
    console.log('\n--- Endpoint: PurchaseOrder/GetPurchaseOrder ---');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e: any) {
    console.log('\n--- Endpoint: PurchaseOrder/GetPurchaseOrder FAILED ---');
  }

  // 2. Try PurchaseOrder/GetPurchaseOrderById
  try {
    const res = await axios.get('https://api.workguru.io/api/services/app/PurchaseOrder/GetPurchaseOrderById', {
      headers,
      params: { id: poId }
    });
    console.log('\n--- Endpoint: PurchaseOrder/GetPurchaseOrderById ---');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e: any) {
    console.log('\n--- Endpoint: PurchaseOrder/GetPurchaseOrderById FAILED ---');
  }

  // 3. Find project for this PO to check GetProjectById vs GetPurchaseOrders
  const localPo = await db.select().from(purchaseOrders).where(eq(purchaseOrders.workguruId, poId)).limit(1);
  if (localPo.length > 0) {
      const projectId = localPo[0].projectId;
      const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
      if (project) {
          console.log(`\nPO belongs to Project ${project.projectNumber} (${project.workguruId})`);
          
          // Compare GetProjectById (Nested)
          const detailRes = await axios.get('https://api.workguru.io/api/services/app/Project/GetProjectById', {
            headers,
            params: { id: project.workguruId }
          });
          const nestedPo = detailRes.data.result.purchaseOrders.find((p: any) => String(p.id || p.id_Internal) === poId);
          console.log('\n--- Data from GetProjectById (Nested PO) ---');
          console.log(JSON.stringify(nestedPo, null, 2));

          // Compare GetPurchaseOrders (Dedicated)
          const dedicatedRes = await axios.get('https://api.workguru.io/api/services/app/PurchaseOrder/GetPurchaseOrders', {
            headers,
            params: { projectId: 1282467, MaxResultCount: 1000 }
          });
          const dedicatedPo = dedicatedRes.data.result.items.find((p: any) => String(p.id || p.id_Internal) === poId);
          console.log('\n--- Data from PurchaseOrder/GetPurchaseOrders (Dedicated) ---');
          console.log(JSON.stringify(dedicatedPo, null, 2));
      }
  }
}

investigatePO1078().catch(console.error);
