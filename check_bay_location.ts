import { db } from "./src/db";
import { projects } from "./src/db/schema";
import { sql } from "drizzle-orm";

async function checkBayLocation() {
  console.log("Checking for projects with bayLocation...");
  const results = await db.select({
    id: projects.id,
    projectNumber: projects.projectNumber,
    bayLocation: projects.bayLocation,
  })
  .from(projects)
  .where(sql`${projects.bayLocation} IS NOT NULL AND ${projects.bayLocation} != ''`)
  .limit(10);

  if (results.length === 0) {
    console.log("No projects found with bayLocation data.");
    
    // Check total count
    const total = await db.select({ count: sql`count(*)` }).from(projects);
    console.log(`Total projects in DB: ${total[0].count}`);
  } else {
    console.log(`Found ${results.length} projects with bayLocation:`);
    results.forEach(r => console.log(`- ${r.projectNumber}: ${r.bayLocation}`));
  }
  
  process.exit(0);
}

checkBayLocation().catch(err => {
  console.error(err);
  process.exit(1);
});
