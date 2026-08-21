import * as fs from 'fs';
import * as path from 'path';

try {
  const envPath = path.resolve(process.cwd(), '.env');
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["'](.*)["']$/, '$1');
    }
  });
} catch (e) {}

async function run() {
  const { db } = await import('./src/db');
  const { systemConfig } = await import('./src/db/schema');
  const { decrypt } = await import('./src/lib/crypto');
  const { eq } = await import('drizzle-orm');
  
  const configRes = await db.select().from(systemConfig).where(eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS')).limit(1);
  const config = configRes[0];

  if (!config) throw new Error('No config');
  const { apiKey, apiSecret } = config.value as { apiKey: string, apiSecret: string };

  const { ProfitabilitySyncService } = await import('./src/lib/profitability-sync');
  const svc = new ProfitabilitySyncService(decrypt(apiKey), decrypt(apiSecret));
  console.log("Starting sync...");
  await svc.runSync();
  console.log("Sync done.");
  process.exit(0);
}

run().catch(console.error);