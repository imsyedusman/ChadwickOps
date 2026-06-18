import { db } from './src/db';
import { purchaseOrders, purchaseOrderLines, projects } from './src/db/schema';
import { eq, and, or, ne, isNotNull, sql } from 'drizzle-orm';
import { determineLineAction } from './src/lib/procurement-logic';
import { differenceInDays, startOfDay } from 'date-fns';

async function main() {
  console.log("=== Query 1: Arrivals ===");
  const arrivalsData = await db.select({
      line: purchaseOrderLines,
      po: purchaseOrders,
      project: projects
  })
  .from(purchaseOrderLines)
  .innerJoin(purchaseOrders, eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id))
  .innerJoin(projects, eq(purchaseOrderLines.projectId, projects.id))
  .where(and(
      sql`${purchaseOrderLines.quantity} > ${purchaseOrderLines.receivedQuantity}`,
      or(
          eq(purchaseOrderLines.supplierName, 'HI SWITCH'),
          eq(purchaseOrderLines.supplierName, 'PM SWITCHBOARDS(NSW)P/L'),
          eq(purchaseOrders.supplierName, 'HI SWITCH'),
          eq(purchaseOrders.supplierName, 'PM SWITCHBOARDS(NSW)P/L')
      )
  ));
  
  const arrivals = arrivalsData.map(item => {
      const supplier = item.line.supplierName && item.line.supplierName !== 'Unknown' ? item.line.supplierName : (item.po.supplierName || 'Unknown');
      
      const action = determineLineAction({
          workguruId: item.line.workguruId,
          poNumber: item.line.poNumber,
          supplierName: supplier,
          name: item.line.name || 'Unknown',
          quantity: item.line.quantity,
          receivedQuantity: item.line.receivedQuantity,
          unitPrice: item.line.unitPrice,
          expectedDate: item.po.expectedDate
      }, item.project.deliveryDate);
      
      return {
          projectName: item.project.name,
          projectNumber: item.project.projectNumber,
          expectedDate: item.po.expectedDate ? item.po.expectedDate.toISOString().split('T')[0] : null,
          riskStatus: action.label,
      };
  });
  
  arrivals.sort((a, b) => {
      const dateA = a.expectedDate ? new Date(a.expectedDate).getTime() : Infinity;
      const dateB = b.expectedDate ? new Date(b.expectedDate).getTime() : Infinity;
      return dateA - dateB;
  });
  console.log(JSON.stringify(arrivals, null, 2));


  console.log("\n=== Query 2: In Progress (Grouped by Bay) ===");
  const inProgressProjects = await db.select()
      .from(projects)
      .where(and(
          isNotNull(projects.bayLocation),
          ne(projects.bayLocation, ''),
          ne(projects.bayLocation, 'Dispatch')
      ));
      
  const bayGroups: Record<string, any[]> = {};
  for (const p of inProgressProjects) {
      const bay = p.bayLocation as string;
      if (!bayGroups[bay]) bayGroups[bay] = [];
      bayGroups[bay].push({
          projectName: p.name,
          projectNumber: p.projectNumber,
          progressPercent: Math.round(p.progressPercent * 10) / 10
      });
  }
  console.log(JSON.stringify(bayGroups, null, 2));


  console.log("\n=== Query 3: Departures ===");
  const departuresProjects = await db.select()
      .from(projects)
      .where(eq(projects.bayLocation, 'Dispatch'));
      
  const today = startOfDay(new Date());
  const departures = departuresProjects.map(p => {
      let status = "On track";
      if (p.deliveryDate) {
          const dDate = startOfDay(new Date(p.deliveryDate));
          if (dDate < today) {
              status = "Overdue";
          } else {
              const diff = differenceInDays(dDate, today);
              if (diff >= 0 && diff <= 2) {
                  status = "Due soon";
              }
          }
      }
      return {
          projectName: p.name,
          projectNumber: p.projectNumber,
          deliveryDate: p.deliveryDate ? p.deliveryDate.toISOString().split('T')[0] : null,
          dateStatus: status,
          isCompletedStatus: p.rawStatus === '3.2 - Delivered' || p.rawStatus === 'Completed',
          isInactive: p.isArchived,
          rawStatusStr: p.rawStatus
      };
  });
  console.log(JSON.stringify(departures, null, 2));

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
