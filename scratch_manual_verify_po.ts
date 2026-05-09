import axios from 'axios';
import { db } from './src/db';
import { eq } from 'drizzle-orm';
import { systemConfig } from './src/db/schema';
import { decrypt } from './src/lib/crypto';

async function verifyPoDetail() {
    const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config) throw new Error('WorkGuru API Credentials not configured');
    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    // Authenticate
    const authRes = await axios.post('https://api.workguru.io/api/ClientTokenAuth/Authenticate/api/client/v1/tokenauth', {
        apiKey: decryptedKey,
        secret: decryptedSecret
    });
    const token = authRes.data.accessToken;

    const poId = '1207145';
    console.log(`Fetching PO ${poId} details...`);
    
    try {
        const response = await axios.get(`https://api.workguru.io/api/services/app/PurchaseOrder/GetPurchaseOrderById`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { id: poId }
        });
        
        const detail = response.data.result || response.data;
        console.log('--- PO Detail Result ---');
        console.log(JSON.stringify(detail, null, 2));
        
        const isExTax = Math.abs(Number(detail.total) * 0.1 - Number(detail.totalTax)) < 0.01;
        console.log(`Is total Ex-Tax? ${isExTax} (Total * 0.1 == TotalTax)`);
        
        const line = detail.purchaseLineItems?.[0] || detail.purchaseOrderLineItems?.[0] || {};
        console.log('Line sample:', JSON.stringify(line, null, 2));
    } catch (err: any) {
        console.error('Failed to fetch PO detail:', err.response?.data || err.message);
    }
}

verifyPoDetail().catch(console.error);
