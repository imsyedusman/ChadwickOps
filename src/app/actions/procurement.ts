'use server';

import { db } from '@/db';
import { projects, purchaseOrders, purchaseOrderLines, systemConfig, procurementSyncLogs, masterSuppliers, projectSuppliers } from '@/db/schema';
import { eq, and, desc, sql, lt, ne, inArray, count } from 'drizzle-orm';
import { 
    calculateProjectProcurementRisk, 
    calculateAgingDays, 
    calculateOutstandingValue, 
    determineLineAction,
    ProcurementActionMetadata,
    ProjectProcurementContext 
} from '@/lib/procurement-logic';
import { revalidatePath } from 'next/cache';

// ... (existing interfaces and functions)

/**
 * Adds a manual supplier record to a project.
 */
export async function addSupplier(projectId: number, data: any) {
    try {
        const [result] = await db.insert(projectSuppliers).values({
            projectId,
            masterSupplierId: data.masterSupplierId,
            supplierName: data.supplierName,
            materialType: data.materialType,
            orderDate: data.orderDate ? new Date(data.orderDate) : new Date(),
            expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
            deliveryStatus: data.deliveryStatus || 'Ordered',
            notes: data.notes || ''
        }).returning({ id: projectSuppliers.id });

        revalidatePath('/procurement');
        return { success: true, id: result.id };
    } catch (error) {
        console.error('Failed to add supplier:', error);
        return { success: false, error: 'Failed to add supplier' };
    }
}

/**
 * Updates a manual supplier record.
 */
export async function updateSupplier(supplierId: number, data: any) {
    try {
        await db.update(projectSuppliers)
            .set({
                masterSupplierId: data.masterSupplierId,
                supplierName: data.supplierName,
                materialType: data.materialType,
                orderDate: data.orderDate ? new Date(data.orderDate) : undefined,
                expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
                deliveryStatus: data.deliveryStatus,
                notes: data.notes,
                updatedAt: new Date()
            })
            .where(eq(projectSuppliers.id, supplierId));

        revalidatePath('/procurement');
        return { success: true };
    } catch (error) {
        console.error('Failed to update supplier:', error);
        return { success: false, error: 'Failed to update supplier' };
    }
}

/**
 * Deletes a manual supplier record.
 */
export async function deleteSupplier(supplierId: number) {
    try {
        await db.delete(projectSuppliers).where(eq(projectSuppliers.id, supplierId));
        revalidatePath('/procurement');
        return { success: true };
    } catch (error) {
        console.error('Failed to delete supplier:', error);
        return { success: false, error: 'Failed to delete supplier' };
    }
}

/**
 * Adds a new master supplier.
 */
export async function addMasterSupplier(name: string) {
    try {
        const [result] = await db.insert(masterSuppliers).values({
            name,
            updatedAt: new Date()
        }).onConflictDoUpdate({
            target: masterSuppliers.name,
            set: { updatedAt: new Date() }
        }).returning({ id: masterSuppliers.id });

        return { success: true, id: result.id };
    } catch (error) {
        console.error('Failed to add master supplier:', error);
        return { success: false, error: 'Failed to add master supplier' };
    }
}

/**
 * Updates project-level procurement fields.
 */
