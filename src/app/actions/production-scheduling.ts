"use server";

import { db } from "@/db";
import { projects, tasks, projectStageHours, productionSchedule, projectSuppliers, timeEntries, staffEfficiency, workerAssignments, systemConfig, staffAbsences } from "@/db/schema";
import { eq, and, inArray, notInArray, not, like, isNotNull, sql, lte, gte } from "drizzle-orm";
import { validateSession, hasRole } from "@/lib/auth-helpers";
import { getStageCapacityPerWeek, getWeeklyCapacityBreakdown } from "@/lib/stage-capacity";
import { format, parseISO, addDays } from "date-fns";
import { generateAutoSchedule, getSchedulingSummary, type AutoScheduleResult, type SchedulingSummary } from "@/lib/auto-scheduler";

export type InsightItem = {
  type: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  affectedCount: number
  actionLabel?: string
  actionFilter?: string
}

async function checkAuth() {
  if (process.env.BYPASS_AUTH_FOR_TEST === "true") {
    return { user: { id: "1", role: "admin", roles: ["admin"] }, expires: new Date().toISOString() } as any;
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
           stageCapacity,
           autoScheduledCount: 0
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
    const autoScheduledCount = allSchedules.filter(s => s.scheduledByAuto === true).length;

    return {
      success: true,
      data: {
        projects: projectsData,
        stageCapacity,
        autoScheduledCount
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

export async function getProjectStageHours(projectId: number) {
  await checkAuth();

  try {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { projectType: true }
    });
    const isIfm = project?.projectType?.toUpperCase().includes("IFM") || false;

    const projectTasks = await db.query.tasks.findMany({
      where: eq(tasks.projectId, projectId)
    });

    const manualHours = await db.query.projectStageHours.findFirst({
      where: eq(projectStageHours.projectId, projectId)
    });

    const taskMap = new Map(projectTasks.map(t => [t.name, t.budgetHours]));

    const helper = (taskName: string, manualVal: string | null | undefined): { value: number | null, source: "wg" | "manual" | "none" } => {
      const wgHours = taskMap.get(taskName) || 0;
      if (wgHours > 0) return { value: wgHours, source: "wg" };
      
      if (manualVal !== null && manualVal !== undefined) {
        const val = parseFloat(manualVal);
        if (!isNaN(val) && val > 0) return { value: val, source: "manual" };
      }
      return { value: null, source: "none" };
    };

    const manualFrameAssembly = isIfm ? manualHours?.frameAssemblyIfm : manualHours?.frameAssemblyIfc;
    const manualBusbar = isIfm ? manualHours?.busbarIfm : manualHours?.busbarIfc;

    const stages = {
      frame_assembly: helper("04 - Frame Assembling", manualFrameAssembly),
      switchgear_mount: helper("05 - Switchgear & Component Mounting", manualHours?.switchgearMount),
      busbar: helper("06 - Busbar Assembling", manualBusbar),
      wiring: helper("07 - Wiring", manualHours?.wiring),
      labels: helper("08 - Fixing Labels", manualHours?.labels),
      testing: helper("09 - Inspection & Testing", manualHours?.testing),
      packaging_freight: helper("10 - Packaging and Freight", manualHours?.packagingFreight),
    };

    return { success: true, data: stages };
  } catch (error: any) {
    console.error("[getProjectStageHours] Error:", error);
    return { success: false, error: error.message || "Failed to load project stage hours." };
  }
}

export async function saveProjectStageHours(projectId: number, stageHours: Record<string, any>) {
  const session = await validateSession();
  if (!session || (!hasRole(session, "scheduler") && !hasRole(session, "admin"))) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const existingRecord = await db.query.projectStageHours.findFirst({
      where: eq(projectStageHours.projectId, projectId)
    });

    const updateData = {
      ...stageHours,
      updatedAt: new Date(),
      updatedBy: Number(session.user.id)
    };

    if (existingRecord) {
      await db.update(projectStageHours)
        .set(updateData)
        .where(eq(projectStageHours.projectId, projectId));
    } else {
      await db.insert(projectStageHours).values({
        projectId,
        ...updateData
      } as any);
    }

    return { success: true };
  } catch (error: any) {
    console.error("[saveProjectStageHours] Error:", error);
    return { success: false, error: error.message || "Failed to save project stage hours" };
  }
}

export async function getProjectedLabourCost(projectId: number) {
  await checkAuth();

  try {
    const stageHoursRes = await getProjectStageHours(projectId);
    if (!stageHoursRes.success || !stageHoursRes.data) {
      throw new Error("Failed to get stage hours");
    }
    const stages = stageHoursRes.data;

    const staff = await db.query.staffEfficiency.findMany({
      where: and(eq(staffEfficiency.isActive, true), eq(staffEfficiency.isWorkshopStaff, true))
    });

    const userRatesRaw = await db.select({
      user: timeEntries.user,
      avgRate: sql<number>`avg(${timeEntries.cost} / ${timeEntries.hours})`
    }).from(timeEntries).where(sql`${timeEntries.hours} > 0`).groupBy(timeEntries.user);

    const ratesMap = new Map<string, number>();
    userRatesRaw.forEach(r => {
      ratesMap.set(r.user, Number(r.avgRate));
    });

    const calcStageCost = (dbKey: keyof typeof staff[0], stageHours: number | null) => {
      if (!stageHours || stageHours === 0) return null;
      let totalRate = 0;
      let totalEff = 0;
      let count = 0;
      for (const person of staff) {
        const eff = person[dbKey];
        if (eff !== null && eff !== undefined) {
          const parsedEff = parseFloat(eff as string);
          const rate = ratesMap.get(person.fullName);
          if (rate !== undefined && !isNaN(parsedEff)) {
            totalRate += rate;
            totalEff += parsedEff;
            count++;
          }
        }
      }
      if (count === 0) return null;
      const avgRate = totalRate / count;
      const avgEff = totalEff / count;
      return stageHours * avgRate * avgEff;
    };

    const costs = {
      frameAssembly: calcStageCost("frameAssembly", stages.frame_assembly.value),
      switchgearMount: calcStageCost("switchgearMount", stages.switchgear_mount.value),
      busbar: calcStageCost("busbar", stages.busbar.value),
      wiring: calcStageCost("wiring", stages.wiring.value),
      labels: calcStageCost("labels", stages.labels.value),
      testing: calcStageCost("testing", stages.testing.value),
      packagingFreight: calcStageCost("packagingFreight", stages.packaging_freight.value),
    };

    let totalProjectedCost = 0;
    Object.values(costs).forEach(c => {
      if (c !== null) totalProjectedCost += c;
    });

    const actualRes = await db.select({
      totalCost: sql<number>`sum(${timeEntries.cost})`
    }).from(timeEntries).where(eq(timeEntries.projectId, projectId));
    const actualCost = Number(actualRes[0]?.totalCost) || 0;

    return {
      success: true,
      data: {
        costs,
        totalProjectedCost,
        actualCost
      }
    };
  } catch (error: any) {
    console.error("[getProjectedLabourCost] Error:", error);
    return { success: false, error: error.message || "Failed to calculate projected labour cost." };
  }
}

export async function getBulkLabourCosts(projectIds: number[]) {
  const session = await checkAuth();
  if (!hasRole(session, "finance") && !hasRole(session, "admin")) {
    return { success: false, error: "Unauthorized" };
  }

  if (!projectIds || projectIds.length === 0) {
    return { success: true, data: {} };
  }

  try {
    const allProjects = await db.query.projects.findMany({
      where: inArray(projects.id, projectIds),
      columns: { id: true, projectType: true }
    });
    
    const allTasks = await db.query.tasks.findMany({
      where: inArray(tasks.projectId, projectIds)
    });
    
    const allManualHours = await db.query.projectStageHours.findMany({
      where: inArray(projectStageHours.projectId, projectIds)
    });

    const staff = await db.query.staffEfficiency.findMany({
      where: and(eq(staffEfficiency.isActive, true), eq(staffEfficiency.isWorkshopStaff, true))
    });

    const userRatesRaw = await db.select({
      user: timeEntries.user,
      avgRate: sql<number>`avg(${timeEntries.cost} / ${timeEntries.hours})`
    }).from(timeEntries).where(sql`${timeEntries.hours} > 0`).groupBy(timeEntries.user);

    const ratesMap = new Map<string, number>();
    userRatesRaw.forEach(r => {
      ratesMap.set(r.user, Number(r.avgRate));
    });

    const actualRes = await db.select({
      projectId: timeEntries.projectId,
      totalCost: sql<number>`sum(${timeEntries.cost})`
    }).from(timeEntries).where(inArray(timeEntries.projectId, projectIds)).groupBy(timeEntries.projectId);
    
    const actualCostMap = new Map<number, number>();
    actualRes.forEach(r => {
      if (r.projectId) actualCostMap.set(r.projectId, Number(r.totalCost));
    });

    const calcStageCost = (dbKey: keyof typeof staff[0], stageHours: number | null) => {
      if (!stageHours || stageHours === 0) return null;
      let totalRate = 0;
      let totalEff = 0;
      let count = 0;
      for (const person of staff) {
        const eff = person[dbKey];
        if (eff !== null && eff !== undefined) {
          const parsedEff = parseFloat(eff as string);
          const rate = ratesMap.get(person.fullName);
          if (rate !== undefined && !isNaN(parsedEff)) {
            totalRate += rate;
            totalEff += parsedEff;
            count++;
          }
        }
      }
      if (count === 0) return null;
      const avgRate = totalRate / count;
      const avgEff = totalEff / count;
      return stageHours * avgRate * avgEff;
    };

    const taskMapByProj = new Map<number, Map<string, number>>();
    allTasks.forEach(t => {
      let m = taskMapByProj.get(t.projectId);
      if (!m) { m = new Map(); taskMapByProj.set(t.projectId, m); }
      m.set(t.name, t.budgetHours);
    });

    const manualMap = new Map<number, typeof allManualHours[0]>();
    allManualHours.forEach(m => manualMap.set(m.projectId, m));

    const result: Record<number, { actualCost: number, projectedCost: number }> = {};

    allProjects.forEach(p => {
      const isIfm = p.projectType?.toUpperCase().includes("IFM") || false;
      const tMap = taskMapByProj.get(p.id) || new Map();
      const mHours = manualMap.get(p.id);

      const helper = (taskName: string, manualVal: string | null | undefined): number | null => {
        const wgHours = tMap.get(taskName) || 0;
        if (wgHours > 0) return wgHours;
        if (manualVal !== null && manualVal !== undefined) {
          const val = parseFloat(manualVal);
          if (!isNaN(val) && val > 0) return val;
        }
        return null;
      };

      const manualFrameAssembly = isIfm ? mHours?.frameAssemblyIfm : mHours?.frameAssemblyIfc;
      const manualBusbar = isIfm ? mHours?.busbarIfm : mHours?.busbarIfc;

      const costs = {
        frameAssembly: calcStageCost("frameAssembly", helper("04 - Frame Assembling", manualFrameAssembly)),
        switchgearMount: calcStageCost("switchgearMount", helper("05 - Switchgear & Component Mounting", mHours?.switchgearMount)),
        busbar: calcStageCost("busbar", helper("06 - Busbar Assembling", manualBusbar)),
        wiring: calcStageCost("wiring", helper("07 - Wiring", mHours?.wiring)),
        labels: calcStageCost("labels", helper("08 - Fixing Labels", mHours?.labels)),
        testing: calcStageCost("testing", helper("09 - Inspection & Testing", mHours?.testing)),
        packagingFreight: calcStageCost("packagingFreight", helper("10 - Packaging and Freight", mHours?.packagingFreight)),
      };

      let totalProjectedCost = 0;
      Object.values(costs).forEach(c => {
        if (c !== null) totalProjectedCost += c;
      });

      const actualCost = actualCostMap.get(p.id) || 0;
      
      result[p.id] = { actualCost, projectedCost: totalProjectedCost };
    });

    return { success: true, data: result };
  } catch (error: any) {
    console.error("[getBulkLabourCosts] Error:", error);
    return { success: false, error: error.message || "Failed to calculate bulk labour costs." };
  }
}

export async function getWorkerSuggestionsForProject(projectId: number, stageWindows?: Record<string, { start: string, end: string }>) {
  await checkAuth();

  try {
    const staff = await db.query.staffEfficiency.findMany({
      where: and(eq(staffEfficiency.isActive, true), eq(staffEfficiency.isWorkshopStaff, true))
    });

    const userRatesRaw = await db.select({
      user: timeEntries.user,
      avgRate: sql<number>`avg(${timeEntries.cost} / ${timeEntries.hours})`
    }).from(timeEntries).where(sql`${timeEntries.hours} > 0`).groupBy(timeEntries.user);

    const ratesMap = new Map<string, number>();
    userRatesRaw.forEach(r => {
      ratesMap.set(r.user, Number(r.avgRate));
    });

    // Pre-fetch all staff absences
    const allAbsences = await db.query.staffAbsences.findMany();
    
    // Pre-fetch active worker assignments to compute weekly committed hours
    const allAssignments = await db.query.workerAssignments.findMany({
      where: eq(workerAssignments.status, 'active')
    });

    const stagesKeys = [
      { key: "frameAssembly", name: "frame_assembly" },
      { key: "switchgearMount", name: "switchgear_mount" },
      { key: "busbar", name: "busbar" },
      { key: "wiring", name: "wiring" },
      { key: "labels", name: "labels" },
      { key: "testing", name: "testing" },
      { key: "packagingFreight", name: "packaging_freight" }
    ] as const;

    const result: Record<string, any[]> = {};

    stagesKeys.forEach(stage => {
      let stageWorkers = staff
        .filter(person => {
          const eff = person[stage.key];
          return eff !== null && eff !== undefined;
        })
        .map(person => {
          const effStr = person[stage.key];
          const eff = parseFloat(effStr as string);
          
          let impliedRate = ratesMap.get(person.fullName);
          if (impliedRate === undefined) {
            impliedRate = parseFloat((person.hourlyRate as any) || "0");
          }

          const score = impliedRate / (eff || 1); // fallback to 1 to avoid div by zero, though shouldn't happen if eff > 0

          let isAbsent = false;
          let weeklyCommitted = 0;

          if (stageWindows && stageWindows[stage.name]) {
            const window = stageWindows[stage.name];
            
            // Check absence
            isAbsent = allAbsences.some(a => 
              a.staffId === person.id && 
              a.startDate <= window.end && 
              a.endDate >= window.start
            );

            // Compute weekly committed from assignments that overlap this window
            const overlappingAssignments = allAssignments.filter(a => 
              a.staffId === person.id && 
              a.projectedStart && a.projectedEnd &&
              a.projectedStart <= window.end && 
              a.projectedEnd >= window.start
            );
            
            weeklyCommitted = overlappingAssignments.reduce((sum, a) => {
              const diffTime = new Date(a.projectedEnd!).getTime() - new Date(a.projectedStart!).getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
              const weeks = Math.max(1, Math.ceil(diffDays / 7));
              return sum + (parseFloat(a.assignedHours as string) / weeks);
            }, 0);
          }

          return {
            staff_id: person.id,
            full_name: person.fullName,
            efficiency_rating: eff,
            implied_hourly_rate: impliedRate,
            cost_effectiveness_score: score,
            tier: "", // will be set after sort
            isAbsent,
            weeklyCommitted: Math.round(weeklyCommitted)
          };
        })
        .filter(w => !isNaN(w.efficiency_rating) && w.efficiency_rating > 0);

      stageWorkers.sort((a, b) => a.cost_effectiveness_score - b.cost_effectiveness_score);

      const n = stageWorkers.length;
      if (n > 0) {
        const topThird = Math.ceil(n / 3);
        const middleThird = Math.ceil((2 * n) / 3);

        stageWorkers.forEach((w, i) => {
          if (i < topThird) w.tier = "Recommended";
          else if (i < middleThird) w.tier = "Good";
          else w.tier = "Available";
        });
      }

      result[stage.name] = stageWorkers;
    });

    return {
      success: true,
      data: result
    };
  } catch (error: any) {
    console.error("[getWorkerSuggestionsForProject] Error:", error);
    return { success: false, error: error.message || "Failed to fetch worker suggestions." };
  }
}

export async function assignWorkerToStage(projectId: number, stage: string, staffId: number, assignedHours: number) {
  const session = await validateSession();
  if (!session || (!hasRole(session, "scheduler") && !hasRole(session, "admin"))) {
    return { success: false, error: "Unauthorized" };
  }

  if (assignedHours <= 0) {
    return { success: false, error: "Assigned hours must be greater than 0" };
  }

  const stageHoursRes = await getProjectStageHours(projectId);
  if (!stageHoursRes.success || !stageHoursRes.data) {
    return { success: false, error: "Failed to get project stage hours" };
  }

  let generalStageKey = stage.replace('_ifc', '').replace('_ifm', '');
  const stageHours = stageHoursRes.data[generalStageKey as keyof typeof stageHoursRes.data]?.value || 0;
  
  if (assignedHours > stageHours) {
    return { success: false, error: "Assigned hours cannot exceed total stage hours" };
  }

  const existingStageAssignments = await db.query.workerAssignments.findMany({
    where: and(
      eq(workerAssignments.projectId, projectId),
      eq(workerAssignments.stage, stage),
      eq(workerAssignments.status, 'active')
    )
  });
  
  const assignedSoFar = existingStageAssignments.reduce((sum, a) => sum + parseFloat(a.assignedHours as string), 0);
  if (assignedSoFar + assignedHours > stageHours) {
    return { 
      success: false, 
      error: `Cannot assign more hours than the stage total of ${stageHours} hours. ${assignedSoFar} hours already assigned.` 
    };
  }

  const projSched = await db.query.productionSchedule.findFirst({
    where: eq(productionSchedule.projectId, projectId)
  });
  
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId)
  });

  let startDate = new Date();
  if (projSched?.scheduledStart) {
    startDate = parseISO(projSched.scheduledStart);
  } else if (project?.deliveryDate) {
    startDate = new Date(project.deliveryDate);
  }

  const durationDays = Math.ceil(assignedHours / 8);
  const endDate = addDays(startDate, durationDays);
  
  const projStartStr = format(startDate, 'yyyy-MM-dd');
  const projEndStr = format(endDate, 'yyyy-MM-dd');

  // Check absence
  const overlappingAbsence = await db.query.staffAbsences.findFirst({
    where: and(
      eq(staffAbsences.staffId, staffId),
      lte(staffAbsences.startDate, projEndStr),
      gte(staffAbsences.endDate, projStartStr)
    )
  });

  if (overlappingAbsence) {
    const staffRec = await db.query.staffEfficiency.findFirst({ where: eq(staffEfficiency.id, staffId) });
    const name = staffRec?.fullName || "worker";
    const sStr = format(new Date(overlappingAbsence.startDate), "dd MMM");
    const eStr = format(new Date(overlappingAbsence.endDate), "dd MMM");
    return { success: false, error: `Cannot assign ${name} — recorded absence from ${sStr} to ${eStr} overlaps with this stage window.` };
  }

  try {
    const [inserted] = await db.insert(workerAssignments).values({
      projectId,
      stage,
      staffId,
      assignedHours: assignedHours.toString(),
      projectedStart: format(startDate, 'yyyy-MM-dd'),
      projectedEnd: format(endDate, 'yyyy-MM-dd'),
      createdBy: Number(session.user.id),
    }).returning({ id: workerAssignments.id });

    return { success: true, data: { assignmentId: inserted.id } };
  } catch (error: any) {
    console.error("[assignWorkerToStage] Error:", error);
    return { success: false, error: error.message };
  }
}

