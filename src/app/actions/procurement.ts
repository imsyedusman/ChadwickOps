'use server';

import { db } from '@/db';
import { projects, purchaseOrders, purchaseOrderLines, systemConfig, procurementSyncLogs } from '@/db/schema';
import { eq, and, desc, sql, lt, ne, inArray } from 'drizzle-orm';
import { 
    calculateProjectProcurementRisk, 
    calculateAgingDays, 
    calculateOutstandingValue, 
    determineLineAction,
    ProcurementActionMetadata,
    ProjectProcurementContext 
} from '@/lib/procurement-logic';

export interface ProcurementDashboardItem {
  id: number;
  projectNumber: string;
  projectName: string;
  projectUrl: string;
  deliveryDate: Date | null;
  action: ProcurementActionMetadata;
  stats: {
    totalLines: number;
    outstandingLines: number;
    delayedLines: number;
    missingEtaLines: number;
    totalOrdered: number;
    totalReceived: number;
    outstandingValue: number;
  };
}

export interface BackorderItem {
    id: string; // Line WorkGuruId
    projectNumber: string;
    projectName: string;
    projectUrl: string;
    projectDeliveryDate: Date | null;
    supplierName: string;
    poNumber: string;
    materialName: string;
    quantity: number;
    receivedQuantity: number;
    outstandingQuantity: number;
    unitPrice: number;
    outstandingValue: number;
    expectedDate: Date | null;
    daysOutstanding: number;
    action: ProcurementActionMetadata;
}

export interface SupplierRiskItem {
    supplierName: string;
    totalOutstandingValue: number;
    affectedProjectCount: number;
    totalLineCount: number;
    delayedLineCount: number;
    missingEtaCount: number;
    deliveryRiskCount: number;
    // Drilldown data
    affectedProjectIds: number[];
}

/**
 * Fetches data for the main Procurement Hub overview.
 */
export async function getProcurementDashboardData() {
  try {
    const allProjects = await db.select().from(projects)
      .where(eq(projects.isArchived, false))
      .orderBy(desc(projects.updatedAt));

    const allPoData = await db.select({
      line: purchaseOrderLines,
      po: purchaseOrders
    })
    .from(purchaseOrderLines)
    .innerJoin(purchaseOrders, eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id));

    const dataByProject = new Map<number, { line: any; po: any }[]>();
    for (const item of allPoData) {
      if (!dataByProject.has(item.line.projectId)) {
        dataByProject.set(item.line.projectId, []);
      }
      dataByProject.get(item.line.projectId)!.push(item);
    }

    const dashboardData: ProcurementDashboardItem[] = [];

    for (const project of allProjects) {
      const items = dataByProject.get(project.id) || [];
      
      const context: ProjectProcurementContext = {
        projectNumber: project.projectNumber,
        deliveryDate: project.deliveryDate,
        poLines: items.map(it => ({
          workguruId: it.line.workguruId,
          poNumber: it.line.poNumber,
          supplierName: it.line.supplierName || 'Unknown',
          name: it.line.name || 'Unknown',
          quantity: it.line.quantity,
          receivedQuantity: it.line.receivedQuantity,
          unitPrice: it.line.unitPrice,
          expectedDate: it.po.expectedDate
        }))
      };

      const action = calculateProjectProcurementRisk(context);
      const outstandingValue = context.poLines.reduce((acc, l) => acc + calculateOutstandingValue(l.quantity, l.receivedQuantity, l.unitPrice), 0);
      
      const stats = {
        totalLines: context.poLines.length,
        outstandingLines: context.poLines.filter(l => (l.quantity - l.receivedQuantity) > 0).length,
        delayedLines: context.poLines.filter(l => determineLineAction(l, project.deliveryDate).type === 'ACTION_FOLLOW_UP').length,
        missingEtaLines: context.poLines.filter(l => determineLineAction(l, project.deliveryDate).type === 'ACTION_CONFIRM_ETA').length,
        totalOrdered: context.poLines.reduce((acc, l) => acc + l.quantity, 0),
        totalReceived: context.poLines.reduce((acc, l) => acc + l.receivedQuantity, 0),
        outstandingValue
      };

      dashboardData.push({
        id: project.id,
        projectNumber: project.projectNumber,
        projectName: project.name || 'Unnamed Project',
        projectUrl: `https://app.workguru.io/App/Projects/Detail2/${project.workguruId}`,
        deliveryDate: project.deliveryDate,
        action,
        stats
      });
    }

    // Sort by severity (lower is more urgent)
    dashboardData.sort((a, b) => {
        if (a.action.severity !== b.action.severity) return a.action.severity - b.action.severity;
        return a.projectNumber.localeCompare(b.projectNumber);
    });

    const retryQueueConfig = await db.query.systemConfig.findFirst({ where: eq(systemConfig.key, 'PROCUREMENT_RETRY_QUEUE') });
    const permFailuresConfig = await db.query.systemConfig.findFirst({ where: eq(systemConfig.key, 'PROCUREMENT_PERMANENT_FAILURES') });
    const lastSyncLog = await db.query.procurementSyncLogs.findFirst({ orderBy: [desc(procurementSyncLogs.timestamp)] });

    const retryQueue = (retryQueueConfig?.value as any[]) || [];
    const permFailures = (permFailuresConfig?.value as any[]) || [];

    // Calculate aggregated summary with explicit operational labels
    const allOutstandingLines = Array.from(dataByProject.values()).flat();
    const materialActions = allOutstandingLines.map(it => determineLineAction({
        workguruId: it.line.workguruId,
        poNumber: it.line.poNumber,
        supplierName: it.line.supplierName || 'Unknown',
        name: it.line.name || 'Unknown',
        quantity: it.line.quantity,
        receivedQuantity: it.line.receivedQuantity,
        unitPrice: it.line.unitPrice,
        expectedDate: it.po.expectedDate
    }, null)); // Note: project context needed for full Escalate check, but this gives a good global count

    return { 
        success: true, 
        data: dashboardData,
        summary: {
            totalProjects: dashboardData.length,
            backorderItemCount: materialActions.filter(a => a.severity < 4).length,
            outstandingMaterialCost: dashboardData.reduce((acc, d) => acc + d.stats.outstandingValue, 0),
            projectsWaitingOnMaterials: dashboardData.filter(d => d.action.type === 'ACTION_ESCALATE').length,
            lateSupplierDeliveries: materialActions.filter(a => a.type === 'ACTION_FOLLOW_UP').length,
            missingSupplierEtas: materialActions.filter(a => a.type === 'ACTION_CONFIRM_ETA').length,
            syncHealth: {
                lastSyncAt: lastSyncLog?.timestamp || null,
                lastStatus: lastSyncLog?.status || 'UNKNOWN',
                retryQueueCount: retryQueue.length,
                permFailureCount: permFailures.length
            }
        }
    };
  } catch (error) {
    console.error('Failed to fetch procurement dashboard data:', error);
    return { success: false, error: 'Failed to fetch dashboard data' };
  }
}

