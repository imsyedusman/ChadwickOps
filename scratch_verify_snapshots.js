
const path = require('path');
const fs = require('fs');

// Load .env manually
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1');
        }
    });
}

const { ProjectFinancialService } = require('./src/lib/financials');
const { db } = require('./src/db');
const { projects, projectFinancialSnapshots } = require('./src/db/schema');
const { eq } = require('drizzle-orm');

async function verify() {
    console.log('--- Step 5: Snapshot Verification ---');
    
    const targetProjectId = '1282417';
    const projectRow = await db.select().from(projects).where(eq(projects.workguruId, targetProjectId)).limit(1);
    const p = projectRow[0];
    
    console.log(`Generating all snapshots for: ${p.name} (ID: ${p.id})...`);
    await ProjectFinancialService.recalculateAll(p.id);
    
    const snapshots = await db.select().from(projectFinancialSnapshots)
        .where(eq(projectFinancialSnapshots.projectId, p.id))
        .orderBy(projectFinancialSnapshots.snapshotMonth);
        
    console.log(`\nFound ${snapshots.length} snapshots:`);
    console.log('Month   | Cost to Date | Invoiced to Date | Unrecovered');
    console.log('-------------------------------------------------------');
    
    snapshots.forEach(s => {
        console.log(`${s.snapshotMonth} | $${s.totalCostToDate.toFixed(2).padStart(12)} | $${s.totalInvoicedToDate.toFixed(2).padStart(16)} | $${s.unrecoveredAmount.toFixed(2).padStart(11)}`);
    });
    
    process.exit(0);
}

verify();
