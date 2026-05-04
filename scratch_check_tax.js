
const axios = require('axios');
const postgres = require('postgres');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Load .env manually
const envPath = path.join(__dirname, '.env');
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
  if (!DATABASE_URL) {
      console.error('DATABASE_URL not found in .env');
      return;
  }
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

    const pid = '1282417';
    const detailRes = await axios.get(`${baseUrl}/api/services/app/Project/GetProjectById`, { headers, params: { id: pid } });
    const project = detailRes.data.result;

    if (project.purchaseOrders && project.purchaseOrders.length > 0) {
        const po = project.purchaseOrders[0];
        console.log('PO Header:', {
            id: po.id,
            number: po.number,
            total: po.total,
            taxTotal: po.taxTotal,
            totalNet: po.totalNet,
            netTotal: po.netTotal,
            subTotal: po.subTotal
        });
    }

    const invRes = await axios.get(`${baseUrl}/api/services/app/Invoice/GetAllInvoices`, { headers, params: { MaxResultCount: 1 } });
    const items = invRes.data.result?.items || invRes.data.result || [];
    if (items.length > 0) {
        const inv = items[0];
        console.log('Invoice Header:', {
            id: inv.id,
            number: inv.number,
            total: inv.total,
            taxTotal: inv.taxTotal,
            totalNet: inv.totalNet,
            netTotal: inv.netTotal,
            subTotal: inv.subTotal
        });
    }

  } catch (error) {
    console.error('System Error:', error.message);
  } finally {
    await sql.end();
  }
}

verify();
