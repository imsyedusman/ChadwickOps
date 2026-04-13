import { db } from "./src/db";
import { systemConfig } from "./src/db/schema";
import { SyncService } from "./src/lib/sync";
import { decrypt } from "./src/lib/crypto";
import { eq } from "drizzle-orm";

async function runDiag() {
  console.log("Starting rigorous diagnostic sync...");
  try {
    const config = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config) {
        console.error("Credentials not found.");
        return;
    }

    const { apiKey, apiSecret } = config.value as any;
    const key = decrypt(apiKey);
    const secret = decrypt(apiSecret);

    const syncService = new SyncService(key, secret);
    // runSync returns stats, but we care about the console logs I added
    await syncService.runSync('QUICK');
  } catch (err) {
    console.error("Diag failed:", err);
  }
}

runDiag();
