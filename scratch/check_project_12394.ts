import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { db } from '../src/db';
import { projects } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function checkProject() {
  const projectNumber = '12394-01';
  const result = await db.select().from(projects).where(eq(projects.projectNumber, projectNumber)).limit(1);
  console.log('Project Details for', projectNumber);
  console.log(JSON.stringify(result[0], null, 2));
  process.exit(0);
}

checkProject();
