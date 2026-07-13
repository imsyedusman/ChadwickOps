import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function setup() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      description VARCHAR(255)
    );
  `);
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );
  `);
  console.log("Tables created successfully");
  process.exit(0);
}

setup().catch((e) => {
  console.error(e);
  process.exit(1);
});
