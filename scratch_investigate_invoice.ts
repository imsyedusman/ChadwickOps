import { db } from './src/db';
import { projects, invoices, projectFinancialSnapshots } from './src/db/schema';
import { eq, and } from 'drizzle-orm';

async function investigate() {
    const projectNumber = '12393-01';
    const workguruProjectId = '1282335';
    const workguruInvoiceId = '1155116';

    console.log('--- Investigation ---');
    
    // 1. Find Project
    const project = await db.query.projects.findFirst({
        where: eq(projects.projectNumber, projectNumber)
    });
    
    if (!project) {
        console.log(`Project ${projectNumber} not found in DB.`);
    } else {
        console.log(`Project found: ID=${project.id}, Name=${project.name}, WG_ID=${project.workguruId}`);
        
        // 2. Find Invoice
        const projectInvoices = await db.select().from(invoices).where(eq(invoices.projectId, project.id));
        console.log(`Found ${projectInvoices.length} invoices for this project.`);
        
        const targetInvoice = projectInvoices.find(i => i.workguruId === workguruInvoiceId);
        if (targetInvoice) {
            console.log(`Target Invoice ${workguruInvoiceId} found:`);
            console.log(`- ID: ${targetInvoice.id}`);
            console.log(`- Status: ${targetInvoice.status}`);
            console.log(`- Date: ${targetInvoice.issueDate}`);
            console.log(`- Total: ${targetInvoice.total}`);
        } else {
            console.log(`Target Invoice ${workguruInvoiceId} NOT found for this project.`);
        }

        // 3. Check Snapshots
        const snapshots = await db.select().from(projectFinancialSnapshots).where(eq(projectFinancialSnapshots.projectId, project.id));
        console.log(`Found ${snapshots.length} snapshots.`);
        snapshots.forEach(s => {
            console.log(`- Month: ${s.snapshotMonth}, Unrecovered: ${s.unrecoveredAmount}, LabourThisMonth: ${s.labourCostThisMonth}, InvoicedToDate: ${s.totalInvoicedToDate}`);
        });
    }
}

investigate().catch(console.error);
