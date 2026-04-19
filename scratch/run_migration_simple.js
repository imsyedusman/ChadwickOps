const postgres = require('postgres');
const sql_client = postgres("postgresql://chadwick_user:Developer2k26!@localhost:5432/chadwick_ops");

async function run() {
  console.log('Running migration...');
  await sql_client`ALTER TABLE "projects" ADD COLUMN "total" double precision DEFAULT 0 NOT NULL;`;
  console.log('Migration complete!');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
