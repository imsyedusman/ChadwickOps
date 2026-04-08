import postgres from 'postgres';

async function diagnose() {
  const sql = postgres(process.env.DATABASE_URL!);
  
  try {
    console.log('--- SYSTEM_CONFIG ---');
    const configs = await sql`SELECT * FROM system_config`;
    configs.forEach(c => console.log(`${c.key}: ${JSON.stringify(c.value)}`));

    const prevSync = configs.find(c => c.key === 'PREVIOUS_FULL_SYNC_START');
    if (prevSync) {
        console.log('Raw PREVIOUS_FULL_SYNC_START value:', prevSync.value);
    }

    console.log('\n--- PROJECT TIMESTAMPS ---');
    const counts = await sql`
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE is_archived = true) as archived,
            COUNT(*) FILTER (WHERE is_archived = false) as active
        FROM projects
    `;
    console.log(`Total: ${counts[0].total}, Active: ${counts[0].active}, Archived: ${counts[0].archived}`);

    const topSeens = await sql`
        SELECT project_number, last_seen_at, is_archived
        FROM projects
        WHERE is_archived = false
        ORDER BY last_seen_at ASC
        LIMIT 10
    `;
    console.log('\nOldest last_seen_at (Active):');
    topSeens.forEach(p => console.log(`${p.project_number}: ${p.last_seen_at.toISOString()}`));

    if (prevSync) {
        const threshold = (prevSync.value as any).timestamp;
        console.log(`\nThreshold for archiving: ${threshold}`);
        const missings = await sql`
            SELECT count(*) 
            FROM projects 
            WHERE is_archived = false 
            AND last_seen_at < ${threshold}::timestamp
        `;
        console.log(`Projects satisfying last_seen_at < threshold: ${missings[0].count}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

diagnose();
