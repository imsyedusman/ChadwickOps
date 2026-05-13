import { db } from './src/db';
import { eq } from 'drizzle-orm';
import { systemConfig } from './src/db/schema';
import { decrypt } from './src/lib/crypto';
import { WorkGuruClient } from './src/lib/workguru';

async function debugPO() {
    const poId = '1196897';
    console.log(`--- Debugging PO ${poId} ---`);

    const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config) throw new Error('API Credentials not found');
    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    
    const client = new WorkGuruClient(decrypt(apiKey), decrypt(apiSecret));

    console.log('Fetching PO Detail from WorkGuru API...');
    const detail = await client.getPurchaseOrderById(poId);
    
    const result = detail.result || detail;
    console.log('Available keys in result:', Object.keys(result));

    const lines = result.products || result.purchaseOrderLineItems || [];
    console.log(`\nFound ${lines.length} lines in API response.`);
    
    if (lines.length > 0) {
        console.log('First line keys:', Object.keys(lines[0]));
        console.log('First line sample:', JSON.stringify(lines[0], null, 2));
    } else {
        console.log('WARNING: No lines found in API response for this PO.');
    }
    
    if (result.purchaseOrderLineItems) {
        console.log(`purchaseOrderLineItems count: ${result.purchaseOrderLineItems.length}`);
    }
    if (result.products) {
        console.log(`products count: ${result.products.length}`);
    }

}

debugPO().catch(console.error);
