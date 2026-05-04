
const path = require('path');
const fs = require('fs');

// Load .env manually BEFORE any other imports
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

// Now imports
const { SyncService } = require('./src/lib/sync');
const { db } = require('./src/db');
const { projects, timeEntries, purchaseOrders, invoices, systemConfig } = require('./src/db/schema');
const { eq } = require('drizzle-orm');
const crypto = require('crypto');

function decrypt(text, key) {
  if (!text || !text.includes(':')) return text;
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const keyBuf = Buffer.from(key);
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return text;
  }
}

async function validate() {
  console.log('--- Step 3: Raw Data Validation ---');
  
  try {
    // 1. Get Credentials
    const config = await db.select().from(systemConfig).where(eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS')).limit(1);
    if (!config.length) {
        console.error('Credentials not found in DB');
        return;
    }
    
    const { apiKey, apiSecret } = config[0].value;
    const encryptionKey = process.env.ENCRYPTION_KEY;
    
    const decryptedKey = decrypt(apiKey, encryptionKey);
    const decryptedSecret = decrypt(apiSecret, encryptionKey);

    const syncService = new SyncService(decryptedKey, decryptedSecret);
    
    const targetProjectId = '1282417'; // 4CYTE Pathology
    console.log(`\nTriggering Deep Sync for Project: ${targetProjectId}...`);
    
    await syncService.processProjectDetail(targetProjectId);
    console.log('Deep Sync Completed.');
    
    // 2. Query DB
    const projectRow = await db.select().from(projects).where(eq(projects.workguruId, targetProjectId)).limit(1);
    const p = projectRow[0];
    
    const ts = await db.select().from(timeEntries).where(eq(timeEntries.projectId, p.id));
    const pos = await db.select().from(purchaseOrders).where(eq(purchaseOrders.projectId, p.id));
    const invs = await db.select().from(invoices).where(eq(invoices.projectId, p.id));
    
    console.log(`\nValidation Results for: ${p.name}`);
    console.log('-----------------------------------');
    console.log(`Timesheets: ${ts.length}`);
    console.log(`Total Labor Cost: $${ts.reduce((acc, t) => acc + (t.cost || 0), 0).toFixed(2)}`);
    
    console.log(`Purchase Orders: ${pos.length}`);
    console.log(`Total PO Value: $${pos.reduce((acc, po) => acc + (po.total || 0), 0).toFixed(2)}`);
    
    console.log(`Invoices: ${invs.length}`);
    console.log(`Total Invoiced: $${invs.reduce((acc, inv) => acc + (inv.total || 0), 0).toFixed(2)}`);
    
    if (pos.length > 0) {
        console.log('\nSample PO Statuses:', [...new Set(pos.map(p => p.status))]);
    }
    
    if (invs.length > 0) {
        console.log('Sample Invoice Statuses:', [...new Set(invs.map(i => i.status))]);
    }
      
  } catch (e) {
      console.error('Validation FAILED:', e);
  }
  
  process.exit(0);
}

validate();
