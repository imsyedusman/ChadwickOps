import { WorkGuruClient } from '../src/lib/workguru';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// Manual .env loader
function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const env = fs.readFileSync(envPath, 'utf8');
        env.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1');
                process.env[key.trim()] = value;
            }
        });
    }
}

loadEnv();

// Now import crypto AFTER env is loaded
import { decrypt } from '../src/lib/crypto';

async function testTimesheetCost() {
    const sql = postgres('postgresql://chadwick_user:Developer2k26!@localhost:5432/chadwick_ops');
    
    try {
        const config = await sql`SELECT value FROM system_config WHERE key = 'WORKGURU_API_CREDENTIALS'`;
        if (config.length === 0) throw new Error('No credentials found');
        
        const { apiKey, apiSecret } = config[0].value;
        const decryptedKey = decrypt(apiKey);
        const decryptedSecret = decrypt(apiSecret);
        
        const client = new WorkGuruClient(decryptedKey, decryptedSecret);
        const workguruId = '1282417'; 
        console.log(`Testing Timesheet API for project ${workguruId}...`);
        
        const tsResponse = await client.getProjectTimeEntries(workguruId);
        const items = tsResponse.result?.items || tsResponse.items || tsResponse.result || [];
        
        console.log(`Found ${items.length} timesheets.`);
        if (items.length > 0) {
            console.log('Sample Timesheet Data:', items[0]);
            console.log('Cost Fields:', {
                cost: items[0].cost,
                internalCosting: items[0].internalCosting,
                Cost: items[0].Cost,
                InternalCosting: items[0].InternalCosting
            });
        }

    } catch (e) {
        console.error('Test Failed:', e);
    } finally {
        await sql.end();
    }
}

testTimesheetCost();
