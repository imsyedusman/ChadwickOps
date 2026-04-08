import postgres from 'postgres';

async function check() {
  const sql = postgres(process.env.DATABASE_URL!);
  try {
    const res = await sql`
      SELECT 
        current_setting('TIMEZONE') as db_tz,
        NOW() as db_now_with_tz,
        LOCALTIMESTAMP as db_now_no_tz
    `;
    console.log(JSON.stringify(res[0], null, 2));

    const projectsRes = await sql`
        SELECT last_seen_at FROM projects LIMIT 1
    `;
    if (projectsRes.length > 0) {
        console.log('last_seen_at sample:', projectsRes[0].last_seen_at);
        console.log('last_seen_at ctor:', new Date(projectsRes[0].last_seen_at).toISOString());
    }

    const configRes = await sql`
        SELECT value FROM system_config WHERE key = 'PREVIOUS_FULL_SYNC_START'
    `;
    if (configRes.length > 0) {
        console.log('PREVIOUS_FULL_SYNC_START value:', configRes[0].value);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

check();
