import { db } from "@/db";
import { projects, tasks, projectStageHours, productionSchedule, workerAssignments, staffEfficiency, staffAbsences, systemConfig } from "@/db/schema";
import { eq, and, inArray, notInArray, not, like, isNotNull, lte, gte } from "drizzle-orm";
import { addDays, differenceInDays, format, parseISO } from "date-fns";

export type AutoScheduleResult = {
  projectId: number;
  projectNumber: string;
  projectName: string;
  suggestedStart: string; // "yyyy-MM-dd"
  reason: string;
  stagesScheduled: { stage: string; hours: number }[];
};

export type SchedulingSummary = {
  totalScheduled: number;
  overdueCount: number;
  averageDaysToStart: number;
  highestLoadWeek: string;
};

const STAGE_CONFIGS = [
  { projectKey: 'frameAssembly', capacityKey: 'frameAssembly', name: 'Frame Assembly' },
  { projectKey: 'switchgearMount', capacityKey: 'switchgearMount', name: 'Switchgear Mount' },
  { projectKey: 'busbar', capacityKey: 'busbar', name: 'Busbar' },
  { projectKey: 'wiring', capacityKey: 'wiring', name: 'Wiring' },
  { projectKey: 'labels', capacityKey: 'labels', name: 'Labels' },
  { projectKey: 'testing', capacityKey: 'testing', name: 'Testing' },
  { projectKey: 'packagingFreight', capacityKey: 'packagingFreight', name: 'Packaging and Freight' }
] as const;

