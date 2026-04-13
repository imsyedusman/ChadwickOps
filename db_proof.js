const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL);

async function check() {
  try {
    console.log("Checking for bay_location data...");
    const results = await sql`SELECT project_number, bay_location FROM projects WHERE bay_location IS NOT NULL AND bay_location != '' LIMIT 5`;
    console.log("PROOFS:", JSON.stringify(results, null, 2));
  } catch (err) {
    console.error("DB error:", err.message);
  } finally {
    await sql.end();
  }
}

check();
