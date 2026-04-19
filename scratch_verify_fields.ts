import { db } from './src/db';
import { systemConfig, projects } from './src/db/schema';
import { WorkGuruClient } from './src/lib/workguru';
import { decrypt } from './src/lib/crypto';
import { eq, notInArray } from 'drizzle-orm';

async function verifyCustomFields() {
    console.log('=== CUSTOM FIELD VERIFICATION ===');

    try {
        // 1. Get Credentials
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

        // 2. Get some active projects to test
        const activeProjects = await db.select()
            .from(projects)
            .where(notInArray(projects.rawStatus, ['Completed', 'Archived', 'Declined']))
            .limit(5);

        console.log(`Testing ${activeProjects.length} active projects...`);

        for (const project of activeProjects) {
            console.log(`\n--- Project: ${project.projectNumber} (${project.name}) ---`);
            console.log(`WorkGuru ID: ${project.workguruId}`);

            const details = await client.getProjectDetails(project.workguruId);
            const remote = details?.result || details;

            const customFieldValues = remote?.customFieldValues || remote?.CustomFieldValues || [];
            console.log(`Custom Field Values Count: ${customFieldValues.length}`);

            const targetIds = [9450, 9451, 9487, 9488, 9489, 9490, 8925];
            const foundFields = customFieldValues.filter((v: any) => targetIds.includes(v.customFieldId));

            if (foundFields.length > 0) {
                foundFields.forEach((f: any) => {
                    console.log(`- ID ${f.customFieldId}: "${f.value || f.Value}"`);
                });
            } else {
                console.log('No target custom fields found in this project.');
                // Log all IDs just in case
                console.log('Available IDs:', customFieldValues.map((v: any) => v.customFieldId).join(', '));
            }
            
            // Log raw values for the first project that has ANY custom fields
            if (customFieldValues.length > 0) {
                console.log('Raw customFieldValues sample:', JSON.stringify(customFieldValues.slice(0, 3), null, 2));
            }
        }

    } catch (error: any) {
        console.error('Verification failed:', error.message);
        if (error.response?.data) {
            console.error('API Error Response:', JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        process.exit(0);
    }
}

verifyCustomFields();
