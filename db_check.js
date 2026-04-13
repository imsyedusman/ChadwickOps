const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL);

async function checkData() {
  console.log("Checking DB for bay_location...");
  try {
    const results = await sql`SELECT project_number, bay_location FROM projects WHERE bay_location IS NOT NULL AND bay_location != '' LIMIT 5`;
    if (results.length === 0) {
      console.log("No projects with bay_location found in DB.");
    } else {
      console.log("Found projects with data:", results);
    }
  } catch (err) {
    console.error("DB check failed:", err.message);
  } finally {
    await sql.end();
  }
}

checkData();
