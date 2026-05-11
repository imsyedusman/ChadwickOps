'use server';

import { db } from '@/db';
import { projects, purchaseOrders, purchaseOrderLines, systemConfig, procurementSyncLogs } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { calculateProjectProcurementRisk, ProcurementRiskLevel, ProjectProcurementContext } from '@/lib/procurement-logic';

export interface ProcurementDashboardItem {
  id: number;
  projectNumber: string;
  projectName: string;
  projectUrl: string;
  deliveryDate: Date | null;
  risk: {
    level: ProcurementRiskLevel;
    reason: string;
    isActionable: boolean;
  };
  stats: {
    totalLines: number;
    outstandingLines: number;
    totalOrdered: number;
    totalReceived: number;
  };
}

export async function getProcurementDashboardData() {
  try {
    // 1. Fetch active projects
    const allProjects = await db.select().from(projects)
      .where(eq(projects.isArchived, false))
      .orderBy(desc(projects.updatedAt));

    // 2. Fetch all POs with their lines for these projects
    const allPoData = await db.select({
      line: purchaseOrderLines,
      po: purchaseOrders
    })
    .from(purchaseOrderLines)
    .innerJoin(purchaseOrders, eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id));

    // Group PO Data by project
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
          expectedDate: it.po.expectedDate // From parent PO
        }))
      };

      const risk = calculateProjectProcurementRisk(context);
      
      const stats = {
        totalLines: context.poLines.length,
        outstandingLines: context.poLines.filter(l => (l.quantity - l.receivedQuantity) > 0).length,
        totalOrdered: context.poLines.reduce((acc, l) => acc + l.quantity, 0),
        totalReceived: context.poLines.reduce((acc, l) => acc + l.receivedQuantity, 0),
      };

      dashboardData.push({
        id: project.id,
        projectNumber: project.projectNumber,
        projectName: project.name || 'Unnamed Project',
        projectUrl: `https://app.workguru.io/App/Projects/Detail2/${project.workguruId}`,
        deliveryDate: project.deliveryDate,
        risk,
        stats
      });
    }

    // Sort: Actionable risks first, then by project number
    dashboardData.sort((a, b) => {
        if (a.risk.isActionable && !b.risk.isActionable) return -1;
        if (!a.risk.isActionable && b.risk.isActionable) return 1;
        return a.projectNumber.localeCompare(b.projectNumber);
    });

    // 3. Fetch sync health stats
    const retryQueueConfig = await db.query.systemConfig.findFirst({ where: eq(systemConfig.key, 'PROCUREMENT_RETRY_QUEUE') });
    const permFailuresConfig = await db.query.systemConfig.findFirst({ where: eq(systemConfig.key, 'PROCUREMENT_PERMANENT_FAILURES') });
    const lastSyncLog = await db.query.procurementSyncLogs.findFirst({ orderBy: [desc(procurementSyncLogs.timestamp)] });

    const retryQueue = (retryQueueConfig?.value as any[]) || [];
    const permFailures = (permFailuresConfig?.value as any[]) || [];

    return { 
        success: true, 
        data: dashboardData,
        summary: {
            totalProjects: dashboardData.length,
            deliveryRiskCount: dashboardData.filter(d => d.risk.level === 'DELIVERY_RISK').length,
            delayedCount: dashboardData.filter(d => d.risk.level === 'DELAYED_PROCUREMENT').length,
            atRiskCount: dashboardData.filter(d => d.risk.level === 'AT_RISK').length,
            missingEtaCount: dashboardData.filter(d => d.risk.level === 'MISSING_ETA').length,
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
