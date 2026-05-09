import { db } from './src/db';
import { projects, timeEntries, purchaseOrders, invoices, projectFinancialSnapshots } from './src/db/schema';
import { eq, and, sql } from 'drizzle-orm';

async function finalReconciliation() {
    const projectNumbers = ['12393-01', '12392-03', '12185-02']; // Three projects to test
    
    console.log('--- FINAL RECONCILIATION PASS ---');
    console.log('Reporting Month: 2026-05 (Current)');

    for (const projectNo of projectNumbers) {
        console.log(`\n>>> Project ${projectNo} <<<`);
        
        const project = await db.query.projects.findFirst({
            where: eq(projects.projectNumber, projectNo)
        });
        
        if (!project) {
            console.log(`Project ${projectNo} not found.`);
            continue;
        }

        const snapshot = await db.query.projectFinancialSnapshots.findFirst({
            where: and(
                eq(projectFinancialSnapshots.projectId, project.id),
                eq(projectFinancialSnapshots.snapshotMonth, '2026-05')
            )
        });

        const prevSnapshot = await db.query.projectFinancialSnapshots.findFirst({
            where: and(
                eq(projectFinancialSnapshots.projectId, project.id),
                eq(projectFinancialSnapshots.snapshotMonth, '2026-04')
            )
        });

        if (!snapshot) {
            console.log('No snapshot found for 2026-05.');
            continue;
        }

        const opening = prevSnapshot?.unrecoveredAmount || 0;
        const approvedLabour = snapshot.approvedLabourCostThisMonth || 0;
        const pendingLabour = snapshot.pendingLabourCostThisMonth || 0;
        const materials = snapshot.materialCostThisMonth || 0;
        
        // Calculate Billed manually from invoices table for May
        const billedRows = await db.select({ total: sql<number>`SUM(total)` })
            .from(invoices)
            .where(and(
                eq(invoices.projectId, project.id),
                sql`TO_CHAR(issue_date, 'YYYY-MM') = '2026-05'`,
                sql`status IN ('Approved', 'Sent', 'Paid')`
            ));
        const billed = Number(billedRows[0]?.total || 0);
        
        const closing = snapshot.unrecoveredAmount || 0;

        const manualClosing = opening + approvedLabour + pendingLabour + materials - billed;
        const diff = Math.abs(manualClosing - closing);

        console.log(`Opening WIP:  ${opening.toFixed(2)}`);
        console.log(`Approved Lab: ${approvedLabour.toFixed(2)}`);
        console.log(`Pending Lab:  ${pendingLabour.toFixed(2)}`);
        console.log(`Materials:     ${materials.toFixed(2)}`);
        console.log(`Money Billed:  ${billed.toFixed(2)}`);
        console.log(`-----------------------------`);
        console.log(`CALCULATED:   ${manualClosing.toFixed(2)}`);
        console.log(`ACTUAL WIP:   ${closing.toFixed(2)}`);
        console.log(`DIFFERENCE:   ${diff.toFixed(2)}`);
        console.log(`RECONCILED:   ${diff < 1.0 ? '✅ YES' : '❌ NO'}`);
    }
}

finalReconciliation().catch(console.error);
