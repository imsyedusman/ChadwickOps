import postgres from 'postgres';

async function applyMigration() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  const sql = postgres(url);

  console.log('Applying migration to add projects.is_archived and projects.last_seen_at...');

  try {
    // Add is_archived if it doesn't exist
    await sql.unsafe(`
      ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false NOT NULL;
    `);
    console.log('Added is_archived column.');

    // Add last_seen_at if it doesn't exist
    await sql.unsafe(`
      ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp DEFAULT now() NOT NULL;
    `);
    console.log('Added last_seen_at column.');

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sql.end();
  }
}

applyMigration();
