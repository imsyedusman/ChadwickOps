import fs from 'fs';
import postgres from 'postgres';

const env = fs.readFileSync('.env', 'utf8');
const dbUrlLine = env.split('\n').find(l => l.startsWith('DATABASE_URL'));
if (!dbUrlLine) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}
let dbUrl = dbUrlLine.split('=')[1].trim();
if (dbUrl.startsWith('"') && dbUrl.endsWith('"')) {
  dbUrl = dbUrl.slice(1, -1);
}

const sql = postgres(dbUrl);
const query = fs.readFileSync('drizzle/0022_cloudy_changeling.sql', 'utf8');

sql.unsafe(query).then(() => {
  console.log('Migrated successfully');
  process.exit(0);
}).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
