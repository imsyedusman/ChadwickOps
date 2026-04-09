
import { db } from './src/db';
import { systemConfig } from './src/db/schema';
import { WorkGuruClient } from './src/lib/workguru';
import { decrypt } from './src/lib/crypto';
import { eq } from 'drizzle-orm';

async function investigate() {
  const config = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
  });

  if (!config) {
    console.error('WorkGuru API Credentials not configured');
    return;
  }

  const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
  const decryptedKey = decrypt(apiKey);
  const decryptedSecret = decrypt(apiSecret);

  const client = new WorkGuruClient(decryptedKey, decryptedSecret);
  
  console.log('--- FETCHING QUICK SYNC PROJECTS (GetProjects) ---');
  const quickData = await client.getProjects();
  const quickItems = quickData?.result?.items || quickData?.items || [];
  if (quickItems.length > 0) {
    const sample = quickItems.find((p: any) => p.projectManager);
    console.log('Quick Sync PM Sample:', typeof sample?.projectManager, sample?.projectManager);
  }

  console.log('\n--- FETCHING FULL SYNC PROJECTS (GetAllProjects) ---');
  const fullData = await client.getAllProjects();
  const fullItems = fullData?.result?.items || fullData?.items || [];
  if (fullItems.length > 0) {
    const sample = fullItems.find((p: any) => p.projectManager);
    console.log('Full Sync PM Sample:', typeof sample?.projectManager, sample?.projectManager);
    
    const objectSample = fullItems.find((p: any) => typeof p.projectManager === 'object' && p.projectManager !== null);
    if (objectSample) {
        console.log('Found an OBJECT PM in Full Sync:', JSON.stringify(objectSample.projectManager));
    } else {
        console.log('No object PMs found in this batch of Full Sync.');
    }
  }
}

investigate().catch(console.error);
