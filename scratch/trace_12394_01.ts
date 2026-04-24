import fs from 'fs';
import path from 'path';

// Manually load .env
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            const k = key.trim();
            const v = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            process.env[k] = v;
            console.log(`Loaded ${k}=${k === 'ENCRYPTION_KEY' ? '***' : v}`);
        }
    });
}

async function trace() {
    const { decrypt } = await import('../src/lib/crypto');
    const { db } = await import('../src/db');
    const { projects, systemConfig } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');
    const axios = (await import('axios')).default;

    const targetProjectNo = '12394-01';
    
    console.log(`\n--- DB Check for Project ${targetProjectNo} ---`);
    const dbProject = await db.select().from(projects).where(eq(projects.projectNumber, targetProjectNo)).limit(1);
    if (dbProject[0]) {
        console.log('DB Start Date:', dbProject[0].startDate);
        console.log('DB Delivery Date:', dbProject[0].deliveryDate);
        console.log('DB WorkGuru ID:', dbProject[0].workguruId);
    } else {
        console.log('Project not found in DB');
    }

    const configRes = await db.select().from(systemConfig).where(eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS')).limit(1);
    const config = configRes[0];
    if (!config) {
        console.error('No API credentials found in DB');
        process.exit(1);
    }

    const { apiKey, apiSecret } = config.value as { apiKey: string, apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    const tokenRes = await axios.post('https://api.workguru.io/api/ClientTokenAuth/Authenticate/api/client/v1/tokenauth', {
        apiKey: decryptedKey,
        secret: decryptedSecret,
    });
    const token = tokenRes.data.accessToken;

    // 1. Check BASE API
    const listUrl = 'https://api.workguru.io/api/services/app/Project/GetAllProjects?MaxResultCount=1000';
    const listResponse = await axios.get(listUrl, {
        headers: { Authorization: `Bearer ${token}` }
    });
    
    const baseProject = (listResponse.data.result?.items || listResponse.data.result || []).find((p: any) => 
        (p.projectNo || p.projectNumber || p.ProjectNumber) === targetProjectNo
    );
    
    console.log(`\n--- Base API (List) for ${targetProjectNo} ---`);
    if (baseProject) {
        console.log(`Found in List: YES`);
        console.log(`Start Date: ${baseProject.startDate || baseProject.StartDate}`);
        console.log(`Due Date: ${baseProject.dueDate || baseProject.DueDate}`);
        console.log(`WorkGuru ID: ${baseProject.id || baseProject.ProjectID}`);
    } else {
        console.log(`Found in List: NO`);
    }

    if (baseProject || dbProject[0]) {
        const wgId = baseProject?.id || baseProject?.ProjectID || dbProject[0]?.workguruId;
        // 2. Check DETAIL API
        const projectUrl = `https://api.workguru.io/api/services/app/Project/GetProjectById?id=${wgId}`;
        try {
            const response = await axios.get(projectUrl, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const project = response.data.result;
            
            console.log(`\n--- Detail API (GetProjectById) for ${targetProjectNo} ---`);
            console.log(`Start Date: ${project.startDate || project.StartDate}`);
            console.log(`Due Date: ${project.dueDate || project.DueDate}`);
            console.log(`Creation Time: ${project.creationTime || project.CreationTime}`);
            
        } catch (error: any) {
            console.error('API Error:', error.response?.status, error.response?.data || error.message);
        }
    }

    process.exit(0);
}

trace().catch(err => {
    console.error(err);
    process.exit(1);
});
