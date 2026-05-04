import postgres from 'postgres';

async function investigate() {
    const sql = postgres('postgresql://chadwick_user:Developer2k26!@localhost:5432/chadwick_ops');
    try {
        console.log('--- FINAL DIAGNOSIS REPORT ---');
        
        // 1. Success Case: Project 2961
        const pSuccess = await sql`SELECT id, name, workguru_id FROM projects WHERE id = 2961`;
        const tSuccess = await sql`SELECT count(*), sum(cost) FROM time_entries WHERE project_id = 2961`;
        const poSuccess = await sql`SELECT count(*), sum(total) FROM purchase_orders WHERE project_id = 2961`;
        const iSuccess = await sql`SELECT count(*), sum(total) FROM invoices WHERE project_id = 2961`;
        const sSuccess = await sql`SELECT snapshot_month, total_cost_to_date, unrecovered_amount FROM project_financial_snapshots WHERE project_id = 2961`;

        console.log('\n[SUCCESS CASE] Project 2961 (4CYTE Pathology):');
        console.log('Timesheets:', tSuccess[0]);
        console.log('POs:', poSuccess[0]);
        console.log('Invoices:', iSuccess[0]);
        console.log('Snapshots:', sSuccess);

        // 2. Failure Case: Project 3854 (Recently synced but all 0)
        const pFail = await sql`SELECT id, name, workguru_id FROM projects WHERE id = 3854`;
        const tFail = await sql`SELECT count(*), sum(cost) FROM time_entries WHERE project_id = 3854`;
        const poFail = await sql`SELECT count(*), sum(total) FROM purchase_orders WHERE project_id = 3854`;
        const iFail = await sql`SELECT count(*), sum(total) FROM invoices WHERE project_id = 3854`;

        console.log('\n[FAILURE CASE] Project 3854 (KIERA ST):');
        console.log('Timesheets:', tFail[0]);
        console.log('POs:', poFail[0]);
        console.log('Invoices:', iFail[0]);

        // 3. Overall Totals
        const totals = await sql`
            SELECT 
                (SELECT count(*) FROM time_entries) as total_time,
                (SELECT count(*) FROM purchase_orders) as total_po,
                (SELECT count(*) FROM invoices) as total_invoice,
                (SELECT count(*) FROM project_financial_snapshots) as total_snapshots
        `;
        console.log('\n[GLOBAL TOTALS]:', totals[0]);

    } catch (e) {
        console.error(e);
    } finally {
        await sql.end();
    }
}

investigate();
