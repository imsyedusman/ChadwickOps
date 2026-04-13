import { db } from "./src/db";
import { systemConfig } from "./src/db/schema";
import { SyncService } from "./src/lib/sync";
import { decrypt } from "./src/lib/crypto";
import { eq } from "drizzle-orm";

async function runDiagnosticSync() {
  console.log("Starting diagnostic sync...");
  try {
    const config = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config) {
      console.error("No API credentials found in DB.");
      return;
    }

    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    const syncService = new SyncService(decryptedKey, decryptedSecret);
    // We only need to see ONE project, so runSync('QUICK') should be enough
    await syncService.runSync('QUICK');
    
    console.log("Diagnostic sync finished.");
  } catch (error) {
    console.error("Diagnostic sync failed:", error);
  }
  process.exit(0);
}

runDiagnosticSync();