/**
 * Fetches all items that have not been fully received.
 */
export async function getBackordersData(options: { onlyProblems?: boolean } = {}) {
    try {
        const allData = await db.select({
            line: purchaseOrderLines,
            po: purchaseOrders,
            project: projects
        })
        .from(purchaseOrderLines)
        .innerJoin(purchaseOrders, eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id))
        .innerJoin(projects, eq(purchaseOrderLines.projectId, projects.id))
        .where(sql`${purchaseOrderLines.quantity} > ${purchaseOrderLines.receivedQuantity}`)
        .orderBy(desc(purchaseOrders.expectedDate));

        const backorders: BackorderItem[] = allData.map(item => {
            const outstandingQty = item.line.quantity - item.line.receivedQuantity;
            const outstandingValue = calculateOutstandingValue(item.line.quantity, item.line.receivedQuantity, item.line.unitPrice);
            const daysOutstanding = calculateAgingDays(item.po.expectedDate || item.po.issueDate);

            const action = determineLineAction({
                workguruId: item.line.workguruId,
                poNumber: item.line.poNumber,
                supplierName: item.line.supplierName || 'Unknown',
                name: item.line.name || 'Unknown',
                quantity: item.line.quantity,
                receivedQuantity: item.line.receivedQuantity,
                unitPrice: item.line.unitPrice,
                expectedDate: item.po.expectedDate
            }, item.project.deliveryDate);

            return {
                id: item.line.workguruId,
                projectNumber: item.project.projectNumber,
                projectName: item.project.name || 'Unnamed Project',
                projectUrl: `https://app.workguru.io/App/Projects/Detail2/${item.project.workguruId}`,
                projectDeliveryDate: item.project.deliveryDate,
                supplierName: item.line.supplierName !== 'Unknown' ? item.line.supplierName : (item.po.supplierName || 'Unknown'),
                poNumber: item.line.poNumber,
                materialName: item.line.name || 'Unknown',
                quantity: item.line.quantity,
                receivedQuantity: item.line.receivedQuantity,
                outstandingQuantity: outstandingQty,
                unitPrice: item.line.unitPrice,
                outstandingValue,
                expectedDate: item.po.expectedDate,
                daysOutstanding,
                action
            };
        });

        if (options.onlyProblems) {
            return {
                success: true,
                data: backorders.filter(b => b.action.severity < 4)
            };
        }

        return { success: true, data: backorders };
    } catch (error) {
        console.error('Failed to fetch backorders data:', error);
        return { success: false, error: 'Failed to fetch backorders' };
    }
}

