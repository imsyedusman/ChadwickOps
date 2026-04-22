import { db } from '../src/db/index';
import { systemConfig, projects } from '../src/db/schema';
import { WorkGuruClient } from '../src/lib/workguru';
import { decrypt } from '../src/lib/crypto';
import { eq } from 'drizzle-orm';

async function checkDateFields() {
    console.log('=== WORKGURU DATE FIELD CHECK ===');

    try {
        const config = await db.query.systemConfig.findFirst({
            where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
        });

        if (!config) {
            console.error('API Credentials not found in DB');
            return;
        }

        const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
        const decryptedKey = decrypt(apiKey);
        const decryptedSecret = decrypt(apiSecret);

        const client = new WorkGuruClient(decryptedKey, decryptedSecret);

        console.log('Fetching first 5 projects...');
        const projectsData = await client.getAllProjects();
        const items = projectsData?.result?.items || projectsData?.items || [];

        console.log(`Found ${items.length} projects total.`);
        
        const sample = items.slice(0, 5);
        for (const project of sample) {
            console.log(`\n--- Project: ${project.projectNo} ---`);
            console.log(`Name: ${project.projectName}`);
            console.log(`startDate: ${project.startDate}`);
            console.log(`StartDate: ${project.StartDate}`);
            console.log(`creationTime: ${project.creationTime}`);
            console.log(`CreationTime: ${project.CreationTime}`);
            
            // Check custom fields just in case
            const customFields = project.customFieldValues || project.CustomFieldValues || [];
            console.log(`Custom Fields count: ${customFields.length}`);
        }

        // Check details for one project
        if (items.length > 0) {
            const firstId = (items[0].id || items[0].ProjectID)?.toString();
            console.log(`\n--- Fetching Detail for Project ID: ${firstId} ---`);
            const details = await client.getProjectDetails(firstId);
            const remote = details?.result || details;
            console.log(`startDate: ${remote.startDate}`);
            console.log(`StartDate: ${remote.StartDate}`);
            console.log(`creationTime: ${remote.creationTime}`);
            console.log(`CreationTime: ${remote.CreationTime}`);
            
            // Log all keys to see if we missed anything
            console.log('Available keys in detail response:', Object.keys(remote).sort().join(', '));
        }

    } catch (error: any) {
        console.error('Check failed:', error.message);
    } finally {
        process.exit(0);
    }
}

checkDateFields();
