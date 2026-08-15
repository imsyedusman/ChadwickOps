import { ProfitabilitySyncService } from "./src/lib/profitability-sync";
import { db } from "./src/db";
import { systemConfig } from "./src/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "./src/lib/crypto";

async function run() {
  try {
    const config = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config || !config.value) {
      throw new Error('WorkGuru API Credentials not configured');
    }

    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    const syncService = new ProfitabilitySyncService(decryptedKey, decryptedSecret);
    const result = await syncService.runSync();
    console.log(result);
  } catch (error) {
    console.error("Error running sync:", error);
  }
  process.exit(0);
}
run();
