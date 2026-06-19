const { db } = require('./src/db/index.js');
const { projects } = require('./src/db/schema.js');
const { eq, isNotNull, and } = require('drizzle-orm');

async function run() {
    const res = await db.select().from(projects).where(and(eq(projects.isArchived, false), isNotNull(projects.bayLocation)));
    console.log('Total in bays:', res.length);
    console.log('With deliveryDate:', res.filter(r => r.deliveryDate).length);
    process.exit(0);
}
run().catch(console.error);
