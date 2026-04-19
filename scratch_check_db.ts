import { db } from './src/db';
import { projects } from './src/db/schema';
import { sql } from 'drizzle-orm';

async function checkDbValues() {
    console.log('=== DATABASE CUSTOM FIELD COUNT ===');
    try {
        const counts = await db.select({
            total: sql<number>`count(*)`,
            bayCount: sql<number>`count(bay_location)`,
            appCount: sql<number>`count(drawing_approval_date)`,
            subCount: sql<number>`count(drawing_submitted_date)`,
            smOrdCount: sql<number>`count(sheetmetal_ordered_date)`,
            smDelCount: sql<number>`count(sheetmetal_delivered_date)`,
            sgOrdCount: sql<number>`count(switchgear_ordered_date)`,
            sgDelCount: sql<number>`count(switchgear_delivered_date)`
        })
        .from(projects);

        console.log('Counts of non-null values:');
        console.table(counts);

        if (counts[0].bayCount > 0) {
            console.log('\nSample projects with Bay Location:');
            const samples = await db.select({
                id: projects.projectNumber,
                bay: projects.bayLocation
            })
            .from(projects)
            .where(sql`bay_location IS NOT NULL`)
            .limit(5);
            console.table(samples);
        }

    } catch (error) {
        console.error('Error checking DB:', error);
    } finally {
        process.exit(0);
    }
}

checkDbValues();
