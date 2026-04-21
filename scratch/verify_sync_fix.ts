
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

import { db } from '../src/db';
import { projects, systemConfig } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { SyncService } from '../src/lib/sync';
import { decrypt } from '../src/lib/crypto';

async function verify() {
    console.log('--- Sync Fix Verification ---');
    
    // 1. Prepare Test Data
    const targetNo = '12414-01'; // Known project with 0 in List API but 1725 in Detail
    console.log(`Setting project ${targetNo} to $0 in DB...`);
    await db.update(projects).set({ total: 0 }).where(eq(projects.projectNumber, targetNo));
    
    // Verify it is indeed 0
    let p = await db.query.projects.findFirst({ where: eq(projects.projectNumber, targetNo) });
    console.log('Current DB Value (Initial):', p?.total);

    // 2. Fetch Credentials
    const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS')
    });
    if (!config) throw new Error('Missing API config');
    const { apiKey, apiSecret } = config.value as any;
    
    const syncService = new SyncService(decrypt(apiKey), decrypt(apiSecret));

    // 3. Test Scenario 1: Recovery from Zero (Deep Sync should set it to 1725)
    console.log('\nRunning Sync Cycle (Scenario 1: Recovery)...');
    // Note: We'll run runSync directly. It now performs a FULL sync.
    await syncService.runSync('FULL');

    p = await db.query.projects.findFirst({ where: eq(projects.projectNumber, targetNo) });
    console.log('Value after Sync:', p?.total);
    if (p?.total === 1725) {
        console.log('✅ Scenario 1 Passed: Recovered to $1,725');
    } else {
        console.error('❌ Scenario 1 Failed: Value is', p?.total);
    }

    // 4. Test Scenario 2: List API "Undo" Protection
    // Base Sync is now protected. If we run sync again, it should STAY at 1725
    console.log('\nRunning Sync Cycle again (Scenario 2: Overwrite Protection)...');
    await syncService.runSync('FULL');

    p = await db.query.projects.findFirst({ where: eq(projects.projectNumber, targetNo) });
    console.log('Value after second Sync:', p?.total);
    if (p?.total === 1725) {
        console.log('✅ Scenario 2 Passed: Stayed at $1,725');
    } else {
        console.error('❌ Scenario 2 Failed: Value flipped to', p?.total);
    }

    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