export async function getWorkerAssignmentsForProject(projectId: number) {
  await checkAuth();
  
  try {
    const records = await db.select({
      assignment: workerAssignments,
      staff: staffEfficiency
    })
    .from(workerAssignments)
    .innerJoin(staffEfficiency, eq(workerAssignments.staffId, staffEfficiency.id))
    .where(and(
      eq(workerAssignments.projectId, projectId),
      eq(workerAssignments.status, 'active')
    ));
    
    const grouped: Record<string, any[]> = {};
    for (const row of records) {
      const a = row.assignment;
      const s = row.staff;
      
      if (!grouped[a.stage]) grouped[a.stage] = [];
      
      const staffColMap: Record<string, keyof typeof staffEfficiency> = {
        'frame_assembly_ifc': 'frameAssembly',
        'frame_assembly_ifm': 'frameAssembly',
        'switchgear_mount': 'switchgearMount',
        'busbar_ifc': 'busbar',
        'busbar_ifm': 'busbar',
        'wiring': 'wiring',
        'labels': 'labels',
        'testing': 'testing',
        'packaging_freight': 'packagingFreight'
      };
      
      const col = staffColMap[a.stage];
      const val = s[col as keyof typeof s];
      const eff = val ? parseFloat(val as string) : 1;
      
      grouped[a.stage].push({
        id: a.id,
        stage: a.stage,
        assignedHours: parseFloat(a.assignedHours as string),
        projectedStart: a.projectedStart,
        projectedEnd: a.projectedEnd,
        status: a.status,
        staffId: s.id,
        staffName: s.fullName,
        efficiency: eff
      });
    }

    return { success: true, data: grouped };
  } catch (error: any) {
    console.error("[getWorkerAssignmentsForProject] Error:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteWorkerAssignment(assignmentId: number) {
  const session = await validateSession();
  if (!session || (!hasRole(session, "scheduler") && !hasRole(session, "admin"))) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.delete(workerAssignments).where(eq(workerAssignments.id, assignmentId));
    return { success: true };
  } catch (error: any) {
    console.error("[deleteWorkerAssignment] Error:", error);
    return { success: false, error: error.message };
  }
}

export async function fetchWeeklyCapacityBreakdown(weeksAhead: number) {
  await checkAuth();
  try {
    const data = await getWeeklyCapacityBreakdown(weeksAhead);
    return { success: true, data };
  } catch (error: any) {
    console.error("[fetchWeeklyCapacityBreakdown] Error:", error);
    return { success: false, error: error.message };
  }
}

export async function getSchedulingInsights(): Promise<{ success: true, data: InsightItem[] } | { success: false, error: string }> {
  await checkAuth();

  try {
    const insights: InsightItem[] = [];

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

    const rawProjects = await db.query.projects.findMany({
      where: and(
        eq(projects.isArchived, false),
        inArray(projects.rawStatus, activeStatuses),
        notInArray(projects.rawStatus, ["Delivered", "Completed", "Cancelled", "2.6 - Ready for Invoicing", "3.1 - Invoiced"]),
        not(like(projects.projectNumber, "99%")),
        isNotNull(projects.projectType)
      )
    });

    const projectIds = rawProjects.map(p => p.id);

    const allSchedules = projectIds.length > 0 ? await db.query.productionSchedule.findMany({
      where: inArray(productionSchedule.projectId, projectIds)
    }) : [];
    const scheduleMap = new Map<number, typeof allSchedules[0]>();
    allSchedules.forEach(s => scheduleMap.set(s.projectId, s));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Critical — Overdue and unscheduled
    let overdueUnscheduledCount = 0;
    for (const p of rawProjects) {
      if (p.deliveryDate && new Date(p.deliveryDate) < today && !scheduleMap.has(p.id)) {
        overdueUnscheduledCount++;
      }
    }
    if (overdueUnscheduledCount > 0) {
      insights.push({
        type: 'overdue_unscheduled',
        severity: 'critical',
        title: 'Overdue and unscheduled',
        description: `${overdueUnscheduledCount} projects are past their due date with no scheduled start.`,
        affectedCount: overdueUnscheduledCount,
        actionLabel: 'View projects',
        actionFilter: 'overdue-unscheduled'
      });
    }

    // 2. Critical — Worker absent with active assignments
    const allAssignments = await db.query.workerAssignments.findMany({
      where: eq(workerAssignments.status, 'active')
    });
    const allAbsences = await db.query.staffAbsences.findMany();
    const staffEff = await db.query.staffEfficiency.findMany();
    const staffMap = new Map(staffEff.map(s => [s.id, s.fullName]));

    const assignedProjectIds = Array.from(new Set(allAssignments.map(a => a.projectId)));
    const assignedProjects = assignedProjectIds.length > 0 ? await db.query.projects.findMany({
      where: inArray(projects.id, assignedProjectIds)
    }) : [];
    const projectMap = new Map(assignedProjects.map(p => [p.id, p]));

    for (const absence of allAbsences) {
      const absStart = new Date(absence.startDate);
      const absEnd = new Date(absence.endDate);
      const overlapping = allAssignments.filter(a => {
        if (a.staffId !== absence.staffId || !a.projectedStart || !a.projectedEnd) return false;
        const aStart = new Date(a.projectedStart);
        const aEnd = new Date(a.projectedEnd);
        return aStart <= absEnd && aEnd >= absStart;
      });
      
      if (overlapping.length > 0) {
        const staffName = staffMap.get(absence.staffId) || "worker";
        const dFormat = (d: Date) => format(d, "dd MMM");
        
        for (const a of overlapping) {
          const proj = projectMap.get(a.projectId);
          const pNum = proj?.projectNumber || "Unknown";
          const pName = proj?.name || "Unknown Project";
          insights.push({
            type: `conflict_${absence.id}_${a.id}`,
            severity: 'critical',
            title: 'Assignment conflict',
            description: `Worker ${staffName} is assigned to ${pNum} - ${pName} during recorded absence ${dFormat(absStart)} to ${dFormat(absEnd)}.`,
            affectedCount: 1
          });
        }
      }
    }

    // 3. Warning — Projects at risk of missing deadline
    let atRiskCount = 0;
    for (const p of rawProjects) {
      const schedule = scheduleMap.get(p.id);
      if (schedule && schedule.scheduledStart && p.deliveryDate && Number(p.remainingHours) > 0) {
        const remaining = Number(p.remainingHours);
        const sStart = new Date(schedule.scheduledStart);
        const daysNeeded = remaining / 7.6;
        const projFinish = addDays(sStart, daysNeeded);
        if (projFinish > new Date(p.deliveryDate)) {
          atRiskCount++;
        }
      }
    }
    if (atRiskCount > 0) {
      insights.push({
        type: 'at_risk',
        severity: 'warning',
        title: 'At risk of missing deadline',
        description: `${atRiskCount} projects are projected to finish after their due date.`,
        affectedCount: atRiskCount,
        actionLabel: 'View at risk',
        actionFilter: 'at-risk'
      });
    }

    // 4. Warning — Stages with demand but no rated staff
    const psdRes = await getProductionSchedulingData();
    const psData = psdRes.data?.projects || [];
    const stageCapacity = psdRes.data?.stageCapacity || {} as any;

    const stageDemand = {
      frameAssembly: 0,
      switchgearMount: 0,
      busbar: 0,
      wiring: 0,
      labels: 0,
      testing: 0,
      packagingFreight: 0
    };
    psData.forEach(p => {
      if (p.stages.frameAssembly?.value) stageDemand.frameAssembly += p.stages.frameAssembly.value;
      if (p.stages.switchgearMount?.value) stageDemand.switchgearMount += p.stages.switchgearMount.value;
      if (p.stages.busbar?.value) stageDemand.busbar += p.stages.busbar.value;
      if (p.stages.wiring?.value) stageDemand.wiring += p.stages.wiring.value;
      if (p.stages.labels?.value) stageDemand.labels += p.stages.labels.value;
      if (p.stages.testing?.value) stageDemand.testing += p.stages.testing.value;
      if (p.stages.packagingFreight?.value) stageDemand.packagingFreight += p.stages.packagingFreight.value;
    });

    const stageChecks = [
      { key: 'frameAssembly', name: 'Frame Assembly', cap: (stageCapacity.frameAssemblyIfc || 0) + (stageCapacity.frameAssemblyIfm || 0) },
      { key: 'switchgearMount', name: 'Switchgear Mount', cap: (stageCapacity.switchgearMount || 0) },
      { key: 'busbar', name: 'Busbar', cap: (stageCapacity.busbarIfc || 0) + (stageCapacity.busbarIfm || 0) },
      { key: 'wiring', name: 'Wiring', cap: (stageCapacity.wiring || 0) },
      { key: 'labels', name: 'Labels', cap: (stageCapacity.labels || 0) },
      { key: 'testing', name: 'Testing', cap: (stageCapacity.testing || 0) },
      { key: 'packagingFreight', name: 'Packaging and Freight', cap: (stageCapacity.packagingFreight || 0) }
    ];

    stageChecks.forEach(st => {
      if (st.cap === 0 && stageDemand[st.key as keyof typeof stageDemand] > 0) {
        insights.push({
          type: `no_staff_${st.key}`,
          severity: 'warning',
          title: 'No rated staff for stage',
          description: `${st.name} has demand but no efficiency ratings entered for any staff.`,
          affectedCount: 1
        });
      }
    });

    // 5. Info — Recently unblocked projects
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    let recentlyUnblockedCount = 0;
    for (const p of rawProjects) {
      if (scheduleMap.has(p.id)) continue;
      let unblocked = false;
      if (p.sheetmetalDeliveredDate && new Date(p.sheetmetalDeliveredDate) >= sevenDaysAgo) {
        unblocked = true;
      }
      if (p.switchgearDeliveredDate && new Date(p.switchgearDeliveredDate) >= sevenDaysAgo) {
        unblocked = true;
      }
      if (unblocked) {
        recentlyUnblockedCount++;
      }
    }
    if (recentlyUnblockedCount > 0) {
      insights.push({
        type: 'recently_unblocked',
        severity: 'info',
        title: 'Ready to schedule',
        description: `${recentlyUnblockedCount} projects had materials delivered in the last 7 days and are ready to be scheduled.`,
        affectedCount: recentlyUnblockedCount,
        actionLabel: 'View projects',
        actionFilter: 'recently-unblocked'
      });
    }

    // 6. Info — Unscheduled active projects
    let unscheduledCount = 0;
    for (const p of rawProjects) {
      if (!scheduleMap.has(p.id)) {
        unscheduledCount++;
      }
    }
    if (unscheduledCount > 0) {
      insights.push({
        type: 'unscheduled',
        severity: 'info',
        title: 'Unscheduled projects',
        description: `${unscheduledCount} active projects have no scheduled start date yet.`,
        affectedCount: unscheduledCount
      });
    }

    const severityOrder = { critical: 0, warning: 1, info: 2 };
    insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return { success: true, data: insights };
  } catch (error: any) {
    console.error("[getSchedulingInsights] Error:", error);
    return { success: false, error: error.message || "Failed to load scheduling insights." };
  }
}

export async function previewAutoSchedule(projectIds?: number[]): Promise<{ success: true; data: { schedule: AutoScheduleResult[]; summary: SchedulingSummary } } | { success: false; error: string }> {
  const session = await validateSession();
  if (!session || (!hasRole(session, "scheduler") && !hasRole(session, "admin"))) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const schedule = await generateAutoSchedule(projectIds);
    const summary = await getSchedulingSummary(schedule);
    return { success: true, data: { schedule, summary } };
  } catch (error: any) {
    console.error("[previewAutoSchedule] Error:", error);
    return { success: false, error: error.message || "Failed to preview auto-schedule." };
  }
}

