
import { db } from '@/db';
import { purchaseOrders, projects } from '@/db/schema';
import { sql, eq, and, lte, gte } from 'drizzle-orm';

async function investigatePOs() {
  // 1. PO Statuses in DB
  const statuses = await db.select({ 
    status: purchaseOrders.status, 
    count: sql<number>`count(*)` 
  }).from(purchaseOrders).groupBy(purchaseOrders.status);
  
  console.log('--- PO STATUSES IN DB ---');
  console.table(statuses);

  // Check receivedDate for 'Received' POs
  const receivedPos = await db.select({
    hasReceivedDate: sql<boolean>`${purchaseOrders.receivedDate} IS NOT NULL`,
    count: sql<number>`count(*)`
  })
  .from(purchaseOrders)
  .where(eq(purchaseOrders.status, 'Received'))
  .groupBy(sql`${purchaseOrders.receivedDate} IS NOT NULL`);

  console.log('\n--- "Received" Status PO Date Check ---');
  console.table(receivedPos);

  const totalCount = await db.select({ value: sql<number>`count(*)` }).from(purchaseOrders);
  console.log('Total POs:', totalCount[0].value);

  // 3. Find a project with mixed PO statuses for manual inspection
  // We want a project that has both 'Received' and other statuses (like 'Approved' or 'Draft')
  const projectWithMixedPOs = await db.select({
    projectId: purchaseOrders.projectId,
    status: purchaseOrders.status,
    count: sql<number>`count(*)`
  })
  .from(purchaseOrders)
  .groupBy(purchaseOrders.projectId, purchaseOrders.status);

  // Group by project ID to find ones with multiple statuses
  const projectStats: Record<number, string[]> = {};
  projectWithMixedPOs.forEach(row => {
    if (!projectStats[row.projectId]) projectStats[row.projectId] = [];
    projectStats[row.projectId].push(row.status);
  });

  const targetProjectId = Object.keys(projectStats).find(id => {
    const s = projectStats[Number(id)];
    return s.includes('Received') && (s.includes('Approved') || s.includes('Draft') || s.includes('Ordered'));
  });

  if (targetProjectId) {
    const id = Number(targetProjectId);
    const project = await db.query.projects.findFirst({
        where: eq(projects.id, id)
    });

    console.log(`\n--- INSPECTING PROJECT: ${project?.projectNumber} (${project?.name}) ---`);
    
    const projectPOs = await db.select().from(purchaseOrders).where(eq(purchaseOrders.projectId, id));
    console.log(`Total POs for this project: ${projectPOs.length}`);
    
    const breakdown = projectPOs.map(po => ({
        Number: po.orderNumber,
        Status: po.status,
        Created: po.issueDate ? new Date(po.issueDate).toISOString().split('T')[0] : 'N/A',
        Received: po.receivedDate ? new Date(po.receivedDate).toISOString().split('T')[0] : 'N/A',
        Total: po.total,
        IncludedInWIP: po.status === 'Received' ? 'YES' : 'NO'
    }));

    console.table(breakdown);

    // Calculate WIP according to current logic
    const wipMaterials = projectPOs
        .filter(po => po.status === 'Received')
        .reduce((sum, po) => sum + Number(po.total || 0), 0);
    
    const allMaterials = projectPOs
        .reduce((sum, po) => sum + Number(po.total || 0), 0);

    console.log(`Current Logic Material Total (Received Only): ${wipMaterials}`);
    console.log(`Sum of ALL POs (including non-received): ${allMaterials}`);
  } else {
    console.log('No project found with mixed PO statuses for comparison.');
  }
}

investigatePOs().catch(console.error);
