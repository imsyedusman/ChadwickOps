const { db } = require('./src/db');
const { projects } = require('./src/db/schema');
const { isNotNull } = require('drizzle-orm');

async function check() {
    try {
        const results = await db.select({ 
            id: projects.workguruId, 
            name: projects.name, 
            approval: projects.drawingApprovalDate, 
            submitted: projects.drawingSubmittedDate 
        })
        .from(projects)
        .where(isNotNull(projects.drawingApprovalDate))
        .limit(10);
        
        console.log('Projects with Drawing Approval Date:');
        console.log(JSON.stringify(results, null, 2));

        const results2 = await db.select({ 
            id: projects.workguruId, 
            name: projects.name, 
            approval: projects.drawingApprovalDate, 
            submitted: projects.drawingSubmittedDate 
        })
        .from(projects)
        .where(isNotNull(projects.drawingSubmittedDate))
        .limit(10);
        
        console.log('\nProjects with Drawing Submitted Date:');
        console.log(JSON.stringify(results2, null, 2));

    } catch (error) {
        console.error('Error checking DB:', error);
    } finally {
        process.exit(0);
    }
}

check();
