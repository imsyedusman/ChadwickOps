
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

    const pid = '1282417';
    console.log(`\n--- Deep Re-Testing Report Endpoints for Project ID: ${pid} ---`);

    const testCases = [
        {
            name: 'WIP (ProjectId, wide range)',
            url: '/api/services/app/ProjectPivotReport/GetWipBasedOnActualsNew',
            params: { ProjectId: pid, StartDate: '2020-01-01', EndDate: '2030-12-31' }
        },
        {
            name: 'WIP (id, wide range)',
            url: '/api/services/app/ProjectPivotReport/GetWipBasedOnActualsNew',
            params: { id: pid, StartDate: '2020-01-01', EndDate: '2030-12-31' }
        },
        {
            name: 'Profit (ProjectId, wide range)',
            url: '/api/services/app/ProjectPivotReport/GetProjectProfitSummaryWithinPeriod',
            params: { ProjectId: pid, StartDate: '2020-01-01', EndDate: '2030-12-31' }
        },
        {
            name: 'Profit (id, wide range)',
            url: '/api/services/app/ProjectPivotReport/GetProjectProfitSummaryWithinPeriod',
            params: { id: pid, StartDate: '2020-01-01', EndDate: '2030-12-31' }
        },
        {
            name: 'WIP (No filters, just MaxResultCount)',
            url: '/api/services/app/ProjectPivotReport/GetWipBasedOnActualsNew',
            params: { MaxResultCount: 1000 }
        },
        {
            name: 'Profit (No filters, just MaxResultCount)',
            url: '/api/services/app/ProjectPivotReport/GetProjectProfitSummaryWithinPeriod',
            params: { MaxResultCount: 1000 }
        }
    ];

    for (const tc of testCases) {
        console.log(`\nTesting: ${tc.name}`);
        try {
            const res = await axios.get(`${baseUrl}${tc.url}`, { headers, params: tc.params });
            const result = res.data.result;
            const count = Array.isArray(result) ? result.length : (result?.items?.length || (result ? 1 : 0));
            console.log(`SUCCESS, count: ${count}`);
            if (count > 0) {
                const data = Array.isArray(result) ? result : (result.items || [result]);
                // Check if our specific project is in the list if we fetched everything
                const found = data.find(item => String(item.projectId) === pid || String(item.id) === pid);
                if (found) {
                    console.log(`MATCH FOUND for ${pid}:`, JSON.stringify(found, null, 2));
                } else if (tc.params.ProjectId || tc.params.id) {
                     console.log('Result data:', JSON.stringify(data[0], null, 2));
                } else {
                    console.log('Sample data (first item):', JSON.stringify(data[0], null, 2));
                }
            }
        } catch (e) {
            console.log(`FAILED: ${e.response?.status} - ${JSON.stringify(e.response?.data || e.message).substring(0, 200)}`);
        }
    }

    console.log(`\n--- Fetching Project Details for comparison: ${pid} ---`);
    try {
        const detailRes = await axios.get(`${baseUrl}/api/services/app/Project/GetProjectById`, { headers, params: { id: pid } });
        const project = detailRes.data.result;
        console.log(`Project: ${project.projectName}`);
        console.log(`Invoices: ${project.invoices?.length || 0}`);
        console.log(`Timesheets: ${project.timeSheets?.length || 0}`);
        console.log(`PurchaseOrders: ${project.purchaseOrders?.length || 0}`);
    } catch (e) {
        console.log(`Detail fetch FAILED: ${e.message}`);
    }

  } catch (error) {
    console.error('System Error:', error.message);
  } finally {
    await sql.end();
  }
}

verify();
