const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Basic .env.local parser
const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});

async function debugPoApi() {
    const apiKey = env.WORKGURU_API_KEY;
    const apiSecret = env.WORKGURU_API_SECRET;
    
    console.log("Authenticating...");
    const authRes = await axios.post('https://api.workguru.io/api/ClientTokenAuth/Authenticate/api/client/v1/tokenauth', {
        apiKey,
        secret: apiSecret
    });
    
    const token = authRes.data.accessToken;
    
    console.log(`Fetching POs list (limit 5)...`);
    const poRes = await axios.get(`https://api.workguru.io/api/services/app/PurchaseOrder/GetPurchaseOrders`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { MaxResultCount: 5 }
    });
    
    const items = poRes.data.result?.items || poRes.data.items || [];
    console.log(`Found ${items.length} items.`);
    
    if (items.length > 0) {
        const first = items[0];
        console.log("First PO Keys:", Object.keys(first));
        console.log("Supplier related fields in list:");
        for (const key of Object.keys(first)) {
            if (key.toLowerCase().includes('supp')) {
                console.log(`${key}:`, first[key]);
            }
        }
        
        const id = first.id || first.purchaseOrderID;
        console.log(`\nFetching detail for PO ${id}...`);
        try {
            const detailRes = await axios.get(`https://api.workguru.io/api/services/app/PurchaseOrder/GetPurchaseOrderById`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { id }
            });
            const detail = detailRes.data.result || detailRes.data;
            console.log("Detail Keys:", Object.keys(detail));
            console.log("Supplier related fields in detail:");
            for (const key of Object.keys(detail)) {
                if (key.toLowerCase().includes('supp')) {
                    console.log(`${key}:`, detail[key]);
                }
            }
        } catch (e) {
            console.error("Detail fetch failed:", e.message);
            if (e.response) console.log("Status:", e.response.status);
        }
    }
}

debugPoApi().catch(console.error);
