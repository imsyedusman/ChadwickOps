import * as fs from 'fs';

// Load .env variables manually to ensure they are available before db import
const envFiles = ['.env', '.env.local'];
envFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const envConfig = fs.readFileSync(file, 'utf-8');
    envConfig.split('\n').forEach(line => {
      const [key, ...values] = line.split('=');
      if (key && values.length > 0 && !key.trim().startsWith('#')) {
        process.env[key.trim()] = values.join('=').trim().replace(/(^"|"$)/g, '');
      }
    });
  }
});

import { db } from "./src/db/index";
import { sql } from "drizzle-orm";

async function run() {
    try {
        await db.execute(sql`ALTER TABLE "worker_assignments" ADD COLUMN "created_by_auto" boolean DEFAULT false NOT NULL;`);
        console.log("Migration executed successfully!");
    } catch (e: any) {
        if (e.message && e.message.includes("already exists")) {
            console.log("Column already exists.");
        } else {
            console.error(e);
            process.exit(1);
        }
    }
    process.exit(0);
}
run();
