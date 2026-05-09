import { WorkGuruClient } from './src/lib/workguru';
import { db } from './src/db';
import { eq } from 'drizzle-orm';
import { systemConfig } from './src/db/schema';
import { decrypt } from './src/lib/crypto';

async function checkApi() {
    const workguruProjectId = '1282335';
    
    const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config) throw new Error('WorkGuru API Credentials not configured');
    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    const client = new WorkGuruClient(decryptedKey, decryptedSecret);
    
    console.log(`Fetching details for project ${workguruProjectId}...`);
    const details = await client.getProjectDetails(workguruProjectId);
    
    const project = details.result || details;
    const invs = project.invoices || project.Invoices || [];
    
    console.log(`Found ${invs.length} invoices in details.`);
    console.log('Invoice sample:', JSON.stringify(invs[0], null, 2));

    const dedicatedInvsRes = await client.getProjectInvoices(workguruProjectId);
    const dedicatedInvs = dedicatedInvsRes.items || dedicatedInvsRes.result?.items || dedicatedInvsRes.result || [];
    console.log(`Found ${dedicatedInvs.length} invoices via dedicated endpoint.`);
    console.log('Dedicated Invoice sample:', JSON.stringify(dedicatedInvs[0], null, 2));
}

checkApi().catch(console.error);
