import { db } from '../src/db';
import { systemConfig } from '../src/db/schema';
import { decrypt } from '../src/lib/crypto';
import { WorkGuruClient } from '../src/lib/workguru';
import { eq } from 'drizzle-orm';

async function investigate(poId: string) {
    console.log(`--- Investigating PO ID: ${poId} ---`);

    const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });
    if (!config) throw new Error('API Credentials not found');
    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const client = new WorkGuruClient(decrypt(apiKey), decrypt(apiSecret));

    try {
        console.log('Fetching PO Detail...');
        const response = await client.getPurchaseOrderById(poId);
        console.log('Status Code: 200');
        
        const result = response.result || response;
        console.log('PO Number:', result.number || result.Number);
        console.log('PO Status:', result.status || result.Status);
        
        const products = result.products || result.purchaseOrderLineItems || [];
        console.log(`Lines Found: ${products.length}`);
        
        if (products.length > 0) {
            console.log('Sample Line:', JSON.stringify(products[0], null, 2));
        } else {
            console.log('WARNING: Products array is EMPTY or MISSING.');
            console.log('Full Response Snippet:', JSON.stringify(result, null, 2).substring(0, 1000));
        }

    } catch (error: any) {
        console.error('FAILED Fetching PO:');
        console.error('HTTP Status:', error.response?.status);
        console.error('Error Message:', error.message);
        console.error('Response Data:', JSON.stringify(error.response?.data || {}, null, 2));
    }
}

const targetId = process.argv[2] || '1196897';
investigate(targetId).catch(console.error);
