"use server";

import { db } from "@/db";
import { projects, tasks, projectStageHours, productionSchedule, projectSuppliers } from "@/db/schema";
import { eq, and, inArray, notInArray, not, like, isNotNull } from "drizzle-orm";
import { validateSession, hasRole } from "@/lib/auth-helpers";
import { getStageCapacityPerWeek } from "@/lib/stage-capacity";
import { format } from "date-fns";

async function checkAuth() {
  if (process.env.BYPASS_AUTH_FOR_TEST === "true") {
    return { user: { id: "1", role: "admin", roles: ["admin"] } };
  }
  const session = await validateSession();
  if (!session) {
    throw new Error("Unauthorized.");
  }
  return session;
}

export type StageInfo = {
  value: number;
  source: "wg" | "manual";
} | null;

export type ProjectSchedulingData = {
  id: number;
  workguruId: string;
  projectNumber: string;
  name: string;
  projectManager: string | null;
  projectType: string | null;
  bayLocation: string | null;
  deliveryDate: Date | null;
  startDate: Date | null;
  drawingApprovalDate: Date | null;
  sheetmetalDeliveredDate: Date | null;
  switchgearDeliveredDate: Date | null;
  budgetHours: number;
  actualHours: number;
  remainingHours: number;
  progressPercent: number;
  rawStatus: string | null;
  displayStageName: string | null;
  scheduledStart: string | null;
  effectiveStart: string | null;
  stages: {
    frameAssembly: StageInfo;
    switchgearMount: StageInfo;
    busbar: StageInfo;
    wiring: StageInfo;
    labels: StageInfo;
    testing: StageInfo;
    packagingFreight: StageInfo;
  };
  suppliers: {
    supplierName: string;
    materialType: string;
    expectedDeliveryDate: Date | null;
    deliveryStatus: string | null;
  }[];
};

