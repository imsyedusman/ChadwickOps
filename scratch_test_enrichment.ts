import { db } from './src/db';
import { projects, systemConfig } from './src/db/schema';
import { WorkGuruClient } from './src/lib/workguru';
import { decrypt } from './src/lib/crypto';
import { eq, notInArray } from 'drizzle-orm';

async function testDeepSyncEnrichment() {
    console.log('=== DEEP SYNC ENRICHMENT TEST ===');
    try {
        // 1. Get Credentials
        const config = await db.query.systemConfig.findFirst({
            where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
        });

        if (!config) {
            console.error('API Credentials not found');
            return;
        }

        const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
        const decryptedKey = decrypt(apiKey);
        const decryptedSecret = decrypt(apiSecret);
        const client = new WorkGuruClient(decryptedKey, decryptedSecret);

        // 2. Sample project (let's pick one from the recent list)
        // From diag_result_utf8.json: 1283320
        const idToTest = '1283320';
        console.log(`Testing Project ID: ${idToTest}`);

        // 3. Fetch details
        const details = await client.getProjectDetails(idToTest);
        const remote = details?.result || details;
        
        if (!remote) {
            console.error('Could not fetch project details');
            return;
        }

        const customFieldValues = remote.customFieldValues || remote.CustomFieldValues || [];
        console.log(`Found ${customFieldValues.length} custom field values:`);
        customFieldValues.forEach((v: any) => {
            console.log(`- ID ${v.customFieldId}: "${v.value || v.Value}"`);
        });

        // 4. Test mapping pattern
        const CF_IDS = {
            BAY_LOCATION: 8925,
            DRAWING_APPROVAL_DATE: 9450,
            DRAWING_SUBMITTED_DATE: 9451,
        };

        const getVal = (id: number) => {
            const found = customFieldValues.find((v: any) => v.customFieldId === id);
            return found ? (found.value || found.Value) : null;
        };

        console.log('\nMapping Results:');
        console.log(`- Bay Location (8925): ${getVal(CF_IDS.BAY_LOCATION)}`);
        console.log(`- Drawing Approval (9450): ${getVal(CF_IDS.DRAWING_APPROVAL_DATE)}`);
        console.log(`- Drawing Submitted (9451): ${getVal(CF_IDS.DRAWING_SUBMITTED_DATE)}`);

    } catch (error: any) {
        console.error('Enrichment test failed:', error.message);
        if (error.response?.data) {
            console.error('API Error:', JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        process.exit(0);
    }
}

testDeepSyncEnrichment();
