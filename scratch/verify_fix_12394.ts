
import fs from 'fs';
import path from 'path';

// Manually load .env
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            const k = key.trim();
            const v = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            process.env[k] = v;
        }
    });
}

async function runSync() {
    const { SyncService } = await import('../src/lib/sync');
    const { decrypt } = await import('../src/lib/crypto');
    const { db } = await import('../src/db');
    const { projects, systemConfig } = await import('../src/db/schema');
    const { eq } = await import('drizzle-orm');

    const configRes = await db.select().from(systemConfig).where(eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS')).limit(1);
    const config = configRes[0];
    const { apiKey, apiSecret } = config.value as { apiKey: string, apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    const syncService = new SyncService(decryptedKey, decryptedSecret);
    const targetWgId = '1282372'; // WG ID for 12394-01 from my previous trace
    
    console.log('Running manual sync for project 12394-01...');
    await syncService.syncProjectById(targetWgId);
    
    const updated = await db.select().from(projects).where(eq(projects.workguruId, targetWgId)).limit(1);
    console.log('Updated DB Start Date:', updated[0].startDate);
    
    process.exit(0);
}

runSync().catch(err => {
    console.error(err);
    process.exit(1);
});
