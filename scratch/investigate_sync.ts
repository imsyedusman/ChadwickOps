import { db } from '../src/db';
import { projects, syncLogs } from '../src/db/schema';
import { eq, desc } from 'drizzle-orm';

async function investigate() {
    console.log('--- Project 12394-02 Check ---');
    const targetProject = await db.query.projects.findFirst({
        where: eq(projects.projectNumber, '12394-02')
    });
    console.log('Project 12394-02:', JSON.stringify(targetProject, null, 2));

    console.log('\n--- Latest Sync Logs ---');
    const logs = await db.query.syncLogs.findMany({
        orderBy: [desc(syncLogs.timestamp)],
        limit: 5
    });
    logs.forEach(log => {
        console.log(`ID: ${log.id}, Status: ${log.status}, Timestamp: ${log.timestamp}`);
        console.log(`Details: ${log.details}`);
    });

    console.log('\n--- Database Stats ---');
    const allProjects = await db.select().from(projects);
    console.log(`Total Projects in DB: ${allProjects.length}`);
    const archived = allProjects.filter(p => p.isArchived).length;
    console.log(`Archived Projects: ${archived}`);
    const active = allProjects.length - archived;
    console.log(`Active Projects: ${active}`);

    process.exit(0);
}

investigate().catch(err => {
    console.error(err);
    process.exit(1);
});
