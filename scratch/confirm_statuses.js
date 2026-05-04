
const axios = require('axios');
const postgres = require('postgres');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Load .env manually
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1');
        }
    });
}

const DATABASE_URL = process.env.DATABASE_URL;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const key = Buffer.from(ENCRYPTION_KEY);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return text;
  }
}

async function verify() {
  const sql = postgres(DATABASE_URL);
  try {
    const configRes = await sql`SELECT value FROM system_config WHERE key = 'WORKGURU_API_CREDENTIALS' LIMIT 1`;
    const { apiKey, apiSecret } = configRes[0].value;
    const decryptedApiKey = decrypt(apiKey);
    const decryptedApiSecret = decrypt(apiSecret);

    const authRes = await axios.post('https://api.workguru.io/api/ClientTokenAuth/Authenticate/api/client/v1/tokenauth', {
      apiKey: decryptedApiKey,
      secret: decryptedApiSecret,
    });
    const token = authRes.data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };
    const baseUrl = 'https://api.workguru.io';

    function extract(data) {
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.items)) return data.items;
        if (data && data.result && Array.isArray(data.result.items)) return data.result.items;
        if (data && data.result && Array.isArray(data.result)) return data.result;
        return [];
    }

    console.log('--- Fetching Invoice Statuses ---');
    const invRes = await axios.get(`${baseUrl}/api/services/app/Invoice/GetAllInvoices`, { headers, params: { MaxResultCount: 1000 } });
    const invoices = extract(invRes.data);
    const invStatuses = new Set();
    invoices.forEach(i => invStatuses.add(i.status));
    console.log('Invoice Statuses found:', Array.from(invStatuses));

    console.log('--- Fetching PO Statuses ---');
    const poRes = await axios.get(`${baseUrl}/api/services/app/PurchaseOrder/GetAllPurchaseOrders`, { headers, params: { MaxResultCount: 1000 } });
    const pos = extract(poRes.data);
    const poStatuses = new Set();
    pos.forEach(p => poStatuses.add(p.status));
    console.log('PO Statuses found:', Array.from(poStatuses));

  } catch (error) {
    console.error('System Error:', error.message);
  } finally {
    await sql.end();
  }
}

verify();
