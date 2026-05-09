import { WorkGuruClient } from './src/lib/workguru';
import { db } from './src/db';
import { eq } from 'drizzle-orm';
import { systemConfig } from './src/db/schema';
import { decrypt } from './src/lib/crypto';

async function verifyPoTax() {
    const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config) throw new Error('WorkGuru API Credentials not configured');
    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    const client = new WorkGuruClient(decryptedKey, decryptedSecret);
    
    const workguruProjectId = '1282329';
    console.log(`Checking PO details for project ${workguruProjectId}...`);
    
    const poRes = await client.getProjectPurchaseOrders(workguruProjectId);
    const po = (poRes.items || poRes.result?.items || poRes.result || [])[0];
    
    if (po) {
        console.log(`PO ID: ${po.id}`);
        console.log(`PO Total: ${po.total}`);
        
        // Fetch detailed PO to see line items and tax
        const detailRes = await client.getPurchaseOrderDetails(po.id);
        const detail = detailRes.result || detailRes;
        
        console.log('--- PO Details ---');
        console.log(`total: ${detail.total}`);
        console.log(`totalTax: ${detail.totalTax}`);
        console.log(`totalNet: ${detail.totalNet}`);
        console.log(`baseCurrencyTotal: ${detail.baseCurrencyTotal}`);
        
        const lines = detail.lineItems || detail.LineItems || [];
        if (lines.length > 0) {
            console.log('Line sample:', JSON.stringify(lines[0], null, 2));
        }
    }
}

verifyPoTax().catch(console.error);
