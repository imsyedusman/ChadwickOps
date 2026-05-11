import axios from 'axios';
import { db } from './src/db';
import { eq } from 'drizzle-orm';
import { systemConfig } from './src/db/schema';
import { decrypt } from './src/lib/crypto';

async function investigatePivotReport() {
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

    console.log('Fetching Purchase Lines Pivot Report...');
    try {
        const res = await axios.get(`https://api.workguru.io/api/services/app/PurchasesPivotReport/GetPurchaseLinesForPivot`, {
            headers,
            params: { MaxResultCount: 5 }
        });
        const report = res.data.result?.items || res.data.items || res.data;
        console.log('Pivot Items:');
        const items = Array.isArray(report) ? report : (report.items || []);
        if (items.length > 0) {
            console.log(JSON.stringify(items[0], null, 2));
        } else {
            console.log('No items found in pivot report.');
        }
    } catch (err: any) {
        console.error('Fetch failed:', err.response?.data || err.message);
    }
}

investigatePivotReport().catch(console.error);