export async function applyAutoSchedule(projectIds?: number[]): Promise<{ success: true; data: { applied: number; skipped: number; workerAssignmentsCreated: number } } | { success: false; error: string }> {
  const session = await validateSession();
  if (!session || (!hasRole(session, "scheduler") && !hasRole(session, "admin"))) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Only auto-schedules projects without an existing manual scheduled start.
    // Joe's manual drag decisions are always preserved.
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

    let targetProjects;
    if (projectIds && projectIds.length > 0) {
      targetProjects = await db.query.projects.findMany({
        where: inArray(projects.id, projectIds)
      });
    } else {
      targetProjects = await db.query.projects.findMany({
        where: and(
          eq(projects.isArchived, false),
          inArray(projects.rawStatus, activeStatuses),
          notInArray(projects.rawStatus, ["Delivered", "Completed", "Cancelled", "2.6 - Ready for Invoicing", "3.1 - Invoiced"]),
          not(like(projects.projectNumber, "99%")),
          isNotNull(projects.projectType)
        )
      });
    }

    const targetProjectIds = targetProjects.map(p => p.id);
    if (targetProjectIds.length === 0) {
      return { success: true, data: { applied: 0, skipped: 0, workerAssignmentsCreated: 0 } };
    }

    const allSchedules = await db.query.productionSchedule.findMany({
      where: inArray(productionSchedule.projectId, targetProjectIds)
    });
    const scheduleMap = new Map(allSchedules.map(s => [s.projectId, s]));

    const autoSchedule = await generateAutoSchedule(projectIds);
    const autoScheduleMap = new Map(autoSchedule.map(s => [s.projectId, s]));

    let applied = 0;
    let skipped = 0;
    let workerAssignmentsCreated = 0;

    const allAbsences = await db.query.staffAbsences.findMany();

    for (const projectId of targetProjectIds) {
      const existing = scheduleMap.get(projectId);
      if (existing && existing.scheduledStart !== null) {
        skipped++;
        continue;
      }

      const suggested = autoScheduleMap.get(projectId);
      if (suggested) {
        if (existing) {
          await db.update(productionSchedule)
            .set({
              scheduledStart: suggested.suggestedStart,
              scheduledByAuto: true,
              updatedAt: new Date(),
              updatedBy: Number(session.user.id)
            })
            .where(eq(productionSchedule.projectId, projectId));
        } else {
          await db.insert(productionSchedule)
            .values({
              projectId,
              scheduledStart: suggested.suggestedStart,
              scheduledByAuto: true,
              updatedBy: Number(session.user.id)
            });
        }
        applied++;

        if (suggested.workerAssignments && suggested.workerAssignments.length > 0) {
          const aggregatedAssignments = new Map<string, { stage: string, staffId: number, hours: number, minStart: Date, maxEnd: Date }>();
          
          for (const a of suggested.workerAssignments) {
            const startDate = parseISO(a.week);
            const durationDays = Math.ceil(a.hours / 8);
            const endDate = addDays(startDate, durationDays);
            
            const key = `${a.stage}-${a.staffId}`;
            if (aggregatedAssignments.has(key)) {
              const existing = aggregatedAssignments.get(key)!;
              existing.hours += a.hours;
              if (startDate < existing.minStart) existing.minStart = startDate;
              if (endDate > existing.maxEnd) existing.maxEnd = endDate;
            } else {
              aggregatedAssignments.set(key, { 
                stage: a.stage, 
                staffId: a.staffId, 
                hours: a.hours,
                minStart: startDate,
                maxEnd: endDate
              });
            }
          }

          const stageHoursRes = await getProjectStageHours(projectId);
          
          for (const a of aggregatedAssignments.values()) {
            const projStartStr = format(a.minStart, 'yyyy-MM-dd');
            const projEndStr = format(a.maxEnd, 'yyyy-MM-dd');

            // Check absence
            const overlappingAbsence = allAbsences.find(ab => 
              ab.staffId === a.staffId && 
              ab.startDate <= projEndStr && 
              ab.endDate >= projStartStr
            );

            if (overlappingAbsence) {
              console.warn(`[applyAutoSchedule] Skipping assignment for staff ${a.staffId} on project ${projectId} stage ${a.stage} due to absence conflict.`);
              continue;
            }

            if (!stageHoursRes.success || !stageHoursRes.data) {
              console.warn(`[applyAutoSchedule] Skipping assignment for project ${projectId} - could not fetch stage hours.`);
              continue;
            }

            const existingStageAssignments = await db.query.workerAssignments.findMany({
              where: and(
                eq(workerAssignments.projectId, projectId),
                eq(workerAssignments.stage, a.stage),
                eq(workerAssignments.status, 'active')
              )
            });
            const assignedSoFar = existingStageAssignments.reduce((sum, wa) => sum + parseFloat(wa.assignedHours as string), 0);
            
            let generalStageKey = a.stage.replace('_ifc', '').replace('_ifm', '');
            const totalStageHours = stageHoursRes.data[generalStageKey as keyof typeof stageHoursRes.data]?.value || 0;

            // Using 0.01 tolerance for floating point additions
            if (assignedSoFar + a.hours > totalStageHours + 0.01) {
              console.warn(`[applyAutoSchedule] Skipping assignment for project ${projectId} stage ${a.stage} - hours exceed total (${assignedSoFar} + ${a.hours} > ${totalStageHours}).`);
              continue;
            }
            
            // Upsert the assignment to prevent duplicate key errors if there's already an existing record we want to aggregate onto
            const existingWorkerAssignment = existingStageAssignments.find(wa => wa.staffId === a.staffId);
            
            if (existingWorkerAssignment) {
               const newHours = parseFloat(existingWorkerAssignment.assignedHours as string) + a.hours;
               await db.update(workerAssignments).set({
                 assignedHours: newHours.toString(),
                 projectedStart: projStartStr,
                 projectedEnd: projEndStr
               }).where(eq(workerAssignments.id, existingWorkerAssignment.id));
               // Not strictly a new record created, but we can treat it as one for the counter
               workerAssignmentsCreated++;
            } else {
               await db.insert(workerAssignments).values({
                 projectId,
                 stage: a.stage,
                 staffId: a.staffId,
                 assignedHours: a.hours.toString(),
                 projectedStart: projStartStr,
                 projectedEnd: projEndStr,
                 createdBy: Number(session.user.id),
                 createdByAuto: true,
               });
               workerAssignmentsCreated++;
            }
          }
        }
      }
    }

    return { success: true, data: { applied, skipped, workerAssignmentsCreated } };
  } catch (error: any) {
    console.error("[applyAutoSchedule] Error:", error);
    return { success: false, error: error.message || "Failed to apply auto-schedule." };
  }
}

