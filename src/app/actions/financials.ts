'use server';

import { db } from '@/db';
import {
    projects,
    clients,
    projectFinancialSnapshots
} from '@/db/schema';
import { eq, and, desc, or } from 'drizzle-orm';
import { ProjectFinancialService } from '@/lib/financials';
import { validateSession } from '@/lib/auth-helpers';

import { subMonths, format, parseISO, endOfMonth } from 'date-fns';
import { inArray, sql, lte } from 'drizzle-orm';
import { ACTIVE_PROJECT_STATUSES, normalizeStatus } from '@/lib/constants';
import { invoices, timeEntries, purchaseOrders } from '@/db/schema';

export async function getJobCostReport(monthStr: string) {
    const session = await validateSession();
    if (!session) {
        throw new Error("Unauthorized");
    }

    const currentMonthDate = parseISO(monthStr + '-01');
    const prevMonthDate = subMonths(currentMonthDate, 1);
    const prevMonthStr = format(prevMonthDate, 'yyyy-MM');

    // 1. Identify all project IDs that are relevant for this month's reporting
    // Relevant = (Active status) OR (Has balance in current month) OR (Has balance in prev month)
    // AND must NOT start with '99'
    
    const snapshotProjectIds = await db.select({ projectId: projectFinancialSnapshots.projectId })
        .from(projectFinancialSnapshots)
        .where(or(
            eq(projectFinancialSnapshots.snapshotMonth, monthStr),
            eq(projectFinancialSnapshots.snapshotMonth, prevMonthStr)
        ));
    
    const relevantProjectIds = new Set(snapshotProjectIds.map(s => s.projectId));

    const allRelevantProjects = await db.select({
        id: projects.id,
        workguruId: projects.workguruId,
        projectNumber: projects.projectNumber,
        name: projects.name,
        projectManager: projects.projectManager,
        clientName: clients.name,
        startDate: projects.startDate,
        deliveryDate: projects.deliveryDate,
        rawStatus: projects.rawStatus,
        isArchived: projects.isArchived
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .where(and(
        eq(projects.isArchived, false),
        sql`NOT (${projects.projectNumber} LIKE '99%')`
    ));

    // Filter projects to only those that were either active OR have a snapshot
    const activeProjects = allRelevantProjects.filter(p => 
        ACTIVE_PROJECT_STATUSES.includes(normalizeStatus(p.rawStatus) as any) || relevantProjectIds.has(p.id)
    );

    // 2. Fetch authoritative snapshots for current month (Closing)
    const currentSnapshots = await db.select()
        .from(projectFinancialSnapshots)
        .where(eq(projectFinancialSnapshots.snapshotMonth, monthStr));

    // 3. Fetch authoritative snapshots for previous month (Opening)
    const prevSnapshots = await db.select()
        .from(projectFinancialSnapshots)
        .where(eq(projectFinancialSnapshots.snapshotMonth, prevMonthStr));

    // 4. Fetch invoices for current month movement
    const currentInvoices = await db.select({
        projectId: invoices.projectId,
        total: sql<number>`sum(${invoices.total})`
    })
    .from(invoices)
    .where(and(
        inArray(invoices.status, ['Approved', 'Sent', 'Paid']),
        sql`TO_CHAR(${invoices.issueDate}, 'YYYY-MM') = ${monthStr}`
    ))
    .groupBy(invoices.projectId);

    const monthEnd = endOfMonth(currentMonthDate);

    // Fetch counts for debug visibility
    const timesheetCounts = await db.select({
        projectId: timeEntries.projectId,
        count: sql<number>`count(*)`
    })
    .from(timeEntries)
    .where(lte(timeEntries.date, monthEnd))
    .groupBy(timeEntries.projectId);

    const poCounts = await db.select({
        projectId: purchaseOrders.projectId,
        count: sql<number>`count(*)`
    })
    .from(purchaseOrders)
    .where(and(
        eq(purchaseOrders.status, 'Received'),
        lte(purchaseOrders.receivedDate, monthEnd)
    ))
    .groupBy(purchaseOrders.projectId);

    const invoiceCounts = await db.select({
        projectId: invoices.projectId,
        count: sql<number>`count(*)`
    })
    .from(invoices)
    .where(and(
        inArray(invoices.status, ['Approved', 'Sent', 'Paid']),
        lte(invoices.issueDate, monthEnd)
    ))
    .groupBy(invoices.projectId);

    const currentSnapshotMap = new Map(currentSnapshots.map(s => [s.projectId, s]));
    const prevSnapshotMap = new Map(prevSnapshots.map(s => [s.projectId, s]));
    const invoiceMap = new Map(currentInvoices.map(i => [i.projectId, Number(i.total || 0)]));
    const tsCountMap = new Map(timesheetCounts.map(c => [c.projectId, Number(c.count)]));
    const poCountMap = new Map(poCounts.map(c => [c.projectId, Number(c.count)]));
    const invCountMap = new Map(invoiceCounts.map(c => [c.projectId, Number(c.count)]));

    const projectsWithFinancials = activeProjects.map(p => {
        const currentSnapshot = currentSnapshotMap.get(p.id);
        const prevSnapshot = prevSnapshotMap.get(p.id);
        const invoicedThisMonth = invoiceMap.get(p.id) || 0;
        
        const openingBalance = prevSnapshot?.unrecoveredAmount || 0;
        const closingBalance = currentSnapshot?.unrecoveredAmount || 0;
        const labourThisMonth = currentSnapshot?.labourCostThisMonth || 0;
        const approvedLabourThisMonth = currentSnapshot?.approvedLabourCostThisMonth || 0;
        const pendingLabourCostThisMonth = currentSnapshot?.pendingLabourCostThisMonth || 0;
        const materialThisMonth = currentSnapshot?.materialCostThisMonth || 0;

        // Validation Rule: Opening + Labour + Materials - Invoiced ≈ Closing
        const movementSum = openingBalance + labourThisMonth + materialThisMonth - invoicedThisMonth;
        const isReconciled = Math.abs(movementSum - closingBalance) < 1.0; // Allow $1 difference for rounding

        return {
            ...p,
            financials: currentSnapshot || {
                totalCostToDate: 0,
                totalInvoicedToDate: 0,
                unrecoveredAmount: 0,
                labourCostThisMonth: 0,
                approvedLabourCostThisMonth: 0,
                pendingLabourCostThisMonth: 0,
                materialCostThisMonth: 0,
                updatedAt: null
            },
            openingBalance,
            closingBalance,
            invoicedThisMonth,
            labourThisMonth,
            approvedLabourThisMonth,
            pendingLabourCostThisMonth,
            materialThisMonth,
            isReconciled,
            discrepancy: movementSum - closingBalance,
            isTableVisible: ACTIVE_PROJECT_STATUSES.includes(normalizeStatus(p.rawStatus) as any),
            debug: {
                timesheetCount: tsCountMap.get(p.id) || 0,
                poCount: poCountMap.get(p.id) || 0,
                invoiceCount: invCountMap.get(p.id) || 0,
                movementInvoiced: invoicedThisMonth,
                monthEnd: format(monthEnd, 'yyyy-MM-dd')
            }
        };
    });

    return projectsWithFinancials.sort((a, b) => {
        const valA = a.closingBalance || 0;
        const valB = b.closingBalance || 0;
        if (valB === valA) return a.name.localeCompare(b.name);
        return valB - valA;
    });
}

import { systemConfig } from '@/db/schema';
import { SyncService } from '@/lib/sync';
import { decrypt } from '@/lib/crypto';

export async function syncProjectFinancials(projectId: number) {
    const session = await validateSession();
    if (!session) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        // 1. Fetch credentials
        const config = await db.query.systemConfig.findFirst({
            where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
        });

        if (!config) throw new Error('WorkGuru API Credentials not configured');
        const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
        const decryptedKey = decrypt(apiKey);
        const decryptedSecret = decrypt(apiSecret);

        // 2. Find the project's workguruId
        const project = await db.query.projects.findFirst({
            where: eq(projects.id, projectId)
        });

        if (!project || !project.workguruId) {
            throw new Error('Project not found or missing WorkGuru ID');
        }

        // 3. Trigger Deep Sync (This will fetch from API)
        const syncService = new SyncService(decryptedKey, decryptedSecret);
        await syncService.syncProjectById(project.workguruId);

        // 4. Recalculate (Already called inside syncProjectById, but doing it again to be safe/explicit)
        await ProjectFinancialService.recalculateAll(projectId);

        return { success: true };
    } catch (error: any) {
        console.error(`[FinancialAction] Sync failed for project ${projectId}:`, error.message);
        return { success: false, error: error.message };
    }
}

export async function getInvoicedThisMonthReport(monthStr: string) {
    const session = await validateSession();
    if (!session) {
        throw new Error("Unauthorized");
    }

    const currentMonthDate = parseISO(monthStr + '-01');
    const prevMonthDate = subMonths(currentMonthDate, 1);
    const prevMonthStr = format(prevMonthDate, 'yyyy-MM');

    // Current month invoices
    const currentInvoices = await db.select({
        projectNumber: projects.projectNumber,
        projectName: projects.name,
        clientName: clients.name,
        invoiceDate: invoices.issueDate,
        invoiceAmount: invoices.total,
        invoiceStatus: invoices.status,
    })
    .from(invoices)
    .innerJoin(projects, eq(invoices.projectId, projects.id))
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .where(and(
        inArray(invoices.status, ['Approved', 'Sent', 'Paid']),
        sql`TO_CHAR(${invoices.issueDate}, 'YYYY-MM') = ${monthStr}`
    ));

    // Previous month total
    const prevInvoicesTotal = await db.select({
        total: sql<number>`sum(${invoices.total})`
    })
    .from(invoices)
    .where(and(
        inArray(invoices.status, ['Approved', 'Sent', 'Paid']),
        sql`TO_CHAR(${invoices.issueDate}, 'YYYY-MM') = ${prevMonthStr}`
    ));

    const previousMonthAmount = Number(prevInvoicesTotal[0]?.total || 0);

    const totalAmount = currentInvoices.reduce((sum, inv) => sum + Number(inv.invoiceAmount || 0), 0);
    const totalCount = currentInvoices.length;

    return {
        invoices: currentInvoices,
        summary: {
            totalAmount,
            totalCount,
            previousMonthAmount
        }
    };
}

