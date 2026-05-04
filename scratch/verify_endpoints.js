
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
            process.env[key.trim()] = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
        }
    });
}

const DATABASE_URL = process.env.DATABASE_URL;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

console.log('ENCRYPTION_KEY length:', ENCRYPTION_KEY ? ENCRYPTION_KEY.length : 'N/A');

function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    // Try both raw string and hex if it looks like hex
    const key = Buffer.from(ENCRYPTION_KEY);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    console.error('Decryption failed:', e.message);
    return text;
  }
}

async function verify() {
  const sql = postgres(DATABASE_URL);
  try {
    const configRes = await sql`SELECT value FROM system_config WHERE key = 'WORKGURU_API_CREDENTIALS' LIMIT 1`;
    if (configRes.length === 0) {
      console.log('No WorkGuru credentials found in system_config');
      return;
    }

    const { apiKey, apiSecret } = configRes[0].value;
    const decryptedApiKey = decrypt(apiKey);
    const decryptedApiSecret = decrypt(apiSecret);

    console.log('API Key decrypted length:', decryptedApiKey.length);
    // console.log('API Key (first 4):', decryptedApiKey.substring(0, 4));

    console.log('Authenticating with WorkGuru...');
    const authUrl = 'https://api.workguru.io/api/ClientTokenAuth/Authenticate/api/client/v1/tokenauth';
    
    try {
      const authRes = await axios.post(authUrl, {
        apiKey: decryptedApiKey,
        secret: decryptedApiSecret,
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      const token = authRes.data.accessToken;
      console.log('Authentication successful. Token received.');
      const headers = { Authorization: `Bearer ${token}` };

      // Use specific projects for testing
      const testIds = ['1290990', '1282403', '1282450'];
      const activeProjects = await sql`
        SELECT workguru_id, name, project_number 
        FROM projects 
        WHERE workguru_id IN ${sql(testIds)}
      `;

      if (activeProjects.length === 0) {
        console.log('No active projects found in DB.');
        return;
      }

      const baseUrl = 'https://api.workguru.io';

      for (const p of activeProjects) {
        console.log(`\n--- Project: ${p.name} (${p.workguru_id}) ---`);

        // 1. GetWipBasedOnActualsNew
        try {
          const wipRes = await axios.get(`${baseUrl}/api/services/app/ProjectPivotReport/GetWipBasedOnActualsNew`, {
            headers,
            params: { ProjectId: p.workguru_id }
          });
          console.log('GetWipBasedOnActualsNew: SUCCESS');
          const data = wipRes.data.result;
          if (Array.isArray(data)) {
              console.log(`- Count: ${data.length}`);
              if (data.length > 0) console.log('- Sample:', JSON.stringify(data[0], null, 2));
          } else {
              console.log('- Result:', JSON.stringify(data, null, 2));
          }
        } catch (e) {
          console.log('GetWipBasedOnActualsNew Error:', e.response?.status, JSON.stringify(e.response?.data || e.message));
        }

        // 2. GetProjectProfitSummaryWithinPeriod
        try {
          const profitRes = await axios.get(`${baseUrl}/api/services/app/ProjectPivotReport/GetProjectProfitSummaryWithinPeriod`, {
            headers,
            params: { ProjectId: p.workguru_id }
          });
          console.log('GetProjectProfitSummaryWithinPeriod: SUCCESS');
          console.log('- Result:', JSON.stringify(profitRes.data.result, null, 2));
        } catch (e) {
          console.log('GetProjectProfitSummaryWithinPeriod Error:', e.response?.status, JSON.stringify(e.response?.data || e.message));
        }

        // 3. GetAllInvoices
        try {
          const invoiceRes = await axios.get(`${baseUrl}/api/services/app/Invoice/GetAllInvoices`, {
            headers,
            params: { ProjectId: p.workguru_id, MaxResultCount: 100 }
          });
          const invoices = invoiceRes.data.result?.items || invoiceRes.data.items || [];
          const nonDraftInvoices = invoices.filter(i => i.status !== 'Draft');
          console.log(`Invoices: ${invoices.length} total, ${nonDraftInvoices.length} non-draft`);
          nonDraftInvoices.slice(0, 3).forEach(i => {
              console.log(`  - Inv #${i.invoiceNumber}: Total ${i.total}, Status ${i.status}, Date ${i.invoiceDate}`);
          });
        } catch (e) {
          console.log('GetAllInvoices Error:', e.response?.status, JSON.stringify(e.response?.data || e.message));
        }
      }
    } catch (e) {
      console.log('Authentication Error:', e.response?.status);
      if (e.response?.data) {
          console.log('Error Data:', JSON.stringify(e.response.data, null, 2).substring(0, 1000));
      } else {
          console.log('Error Message:', e.message);
      }
    }

  } catch (error) {
    console.error('System Error:', error.message);
  } finally {
    await sql.end();
  }
}

verify();
