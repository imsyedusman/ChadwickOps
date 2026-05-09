
import { db } from './src/db';
import { projects, systemConfig, purchaseOrders } from './src/db/schema';
import { eq, isNotNull, and } from 'drizzle-orm';
import { SyncService } from './src/lib/sync';
import { decrypt } from './src/lib/crypto';

async function verifySync() {
  const config = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
  });
  if (!config) return;
  const { apiKey, apiSecret } = config.value as any;
  const syncService = new SyncService(decrypt(apiKey), decrypt(apiSecret));

  const projectNumbers = ['11874-01', '12290-02'];
  
  for (const pNo of projectNumbers) {
      console.log(`\n=== Syncing Project ${pNo} ===`);
      const project = await db.query.projects.findFirst({ where: eq(projects.projectNumber, pNo) });
      if (!project) {
          console.log(`Project ${pNo} not found in DB`);
          continue;
      }
      
      await syncService.syncProjectById(project.workguruId);
      
      // Verify POs in DB
      const pos = await db.select().from(purchaseOrders).where(eq(purchaseOrders.projectId, project.id));
      const receivedWithDate = pos.filter(po => po.status === 'Received' && po.receivedDate !== null);
      const receivedWithoutDate = pos.filter(po => po.status === 'Received' && po.receivedDate === null);
      
      console.log(`Project ${pNo} results:`);
      console.log(` - Total POs: ${pos.length}`);
      console.log(` - Received POs WITH Date: ${receivedWithDate.length}`);
      console.log(` - Received POs WITHOUT Date: ${receivedWithoutDate.length}`);
      
      if (receivedWithDate.length > 0) {
          console.log(` - Sample Received Date: ${receivedWithDate[0].receivedDate}`);
      }
  }
}

verifySync().catch(console.error);
