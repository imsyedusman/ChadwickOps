import { db } from "@/db";
import { projects, tasks, projectStageHours, productionSchedule, workerAssignments, staffEfficiency, staffAbsences, systemConfig, timeEntries } from "@/db/schema";
import { eq, and, inArray, notInArray, not, like, isNotNull, lte, gte, sql } from "drizzle-orm";
import { addDays, differenceInDays, format, parseISO } from "date-fns";

export type AutoScheduleResult = {
  projectId: number;
  projectNumber: string;
  projectName: string;
  suggestedStart: string; // "yyyy-MM-dd"
  reason: string;
  stagesScheduled: { stage: string; hours: number }[];
  workerAssignments: {
    stage: string;
    staffId: number;
    staffName: string;
    hours: number;
    week: string; // "yyyy-MM-dd" week start
  }[];
};

export type SchedulingSummary = {
  totalScheduled: number;
  overdueCount: number;
  averageDaysToStart: number;
  highestLoadWeek: string;
  totalAssignmentsCreated: number;
};

const STAGE_CONFIGS = [
  { projectKey: 'frameAssembly', capacityKey: 'frameAssembly', name: 'Frame Assembly', dbKey: 'frame_assembly' },
  { projectKey: 'switchgearMount', capacityKey: 'switchgearMount', name: 'Switchgear Mount', dbKey: 'switchgear_mount' },
  { projectKey: 'busbar', capacityKey: 'busbar', name: 'Busbar', dbKey: 'busbar' },
  { projectKey: 'wiring', capacityKey: 'wiring', name: 'Wiring', dbKey: 'wiring' },
  { projectKey: 'labels', capacityKey: 'labels', name: 'Labels', dbKey: 'labels' },
  { projectKey: 'testing', capacityKey: 'testing', name: 'Testing', dbKey: 'testing' },
  { projectKey: 'packagingFreight', capacityKey: 'packagingFreight', name: 'Packaging and Freight', dbKey: 'packaging_freight' }
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

  // 2. Fetch staff & absences & rates
  const staff = await db.query.staffEfficiency.findMany({
    where: and(
      eq(staffEfficiency.isActive, true),
      eq(staffEfficiency.isWorkshopStaff, true)
    ),
  });
  const allAbsences = await db.query.staffAbsences.findMany();

  const userRatesRaw = await db.select({
    user: timeEntries.user,
    avgRate: sql<number>`avg(${timeEntries.cost} / ${timeEntries.hours})`
  }).from(timeEntries).where(sql`${timeEntries.hours} > 0`).groupBy(timeEntries.user);

  const ratesMap = new Map<string, number>();
  userRatesRaw.forEach(r => {
    ratesMap.set(r.user, Number(r.avgRate));
  });

  // Calculate base week array (26 weeks)
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

  const weekStarts: Date[] = [];
  let tempStart = new Date(currentWeekStart);
  for (let i = 0; i < 26; i++) {
    weekStarts.push(new Date(tempStart));
    tempStart = addDays(tempStart, 7);
  }

  // Step 1: Build worker availability map
  // Map: staffId -> Map<weekStartStr, availableHours>
  const workerAvailability = new Map<number, Map<string, number>>();

  for (const person of staff) {
    const weeklyAvail = new Map<string, number>();
    for (let w = 0; w < 26; w++) {
      const wStart = weekStarts[w];
      const wEnd = addDays(wStart, 6);
      const wStartStr = wStart.toISOString().split('T')[0];
      const wEndStr = wEnd.toISOString().split('T')[0];

      // Check absence (full or partial, but keeping it simple as per original logic: if absent during the week, zero it out)
      const isAbsent = allAbsences.some(a => {
        const s = new Date(a.startDate);
        const e = new Date(a.endDate);
        s.setHours(0,0,0,0);
        e.setHours(23,59,59,999);
        return s <= wEnd && e >= wStart;
      });

      if (isAbsent) {
        weeklyAvail.set(wStartStr, 0);
      } else {
        // Calculate committed hours
        const weekAssignments = activeAssignments.filter(a => 
          a.staffId === person.id && 
          a.projectedStart && a.projectedEnd &&
          a.projectedStart <= wEndStr && 
          a.projectedEnd >= wStartStr
        );
        let committed = 0;
        for (const a of weekAssignments) {
          const pS = new Date(a.projectedStart!);
          const pE = new Date(a.projectedEnd!);
          const diffDays = Math.ceil((pE.getTime() - pS.getTime()) / (1000 * 3600 * 24)) || 1;
          const weeksInW = Math.max(1, Math.ceil(diffDays / 7));
          committed += (parseFloat(a.assignedHours as string) || 0) / weeksInW;
        }
        
        weeklyAvail.set(wStartStr, Math.max(0, stdHours - committed));
      }
    }
    workerAvailability.set(person.id, weeklyAvail);
  }

  // Helper to find worker rank per stage
  type RankedWorker = { staffId: number, name: string, eff: number, score: number };
  const getRankedWorkers = (stageKey: string): RankedWorker[] => {
    const colName = stageKey as keyof typeof staff[0];
    const workers = staff.filter(s => s[colName] !== null && s[colName] !== undefined).map(s => {
      const eff = parseFloat(s[colName] as string);
      let impliedRate = ratesMap.get(s.fullName);
      if (impliedRate === undefined) impliedRate = parseFloat((s.hourlyRate as any) || "0");
      const score = impliedRate / (eff || 1);
      return { staffId: s.id, name: s.fullName, eff, score };
    }).filter(w => !isNaN(w.eff) && w.eff > 0);
    
    workers.sort((a, b) => a.score - b.score);
    return workers;
  };

  const rankedWorkersPerStage: Record<string, RankedWorker[]> = {};
  for (const st of STAGE_CONFIGS) {
    rankedWorkersPerStage[st.projectKey] = getRankedWorkers(st.capacityKey);
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

  // Step 3: Per-project, per-stage worker assignment
  for (const item of scoredProjects) {
    const p = item.project;
    const existingStart = scheduleMap.get(p.id);

    // If it already has a scheduled start in production_schedule, skip it
    if (existingStart) {
      continue;
    }

    // Determine min start date based on materials delivered
    const currentDay = today.getDay();
    const diffToMonday = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    let minStartDate = new Date(today.getTime());
    minStartDate.setDate(diffToMonday);
    minStartDate.setHours(0, 0, 0, 0);

    if (currentDay === 0 || currentDay > 3) {
      minStartDate = addDays(minStartDate, 7);
    }
    if (minStartDate < today) {
      minStartDate = new Date(today.getTime());
      minStartDate.setHours(0, 0, 0, 0);
    }

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

    let minWeekIdx = 0;
    for (let w = 0; w < 26; w++) {
      if (minStartDate <= addDays(weekStarts[w], 6)) {
        minWeekIdx = w;
        break;
      }
    }

    const assignedWorkers: AutoScheduleResult["workerAssignments"] = [];
    const stagesScheduled: { stage: string; hours: number }[] = [];
    let currentEarliestWeekIdx = minWeekIdx;
    let projectStartStr: string | null = null;
    let missingStaffNotes: string[] = [];
    let schedulingReason = "";

    if (item.totalStageHours === 0) {
      schedulingReason = matReason || "Scheduled immediately based on priority and empty stage hours";
      projectStartStr = weekStarts[currentEarliestWeekIdx].toISOString().split('T')[0];
    } else {
      // Go through sequence
      for (const st of STAGE_CONFIGS) {
        const demand = item.stageHours[st.projectKey];
        if (demand <= 0) continue;

        const dbStageKey = (st.projectKey === 'frameAssembly' || st.projectKey === 'busbar')
          ? `${st.dbKey}_${item.isIfm ? 'ifm' : 'ifc'}`
          : st.dbKey;

        const availableStaffRanked = rankedWorkersPerStage[st.projectKey];
        
        if (availableStaffRanked.length === 0) {
          missingStaffNotes.push(`No rated staff available for ${st.name} — schedule may need manual review.`);
          stagesScheduled.push({ stage: st.name, hours: demand });
          continue; // skip assignment, but move on
        }

        let assignedStaffId = -1;
        let assignedStaffName = "";
        let weekToStartAssignment = -1;
        let finalWeeksInWindow = 1;

        // Find the earliest week where at least one worker has some availability
        let found = false;
        for (let w = currentEarliestWeekIdx; w < 26; w++) {
          const wStartStr = weekStarts[w].toISOString().split('T')[0];
          
          for (const worker of availableStaffRanked) {
            const availMap = workerAvailability.get(worker.staffId);
            if (!availMap) continue;

            let currentWeeksInWindow = 1;
            let hourlyDemandLeft = demand;

            // Does the worker have enough availability starting this week to cover the demand?
            const availWeek = availMap.get(wStartStr) || 0;
            if (availWeek > 0) {
              // We've found a worker with SOME availability this week.
              // We will just assign them, stretching over weeks if needed.
              // How many weeks?
              let tempW = w;
              while (hourlyDemandLeft > 0 && tempW < 26) {
                const twStartStr = weekStarts[tempW].toISOString().split('T')[0];
                const tAvail = availMap.get(twStartStr) || 0;
                if (tAvail > 0) {
                  hourlyDemandLeft -= tAvail;
                }
                if (hourlyDemandLeft > 0) {
                  tempW++;
                  currentWeeksInWindow++;
                }
              }

              if (hourlyDemandLeft <= 0 || tempW >= 26) {
                // Either fully covered, or we hit horizon end. Assign them anyway.
                found = true;
                assignedStaffId = worker.staffId;
                assignedStaffName = worker.name;
                weekToStartAssignment = w;
                finalWeeksInWindow = Math.min(currentWeeksInWindow, 26 - w);
                break;
              }
            }
          }

          if (found) {
            break; // worker found for this week
          }
        }

        if (found && weekToStartAssignment !== -1) {
          // Record the assignment and deduct availability
          const availMap = workerAvailability.get(assignedStaffId)!;
          let remainingDemandToAssign = demand;
          
          if (!projectStartStr) {
            projectStartStr = weekStarts[weekToStartAssignment].toISOString().split('T')[0];
          }

          for (let i = 0; i < finalWeeksInWindow; i++) {
            if (remainingDemandToAssign <= 0) break;
            
            const wIdx = weekToStartAssignment + i;
            if (wIdx >= 26) break;
            
            const wsStr = weekStarts[wIdx].toISOString().split('T')[0];
            const wAvail = availMap.get(wsStr) || 0;
            
            const chunk = Math.min(wAvail, remainingDemandToAssign);
            if (chunk > 0) {
              assignedWorkers.push({
                stage: dbStageKey,
                staffId: assignedStaffId,
                staffName: assignedStaffName,
                hours: chunk,
                week: wsStr
              });
              
              availMap.set(wsStr, wAvail - chunk);
              remainingDemandToAssign -= chunk;
            }
          }
          
          // Next stage can start the week after this stage finishes
          currentEarliestWeekIdx = weekToStartAssignment + finalWeeksInWindow;
          stagesScheduled.push({ stage: st.name, hours: demand });
          
          if (!schedulingReason && !matReason) {
            schedulingReason = `Assigned ${assignedStaffName} to ${st.name} starting ${format(weekStarts[weekToStartAssignment], "d MMM")}`;
          }
        } else {
          // Couldn't find any worker with any availability in the horizon
          missingStaffNotes.push(`No available staff capacity in 26-week horizon for ${st.name}.`);
          stagesScheduled.push({ stage: st.name, hours: demand });
        }
      }

      if (missingStaffNotes.length > 0) {
        if (!schedulingReason) schedulingReason = missingStaffNotes.join(" ");
        else schedulingReason += " | " + missingStaffNotes.join(" ");
      } else if (!schedulingReason) {
         schedulingReason = matReason || "Scheduled successfully";
      }

      if (!projectStartStr) {
        projectStartStr = weekStarts[minWeekIdx].toISOString().split('T')[0];
      }
    }

    results.push({
      projectId: p.id,
      projectNumber: p.projectNumber,
      projectName: p.name,
      suggestedStart: projectStartStr,
      reason: schedulingReason,
      stagesScheduled,
      workerAssignments: assignedWorkers
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
      highestLoadWeek: "",
      totalAssignmentsCreated: 0
    };
  }

  const projectIds = schedule.map(s => s.projectId);
  const scheduledProjects = await db.query.projects.findMany({
    where: inArray(projects.id, projectIds)
  });

  const projectMap = new Map(scheduledProjects.map(p => [p.id, p]));

  let overdueCount = 0;
  let totalDaysToStart = 0;
  let totalAssignmentsCreated = 0;

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

    if (item.workerAssignments) {
      totalAssignmentsCreated += item.workerAssignments.length;
    }

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
    highestLoadWeek,
    totalAssignmentsCreated
  };
}
