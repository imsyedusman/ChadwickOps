import postgres from 'postgres';

async function run() {
    const sql = postgres('postgresql://chadwick_user:Developer2k26!@localhost:5432/chadwick_ops');
    try {
        const pCount = await sql`SELECT count(*) FROM projects WHERE is_archived = false`;
        const sCount = await sql`SELECT count(*) FROM project_financial_snapshots`;
        const statuses = await sql`SELECT raw_status, count(*) FROM projects GROUP BY raw_status`;
        
        console.log({ 
            activeProjects: pCount[0].count, 
            snapshots: sCount[0].count 
        });
        console.log('Statuses:', statuses);
        
        const sampleActive = await sql`SELECT id, project_number, name, is_archived FROM projects WHERE is_archived = false LIMIT 5`;
        console.log('Sample Active:', sampleActive);
    } catch (e) {
        console.error(e);
    } finally {
        await sql.end();
    }
}

run();