export async function generateAutoSchedule(projectIds?: number[]): Promise<AutoScheduleResult[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Fetch system config stdHours
  const config = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, 'capacity_settings')
  });
  let stdHours = 38;
  if (config?.value && typeof config.value === 'object' && 'hoursPerWeek' in config.value) {
    stdHours = Number((config.value as any).hoursPerWeek) || 38;
  }

  // 2. Fetch staff & absences
  const staff = await db.query.staffEfficiency.findMany({
    where: and(
      eq(staffEfficiency.isActive, true),
      eq(staffEfficiency.isWorkshopStaff, true)
    ),
  });
  const allAbsences = await db.query.staffAbsences.findMany();

  // 3. Fetch active worker assignments for the next 26 weeks
  // We align start of this week to Monday
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const currentWeekStart = new Date(today.getTime());
  currentWeekStart.setDate(diff);
  currentWeekStart.setHours(0, 0, 0, 0);

  const horizonEnd = addDays(currentWeekStart, 26 * 7 - 1);
  const currentWeekStartStr = currentWeekStart.toISOString().split('T')[0];
  const horizonEndStr = horizonEnd.toISOString().split('T')[0];

  const activeAssignments = await db.query.workerAssignments.findMany({
    where: and(
      eq(workerAssignments.status, 'active'),
      lte(workerAssignments.projectedStart, horizonEndStr),
      gte(workerAssignments.projectedEnd, currentWeekStartStr)
    )
  });

  // 4. Build 26 weekly capacity buckets
  type CapacityKeys = 'frameAssemblyIfc' | 'frameAssemblyIfm' | 'switchgearMount' | 'busbarIfc' | 'busbarIfm' | 'wiring' | 'labels' | 'testing' | 'packagingFreight';
  
  const capacityBuckets: {
    weekStart: Date;
    weekEnd: Date;
    weekStartStr: string;
    capacity: Record<CapacityKeys, number>;
  }[] = [];

  let tempStart = new Date(currentWeekStart);
  for (let i = 0; i < 26; i++) {
    const weekStart = new Date(tempStart);
    const weekEnd = addDays(weekStart, 6);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const absentStaffIds = new Set(
      allAbsences
        .filter(a => {
          const s = new Date(a.startDate);
          const e = new Date(a.endDate);
          s.setHours(0,0,0,0);
          e.setHours(23,59,59,999);
          return s <= weekEnd && e >= weekStart;
        })
        .map(a => a.staffId)
    );

    const weekBaseCapacity: Record<CapacityKeys, number> = {
      frameAssemblyIfc: 0, frameAssemblyIfm: 0, switchgearMount: 0,
      busbarIfc: 0, busbarIfm: 0, wiring: 0, labels: 0,
      testing: 0, packagingFreight: 0
    };

    for (const person of staff) {
      if (absentStaffIds.has(person.id)) continue;

      if (person.frameAssembly !== null) {
        const val = parseFloat(person.frameAssembly as string) * stdHours;
        weekBaseCapacity.frameAssemblyIfc += val;
        weekBaseCapacity.frameAssemblyIfm += val;
      }
      if (person.switchgearMount !== null) {
        weekBaseCapacity.switchgearMount += parseFloat(person.switchgearMount as string) * stdHours;
      }
      if (person.busbar !== null) {
        const val = parseFloat(person.busbar as string) * stdHours;
        weekBaseCapacity.busbarIfc += val;
        weekBaseCapacity.busbarIfm += val;
      }
      if (person.wiring !== null) {
        weekBaseCapacity.wiring += parseFloat(person.wiring as string) * stdHours;
      }
      if (person.labels !== null) {
        weekBaseCapacity.labels += parseFloat(person.labels as string) * stdHours;
      }
      if (person.testing !== null) {
        weekBaseCapacity.testing += parseFloat(person.testing as string) * stdHours;
      }
      if (person.packagingFreight !== null) {
        weekBaseCapacity.packagingFreight += parseFloat(person.packagingFreight as string) * stdHours;
      }
    }

    const committedHours: Record<CapacityKeys, number> = {
      frameAssemblyIfc: 0, frameAssemblyIfm: 0, switchgearMount: 0,
      busbarIfc: 0, busbarIfm: 0, wiring: 0, labels: 0,
      testing: 0, packagingFreight: 0
    };

    const weekAssignments = activeAssignments.filter(a => {
      return a.projectedStart && a.projectedEnd &&
             a.projectedStart <= weekEndStr && a.projectedEnd >= weekStartStr;
    });

    for (const assignment of weekAssignments) {
      if (!assignment.projectedStart || !assignment.projectedEnd) continue;
      const pStart = new Date(assignment.projectedStart);
      const pEnd = new Date(assignment.projectedEnd);
      const days = differenceInDays(pEnd, pStart) || 1;
      const weeksInWindow = Math.max(1, Math.ceil(days / 7));
      const weeklyCommitted = parseFloat(assignment.assignedHours as string) / weeksInWindow;

      switch(assignment.stage) {
        case 'frame_assembly_ifc': committedHours.frameAssemblyIfc += weeklyCommitted; break;
        case 'frame_assembly_ifm': committedHours.frameAssemblyIfm += weeklyCommitted; break;
        case 'switchgear_mount': committedHours.switchgearMount += weeklyCommitted; break;
        case 'busbar_ifc': committedHours.busbarIfc += weeklyCommitted; break;
        case 'busbar_ifm': committedHours.busbarIfm += weeklyCommitted; break;
        case 'wiring': committedHours.wiring += weeklyCommitted; break;
        case 'labels': committedHours.labels += weeklyCommitted; break;
        case 'testing': committedHours.testing += weeklyCommitted; break;
        case 'packaging_freight': committedHours.packagingFreight += weeklyCommitted; break;
      }
    }

    const capacity: Record<CapacityKeys, number> = {} as any;
    for (const key of Object.keys(weekBaseCapacity) as CapacityKeys[]) {
      capacity[key] = Math.max(0, weekBaseCapacity[key] - committedHours[key]);
    }

    capacityBuckets.push({
      weekStart,
      weekEnd,
      weekStartStr,
      capacity
    });

    tempStart = addDays(tempStart, 7);
  }

  // 5. Fetch all active projects (or filter by projectIds if provided)
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

  let rawProjects;
  if (projectIds && projectIds.length > 0) {
    rawProjects = await db.query.projects.findMany({
      where: inArray(projects.id, projectIds)
    });
  } else {
    rawProjects = await db.query.projects.findMany({
      where: and(
        eq(projects.isArchived, false),
        inArray(projects.rawStatus, activeStatuses),
        notInArray(projects.rawStatus, ["Delivered", "Completed", "Cancelled", "2.6 - Ready for Invoicing", "3.1 - Invoiced"]),
        not(like(projects.projectNumber, "99%")),
        isNotNull(projects.projectType)
      )
    });
  }

  if (rawProjects.length === 0) {
    return [];
  }

  const loadedProjectIds = rawProjects.map(p => p.id);

  // Fetch tasks, stage hours, and production schedule records
  const allTasks = await db.query.tasks.findMany({
    where: inArray(tasks.projectId, loadedProjectIds)
  });
  const allStageHours = await db.query.projectStageHours.findMany({
    where: inArray(projectStageHours.projectId, loadedProjectIds)
  });
  const allSchedules = await db.query.productionSchedule.findMany({
    where: inArray(productionSchedule.projectId, loadedProjectIds)
  });

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

  const getStageHoursValue = (
    pTasks: typeof allTasks | undefined,
    taskName: string,
    manualVal: string | null | undefined
  ): number => {
    const task = pTasks?.find(t => t.name === taskName);
    if (task && task.budgetHours > 0) {
      return task.budgetHours;
    }
    if (manualVal !== null && manualVal !== undefined) {
      const val = parseFloat(manualVal);
      if (!isNaN(val) && val > 0) {
        return val;
      }
    }
    return 0;
  };

  // 6. Calculate priority score for each project
  const scoredProjects = rawProjects.map(p => {
    const pTasks = tasksMap.get(p.id);
    const sh = stageHoursMap.get(p.id);
    const isIfm = p.projectType?.toUpperCase().includes("IFM") || false;

    const manualFrameAssembly = isIfm ? sh?.frameAssemblyIfm : sh?.frameAssemblyIfc;
    const manualBusbar = isIfm ? sh?.busbarIfm : sh?.busbarIfc;

    const stageHours = {
      frameAssembly: getStageHoursValue(pTasks, "04 - Frame Assembling", manualFrameAssembly),
      switchgearMount: getStageHoursValue(pTasks, "05 - Switchgear & Component Mounting", sh?.switchgearMount),
      busbar: getStageHoursValue(pTasks, "06 - Busbar Assembling", manualBusbar),
      wiring: getStageHoursValue(pTasks, "07 - Wiring", sh?.wiring),
      labels: getStageHoursValue(pTasks, "08 - Fixing Labels", sh?.labels),
      testing: getStageHoursValue(pTasks, "09 - Inspection & Testing", sh?.testing),
      packagingFreight: getStageHoursValue(pTasks, "10 - Packaging and Freight", sh?.packagingFreight),
    };

    const totalStageHours = Object.values(stageHours).reduce((sum, h) => sum + h, 0);

    // Score components
    const dueDate = p.deliveryDate ? new Date(p.deliveryDate) : null;
    const daysUntilDue = dueDate ? differenceInDays(dueDate, today) : 9999;
    let score = daysUntilDue;

    const smDelivered = p.sheetmetalDeliveredDate !== null;
    const sgDelivered = p.switchgearDeliveredDate !== null;
    if (smDelivered && sgDelivered) {
      score -= 10;
    }

    if (p.drawingApprovalDate !== null) {
      score -= 5;
    }

    if (totalStageHours > 0) {
      score -= 3;
    }

    return {
      project: p,
      stageHours,
      totalStageHours,
      score,
      isIfm
    };
  });

  // Sort: Lower score = higher priority
  scoredProjects.sort((a, b) => a.score - b.score);

  const results: AutoScheduleResult[] = [];

  // 7. Greedy scheduling
  for (const item of scoredProjects) {
    const p = item.project;
    const existingStart = scheduleMap.get(p.id);

    // If it already has a scheduled start in production_schedule, skip it
    if (existingStart) {
      continue;
    }

    // Determine min start date based on materials delivered
    let minStartDate = today;
    let matReason = "";

    if (p.sheetmetalDeliveredDate) {
      const smDate = new Date(p.sheetmetalDeliveredDate);
      if (smDate > minStartDate) {
        minStartDate = smDate;
        matReason = `Scheduled after SM delivery date of ${format(smDate, "d MMM")}`;
      }
    }
    if (p.switchgearDeliveredDate) {
      const sgDate = new Date(p.switchgearDeliveredDate);
      if (sgDate > minStartDate) {
        minStartDate = sgDate;
        matReason = `Scheduled after SG delivery date of ${format(sgDate, "d MMM")}`;
      }
    }

    // Find minWeekIdx that can satisfy minStartDate
    let minWeekIdx = 0;
    for (let w = 0; w < 26; w++) {
      if (minStartDate <= capacityBuckets[w].weekEnd) {
        minWeekIdx = w;
        break;
      }
    }

    // Identify most constrained stage
    let mostConstrainedStage: typeof STAGE_CONFIGS[number] | null = null;
    let highestRatio = -1;

    for (const stage of STAGE_CONFIGS) {
      const demand = item.stageHours[stage.projectKey];
      if (demand > 0) {
        const capKey = (stage.projectKey === 'frameAssembly' || stage.projectKey === 'busbar')
          ? `${stage.projectKey}${item.isIfm ? 'Ifm' : 'Ifc'}` as CapacityKeys
          : stage.projectKey as CapacityKeys;

        let totalCap = 0;
        for (let w = 0; w < 26; w++) {
          totalCap += capacityBuckets[w].capacity[capKey];
        }

        const ratio = totalCap > 0 ? demand / totalCap : Infinity;
        if (ratio > highestRatio) {
          highestRatio = ratio;
          mostConstrainedStage = stage;
        }
      }
    }

    let selectedWeek = minWeekIdx;
    let chosenReason = "";

    if (mostConstrainedStage && item.totalStageHours > 0) {
      const demand = item.stageHours[mostConstrainedStage.projectKey];
      const capKey = (mostConstrainedStage.projectKey === 'frameAssembly' || mostConstrainedStage.projectKey === 'busbar')
        ? `${mostConstrainedStage.projectKey}${item.isIfm ? 'Ifm' : 'Ifc'}` as CapacityKeys
        : mostConstrainedStage.projectKey as CapacityKeys;

      const durationDays = Math.ceil(demand / 8);
      const weeksInWindow = Math.max(1, Math.ceil(durationDays / 7));

      let found = false;
      for (let w = minWeekIdx; w < 26; w++) {
        let fits = true;
        for (let i = 0; i < weeksInWindow; i++) {
          const targetWeek = w + i;
          if (targetWeek >= 26) continue;
          if (capacityBuckets[targetWeek].capacity[capKey] < demand / weeksInWindow) {
            fits = false;
            break;
          }
        }
        if (fits) {
          selectedWeek = w;
          found = true;
          break;
        }
      }

      if (!found) {
        // If no week fits perfectly, pick the one with max capacity for this stage starting from minWeekIdx
        let maxCap = -1;
        for (let w = minWeekIdx; w < 26; w++) {
          if (capacityBuckets[w].capacity[capKey] > maxCap) {
            maxCap = capacityBuckets[w].capacity[capKey];
            selectedWeek = w;
          }
        }
      }

      if (selectedWeek > minWeekIdx) {
        chosenReason = `Earliest available week where ${mostConstrainedStage.name} capacity is sufficient`;
      } else if (matReason) {
        chosenReason = matReason;
      } else {
        chosenReason = `Earliest available week where ${mostConstrainedStage.name} capacity is sufficient`;
      }
    } else {
      // No stage hours data
      chosenReason = matReason || "Scheduled immediately based on priority and empty stage hours";
    }

    const scheduledDate = capacityBuckets[selectedWeek].weekStart;
    const suggestedStart = format(scheduledDate, "yyyy-MM-dd");

    // Mark capacity as consumed
    for (const stage of STAGE_CONFIGS) {
      const demand = item.stageHours[stage.projectKey];
      if (demand > 0) {
        const capKey = (stage.projectKey === 'frameAssembly' || stage.projectKey === 'busbar')
          ? `${stage.projectKey}${item.isIfm ? 'Ifm' : 'Ifc'}` as CapacityKeys
          : stage.projectKey as CapacityKeys;

        const durationDays = Math.ceil(demand / 8);
        const weeksInWindow = Math.max(1, Math.ceil(durationDays / 7));

        for (let i = 0; i < weeksInWindow; i++) {
          const targetWeek = selectedWeek + i;
          if (targetWeek < 26) {
            capacityBuckets[targetWeek].capacity[capKey] = Math.max(
              0,
              capacityBuckets[targetWeek].capacity[capKey] - (demand / weeksInWindow)
            );
          }
        }
      }
    }

    const stagesScheduled = STAGE_CONFIGS
      .filter(st => item.stageHours[st.projectKey] > 0)
      .map(st => ({
        stage: st.name,
        hours: item.stageHours[st.projectKey]
      }));

    results.push({
      projectId: p.id,
      projectNumber: p.projectNumber,
      projectName: p.name,
      suggestedStart,
      reason: chosenReason,
      stagesScheduled
    });
  }

  return results;
}

