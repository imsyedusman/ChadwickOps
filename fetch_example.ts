import { db } from './src/db';
import { systemConfig } from './src/db/schema';
import { eq } from 'drizzle-orm';
import { WorkGuruClient } from './src/lib/workguru';
import { decrypt } from './src/lib/crypto';

async function t() {
    const config = await db.query.systemConfig.findFirst({ where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS') });
    const { apiKey, apiSecret } = config.value as any;
    const client = new WorkGuruClient(decrypt(apiKey), decrypt(apiSecret));
    const now = new Date().toISOString();
    const ten = new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000).toISOString();
    const resp = await client.getAllProjectsCompletedInDateRange(ten, now);
    const p1 = resp.result.find((p: any) => p.ProjectNo === '12421-01');
    const p2 = resp.result.find((p: any) => p.ProjectNo === '12372-10');
    console.log("--- 12421-01 ---");
    console.log(JSON.stringify(p1, null, 2));
    console.log("--- 12372-10 ---");
    console.log(JSON.stringify(p2, null, 2));
    process.exit(0);
}
t();
