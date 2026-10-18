'use server';

import { db } from "@/db";
import { projects, clients, productionSchedule, syncLogs, purchaseOrders, systemConfig } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { validateSession, hasRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { 
  CapacitySettingsV2, 
  RiskV2DashboardData 
} from "@/lib/risk-v2/types";
import { 
  getCapacitySettingsV2, 
  updateCapacitySettingsV2 as updateSettings,
  calculateForecastPeriods 
} from "@/lib/risk-v2/capacity";
import { 
  buildRiskV2DashboardData, 
  RawProjectInput,
  normalizeDateToSydneyString
} from "@/lib/risk-v2/demand";
import { 
  ProjectMaterialConfirmation, 
  LinkedPurchaseOrder 
} from "@/lib/risk-v2/readiness";
import { getSydneyTodayDateString } from "@/lib/risk-v2/calendar";
import { isProductiveProject, isActiveWorkStatus } from "@/lib/project-utils";

const MATERIAL_CONFIRMATIONS_CONFIG_KEY = 'v2_project_material_confirmations';

function countCalendarDaysDiff(date1Str: string, date2Str: string): number {
  const d1 = new Date(date1Str + 'T00:00:00Z');
  const d2 = new Date(date2Str + 'T00:00:00Z');
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

export async function fetchRiskV2Data(
  viewMode: 'monthly' | 'weekly' = 'monthly',
  horizonMonths: number = 6
): Promise<RiskV2DashboardData> {
  const session = await validateSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const settings = await getCapacitySettingsV2();
  const todayStr = getSydneyTodayDateString();

  // Fetch projects from DB including custom material, drawing fields, and projectType
  const rawProjects = await db
    .select({
      id: projects.id,
      projectNumber: projects.projectNumber,
      name: projects.name,
      clientName: clients.name,
      projectManager: projects.projectManager,
      rawStatus: projects.rawStatus,
      projectType: projects.projectType,
      budgetHours: projects.budgetHours,
      actualHours: projects.actualHours,
      deliveryDate: projects.deliveryDate,
      total: projects.total,
      isArchived: projects.isArchived,
      updatedAt: projects.updatedAt,
      remoteUpdatedAt: projects.remoteUpdatedAt,
      scheduledStart: productionSchedule.scheduledStart,
      drawingApprovalDate: projects.drawingApprovalDate,
      expectedDrawingApprovalDate: projects.expectedDrawingApprovalDate,
      sheetmetalOrderedDate: projects.sheetmetalOrderedDate,
      sheetmetalDeliveredDate: projects.sheetmetalDeliveredDate,
      switchgearOrderedDate: projects.switchgearOrderedDate,
      switchgearDeliveredDate: projects.switchgearDeliveredDate,
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(productionSchedule, eq(projects.id, productionSchedule.projectId))
    .where(eq(projects.isArchived, false))
    .orderBy(desc(projects.updatedAt));

  // Fetch latest sync timestamp
  const latestSync = await db.query.syncLogs.findFirst({
    orderBy: [desc(syncLogs.timestamp)],
  });

  const lastSyncTimestamp = latestSync 
    ? new Date(latestSync.timestamp).toLocaleString('en-AU', {
        timeZone: 'Australia/Sydney',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : null;

  // Audited: Only query POs for active pipeline projects (exclude completed/invoiced/cancelled jobs and internal 99xxx)
  const activePipelineProjects = rawProjects.filter(
    p => isProductiveProject(p.projectNumber) && isActiveWorkStatus(p.rawStatus)
  );
  const activeProjectIds = activePipelineProjects.map(p => p.id);

  const rawPOs = activeProjectIds.length > 0
    ? await db
        .select({
          id: purchaseOrders.id,
          projectId: purchaseOrders.projectId,
          poNumber: purchaseOrders.poNumber,
          supplierName: purchaseOrders.supplierName,
          total: purchaseOrders.total,
          status: purchaseOrders.status,
          issueDate: purchaseOrders.issueDate,
          expectedDate: purchaseOrders.expectedDate,
          receivedDate: purchaseOrders.receivedDate,
        })
        .from(purchaseOrders)
        .where(inArray(purchaseOrders.projectId, activeProjectIds))
    : [];


  const formattedPOs: LinkedPurchaseOrder[] = rawPOs.map(po => {
    const issueDateStr = normalizeDateToSydneyString(po.issueDate);
    const expectedDateStr = normalizeDateToSydneyString(po.expectedDate);
    const receivedDateStr = normalizeDateToSydneyString(po.receivedDate);
    const isReceived = po.status?.toLowerCase() === 'received';

    let isOverdueETA = false;
    let varianceDays: number | null = null;

    if (!isReceived && expectedDateStr) {
      isOverdueETA = expectedDateStr < todayStr;
      varianceDays = isOverdueETA ? countCalendarDaysDiff(expectedDateStr, todayStr) : null;
    } else if (isReceived && expectedDateStr && receivedDateStr) {
      varianceDays = countCalendarDaysDiff(expectedDateStr, receivedDateStr);
    }

    return {
      id: po.id,
      projectId: po.projectId,
      poNumber: po.poNumber,
      supplierName: po.supplierName,
      total: po.total || 0,
      status: po.status,
      issueDate: issueDateStr,
      expectedDate: expectedDateStr,
      receivedDate: receivedDateStr,
      isOverdueETA,
      varianceDays,
    };
  });

  // Fetch planner material requirement confirmations
  const confirmationsRecord = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, MATERIAL_CONFIRMATIONS_CONFIG_KEY),
  });
  const plannerConfirmations: Record<string, ProjectMaterialConfirmation> = 
    (confirmationsRecord?.value as Record<string, ProjectMaterialConfirmation>) || {};

  const periods = calculateForecastPeriods(viewMode, horizonMonths, settings, todayStr);

  const formattedInputs: RawProjectInput[] = rawProjects.map(p => ({
    id: p.id,
    projectNumber: p.projectNumber,
    name: p.name,
    clientName: p.clientName,
    projectManager: p.projectManager,
    rawStatus: p.rawStatus,
    budgetHours: p.budgetHours,
    actualHours: p.actualHours,
    deliveryDate: p.deliveryDate,
    total: p.total,
    isArchived: p.isArchived,
    scheduledStart: p.scheduledStart,
    updatedAt: p.updatedAt,
    remoteUpdatedAt: p.remoteUpdatedAt,
    projectType: p.projectType,
    drawingApprovalDate: p.drawingApprovalDate,
    expectedDrawingApprovalDate: p.expectedDrawingApprovalDate,
    sheetmetalOrderedDate: p.sheetmetalOrderedDate,
    sheetmetalDeliveredDate: p.sheetmetalDeliveredDate,
    switchgearOrderedDate: p.switchgearOrderedDate,
    switchgearDeliveredDate: p.switchgearDeliveredDate,
  }));

  return buildRiskV2DashboardData(
    formattedInputs,
    settings,
    periods,
    lastSyncTimestamp,
    viewMode,
    horizonMonths,
    todayStr,
    {
      plannerConfirmations,
      purchaseOrders: formattedPOs,
    }
  );
}

export async function saveCapacitySettingsV2(settings: CapacitySettingsV2) {
  return await updateSettings(settings);
}

/**
 * Persists an authorized planner's material requirement confirmation for a project.
 * Uses system_config to avoid schema mutations until approved by Joe.
 * Audited: Enforces strict authorization, project existence, requirement enum check, and notes sanitization.
 */
export async function saveProjectMaterialConfirmation(
  projectId: number,
  confirmation: {
    requirement: 'both' | 'sheetmetal_only' | 'switchgear_only' | 'neither' | 'unknown';
    notes?: string;
  }
) {
  const session = await validateSession();
  if (!session || (!hasRole(session, "scheduler") && !hasRole(session, "admin"))) {
    return { success: false, error: "Unauthorized: only schedulers and administrators can confirm material requirements." };
  }

  // 1. Validate projectId
  if (typeof projectId !== 'number' || !Number.isInteger(projectId) || projectId <= 0) {
    return { success: false, error: "Invalid project ID." };
  }

  // 2. Validate requirement enum
  const validRequirements = ['both', 'sheetmetal_only', 'switchgear_only', 'neither', 'unknown'];
  if (!confirmation || !validRequirements.includes(confirmation.requirement)) {
    return { success: false, error: "Invalid material requirement selection." };
  }

  // 3. Sanitize notes
  const cleanNotes = String(confirmation.notes || '').trim().slice(0, 500);

  try {
    // 4. Verify project exists in local database
    const projectExists = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { id: true, projectNumber: true }
    });
    if (!projectExists) {
      return { success: false, error: "Project not found in database." };
    }

    const existing = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, MATERIAL_CONFIRMATIONS_CONFIG_KEY),
    });

    const currentMap = (existing?.value as Record<string, ProjectMaterialConfirmation>) || {};
    currentMap[String(projectId)] = {
      requirement: confirmation.requirement,
      confirmedBy: session.user.name || session.user.email || 'Authorized Planner',
      confirmedAt: new Date().toISOString(),
      notes: cleanNotes,
    };

    if (existing) {
      await db.update(systemConfig)
        .set({
          value: currentMap,
          updatedAt: new Date(),
        })
        .where(eq(systemConfig.key, MATERIAL_CONFIRMATIONS_CONFIG_KEY));
    } else {
      await db.insert(systemConfig)
        .values({
          key: MATERIAL_CONFIRMATIONS_CONFIG_KEY,
          value: currentMap,
          updatedAt: new Date(),
        });
    }

    revalidatePath('/risk-v2');
    return { success: true };
  } catch (error: any) {
    console.error("[saveProjectMaterialConfirmation] Error:", error);
    return { success: false, error: error.message || "Failed to save material confirmation." };
  }
}

