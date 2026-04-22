import { db } from './src/db/index';
import { systemConfig } from './src/db/schema';

async function checkConfig() {
    try {
        const configs = await db.select().from(systemConfig);
        console.log(`Found ${configs.length} config entries.`);
        configs.forEach(c => {
            console.log(`- Key: ${c.key}`);
        });
    } catch (error: any) {
        console.error('Error checking config:', error.message);
    } finally {
        process.exit(0);
    }
}

checkConfig();
