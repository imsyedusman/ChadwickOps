import postgres from 'postgres';

async function investigate() {
    const sql = postgres('postgresql://chadwick_user:Developer2k26!@localhost:5432/chadwick_ops');
    try {
        console.log('--- DATABASE INVESTIGATION (REFINED) ---');
        
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

        // 2. Check if ANY time entries have cost > 0
        const costEntries = await sql`SELECT count(*) FROM time_entries WHERE cost > 0`;
        console.log('Time entries with cost > 0:', costEntries[0].count);

        // 3. Check projects with snapshots
        const projectsWithSnapshots = await sql`
            SELECT p.id, p.name, p.workguru_id, count(s.id) as s_count 
            FROM projects p 
            JOIN project_financial_snapshots s ON p.id = s.project_id 
            GROUP BY p.id, p.name, p.workguru_id 
            LIMIT 5
        `;
        console.log('\nProjects with Snapshots:', projectsWithSnapshots);

        if (projectsWithTime.length > 0) {
            const pid = projectsWithTime[0].id;
            console.log(`\n--- Deep Dive Project ID: ${pid} (${projectsWithTime[0].name}) ---`);
            
            const timesheets = await sql`SELECT id, cost, hours FROM time_entries WHERE project_id = ${pid} LIMIT 5`;
            const pos = await sql`SELECT id, total, status FROM purchase_orders WHERE project_id = ${pid} LIMIT 5`;
            const invs = await sql`SELECT id, total, status FROM invoices WHERE project_id = ${pid} LIMIT 5`;
            
            console.log('Timesheets:', timesheets);
            console.log('POs:', pos);
            console.log('Invoices:', invs);
        }

        // 4. Snapshot Check
        const snapshots = await sql`SELECT * FROM project_financial_snapshots ORDER BY updated_at DESC LIMIT 5`;
        console.log('\nRecent Snapshots:', snapshots);

        // 5. Check Sync Logs for errors or financial mentions
        const logs = await sql`SELECT timestamp, status, details FROM sync_logs ORDER BY timestamp DESC LIMIT 50`;
        console.log('\nRecent Logs (Total 50 checked):');
        logs.forEach(l => {
            const content = l.details || '';
            if (l.status === 'FAILURE' || content.includes('failed') || content.includes('Error') || content.includes('Financial')) {
                console.log(`[${l.timestamp.toISOString()}] ${l.status}: ${content.substring(0, 200)}`);
            }
        });

    } catch (e) {
        console.error('Investigation Failed:', e);
    } finally {
        await sql.end();
    }
}

investigate();
