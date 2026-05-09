
import { db } from './src/db';
import { systemConfig, projects, purchaseOrders } from './src/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { decrypt } from './src/lib/crypto';
import { WorkGuruClient } from './src/lib/workguru';

async function testApiDetails() {
  const config = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
  });
  if (!config) return;
  const { apiKey, apiSecret } = config.value as any;
  const client = new WorkGuruClient(decrypt(apiKey), decrypt(apiSecret));
  
  // Same project from before
  const projectNo = "12290-02";
  const project = await db.query.projects.findFirst({
      where: eq(projects.projectNumber, projectNo)
  });
  
  if (!project) return;
  
  console.log(`Fetching DETAILS for Project ${projectNo} (${project.workguruId})`);
  const detailsRes = await client.getProjectDetails(project.workguruId);
  const details = detailsRes.result || detailsRes;
  
  const pos = details.purchaseOrders || [];
  console.log(`Found ${pos.length} POs in project details`);
  
  const targetPo = pos[0]; // Just look at one
  console.log('Raw PO Data from Project Details:', JSON.stringify(targetPo, null, 2));
}

testApiDetails().catch(console.error);
