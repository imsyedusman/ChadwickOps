import { WorkGuruClient } from './src/lib/workguru';
import { db } from './src/db';
import { eq } from 'drizzle-orm';
import { systemConfig } from './src/db/schema';
import { decrypt } from './src/lib/crypto';

async function verifyTax() {
    const config = await db.query.systemConfig.findFirst({
        where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config) throw new Error('WorkGuru API Credentials not configured');
    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    const client = new WorkGuruClient(decryptedKey, decryptedSecret);
    
    // Check Invoice 1155116
    console.log('--- Invoice 1155116 (Dedicated) ---');
    const invRes = await client.getProjectInvoices('1282335');
    const inv = (invRes.items || invRes.result?.items || invRes.result || []).find((i: any) => String(i.id) === '1155116');
    if (inv) {
        console.log(`total: ${inv.total}`);
        console.log(`totalTax: ${inv.totalTax}`);
        console.log(`baseCurrencyTotal: ${inv.baseCurrencyTotal}`);
        console.log(`amountOutstanding: ${inv.amountOutstanding}`);
        const isExTax = Math.abs(Number(inv.total) * 0.1 - Number(inv.totalTax)) < 0.01;
        console.log(`Is total Ex-Tax? ${isExTax} (Total * 0.1 == TotalTax)`);
    }

    // Check a PO for same project
    console.log('--- PO for project 1282335 ---');
    const poRes = await client.getProjectPurchaseOrders('1282335');
    const po = (poRes.items || poRes.result?.items || poRes.result || [])[0];
    if (po) {
        console.log(`total: ${po.total}`);
        console.log(`totalTax: ${po.totalTax}`);
        console.log(`totalNet: ${po.totalNet}`);
        const isExTax = Math.abs(Number(po.totalNet) * 0.1 - Number(po.totalTax)) < 0.01 || Math.abs(Number(po.total) * 0.1 - Number(po.totalTax)) < 0.01;
        console.log(`PO Data:`, JSON.stringify(po, null, 2));
    }
}

verifyTax().catch(console.error);
