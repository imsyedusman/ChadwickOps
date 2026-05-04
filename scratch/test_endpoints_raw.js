
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

    const endpoints = [
        '/api/services/app/ProjectPivotReport/GetWipBasedOnActualsNew',
        '/api/services/app/ProjectPivotReport/GetProjectProfitSummaryWithinPeriod',
        '/api/services/app/Invoice/GetAllInvoices'
    ];

    for (const endpoint of endpoints) {
        console.log(`\n--- Testing endpoint: ${endpoint} (No params) ---`);
        try {
            const res = await axios.get(`${baseUrl}${endpoint}`, {
                headers,
                params: { MaxResultCount: 10 }
            });
            console.log('SUCCESS');
            const result = res.data.result;
            if (result) {
                if (Array.isArray(result)) {
                    console.log(`Count: ${result.length}`);
                    if (result.length > 0) console.log('First item keys:', Object.keys(result[0]));
                } else if (result.items && Array.isArray(result.items)) {
                    console.log(`Count (items): ${result.items.length}`);
                    if (result.items.length > 0) console.log('First item keys:', Object.keys(result.items[0]));
                } else {
                    console.log('Result keys:', Object.keys(result));
                }
            } else {
                console.log('Result is empty');
            }
        } catch (e) {
            console.log('FAILED', e.response?.status, JSON.stringify(e.response?.data || e.message).substring(0, 500));
        }
    }

  } catch (error) {
    console.error('System Error:', error.message);
  } finally {
    await sql.end();
  }
}

verify();
