
import fs from 'fs';
import path from 'path';

// Manual .env loading for scripts
function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) return;
            const index = trimmedLine.indexOf('=');
            if (index !== -1) {
                const key = trimmedLine.substring(0, index).trim();
                const value = trimmedLine.substring(index + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
                process.env[key] = value;
            }
        });
    }
}

loadEnv();
console.log('DATABASE_URL detected:', process.env.DATABASE_URL ? 'YES (masked)' : 'NO');

import { db } from '../src/db';
import { projects, systemConfig } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '../src/lib/crypto';
import { WorkGuruClient } from '../src/lib/workguru';

async function main() {
    console.log('--- Investigation for Project 12394-02 ---');

    // 1. Check Database Storage
    const targetNo = '12414-01';
    const project = await db.query.projects.findFirst({
        where: eq(projects.projectNumber, targetNo)
    });

    if (!project) {
        console.error(`Project ${targetNo} not found in database.`);
        process.exit(1);
    }

    console.log('Stored Value in DB:', project.total);
    console.log('WorkGuru ID:', project.workguruId);
    console.log('Name:', project.name);
    console.log('Status:', project.rawStatus);

    // 2. Fetch API Credentials
    const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config) {
        console.error('WorkGuru API Credentials not found in system_config table.');
        process.exit(1);
    }

    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    const client = new WorkGuruClient(decryptedKey, decryptedSecret);
    
    // 3. WorkGuru API Response
    console.log('\n--- Fetching WorkGuru API Data ---');
    const detailResponse = await client.getProjectDetails(project.workguruId);
    const remoteDetails = (detailResponse?.result || detailResponse);

    if (!remoteDetails) {
        console.error('Failed to fetch project details from WorkGuru API.');
        console.log('Response:', JSON.stringify(detailResponse, null, 2));
        process.exit(1);
    }

    console.log('Raw API Totals:');
    console.log('  total:', remoteDetails.total);
    console.log('  Total:', remoteDetails.Total);

    const lineItems = remoteDetails.productLineItems || remoteDetails.ProductLineItems || [];
    console.log(`\nProduct Line Items (${lineItems.length}):`);
    
    let calculatedTotal = 0;
    lineItems.forEach((li: any, index: number) => {
        const unitAmount = li.unitAmount || li.unitPrice || li.UnitPrice || 0;
        const quantity = li.quantity || li.Quantity || 0;
        const lineTotal = li.lineTotal || li.total || li.Total || (unitAmount * quantity);
        
        console.log(`  Item ${index + 1}:`);
        console.log(`    Name: ${li.name || li.Name}`);
        console.log(`    unitAmount/unitPrice: ${unitAmount}`);
        console.log(`    quantity: ${quantity}`);
        console.log(`    lineTotal: ${lineTotal}`);
        
        calculatedTotal += Number(lineTotal);
    });

    console.log('\nFinal Calculated Value (sum of line items):', calculatedTotal);

    // 4. Trace the logic in sync.ts
    console.log('\n--- Calculation Logic Trace ---');
    let total = Number(remoteDetails.total || remoteDetails.Total || 0);
    console.log(`Initial total from API: ${total}`);

    if (total === 0) {
        console.log('Fallback triggered because total is 0');
        if (lineItems.length > 0) {
            total = lineItems.reduce((acc: number, li: any) => {
                const price = Number(li.unitAmount || li.unitPrice || li.UnitPrice || 0);
                const qty = Number(li.quantity || li.Quantity || 0);
                const lineTotal = Number(li.lineTotal || li.total || li.Total || (price * qty));
                return acc + lineTotal;
            }, 0);
            console.log(`Value derived from ${lineItems.length} line items: $${total}`);
        } else {
            console.log('No line items found for fallback.');
        }
    }

    if (total === 0 && project.total > 0) {
        console.log(`Final fallback to local total: ${project.total}`);
        total = Number(project.total);
    }

    console.log('Final value to be stored:', total);

    process.exit(0);
}

main().catch(error => {
    console.error('Fatal Error:', error);
    process.exit(1);
});
