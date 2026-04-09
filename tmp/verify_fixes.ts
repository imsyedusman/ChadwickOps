
import { db } from './src/db';
import { projects } from './src/db/schema';
import { sql, like } from 'drizzle-orm';
import { isActiveWorkStatus } from './src/lib/project-utils';

async function verify() {
  console.log('--- VERIFYING PM FIELD ---');
  const badPMs = await db.select().from(projects).where(like(projects.projectManager, '%[object Object]%'));
  console.log(`Found ${badPMs.length} projects with [object Object] Project Manager.`);
  if (badPMs.length > 0) {
      console.log('Sample IDs:', badPMs.slice(0, 5).map(p => p.projectNumber));
  }

  console.log('\n--- VERIFYING STATUS FILTERING ---');
  const allProjects = await db.query.projects.findMany();
  const activeCount = allProjects.filter(p => isActiveWorkStatus(p.rawStatus)).length;
  const inactiveCount = allProjects.length - activeCount;
  
  console.log(`Verified Statuses: ${activeCount} Active, ${inactiveCount} Inactive (Excluded).`);
  
  const sampleInactive = allProjects.find(p => !isActiveWorkStatus(p.rawStatus));
  if (sampleInactive) {
      console.log(`Sample Inactive Project: ${sampleInactive.projectNumber} - ${sampleInactive.rawStatus}`);
  }
}

verify().catch(console.error);
