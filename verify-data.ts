import { db } from './src/db';
import { projects } from './src/db/schema';
import { desc, eq } from 'drizzle-orm';
import { isActiveWorkStatus, isProductiveProject } from './src/lib/project-utils';

async function run() {
  const allProjects = await db.query.projects.findMany({
    where: eq(projects.isArchived, false),
  });

  let juneAllCount = 0;
  let juneAllValue = 0;
  let juneActiveCount = 0;
  let juneActiveValue = 0;
  let statuses: Record<string, number> = {};

  allProjects.forEach(p => {
    if (!p.deliveryDate) return;
    const m = new Date(p.deliveryDate);
    const monthStr = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    
    if (monthStr === '2026-06') {
      juneAllCount++;
      juneAllValue += (Number(p.total) || 0);

      const isActive = isActiveWorkStatus(p.rawStatus);
      const isProductive = isProductiveProject(p.projectNumber);

      if (isActive && isProductive) {
        juneActiveCount++;
        juneActiveValue += (Number(p.total) || 0);
      }

      statuses[p.rawStatus || 'Unknown'] = (statuses[p.rawStatus || 'Unknown'] || 0) + 1;
    }
  });

  console.log('June All Count:', juneAllCount);
  console.log('June All Value:', juneAllValue);
  console.log('June Active Count:', juneActiveCount);
  console.log('June Active Value:', juneActiveValue);
  console.log('Statuses in June:', statuses);
  process.exit(0);
}

run().catch(console.error);
