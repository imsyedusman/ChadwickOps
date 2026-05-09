import { db } from '@/db';
import { 
    projects, 
    timeEntries, 
    purchaseOrders, 
    invoices, 
    projectFinancialSnapshots 
} from '@/db/schema';
import { eq, and, lte, gte, sql, desc, or, inArray, notInArray } from 'drizzle-orm';
import { format, startOfMonth, endOfMonth, parse } from 'date-fns';

export class ProjectFinancialService {
    /**
     * Generates or updates a financial snapshot for a specific project and month.
     * Strictly DB-only.
     */
    static async generateSnapshot(projectId: number, monthStr: string) {
        const monthDate = parse(monthStr, 'yyyy-MM', new Date());
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);

        // APPROVED STATUSES for Labour
        // Based on user requirements: Approved, Invoiced, and similar are "finalized"
        const APPROVED_LABOUR_STATUSES = ['Approved', 'Invoiced', 'Ready for Invoicing', 'Sent'];

        // 1. Calculate Total Costs to Date (Incurred)
        // Labor - We include ALL logged labor for the cost-to-date (WIP)
        const laborCostsToDate = await db.select({
            total: sql<number>`COALESCE(SUM(${timeEntries.cost}), 0)`
        })
        .from(timeEntries)
        .where(and(
            eq(timeEntries.projectId, projectId),
            lte(timeEntries.date, monthEnd)
        ));

        // Materials (POs) - ONLY Received status where receivedDate is in range
        const materialCostsToDate = await db.select({
            total: sql<number>`COALESCE(SUM(${purchaseOrders.total}), 0)`
        })
        .from(purchaseOrders)
        .where(and(
            eq(purchaseOrders.projectId, projectId),
            eq(purchaseOrders.status, 'Received'),
            lte(purchaseOrders.receivedDate, monthEnd)
        ));

        const totalCostToDate = Number(laborCostsToDate[0].total) + Number(materialCostsToDate[0].total);

        // 2. Calculate Total Invoiced to Date
        const invoicedToDate = await db.select({
            total: sql<number>`COALESCE(SUM(${invoices.total}), 0)`
        })
        .from(invoices)
        .where(and(
            eq(invoices.projectId, projectId),
            lte(invoices.issueDate, monthEnd),
            or(
                eq(invoices.status, 'Approved'),
                eq(invoices.status, 'Sent'),
                eq(invoices.status, 'Paid')
            )
        ));

        const totalInvoicedToDate = Number(invoicedToDate[0].total);

        // 3. Calculate This Month's Incremental Costs
        
        // TOTAL Labour This Month
        const laborCostThisMonth = await db.select({
            total: sql<number>`COALESCE(SUM(${timeEntries.cost}), 0)`
        })
        .from(timeEntries)
        .where(and(
            eq(timeEntries.projectId, projectId),
            gte(timeEntries.date, monthStart),
            lte(timeEntries.date, monthEnd)
        ));

        // APPROVED Labour This Month
        const approvedLaborThisMonth = await db.select({
            total: sql<number>`COALESCE(SUM(${timeEntries.cost}), 0)`
        })
        .from(timeEntries)
        .where(and(
            eq(timeEntries.projectId, projectId),
            gte(timeEntries.date, monthStart),
            lte(timeEntries.date, monthEnd),
            inArray(timeEntries.status, APPROVED_LABOUR_STATUSES)
        ));

        // PENDING Labour This Month (Anything not in approved list)
        const pendingLaborThisMonth = await db.select({
            total: sql<number>`COALESCE(SUM(${timeEntries.cost}), 0)`
        })
        .from(timeEntries)
        .where(and(
            eq(timeEntries.projectId, projectId),
            gte(timeEntries.date, monthStart),
            lte(timeEntries.date, monthEnd),
            notInArray(timeEntries.status, APPROVED_LABOUR_STATUSES)
        ));

        const materialCostThisMonth = await db.select({
            total: sql<number>`COALESCE(SUM(${purchaseOrders.total}), 0)`
        })
        .from(purchaseOrders)
        .where(and(
            eq(purchaseOrders.projectId, projectId),
            eq(purchaseOrders.status, 'Received'),
            gte(purchaseOrders.receivedDate, monthStart),
            lte(purchaseOrders.receivedDate, monthEnd)
        ));

        // 4. Calculate Unrecovered Amount (WIP)
        const unrecoveredAmount = totalCostToDate - totalInvoicedToDate;

        const labourTotal = Number(laborCostThisMonth[0].total);
        const approvedLabourTotal = Number(approvedLaborThisMonth[0].total);
        const pendingLabourTotal = Number(pendingLaborThisMonth[0].total);
        const materialTotal = Number(materialCostThisMonth[0].total);

        // 5. Upsert Snapshot
        await db.insert(projectFinancialSnapshots)
            .values({
                projectId,
                snapshotMonth: monthStr,
                totalCostToDate,
                totalInvoicedToDate,
                unrecoveredAmount,
                labourCostThisMonth: labourTotal,
                approvedLabourCostThisMonth: approvedLabourTotal,
                pendingLabourCostThisMonth: pendingLabourTotal,
                materialCostThisMonth: materialTotal,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: [projectFinancialSnapshots.projectId, projectFinancialSnapshots.snapshotMonth],
                set: {
                    totalCostToDate,
                    totalInvoicedToDate,
                    unrecoveredAmount,
                    labourCostThisMonth: labourTotal,
                    approvedLabourCostThisMonth: approvedLabourTotal,
                    pendingLabourCostThisMonth: pendingLabourTotal,
                    materialCostThisMonth: materialTotal,
                    updatedAt: new Date(),
                }
            });

        return {
            projectId,
            month: monthStr,
            totalCostToDate,
            totalInvoicedToDate,
            unrecoveredAmount
        };
    }

    /**
     * Recalculates snapshots for all months where activity exists for a project.
     */
    static async recalculateAll(projectId: number) {
        // Find first and last activity dates
        const firstDateRes = await db.select({
            date: sql<string>`MIN(d)`
        }).from(sql`(
            SELECT MIN(date) as d FROM time_entries WHERE project_id = ${projectId}
            UNION
            SELECT MIN(issue_date) as d FROM purchase_orders WHERE project_id = ${projectId}
            UNION
            SELECT MIN(issue_date) as d FROM invoices WHERE project_id = ${projectId}
        ) as combined`);

        if (!firstDateRes[0]?.date) return;

        const startDate = startOfMonth(new Date(firstDateRes[0].date));
        const endDate = startOfMonth(new Date());

        let current = startDate;
        while (current <= endDate) {
            const monthStr = format(current, 'yyyy-MM');
            await this.generateSnapshot(projectId, monthStr);
            current = new Date(current.setMonth(current.getMonth() + 1));
        }
    }
}
