
import { db } from '../src/db';
import { projects } from '../src/db/schema';
import { isActiveWorkStatus } from '../src/lib/project-utils';

async function verify() {
  const res = await db.select({ status: projects.rawStatus, number: projects.projectNumber }).from(projects);
  const active = res.filter(p => isActiveWorkStatus(p.status));
  
  console.log('--- FINAL VERIFICATION ---');
  console.log(`Total Projects: ${res.length}`);
  console.log(`Active Projects (Detected): ${active.length}`);
  
  if (active.length < 10) {
      console.log('ACTIVE PROJECTS LIST:');
      active.forEach(p => console.log(`- ${p.number}: ${p.status}`));
      
      console.log('\nSAMPLE NON-ACTIVE (IN PROGRESS?):');
      res.filter(p => !isActiveWorkStatus(p.status) && p.status?.includes('Progress')).slice(0, 5).forEach(p => {
          console.log(`- ${p.number}: "${p.status}"`);
      });
  }
}

verify().catch(console.error);
