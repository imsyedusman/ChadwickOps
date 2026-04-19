import { db } from './src/db';
import { sql } from 'drizzle-orm';

async function run() {
  console.log('Running migration...');
  await db.execute(sql`ALTER TABLE "projects" ADD COLUMN "total" double precision DEFAULT 0 NOT NULL;`);
  console.log('Migration complete!');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