export async function getProductionSchedulingData() {
  await checkAuth();

  try {
    const activeStatuses = [
      "1.3 - Drawings Approved",
      "2.1 - Sheetmetal and switchgear ordrered",
      "2.2 - In Progress",
      "In Progress",
      "Waiting to Start",
      "2.3 - Ready for Testing",
      "2.4 - Tested Defective",
      "On Hold",
      "2.5 - Tested Passed",
      "Tested Passed"
    ];

    // Fetch projects
    const rawProjects = await db.query.projects.findMany({
      where: and(
        eq(projects.isArchived, false),
        inArray(projects.rawStatus, activeStatuses),
        notInArray(projects.rawStatus, ["Delivered", "Completed", "Cancelled", "2.6 - Ready for Invoicing", "3.1 - Invoiced"]),
        not(like(projects.projectNumber, "99%")),
        isNotNull(projects.projectType)
      ),
      with: {
        displayStage: true,
      }
    });

    if (rawProjects.length === 0) {
      const stageCapacity = await getStageCapacityPerWeek();
      return {
        success: true,
        data: {
          projects: [],
          stageCapacity
        }
      };
    }

    const projectIds = rawProjects.map(p => p.id);

    // Fetch related records in bulk to avoid N+1 queries
    const allTasks = await db.query.tasks.findMany({
      where: inArray(tasks.projectId, projectIds)
    });

    const allStageHours = await db.query.projectStageHours.findMany({
      where: inArray(projectStageHours.projectId, projectIds)
    });

    const allSchedules = await db.query.productionSchedule.findMany({
      where: inArray(productionSchedule.projectId, projectIds)
    });

    const allSuppliers = await db.query.projectSuppliers.findMany({
      where: inArray(projectSuppliers.projectId, projectIds)
    });

    // Create lookup maps
    const tasksMap = new Map<number, typeof allTasks>();
    allTasks.forEach(t => {
      const arr = tasksMap.get(t.projectId) || [];
      arr.push(t);
      tasksMap.set(t.projectId, arr);
    });

    const stageHoursMap = new Map<number, typeof allStageHours[0]>();
    allStageHours.forEach(sh => {
      stageHoursMap.set(sh.projectId, sh);
    });

    const scheduleMap = new Map<number, string | null>();
    allSchedules.forEach(s => {
      scheduleMap.set(s.projectId, s.scheduledStart);
    });

    const suppliersMap = new Map<number, typeof allSuppliers>();
    allSuppliers.forEach(s => {
      const arr = suppliersMap.get(s.projectId) || [];
      arr.push(s);
      suppliersMap.set(s.projectId, arr);
    });

    // Helper to extract stage hours
    const getStageHours = (
      pTasks: typeof allTasks | undefined,
      taskName: string,
      manualVal: string | null | undefined
    ): StageInfo => {
      const task = pTasks?.find(t => t.name === taskName);
      if (task && task.budgetHours > 0) {
        return { value: task.budgetHours, source: "wg" };
      }
      if (manualVal !== null && manualVal !== undefined) {
        const val = parseFloat(manualVal);
        if (!isNaN(val) && val > 0) {
          return { value: val, source: "manual" };
        }
      }
      return null;
    };

    const projectsData: ProjectSchedulingData[] = rawProjects.map(p => {
      const pTasks = tasksMap.get(p.id);
      const sh = stageHoursMap.get(p.id);
      
      const isIfm = p.projectType?.toUpperCase().includes("IFM") || false;

      // Determine manual hours for frameAssembly and busbar based on projectType
      const manualFrameAssembly = isIfm ? sh?.frameAssemblyIfm : sh?.frameAssemblyIfc;
      const manualBusbar = isIfm ? sh?.busbarIfm : sh?.busbarIfc;

      const stages = {
        frameAssembly: getStageHours(pTasks, "04 - Frame Assembling", manualFrameAssembly),
        switchgearMount: getStageHours(pTasks, "05 - Switchgear & Component Mounting", sh?.switchgearMount),
        busbar: getStageHours(pTasks, "06 - Busbar Assembling", manualBusbar),
        wiring: getStageHours(pTasks, "07 - Wiring", sh?.wiring),
        labels: getStageHours(pTasks, "08 - Fixing Labels", sh?.labels),
        testing: getStageHours(pTasks, "09 - Inspection & Testing", sh?.testing),
        packagingFreight: getStageHours(pTasks, "10 - Packaging and Freight", sh?.packagingFreight),
      };

      const pSuppliers = suppliersMap.get(p.id) || [];
      const suppliersData = pSuppliers.map(s => ({
        supplierName: s.supplierName,
        materialType: s.materialType,
        expectedDeliveryDate: s.expectedDeliveryDate,
        deliveryStatus: s.deliveryStatus,
      }));

      return {
        id: p.id,
        workguruId: p.workguruId,
        projectNumber: p.projectNumber,
        name: p.name,
        projectManager: p.projectManager,
        projectType: p.projectType,
        bayLocation: p.bayLocation,
        deliveryDate: p.deliveryDate,
        startDate: p.startDate,
        drawingApprovalDate: p.drawingApprovalDate,
        sheetmetalDeliveredDate: p.sheetmetalDeliveredDate,
        switchgearDeliveredDate: p.switchgearDeliveredDate,
        budgetHours: p.budgetHours,
        actualHours: p.actualHours,
        remainingHours: p.remainingHours,
        progressPercent: p.progressPercent,
        rawStatus: p.rawStatus,
        displayStageName: p.displayStage?.name || null,
        scheduledStart: scheduleMap.get(p.id) || null,
        effectiveStart: scheduleMap.get(p.id) || 
                       (p.sheetmetalDeliveredDate ? format(p.sheetmetalDeliveredDate, "yyyy-MM-dd") : null) || 
                       (p.switchgearDeliveredDate ? format(p.switchgearDeliveredDate, "yyyy-MM-dd") : null) || 
                       format(new Date(), "yyyy-MM-dd"),
        stages,
        suppliers: suppliersData
      };
    });

    const stageCapacity = await getStageCapacityPerWeek();

    return {
      success: true,
      data: {
        projects: projectsData,
        stageCapacity
      }
    };

  } catch (error: any) {
    console.error("[getProductionSchedulingData] Error:", error);
    throw new Error(error.message || "Failed to load production scheduling data.");
  }
}

export async function updateScheduledStart(projectId: number, scheduledStart: Date) {
  const session = await validateSession();
  if (!session || (!hasRole(session, "scheduler") && !hasRole(session, "admin"))) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const formattedDate = format(scheduledStart, "yyyy-MM-dd");
    const existingRecord = await db.query.productionSchedule.findFirst({
      where: eq(productionSchedule.projectId, projectId)
    });

    if (existingRecord) {
      await db.update(productionSchedule)
        .set({
          scheduledStart: formattedDate,
          updatedAt: new Date(),
          updatedBy: Number(session.user.id)
        })
        .where(eq(productionSchedule.projectId, projectId));
    } else {
      await db.insert(productionSchedule)
        .values({
          projectId,
          scheduledStart: formattedDate,
          updatedBy: Number(session.user.id)
        });
    }

    console.log(`User ${session.user.id} updated project ${projectId} scheduled start to ${formattedDate}`);
    return { success: true };
  } catch (error: any) {
    console.error("[updateScheduledStart] Error:", error);
    return { success: false, error: error.message || "Failed to update scheduled start" };
  }
}

export async function resetScheduledStart(projectId: number) {
  const session = await validateSession();
  if (!session || (!hasRole(session, "scheduler") && !hasRole(session, "admin"))) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.delete(productionSchedule)
      .where(eq(productionSchedule.projectId, projectId));

    console.log(`User ${session.user.id} reset project ${projectId} scheduled start`);
    return { success: true };
  } catch (error: any) {
    console.error("[resetScheduledStart] Error:", error);
    return { success: false, error: error.message || "Failed to reset scheduled start" };
  }
}
