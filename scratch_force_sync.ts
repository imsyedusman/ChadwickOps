import { SyncService } from './src/lib/sync';
import { db } from './src/db';
import { eq } from 'drizzle-orm';
import { systemConfig } from './src/db/schema';
import { decrypt } from './src/lib/crypto';

async function forceSync() {
    const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config) throw new Error('WorkGuru API Credentials not configured');
    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    const sync = new SyncService(decryptedKey, decryptedSecret);
    
    const projectsToSync = ['1282335', '1282329']; // RAG & FAMISH, NUCLEUS
    
    for (const wgId of projectsToSync) {
        console.log(`Force syncing ${wgId}...`);
        await sync.syncProjectById(wgId);
    }
}

forceSync().catch(console.error);
