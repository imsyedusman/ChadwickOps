
import { db } from './src/db';
import { projects } from './src/db/schema';

async function listStatuses() {
  const res = await db.select({ status: projects.rawStatus }).from(projects);
  const counts: Record<string, number> = {};
  for (const row of res) {
    if (!row.status) continue;
    counts[row.status] = (counts[row.status] || 0) + 1;
  }
  console.log('--- STATUS LIST ---');
  Object.keys(counts).sort().forEach(status => {
    console.log(`${status}: ${counts[status]}`);
  });
}

listStatuses().catch(console.error);
