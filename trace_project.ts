import { db } from './src/db';
import { projects, timeEntries, purchaseOrders, invoices } from './src/db/schema';
import { eq, sql } from 'drizzle-orm';

async function traceProject() {
    // Find a project with time entries, POs, and invoices
    const sample = await db.select({
        id: projects.id,
        projectNumber: projects.projectNumber,
        name: projects.name,
        timeCount: sql<number>`(SELECT count(*) FROM ${timeEntries} WHERE project_id = ${projects.id})`,
        poCount: sql<number>`(SELECT count(*) FROM ${purchaseOrders} WHERE project_id = ${projects.id})`,
        invoiceCount: sql<number>`(SELECT count(*) FROM ${invoices} WHERE project_id = ${projects.id})`,
    })
    .from(projects)
    .where(sql`(SELECT count(*) FROM ${timeEntries} WHERE project_id = ${projects.id}) > 0 
               AND (SELECT count(*) FROM ${purchaseOrders} WHERE project_id = ${projects.id}) > 0
               AND (SELECT count(*) FROM ${invoices} WHERE project_id = ${projects.id}) > 0`)
    .limit(1);

    if (sample.length === 0) {
        console.log("No project found with all data types.");
        return;
    }

    const p = sample[0];
    console.log(`Tracing Project: ${p.projectNumber} - ${p.name} (ID: ${p.id})`);

    const times = await db.select().from(timeEntries).where(eq(timeEntries.projectId, p.id)).limit(5);
    const pos = await db.select().from(purchaseOrders).where(eq(purchaseOrders.projectId, p.id)).limit(5);
    const invs = await db.select().from(invoices).where(eq(invoices.projectId, p.id)).limit(5);

    console.log("\n--- Labour Data ---");
    times.forEach(t => console.log(`Date: ${t.date}, Hours: ${t.hours}, Cost: ${t.cost}, User: ${t.user}`));
    
    console.log("\n--- Material Data ---");
    pos.forEach(po => console.log(`Date: ${po.issueDate}, Total: ${po.total}, Status: ${po.status}, Supplier: ${po.supplierName}`));

    console.log("\n--- Invoiced Data ---");
    invs.forEach(inv => console.log(`Date: ${inv.issueDate}, Total: ${inv.total}, Status: ${inv.status}`));

    const totalLabour = times.reduce((sum, t) => sum + Number(t.cost), 0);
    const totalMaterial = pos.reduce((sum, po) => sum + Number(po.total), 0);
    const totalInvoiced = invs.reduce((sum, inv) => sum + Number(inv.total), 0);

    console.log(`\nSample Totals (limited to 5 records each):`);
    console.log(`Labour: ${totalLabour}`);
    console.log(`Material: ${totalMaterial}`);
    console.log(`Invoiced: ${totalInvoiced}`);
}

traceProject().catch(console.error);