export async function getSchedulingSummary(schedule: AutoScheduleResult[]): Promise<SchedulingSummary> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalScheduled = schedule.length;
  if (totalScheduled === 0) {
    return {
      totalScheduled: 0,
      overdueCount: 0,
      averageDaysToStart: 0,
      highestLoadWeek: ""
    };
  }

  const projectIds = schedule.map(s => s.projectId);
  const scheduledProjects = await db.query.projects.findMany({
    where: inArray(projects.id, projectIds)
  });

  const projectMap = new Map(scheduledProjects.map(p => [p.id, p]));

  let overdueCount = 0;
  let totalDaysToStart = 0;

  const weekLoads: Record<string, number> = {};

  for (const item of schedule) {
    const proj = projectMap.get(item.projectId);
    if (proj?.deliveryDate) {
      const dueDate = new Date(proj.deliveryDate);
      if (dueDate < today) {
        overdueCount++;
      }
    }

    const start = parseISO(item.suggestedStart);
    const daysToStart = differenceInDays(start, today);
    totalDaysToStart += daysToStart;

    // Distribute loads
    for (const stage of item.stagesScheduled) {
      const durationDays = Math.ceil(stage.hours / 8);
      const weeksInWindow = Math.max(1, Math.ceil(durationDays / 7));
      let current = new Date(start);
      for (let i = 0; i < weeksInWindow; i++) {
        const weekStr = format(current, "yyyy-MM-dd");
        weekLoads[weekStr] = (weekLoads[weekStr] || 0) + (stage.hours / weeksInWindow);
        current = addDays(current, 7);
      }
    }
  }

  const averageDaysToStart = Math.round(totalDaysToStart / totalScheduled);

  let highestLoadWeek = "";
  let maxLoad = -1;
  Object.entries(weekLoads).forEach(([week, load]) => {
    if (load > maxLoad) {
      maxLoad = load;
      highestLoadWeek = week;
    }
  });

  return {
    totalScheduled,
    overdueCount,
    averageDaysToStart,
    highestLoadWeek
  };
}
