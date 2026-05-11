import axios from 'axios';
import { db } from './src/db';
import { eq } from 'drizzle-orm';
import { systemConfig } from './src/db/schema';
import { decrypt } from './src/lib/crypto';

async function investigateProcurement() {
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
    const headers = { Authorization: `Bearer ${token}` };

    console.log('--- Investigation Start ---');

    console.log('\nSearching for recent POs with non-zero totals...');
    let testPoId = '';
    try {
        const res = await axios.get(`https://api.workguru.io/api/services/app/PurchaseOrder/GetPurchaseOrders`, {
            headers,
            params: { MaxResultCount: 100, Sorting: 'CreationTime DESC' }
        });
        const pos = res.data.result?.items || res.data.items || [];
        console.log(`Found ${pos.length} POs`);
        const withTotal = pos.filter((p: any) => p.total > 0);
        console.log(`POs with total > 0: ${withTotal.length}`);
        if (withTotal.length > 0) {
            console.table(withTotal.slice(0, 10).map((p: any) => ({ id: p.id, no: p.number, status: p.status, total: p.total, projectId: p.projectId })));
            testPoId = withTotal[0].id;
        }
    } catch (err: any) {
        console.error('Failed to search POs:', err.response?.data || err.message);
    }

    if (testPoId) {
        console.log(`\n1. Fetching PO ${testPoId} details...`);
        try {
            const res = await axios.get(`https://api.workguru.io/api/services/app/PurchaseOrder/GetPurchaseOrderById`, {
                headers,
                params: { id: testPoId }
            });
            const detail = res.data.result || res.data;
            console.log('Fields available in PO Detail:');
            console.log(Object.keys(detail).join(', '));
            
            // Look for any field that might contain lines
            const lineFields = Object.keys(detail).filter(k => k.toLowerCase().includes('line') || k.toLowerCase().includes('item'));
            console.log('Potential line fields:', lineFields);

            for (const field of lineFields) {
                const val = detail[field];
                if (Array.isArray(val)) {
                    console.log(`Field "${field}" is an array with ${val.length} items`);
                    if (val.length > 0) {
                        console.log(`Sample item from "${field}":`, JSON.stringify(val[0], null, 2));
                    }
                }
            }
            
            console.log('PO Status:', detail.status || detail.Status);
            console.log('Expected Date:', detail.expectedDate || detail.ExpectedDate);
        } catch (err: any) {
            console.error('PO Detail Fetch Failed:', err.response?.data || err.message);
        }
    }

    console.log('\n--- Investigation End ---');
}

investigateProcurement().catch(console.error);
