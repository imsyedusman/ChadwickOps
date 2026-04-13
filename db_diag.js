const postgres = require('postgres');

const DATABASE_URL = 'postgresql://chadwick_user:Developer2k26!@localhost:5432/chadwick_ops';
const sql = postgres(DATABASE_URL);

async function diag() {
  console.log("Checking DB directly for bay_location data...");
  try {
    const res = await sql`SELECT project_number, bay_location FROM projects WHERE bay_location IS NOT NULL LIMIT 5`;
    if (res.length === 0) {
      console.log("No data found in bay_location column.");
    } else {
      console.log("Found data:", res);
    }
  } catch (err) {
    console.error("DB check failed:", err.message);
  } finally {
    await sql.end();
  }
}

diag();
