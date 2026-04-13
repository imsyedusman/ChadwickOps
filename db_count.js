const postgres = require('postgres');
require('dotenv').config();
const sql = postgres(process.env.DATABASE_URL);

async function check() {
  try {
    const res = await sql`SELECT count(*) FROM projects`;
    console.log("Total projects in DB:", res[0].count);
    const sample = await sql`SELECT workguru_id FROM projects LIMIT 1`;
    console.log("Sample workguruId:", sample[0]?.workguru_id);
  } catch (err) {
    console.error("Check failed:", err.message);
  } finally {
    await sql.end();
  }
}
check();
