
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

    // 1. Try to get all invoices to see structure and find a project with invoices
    console.log('Fetching last 10 invoices...');
    const allInvoicesRes = await axios.get(`${baseUrl}/api/services/app/Invoice/GetAllInvoices`, {
        headers,
        params: { MaxResultCount: 10, Sorting: 'InvoiceDate DESC' }
    });
    const invoices = allInvoicesRes.data.result?.items || [];
    console.log(`Found ${invoices.length} invoices.`);
    if (invoices.length > 0) {
        console.log('Sample invoice:', JSON.stringify(invoices[0], null, 2));
        const sampleProjectId = invoices[0].projectId || invoices[0].ProjectID;
        console.log('Sample Project ID from invoice:', sampleProjectId);
        
        if (sampleProjectId) {
            console.log(`\nTesting reports for Project ID: ${sampleProjectId}`);
            
            // Try different param names
            for (const paramName of ['ProjectId', 'projectId', 'id', 'ProjectID']) {
                console.log(`\n--- Testing param: ${paramName} ---`);
                try {
                    const wipRes = await axios.get(`${baseUrl}/api/services/app/ProjectPivotReport/GetWipBasedOnActualsNew`, {
                        headers,
                        params: { [paramName]: sampleProjectId }
                    });
                    const count = Array.isArray(wipRes.data.result) ? wipRes.data.result.length : (wipRes.data.result ? 1 : 0);
                    console.log(`GetWipBasedOnActualsNew (${paramName}): SUCCESS, count: ${count}`);
                } catch (e) {
                    console.log(`GetWipBasedOnActualsNew (${paramName}): FAILED`, e.response?.status);
                }

                try {
                    const profitRes = await axios.get(`${baseUrl}/api/services/app/ProjectPivotReport/GetProjectProfitSummaryWithinPeriod`, {
                        headers,
                        params: { [paramName]: sampleProjectId }
                    });
                    const count = Array.isArray(profitRes.data.result) ? profitRes.data.result.length : (profitRes.data.result ? 1 : 0);
                    console.log(`GetProjectProfitSummaryWithinPeriod (${paramName}): SUCCESS, count: ${count}`);
                } catch (e) {
                    console.log(`GetProjectProfitSummaryWithinPeriod (${paramName}): FAILED`, e.response?.status);
                }
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
