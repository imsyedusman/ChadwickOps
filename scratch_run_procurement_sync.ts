import { ProcurementSyncService } from './src/lib/procurement-sync';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function runProcurementSync() {
    console.log("--- Manually Triggering Procurement Sync ---");
    const service = new ProcurementSyncService(
        process.env.WORKGURU_API_KEY!,
        process.env.WORKGURU_API_SECRET!
    );
    
    // We'll sync just a few recent ones to see the logs
    await service.runSync('INCREMENTAL');
    console.log("Sync Complete.");
}

runProcurementSync().catch(console.error);
