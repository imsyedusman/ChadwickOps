import axios from 'axios';
import { decrypt } from './src/lib/crypto';
import { db } from './src/db';
import { systemConfig } from './src/db/schema';
import { eq } from 'drizzle-orm';
import os from 'os';

async function trace() {
    console.log(`--- Environment Detail ---`);
    console.log(`Platform: ${os.platform()}`);
    console.log(`Node Version: ${process.version}`);
    console.log(`Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    console.log(`Time: ${new Date().toISOString()}`);

    const configRes = await db.select().from(systemConfig).where(eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS')).limit(1);
    const config = configRes[0];
    if (!config) {
        console.error('No API credentials found in DB');
        process.exit(1);
    }

    const { apiKey, apiSecret } = config.value as { apiKey: string, apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    console.log('\n--- API Trace for Project 12394-02 ---');
    const authStart = Date.now();
    const tokenRes = await axios.post('https://api.workguru.io/api/ClientTokenAuth/Authenticate/api/client/v1/tokenauth', {
        apiKey: decryptedKey,
        secret: decryptedSecret,
    });
    console.log(`Auth took: ${Date.now() - authStart}ms`);
    const token = tokenRes.data.accessToken;

    // 1. Check BASE API (List)
    const listUrl = 'https://api.workguru.io/api/services/app/Project/GetAllCurrentProjects?MaxResultCount=1000';
    const listStart = Date.now();
    const listResponse = await axios.get(listUrl, {
        headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`Base List fetch took: ${Date.now() - listStart}ms`);
    
    const baseProject = (listResponse.data.result?.items || listResponse.data.result || []).find((p: any) => 
        String(p.id || p.ProjectID) === '1286812' || (p.projectNo || p.ProjectNumber) === '12394-02'
    );
    
    console.log('\n--- Base API (List) Summary ---');
    if (baseProject) {
        console.log(`Found in List: YES`);
        console.log(`Base Total: ${baseProject.total || baseProject.Total || 0}`);
        console.log(`Base Fields: ${Object.keys(baseProject).join(', ')}`);
    } else {
        console.log(`Found in List: NO (Might be non-current?)`);
    }

    // 2. Check DETAIL API (Single)
    const projectUrl = 'https://api.workguru.io/api/services/app/Project/GetProjectById?id=1286812';
    const projectStart = Date.now();
    try {
        const response = await axios.get(projectUrl, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`\nDetail API fetch took: ${Date.now() - projectStart}ms`);
        const project = response.data.result;
        
        console.log('\n--- Detail API Key Fields ---');
        console.log(`Project Number: ${project.projectNo || project.projectNumber || project.ProjectNumber}`);
        console.log(`Total: ${project.total || project.Total}`);
        
        const lineItems = project.productLineItems || project.ProductLineItems || [];
        console.log(`Line Items Count: ${lineItems.length}`);
        
        if (lineItems.length > 0) {
            console.log('First 2 Line Items:');
            console.log(JSON.stringify(lineItems.slice(0, 2), null, 2));
        }

        console.log('\n--- Custom Fields (Raw) ---');
        console.log(JSON.stringify((project.customFieldValues || project.CustomFieldValues || []).slice(0, 5), null, 2));

    } catch (error: any) {
        console.error('API Error:', error.response?.status, error.response?.data || error.message);
    }

    process.exit(0);
}

trace().catch(err => {
    console.error(err);
    process.exit(1);
});
