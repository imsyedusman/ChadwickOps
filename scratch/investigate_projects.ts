import axios from 'axios';
import { decrypt } from '../src/lib/crypto';
import { db } from '../src/db';
import { systemConfig, projects } from '../src/db/schema';
import { eq, sql, and, or, notInArray, gt, isNull } from 'drizzle-orm';

async function investigate() {
    const projectNumbers = process.argv.slice(2);
    if (projectNumbers.length === 0) {
        console.error('Please provide project numbers (e.g. 12432-01)');
        process.exit(1);
    }

    const configRes = await db.select().from(systemConfig).where(eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS')).limit(1);
    const config = configRes[0];
    if (!config) {
        console.error('No API credentials found in DB');
        process.exit(1);
    }

    const { apiKey, apiSecret } = config.value as { apiKey: string, apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    const tokenRes = await axios.post('https://api.workguru.io/api/ClientTokenAuth/Authenticate/api/client/v1/tokenauth', {
        apiKey: decryptedKey,
        secret: decryptedSecret,
    });
    const token = tokenRes.data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    for (const projectNo of projectNumbers) {
        console.log(`\n==================================================`);
        console.log(`INVESTIGATION FOR PROJECT: ${projectNo}`);
        console.log(`==================================================`);

        // 1. Database State
        const dbProject = await db.query.projects.findFirst({
            where: eq(projects.projectNumber, projectNo)
        });

        if (!dbProject) {
            console.log(`DB State: NOT FOUND in database`);
            // We'll try to find it in the API anyway
        } else {
            console.log(`DB State:`);
            console.log(` - ID: ${dbProject.id}`);
            console.log(` - WorkGuru ID: ${dbProject.workguruId}`);
            console.log(` - Status: ${dbProject.rawStatus}`);
            console.log(` - isArchived: ${dbProject.isArchived}`);
            console.log(` - RemoteUpdatedAt: ${dbProject.remoteUpdatedAt}`);
            console.log(` - LastDeepSyncAt: ${dbProject.lastDeepSyncAt}`);
            console.log(` - Total in DB: ${dbProject.total}`);

            // 2. Logic Check (Eligibility)
            const finishedStatuses = ['completed', 'invoiced', 'closed', 'cancelled'];
            const isFinished = finishedStatuses.includes((dbProject.rawStatus || '').toLowerCase());
            const isRecent = dbProject.remoteUpdatedAt && new Date(dbProject.remoteUpdatedAt) > sixtyDaysAgo;
            const neverSynced = !dbProject.lastDeepSyncAt;

            const isEligible = !dbProject.isArchived && (!isFinished || isRecent || neverSynced);
            
            console.log(`Eligibility Check:`);
            console.log(` - isArchived=false: ${!dbProject.isArchived}`);
            console.log(` - !isFinished: ${!isFinished} (Status: ${dbProject.rawStatus})`);
            console.log(` - isRecent (<60d): ${isRecent} (${dbProject.remoteUpdatedAt})`);
            console.log(` - neverSynced: ${neverSynced}`);
            console.log(` - RESULT: ${isEligible ? 'INCLUDED' : 'EXCLUDED'}`);
        }

        // 3. API Data - Detail
        if (dbProject?.workguruId) {
            console.log(`\nAPI Data (Detail API):`);
            try {
                const detailRes = await axios.get(`https://api.workguru.io/api/services/app/Project/GetProjectById?id=${dbProject.workguruId}`, { headers });
                const remote = detailRes.data.result;
                console.log(` - Total reported: ${remote.total || remote.Total}`);
                const lineItems = remote.productLineItems || remote.ProductLineItems || [];
                console.log(` - Line Items count: ${lineItems.length}`);
                
                const calculatedTotal = lineItems.reduce((acc: number, li: any) => acc + (Number(li.lineTotal || li.Total || 0)), 0);
                console.log(` - Calculated Total (Sum of Line Items): ${calculatedTotal}`);
                
                if (lineItems.length > 0) {
                   console.log(` - Sample Line Item: ${JSON.stringify({ name: lineItems[0].name, lineTotal: lineItems[0].lineTotal, quantity: lineItems[0].quantity }, null, 2)}`);
                }
            } catch (err: any) {
                console.error(` - Error fetching Detail API: ${err.message}`);
            }
        } else {
             console.log(`\nAPI Data: Cannot call Detail API without WorkGuru ID`);
        }

        // 4. API Data - List (Check if it exists in GetAllProjects)
        console.log(`\nAPI Data (List API - GetAllProjects):`);
        try {
            const listRes = await axios.get(`https://api.workguru.io/api/services/app/Project/GetAllProjects?MaxResultCount=5000`, { headers });
            const items = listRes.data.result?.items || listRes.data.result || [];
            const foundInList = items.find((p: any) => (p.projectNo || p.ProjectNumber) === projectNo);
            if (foundInList) {
                console.log(` - Found in List: YES`);
                console.log(` - List Total: ${foundInList.total || foundInList.Total}`);
                console.log(` - List Status: ${foundInList.status || foundInList.Status}`);
            } else {
                console.log(` - Found in List: NO`);
            }
        } catch (err: any) {
             console.error(` - Error fetching List API: ${err.message}`);
        }
    }

    process.exit(0);
}

investigate().catch(err => {
    console.error(err);
    process.exit(1);
});
