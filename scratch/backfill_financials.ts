import { SyncService } from '../src/lib/sync';
import { db } from '../src/db';
import { projects, systemConfig } from '../src/db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { decrypt } from '../src/lib/crypto';
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

async function runBackfill() {
    console.log('--- STARTING FINANCIAL DATA BACKFILL ---');
    loadEnv();

    try {
        // 1. Get Credentials
        const config = await db.query.systemConfig.findFirst({
            where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
        });

        if (!config) throw new Error('WorkGuru API Credentials not configured');
        const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
        const decryptedKey = decrypt(apiKey);
        const decryptedSecret = decrypt(apiSecret);

        const syncService = new SyncService(decryptedKey, decryptedSecret);

        // 2. Find all active projects
        const activeProjects = await db.select().from(projects).where(eq(projects.isArchived, false));
        console.log(`Found ${activeProjects.length} active projects to backfill.`);

        // 3. Process with concurrency control (sequential with delay)
        let count = 0;
        for (const project of activeProjects) {
            count++;
            console.log(`[${count}/${activeProjects.length}] Backfilling ${project.projectNumber} (${project.name})...`);
            
            try {
                await syncService.syncProjectById(project.workguruId);
                console.log(`   ✅ Success`);
            } catch (e: any) {
                console.error(`   ❌ Failed: ${e.message}`);
            }

            // Small delay to be polite to the API
            await new Promise(r => setTimeout(r, 200));
        }

        console.log('\n--- BACKFILL COMPLETED ---');

    } catch (error) {
        console.error('Backfill CRASHED:', error);
    } finally {
        process.exit(0);
    }
}

runBackfill();
