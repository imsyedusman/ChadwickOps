import { db } from './src/db';
import { sql } from 'drizzle-orm';

async function checkColumns() {
    try {
        const result = await db.execute(sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'projects'
        `);
        const columns = result.map(r => r.column_name);
        console.log('Current columns in "projects" table:');
        console.log(columns);
        
        const targetColumns = [
            'sheetmetal_ordered_date', 
            'sheetmetal_delivered_date', 
            'switchgear_ordered_date', 
            'switchgear_delivered_date'
        ];
        
        const missing = targetColumns.filter(c => !columns.includes(c));
        if (missing.length === 0) {
            console.log('SUCCESS: All target columns are present.');
        } else {
            console.log('MISSING COLUMNS:', missing);
        }
    } catch (error) {
        console.error('Error checking columns:', error);
    } finally {
        process.exit(0);
    }
}

checkColumns();
