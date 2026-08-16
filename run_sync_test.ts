import { db } from './src/db';
import { systemConfig, profitabilityData } from './src/db/schema';
import { eq } from 'drizzle-orm';
import { ProfitabilitySyncService } from './src/lib/profitability-sync';
import { decrypt } from './src/lib/crypto';

async function main() {
  console.log("Fetching config...");
  const config = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
  });

  if (!config || !config.value) {
    console.log("No API credentials found");
    process.exit(1);
  }

  const { apiKey, apiSecret } = config.value as any;
  const decryptedKey = decrypt(apiKey);
  const decryptedSecret = decrypt(apiSecret);

  console.log("Running sync...");
  const syncService = new ProfitabilitySyncService(decryptedKey, decryptedSecret);
  const result = await syncService.runSync();
  console.log("Sync Result:", result);

  console.log("Verifying 12481-03...");
  const p1 = await db.query.profitabilityData.findFirst({
    where: eq(profitabilityData.projectNumber, '12481-03')
  });
  console.log("12481-03:", p1);

  console.log("Verifying 12500-01 (historical)...");
  const p2 = await db.query.profitabilityData.findFirst({
    where: eq(profitabilityData.projectNumber, '12500-01')
  });
  console.log("12500-01:", p2);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
