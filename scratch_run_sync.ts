import { db } from './src/db';
import { systemConfig } from './src/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from './src/lib/crypto';
import { ProfitabilitySyncService } from './src/lib/profitability-sync';

async function main() {
    try {
        const config = await db.query.systemConfig.findFirst({
            where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
        });
        
        if (!config || !config.value) {
            console.error("No config found");
            return;
        }
        
        const creds = config.value as { apiKey: string; apiSecret: string };
        const apiKey = decrypt(creds.apiKey);
        const apiSecret = decrypt(creds.apiSecret);
        
        console.log("Starting Profitability Sync Test...");
        const syncService = new ProfitabilitySyncService(apiKey, apiSecret);
        const result = await syncService.runSync();
        
        console.log("Sync Result:", result);
        
        // Verify in DB
        const activeCount = await db.query.profitabilityData.findMany({
            where: (t, { eq }) => eq(t.isHistorical, false)
        });
        const historicalCount = await db.query.profitabilityData.findMany({
            where: (t, { eq }) => eq(t.isHistorical, true)
        });
        
        console.log(`\nDB Verification:`);
        console.log(`Active records stored: ${activeCount.length}`);
        console.log(`Historical records stored: ${historicalCount.length}`);
        
        if (activeCount.length > 0) {
            console.log("\nSample Active Record:");
            console.log(JSON.stringify(activeCount[0], null, 2));
        }
        if (historicalCount.length > 0) {
            console.log("\nSample Historical Record:");
            console.log(JSON.stringify(historicalCount[0], null, 2));
        }
        
        process.exit(0);
    } catch (e: any) {
        console.error("Fatal Error:", e.message);
        process.exit(1);
    }
}

main();
