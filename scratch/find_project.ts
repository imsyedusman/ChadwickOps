
import { db } from '../src/db';
import { projects } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const project = await db.query.projects.findFirst({
        where: eq(projects.projectNumber, '12394-02')
    });

    if (project) {
        console.log('Found project:');
        console.log(JSON.stringify(project, null, 2));
    } else {
        console.log('Project 12394-02 not found in database.');
    }

    process.exit(0);
}

main().catch(console.error);