/**
 * Groups procurement bottlenecks by Supplier.
 */
export async function getSupplierRiskData() {
    try {
        const backorders = await getBackordersData();
        if (!backorders.success || !backorders.data) throw new Error(backorders.error);

        const supplierMap = new Map<string, SupplierRiskItem>();

        for (const item of backorders.data) {
            if (!supplierMap.has(item.supplierName)) {
                supplierMap.set(item.supplierName, {
                    supplierName: item.supplierName,
                    totalOutstandingValue: 0,
                    affectedProjectCount: 0,
                    totalLineCount: 0,
                    delayedLineCount: 0,
                    missingEtaCount: 0,
                    deliveryRiskCount: 0,
                    affectedProjectIds: []
                });
            }

            const s = supplierMap.get(item.supplierName)!;
            s.totalOutstandingValue += item.outstandingValue;
            s.totalLineCount++;
            
            if (item.action.type === 'ACTION_FOLLOW_UP') s.delayedLineCount++;
            if (item.action.type === 'ACTION_CONFIRM_ETA') s.missingEtaCount++;
            if (item.action.type === 'ACTION_ESCALATE') s.deliveryRiskCount++;
        }

        // Project counts and drilldown IDs
        const allData = await db.select({
            supplierName: purchaseOrderLines.supplierName,
            projectId: purchaseOrderLines.projectId,
            poId: purchaseOrderLines.purchaseOrderId
        })
        .from(purchaseOrderLines);

        const projectsBySupplier = new Map<string, Set<number>>();
        for (const row of allData) {
            const sName = row.supplierName || 'Unknown';
            if (!projectsBySupplier.has(sName)) projectsBySupplier.set(sName, new Set());
            if (row.projectId) projectsBySupplier.get(sName)!.add(row.projectId);
        }

        for (const [name, stats] of supplierMap.entries()) {
            const projectSet = projectsBySupplier.get(name);
            stats.affectedProjectCount = projectSet?.size || 0;
            stats.affectedProjectIds = Array.from(projectSet || []);
        }

        const sortedSuppliers = Array.from(supplierMap.values()).sort((a, b) => b.totalOutstandingValue - a.totalOutstandingValue);

        return { success: true, data: sortedSuppliers };
    } catch (error) {
        console.error('Failed to fetch supplier risk data:', error);
        return { success: false, error: 'Failed to fetch supplier data' };
    }
}

/**
 * Detailed procurement drilldown for a single project.
 */
export async function getProjectProcurementDetail(projectId: number) {
    try {
        const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
        if (!project) throw new Error('Project not found');

        const pos = await db.select().from(purchaseOrders).where(eq(purchaseOrders.projectId, projectId)).orderBy(desc(purchaseOrders.issueDate));
        const lines = await db.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.projectId, projectId));

        const grouped = pos.map(po => {
            const poLines = lines.filter(l => l.purchaseOrderId === po.id);
            const context: ProjectProcurementContext = {
                projectNumber: project.projectNumber,
                deliveryDate: project.deliveryDate,
                poLines: poLines.map(l => ({
                    workguruId: l.workguruId,
                    poNumber: l.poNumber,
                    supplierName: l.supplierName !== 'Unknown' ? l.supplierName : (po.supplierName || 'Unknown'),
                    name: l.name || 'Unknown',
                    quantity: l.quantity,
                    receivedQuantity: l.receivedQuantity,
                    unitPrice: l.unitPrice,
                    expectedDate: po.expectedDate
                }))
            };
            const action = calculateProjectProcurementRisk(context);

            return {
                ...po,
                action,
                lines: poLines.map(l => ({
                    ...l,
                    outstandingQuantity: l.quantity - l.receivedQuantity,
                    outstandingValue: calculateOutstandingValue(l.quantity, l.receivedQuantity, l.unitPrice),
                    action: determineLineAction({
                        workguruId: l.workguruId,
                        poNumber: l.poNumber,
                        supplierName: l.supplierName || 'Unknown',
                        name: l.name || 'Unknown',
                        quantity: l.quantity,
                        receivedQuantity: l.receivedQuantity,
                        unitPrice: l.unitPrice,
                        expectedDate: po.expectedDate
                    }, project.deliveryDate)
                }))
            };
        });

        return {
            success: true,
            project: {
                id: project.id,
                projectNumber: project.projectNumber,
                name: project.name,
                deliveryDate: project.deliveryDate,
                url: `https://app.workguru.io/App/Projects/Detail2/${project.workguruId}`
            },
            purchaseOrders: grouped
        };
    } catch (error) {
        console.error('Failed to fetch project procurement detail:', error);
        return { success: false, error: 'Failed to fetch project detail' };
    }
}
