import { db } from '../src/db';
import { systemConfig } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '../src/lib/crypto';
import { SyncService } from '../src/lib/sync';

async function testSync() {
    console.log('Fetching credentials from DB...');
    const configRes = await db.select().from(systemConfig).where(eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS')).limit(1);
    const config = configRes[0];
    if (!config) {
        console.error('No API credentials found in DB');
        return;
    }

    const { apiKey, apiSecret } = config.value as { apiKey: string, apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    const sync = new SyncService(decryptedKey, decryptedSecret);
    const syncAny = sync as any;
    
    console.log('Testing Project Type extraction (ID 8926)...');
    
    try {
        // Fetch a few active projects
        const projectsResponse = await syncAny.client.getProjects({ limit: 20, status: 'Active' });
        const projects = projectsResponse?.result?.items || projectsResponse?.result || projectsResponse || [];
        
        console.log(`Found ${projects.length} projects to check.`);
        
        for (const p of projects) {
            const projectNumber = p.projectNo || p.projectNumber || p.ProjectNumber;
            const projectUUID = p.projectUUID || p.ProjectUUID;
            
            console.log(`Checking project ${projectNumber}...`);
            const details = await syncAny.client.getProjectDetails(projectUUID);
            const remote = details?.result || details;
            
            const projectType = syncAny.getCustomFieldValue(remote, 'ProjectType');
            console.log(`Project: ${projectNumber}, Type: ${projectType || 'NULL'}`);
            
            if (projectType) {
                console.log('SUCCESS: Found a project with Project Type!');
                // Let's also check the raw custom fields to be sure about the ID
                const rawCFs = remote.customFieldValues || remote.CustomFieldValues || [];
                const typeCF = rawCFs.find((cf: any) => (cf.customFieldId || cf.CustomFieldID) === 8926);
                console.log('Raw Custom Field (8926):', JSON.stringify(typeCF, null, 2));
                break;
            }
        }
    } catch (err) {
        console.error('Error during test:', err);
    }
    process.exit(0);
}

testSync().catch(console.error);