export async function undoAutoSchedule(): Promise<{ success: true; data: { cleared: number, workerAssignmentsCleared: number } } | { success: false; error: string }> {
  const session = await validateSession();
  if (!session || (!hasRole(session, "scheduler") && !hasRole(session, "admin"))) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const deleted = await db.delete(productionSchedule)
      .where(eq(productionSchedule.scheduledByAuto, true))
      .returning({ id: productionSchedule.id });
      
    const deletedAssignments = await db.delete(workerAssignments)
      .where(eq(workerAssignments.createdByAuto, true))
      .returning({ id: workerAssignments.id });
    
    console.log(`User ${session.user.id} undid auto-schedule, clearing ${deleted.length} schedule records and ${deletedAssignments.length} assignments.`);
    return { success: true, data: { cleared: deleted.length, workerAssignmentsCleared: deletedAssignments.length } };
  } catch (error: any) {
    console.error("[undoAutoSchedule] Error:", error);
    return { success: false, error: error.message || "Failed to undo auto-schedule." };
  }
}

export async function getWorkerDetail(staffId: number) {
  await checkAuth();

  try {
    const staff = await db.query.staffEfficiency.findFirst({
      where: eq(staffEfficiency.id, staffId)
    });

    if (!staff) {
      return { success: false, error: "Staff member not found" };
    }

    const assignments = await db
      .select({
        id: workerAssignments.id,
        stage: workerAssignments.stage,
        assignedHours: workerAssignments.assignedHours,
        projectedStart: workerAssignments.projectedStart,
        projectedEnd: workerAssignments.projectedEnd,
        projectId: projects.id,
        projectNumber: projects.projectNumber,
        projectName: projects.name,
        workguruId: projects.workguruId
      })
      .from(workerAssignments)
      .innerJoin(projects, eq(workerAssignments.projectId, projects.id))
      .where(and(
        eq(workerAssignments.staffId, staffId),
        eq(workerAssignments.status, 'active')
      ))
      .orderBy(workerAssignments.projectedStart);

    const todayStr = new Date().toISOString().split('T')[0];
    const absences = await db.query.staffAbsences.findMany({
      where: and(
        eq(staffAbsences.staffId, staffId),
        gte(staffAbsences.endDate, todayStr)
      ),
      orderBy: (staffAbsences, { asc }) => [asc(staffAbsences.startDate)]
    });

    const breakdownRes = await getWeeklyCapacityBreakdown(8);
    const capacityBreakdown = breakdownRes.map(week => {
      const worker = week.workerUtilisation.find(w => w.staffId === staffId) || { committedHours: 0, freeHours: 0, isAbsent: false };
      return {
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        committedHours: worker.committedHours,
        freeHours: worker.freeHours,
        isAbsent: worker.isAbsent
      };
    });

    return {
      success: true,
      data: {
        staff,
        assignments,
        absences,
        capacityBreakdown
      }
    };

  } catch (error: any) {
    console.error("[getWorkerDetail] Error:", error);
    return { success: false, error: error.message || "Failed to load worker details." };
  }
}

