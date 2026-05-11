import axios from 'axios';
import { db } from './src/db';
import { eq } from 'drizzle-orm';
import { systemConfig } from './src/db/schema';
import { decrypt } from './src/lib/crypto';

async function investigatePoLines() {
    const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const authRes = await axios.post('https://api.workguru.io/api/ClientTokenAuth/Authenticate/api/client/v1/tokenauth', {
        apiKey: decrypt(apiKey),
        secret: decrypt(apiSecret)
    });
    const token = authRes.data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    const poId = '1201071';
    console.log(`Fetching PO ${poId} details...`);
    
    try {
        const res = await axios.get(`https://api.workguru.io/api/services/app/PurchaseOrder/GetPurchaseOrderById`, {
            headers,
            params: { id: poId }
        });
        const detail = res.data.result || res.data;
        
        const allFields = Object.keys(detail);
        const arrayFields = allFields.filter(k => Array.isArray(detail[k]));
        console.log('\nArray fields found:', arrayFields);

        for (const field of arrayFields) {
            const val = detail[field];
            console.log(`Field "${field}" has ${val.length} items`);
            if (val.length > 0) {
                console.log(`Sample item from "${field}":`, JSON.stringify(val[0], null, 2));
            }
        }
        
        console.log('\nPO Status:', detail.status || detail.Status);
        console.log('Expected Date:', detail.expectedDate || detail.ExpectedDate);
        console.log('Total:', detail.total || detail.Total);

    } catch (err: any) {
        console.error('Fetch failed:', err.response?.data || err.message);
    }
}

investigatePoLines().catch(console.error);
