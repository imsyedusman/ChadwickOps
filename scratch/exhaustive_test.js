
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

    const pids = ['1282332', '1282359'];

    for (const pid of pids) {
        console.log(`\n--- Project ID: ${pid} ---`);
        
        const testEndpoints = [
            { name: 'WIP (ProjectId)', url: '/api/services/app/ProjectPivotReport/GetWipBasedOnActualsNew', params: { ProjectId: pid } },
            { name: 'WIP (id)', url: '/api/services/app/ProjectPivotReport/GetWipBasedOnActualsNew', params: { id: pid } },
            { name: 'Profit (ProjectId)', url: '/api/services/app/ProjectPivotReport/GetProjectProfitSummaryWithinPeriod', params: { ProjectId: pid } },
            { name: 'Profit (id)', url: '/api/services/app/ProjectPivotReport/GetProjectProfitSummaryWithinPeriod', params: { id: pid } },
            { name: 'Invoices (ProjectId)', url: '/api/services/app/Invoice/GetAllInvoices', params: { ProjectId: pid } },
            { name: 'Invoices (projectId)', url: '/api/services/app/Invoice/GetAllInvoices', params: { projectId: pid } }
        ];

        for (const ep of testEndpoints) {
            try {
                const res = await axios.get(`${baseUrl}${ep.url}`, {
                    headers,
                    params: ep.params
                });
                const result = res.data.result;
                const count = Array.isArray(result) ? result.length : (result?.items ? result.items.length : (result ? 1 : 0));
                console.log(`${ep.name}: SUCCESS, count: ${count}`);
                if (count > 0) {
                    console.log('Sample data:', JSON.stringify(Array.isArray(result) ? result[0] : (result.items ? result.items[0] : result), null, 2).substring(0, 500));
                }
            } catch (e) {
                console.log(`${ep.name}: FAILED`, e.response?.status);
            }
        }
    }

  } catch (error) {
    console.error('System Error:', error.message);
  } finally {
    await sql.end();
  }
}

verify();
