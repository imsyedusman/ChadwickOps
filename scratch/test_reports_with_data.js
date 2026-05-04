
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

    console.log('Fetching invoices to find active projects with data...');
    const res = await axios.get(`${baseUrl}/api/services/app/Invoice/GetAllInvoices`, {
        headers,
        params: { MaxResultCount: 100 }
    });
    const invoices = Array.isArray(res.data.result) ? res.data.result : (res.data.result?.items || []);
    console.log(`Found ${invoices.length} invoices.`);
    
    const projectInvoiceSummary = {};
    invoices.forEach(inv => {
        const pid = inv.projectId;
        if (!pid) return;
        if (!projectInvoiceSummary[pid]) projectInvoiceSummary[pid] = { name: inv.project?.projectName || inv.project?.name, count: 0, total: 0 };
        if (inv.status !== 'Draft') {
            projectInvoiceSummary[pid].count++;
            projectInvoiceSummary[pid].total += inv.total;
        }
    });

    const candidateProjectIds = Object.keys(projectInvoiceSummary).filter(pid => projectInvoiceSummary[pid].count > 0).slice(0, 5);
    console.log('Candidate projects with invoices:', candidateProjectIds.map(pid => `${pid} (${projectInvoiceSummary[pid].name}): ${projectInvoiceSummary[pid].count} inv, total ${projectInvoiceSummary[pid].total}`));

    for (const pid of candidateProjectIds) {
        console.log(`\n--- Project: ${projectInvoiceSummary[pid].name} (${pid}) ---`);
        
        // 1. GetWipBasedOnActualsNew
        // I'll try adding StartDate/EndDate just in case
        const now = new Date();
        const yearAgo = new Date();
        yearAgo.setFullYear(now.getFullYear() - 1);
        
        const params = { 
            ProjectId: pid,
            StartDate: yearAgo.toISOString(),
            EndDate: now.toISOString()
        };

        try {
            const wipRes = await axios.get(`${baseUrl}/api/services/app/ProjectPivotReport/GetWipBasedOnActualsNew`, {
                headers,
                params
            });
            console.log('GetWipBasedOnActualsNew: SUCCESS');
            const data = wipRes.data.result;
            if (Array.isArray(data) && data.length > 0) {
                console.log('Sample WIP data (first item):', JSON.stringify(data[0], null, 2));
            } else {
                console.log('WIP data is empty for this date range.');
            }
        } catch (e) {
            console.log('GetWipBasedOnActualsNew FAILED', e.response?.status);
        }

        try {
            const profitRes = await axios.get(`${baseUrl}/api/services/app/ProjectPivotReport/GetProjectProfitSummaryWithinPeriod`, {
                headers,
                params
            });
            console.log('GetProjectProfitSummaryWithinPeriod: SUCCESS');
            const data = profitRes.data.result;
            if (Array.isArray(data) && data.length > 0) {
                 console.log('Sample Profit data (first item):', JSON.stringify(data[0], null, 2));
            } else {
                 console.log('Profit data is empty for this date range.');
            }
        } catch (e) {
            console.log('GetProjectProfitSummaryWithinPeriod FAILED', e.response?.status);
        }
    }

  } catch (error) {
    console.error('System Error:', error.message);
  } finally {
    await sql.end();
  }
}

verify();
