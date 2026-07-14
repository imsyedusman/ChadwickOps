import { db } from "./src/db/index";
import { sql } from "drizzle-orm";

async function run() {
  try {
    const res = await db.execute(sql`SELECT raw_status, COUNT(*) as count FROM projects GROUP BY raw_status ORDER BY count DESC`);
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