export async function updateProjectProcurement(projectId: number, data: { procurementStatus?: string, procurementNotes?: string }) {
    try {
        await db.update(projects)
            .set({
                procurementStatus: data.procurementStatus,
                procurementNotes: data.procurementNotes,
                updatedAt: new Date()
            })
            .where(eq(projects.id, projectId));

        revalidatePath('/procurement');
        return { success: true };
    } catch (error) {
        console.error('Failed to update project procurement:', error);
        return { success: false, error: 'Failed to update project procurement' };
    }
}

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
    hasIncompleteHydration: boolean;
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
    hydrationStatus?: string;
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
    // DIAGNOSTIC: Check project archiving status
    const projectCounts = await db.select({ 
        archived: sql<number>`count(*) filter (where ${projects.isArchived} = true)`,
        active: sql<number>`count(*) filter (where ${projects.isArchived} = false)`
    }).from(projects);
    console.log(`[Procurement-Diag] Project Status Counts:`, projectCounts[0]);

    console.time('fetch_projects');
    const allProjects = await db.select().from(projects)
      .where(eq(projects.isArchived, false))
      .orderBy(desc(projects.updatedAt));
    console.timeEnd('fetch_projects');

    console.time('fetch_po_data');
    const allPoData = await db.select({
      line: purchaseOrderLines,
      po: purchaseOrders
    })
    .from(purchaseOrderLines)
    .innerJoin(purchaseOrders, eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id))
    .innerJoin(projects, eq(purchaseOrderLines.projectId, projects.id))
    .where(eq(projects.isArchived, false));
    console.timeEnd('fetch_po_data');

    const dataByProject = new Map<number, { line: any; po: any }[]>();
    for (const item of allPoData) {
      if (!dataByProject.has(item.line.projectId)) {
        dataByProject.set(item.line.projectId, []);
      }
      dataByProject.get(item.line.projectId)!.push(item);
    }

    const dashboardData: ProcurementDashboardItem[] = [];
    
    // Summary counters
    let backorderItemCount = 0;
    let outstandingMaterialCost = 0;
    let lateSupplierDeliveries = 0;
    let missingSupplierEtas = 0;
    let projectsWaitingOnMaterials = 0;

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
      if (action.type === 'ACTION_ESCALATE') projectsWaitingOnMaterials++;

      const outstandingValue = context.poLines.reduce((acc, l) => acc + calculateOutstandingValue(l.quantity, l.receivedQuantity, l.unitPrice), 0);
      outstandingMaterialCost += outstandingValue;
      
      const stats = {
        totalLines: context.poLines.length,
        outstandingLines: context.poLines.filter(l => (l.quantity - l.receivedQuantity) > 0).length,
        delayedLines: context.poLines.filter(l => determineLineAction(l, project.deliveryDate).type === 'ACTION_FOLLOW_UP').length,
        missingEtaLines: context.poLines.filter(l => determineLineAction(l, project.deliveryDate).type === 'ACTION_CONFIRM_ETA').length,
        totalOrdered: context.poLines.reduce((acc, l) => acc + l.quantity, 0),
        totalReceived: context.poLines.reduce((acc, l) => acc + l.receivedQuantity, 0),
        outstandingValue,
        hydrationStatus: items.some(it => it.po.hydrationStatus === 'FAILED') ? 'FAILED' : 
                         items.some(it => it.po.hydrationStatus === 'SUMMARY_ONLY') ? 'PENDING' : 'HYDRATED'
      };

      // Aggregated summary stats (null project context as per original logic)
      context.poLines.forEach(l => {
          const lineAction = determineLineAction(l, null);
          if (lineAction.severity < 4) backorderItemCount++;
          if (lineAction.type === 'ACTION_FOLLOW_UP') lateSupplierDeliveries++;
          if (lineAction.type === 'ACTION_CONFIRM_ETA') missingSupplierEtas++;
      });

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

    console.time('fetch_config');
    const retryQueueConfig = await db.query.systemConfig.findFirst({ where: eq(systemConfig.key, 'PROCUREMENT_RETRY_QUEUE') });
    const permFailuresConfig = await db.query.systemConfig.findFirst({ where: eq(systemConfig.key, 'PROCUREMENT_PERMANENT_FAILURES') });
    const lastSyncLog = await db.query.procurementSyncLogs.findFirst({ orderBy: [desc(procurementSyncLogs.timestamp)] });
    console.timeEnd('fetch_config');

    const retryQueue = (Array.isArray(retryQueueConfig?.value) ? retryQueueConfig.value : []) as any[];
    const permFailures = (Array.isArray(permFailuresConfig?.value) ? permFailuresConfig.value : []) as any[];

    // Data Integrity Metrics
    const integrityStats = await db.select({
        status: purchaseOrders.hydrationStatus,
        count: count()
    }).from(purchaseOrders).groupBy(purchaseOrders.hydrationStatus);

    const hydratedCount = Number(integrityStats.find(s => s.status === 'HYDRATED')?.count || 0);
    const summaryOnlyCount = Number(integrityStats.find(s => s.status === 'SUMMARY_ONLY')?.count || 0);
    const failedCount = Number(integrityStats.find(s => s.status === 'FAILED')?.count || 0);

    return { 
        success: true, 
        data: dashboardData,
        summary: {
            totalProjects: dashboardData.length,
            backorderItemCount,
            outstandingMaterialCost,
            projectsWaitingOnMaterials,
            lateSupplierDeliveries,
            missingSupplierEtas,
            integrity: {
                hydratedCount,
                summaryOnlyCount,
                failedCount,
                totalCount: hydratedCount + summaryOnlyCount + failedCount
            },
            syncHealth: {
                lastSyncAt: lastSyncLog?.timestamp || null,
                lastStatus: lastSyncLog?.status || 'UNKNOWN',
                retryQueueCount: retryQueue.length,
                permFailureCount: permFailures.length
            }
        }
    };
  } catch (error: any) {
    console.error('CRITICAL: Failed to fetch procurement dashboard data:', error);
    console.error('Stack trace:', error.stack);
    return { 
        success: false, 
        error: `Failed to fetch dashboard data: ${error.message || 'Unknown error'}` 
    };
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
                supplierName: (item.line.supplierName && item.line.supplierName !== 'Unknown') ? item.line.supplierName : (item.po.supplierName || 'Unknown'),
                poNumber: item.line.poNumber,
                materialName: item.line.name || 'Unknown',
                quantity: item.line.quantity,
                receivedQuantity: item.line.receivedQuantity,
                outstandingQuantity: outstandingQty,
                unitPrice: item.line.unitPrice,
                outstandingValue,
                expectedDate: item.po.expectedDate,
                daysOutstanding,
                action,
                hydrationStatus: item.po.hydrationStatus
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
                    poNumber: po.poNumber || l.poNumber,
                    supplierName: (l.supplierName && l.supplierName !== 'Unknown') ? l.supplierName : (po.supplierName || 'Unknown'),
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