export async function generateAISchedulingInsights(schedulingContext: {
  activeCount: number
  overdueCount: number
  atRiskCount: number
  unscheduledCount: number
  busiestStage: string
  busiestStageUtilisation: number
  workerConflicts: string[]
  recentlyUnblockedCount: number
}) {
  await checkAuth();

  try {
    const prompt = `You are a production scheduling assistant for Chadwick Switchboards, a switchboard manufacturing company. Based on the following data, write exactly 2-3 sentences in plain English summarising the current production situation and the single most important action the operations manager should take today. Be direct and specific. No bullet points. No headers.

Current scheduling data:
- Active projects: ${schedulingContext.activeCount}
- Overdue projects: ${schedulingContext.overdueCount}
- At risk of missing deadline: ${schedulingContext.atRiskCount}
- Unscheduled active projects: ${schedulingContext.unscheduledCount}
- Most loaded stage: ${schedulingContext.busiestStage} at ${schedulingContext.busiestStageUtilisation}% utilisation
- Worker scheduling conflicts: ${schedulingContext.workerConflicts.length > 0 ? schedulingContext.workerConflicts.join(', ') : 'none'}
- Projects with materials recently delivered and ready to schedule: ${schedulingContext.recentlyUnblockedCount}

Summary:`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL,
        prompt: prompt,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const json = await response.json();
    if (!json.response) {
      throw new Error("No response string from Ollama");
    }

    return { success: true, data: { summary: json.response.trim() } };

  } catch (error) {
    console.error("[generateAISchedulingInsights] Error:", error);
    return { success: false, error: "AI insights unavailable" };
  }
}
