import postgres from 'postgres';

async function investigate() {
    const sql = postgres('postgresql://chadwick_user:Developer2k26!@localhost:5432/chadwick_ops');
    try {
        console.log('--- DATABASE INVESTIGATION ---');
        
        // 1. Raw Data Counts
        const tCount = await sql`SELECT count(*) FROM time_entries`;
        const pCount = await sql`SELECT count(*) FROM purchase_orders`;
        const iCount = await sql`SELECT count(*) FROM invoices`;
        const sCount = await sql`SELECT count(*) FROM project_financial_snapshots`;
        
        console.log({
            time_entries: tCount[0].count,
            purchase_orders: pCount[0].count,
            invoices: iCount[0].count,
            snapshots: sCount[0].count
        });

        // 2. Sample Project with Financial Potential
        // Look for projects that have been synced recently and might have data
        const sampleProjects = await sql`SELECT id, name, workguru_id FROM projects WHERE is_archived = false LIMIT 5`;
        console.log('\nSample Active Projects:', sampleProjects);

        // 3. Deep Dive into 1 Project (if data exists)
        if (sampleProjects.length > 0) {
            const pid = sampleProjects[0].id;
            console.log(`\n--- Deep Dive Project ID: ${pid} (${sampleProjects[0].name}) ---`);
            
            const timesheets = await sql`SELECT id, cost, duration FROM time_entries WHERE project_id = ${pid} LIMIT 5`;
            const pos = await sql`SELECT id, total_net, status FROM purchase_orders WHERE project_id = ${pid} LIMIT 5`;
            const invs = await sql`SELECT id, total_net, status FROM invoices WHERE project_id = ${pid} LIMIT 5`;
            
            console.log('Timesheets (cost):', timesheets);
            console.log('POs (total_net):', pos);
            console.log('Invoices (total_net):', invs);
        }

        // 4. Snapshot Check
        const snapshots = await sql`SELECT * FROM project_financial_snapshots LIMIT 5`;
        console.log('\nSample Snapshots:', snapshots);

        // 5. Check Sync Logs for Financial Mentions
        const logs = await sql`SELECT log_type, message FROM sync_logs ORDER BY created_at DESC LIMIT 20`;
        console.log('\nRecent Sync Logs:', logs.filter(l => l.message.includes('financial') || l.message.includes('cost') || l.message.includes('Project')));

    } catch (e) {
        console.error(e);
    } finally {
        await sql.end();
    }
}

investigate();
