import { db } from "@/db";
import { staffEfficiency, systemConfig, workerAssignments, staffAbsences } from "@/db/schema";
import { and, eq, lte, gte } from "drizzle-orm";
import { addDays, parseISO, differenceInDays } from "date-fns";

export type StageCapacity = {
  frameAssemblyIfc: number;
  frameAssemblyIfm: number;
  switchgearMount: number;
  busbarIfc: number;
  busbarIfm: number;
  wiring: number;
  labels: number;
  testing: number;
  packagingFreight: number;
  activeStaffCount: number;
};

export type WeeklyCapacity = {
  weekStartDate: Date;
  weekEndDate: Date;
  capacity: StageCapacity;
};

export type WorkerUtilisation = {
  staffId: number;
  name: string;
  committedHours: number;
  freeHours: number;
  isAbsent?: boolean;
};

export type WeeklyCapacityBreakdown = {
  weekStart: string;
  weekEnd: string;
  availableCapacity: StageCapacity; // Base capacity - committed
  committedHours: StageCapacity;
  freeHours: StageCapacity;
  workerUtilisation: WorkerUtilisation[];
};

export { getStageCapacities as getStageCapacityPerWeek };

/**
 * Calculates effective hours available per build stage per week across all active workshop staff.
 * If weekStart is provided, subtracts commitments for that week.
 */
export async function getStageCapacities(weekStart?: Date): Promise<StageCapacity> {
  const config = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, 'capacity_settings')
  });
  
  let stdHours = 38;
  if (config?.value && typeof config.value === 'object' && 'hoursPerWeek' in config.value) {
    stdHours = Number((config.value as any).hoursPerWeek) || 38;
  }

  const staff = await db.query.staffEfficiency.findMany({
    where: and(
      eq(staffEfficiency.isActive, true),
      eq(staffEfficiency.isWorkshopStaff, true)
    ),
  });

  const capacities: StageCapacity = {
    frameAssemblyIfc: 0,
    frameAssemblyIfm: 0,
    switchgearMount: 0,
    busbarIfc: 0,
    busbarIfm: 0,
    wiring: 0,
    labels: 0,
    testing: 0,
    packagingFreight: 0,
    activeStaffCount: staff.length,
  };

  for (const person of staff) {
    if (person.frameAssembly !== null) {
      capacities.frameAssemblyIfc += parseFloat(person.frameAssembly as string) * stdHours;
      capacities.frameAssemblyIfm += parseFloat(person.frameAssembly as string) * stdHours;
    }
    if (person.switchgearMount !== null) capacities.switchgearMount += parseFloat(person.switchgearMount as string) * stdHours;
    if (person.busbar !== null) {
      capacities.busbarIfc += parseFloat(person.busbar as string) * stdHours;
      capacities.busbarIfm += parseFloat(person.busbar as string) * stdHours;
    }
    if (person.wiring !== null) capacities.wiring += parseFloat(person.wiring as string) * stdHours;
    if (person.labels !== null) capacities.labels += parseFloat(person.labels as string) * stdHours;
    if (person.testing !== null) capacities.testing += parseFloat(person.testing as string) * stdHours;
    if (person.packagingFreight !== null) capacities.packagingFreight += parseFloat(person.packagingFreight as string) * stdHours;
  }

  if (weekStart) {
    const weekEnd = addDays(weekStart, 6);
    
    // Format dates to YYYY-MM-DD for PG comparison
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const activeAssignments = await db.query.workerAssignments.findMany({
      where: and(
        eq(workerAssignments.status, 'active'),
        lte(workerAssignments.projectedStart, weekEndStr),
        gte(workerAssignments.projectedEnd, weekStartStr)
      )
    });

    for (const assignment of activeAssignments) {
      if (!assignment.projectedStart || !assignment.projectedEnd) continue;
      
      const pStart = new Date(assignment.projectedStart);
      const pEnd = new Date(assignment.projectedEnd);
      const days = differenceInDays(pEnd, pStart) || 1;
      const weeksInWindow = Math.max(1, Math.ceil(days / 7));
      const weeklyCommitted = parseFloat(assignment.assignedHours as string) / weeksInWindow;

      switch(assignment.stage) {
        case 'frame_assembly_ifc': capacities.frameAssemblyIfc = Math.max(0, capacities.frameAssemblyIfc - weeklyCommitted); break;
        case 'frame_assembly_ifm': capacities.frameAssemblyIfm = Math.max(0, capacities.frameAssemblyIfm - weeklyCommitted); break;
        case 'switchgear_mount': capacities.switchgearMount = Math.max(0, capacities.switchgearMount - weeklyCommitted); break;
        case 'busbar_ifc': capacities.busbarIfc = Math.max(0, capacities.busbarIfc - weeklyCommitted); break;
        case 'busbar_ifm': capacities.busbarIfm = Math.max(0, capacities.busbarIfm - weeklyCommitted); break;
        case 'wiring': capacities.wiring = Math.max(0, capacities.wiring - weeklyCommitted); break;
        case 'labels': capacities.labels = Math.max(0, capacities.labels - weeklyCommitted); break;
        case 'testing': capacities.testing = Math.max(0, capacities.testing - weeklyCommitted); break;
        case 'packaging_freight': capacities.packagingFreight = Math.max(0, capacities.packagingFreight - weeklyCommitted); break;
      }
    }
  }

  // Round to 2 decimal places for cleaner output
  for (const key of Object.keys(capacities) as Array<keyof StageCapacity>) {
    if (key !== 'activeStaffCount') {
      capacities[key] = Math.round(capacities[key] * 100) / 100;
    }
  }

  return capacities;
}

/**
 * Generates a week-by-week capacity breakdown for a given number of weeks starting from today.
 */
export async function getWeeklyCapacityBreakdown(weeksAhead: number): Promise<WeeklyCapacityBreakdown[]> {
  const config = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, 'capacity_settings')
  });
  let stdHours = 38;
  if (config?.value && typeof config.value === 'object' && 'hoursPerWeek' in config.value) {
    stdHours = Number((config.value as any).hoursPerWeek) || 38;
  }

  const staff = await db.query.staffEfficiency.findMany({
    where: and(
      eq(staffEfficiency.isActive, true),
      eq(staffEfficiency.isWorkshopStaff, true)
    ),
  });

  const allAbsences = await db.query.staffAbsences.findMany();

  const emptyStageCapacity = (): StageCapacity => ({
    frameAssemblyIfc: 0, frameAssemblyIfm: 0, switchgearMount: 0,
    busbarIfc: 0, busbarIfm: 0, wiring: 0, labels: 0,
    testing: 0, packagingFreight: 0, activeStaffCount: staff.length
  });

  const breakdown: WeeklyCapacityBreakdown[] = [];
  const today = new Date();
  // Align to start of current week (Monday)
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  let currentStart = new Date(today.setDate(diff));
  currentStart.setHours(0,0,0,0);

  for (let i = 0; i < weeksAhead; i++) {
    const weekStart = new Date(currentStart);
    const weekEnd = addDays(weekStart, 6);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const activeAssignments = await db.query.workerAssignments.findMany({
      where: and(
        eq(workerAssignments.status, 'active'),
        lte(workerAssignments.projectedStart, weekEndStr),
        gte(workerAssignments.projectedEnd, weekStartStr)
      )
    });

    const committedHours = emptyStageCapacity();
    const weekBaseCapacity = emptyStageCapacity();
    const workerUtilisation: Record<number, { committed: number; free: number, isAbsent: boolean }> = {};
    
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

    // Initialize worker utilisation and week base capacity
    for (const person of staff) {
      const isAbsent = absentStaffIds.has(person.id);
      workerUtilisation[person.id] = { committed: 0, free: isAbsent ? 0 : stdHours, isAbsent }; 

      if (!isAbsent) {
        if (person.frameAssembly !== null) {
          weekBaseCapacity.frameAssemblyIfc += parseFloat(person.frameAssembly as string) * stdHours;
          weekBaseCapacity.frameAssemblyIfm += parseFloat(person.frameAssembly as string) * stdHours;
        }
        if (person.switchgearMount !== null) weekBaseCapacity.switchgearMount += parseFloat(person.switchgearMount as string) * stdHours;
        if (person.busbar !== null) {
          weekBaseCapacity.busbarIfc += parseFloat(person.busbar as string) * stdHours;
          weekBaseCapacity.busbarIfm += parseFloat(person.busbar as string) * stdHours;
        }
        if (person.wiring !== null) weekBaseCapacity.wiring += parseFloat(person.wiring as string) * stdHours;
        if (person.labels !== null) weekBaseCapacity.labels += parseFloat(person.labels as string) * stdHours;
        if (person.testing !== null) weekBaseCapacity.testing += parseFloat(person.testing as string) * stdHours;
        if (person.packagingFreight !== null) weekBaseCapacity.packagingFreight += parseFloat(person.packagingFreight as string) * stdHours;
      } else {
        weekBaseCapacity.activeStaffCount = Math.max(0, weekBaseCapacity.activeStaffCount - 1);
      }
    }

    for (const assignment of activeAssignments) {
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

      if (workerUtilisation[assignment.staffId]) {
        workerUtilisation[assignment.staffId].committed += weeklyCommitted;
        workerUtilisation[assignment.staffId].free = Math.max(0, workerUtilisation[assignment.staffId].free - weeklyCommitted);
      }
    }

    const availableCapacity = emptyStageCapacity();
    const freeHours = emptyStageCapacity();
    for (const key of Object.keys(weekBaseCapacity) as Array<keyof StageCapacity>) {
      if (key !== 'activeStaffCount') {
        availableCapacity[key] = Math.max(0, weekBaseCapacity[key] - committedHours[key]);
        freeHours[key] = Math.max(0, weekBaseCapacity[key] - committedHours[key]);
      } else {
        availableCapacity.activeStaffCount = weekBaseCapacity.activeStaffCount;
        freeHours.activeStaffCount = weekBaseCapacity.activeStaffCount;
      }
    }

    const workerList: WorkerUtilisation[] = staff.map(s => ({
      staffId: s.id,
      name: s.fullName,
      committedHours: Math.round(workerUtilisation[s.id].committed * 100) / 100,
      freeHours: Math.round(workerUtilisation[s.id].free * 100) / 100,
      isAbsent: workerUtilisation[s.id].isAbsent
    }));

    breakdown.push({
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      availableCapacity,
      committedHours,
      freeHours,
      workerUtilisation: workerList
    });

    currentStart = addDays(currentStart, 7);
  }

  return breakdown;
}

export async function generateCapacityTimeline(startDate: Date, weeks: number): Promise<WeeklyCapacity[]> {
  const baseCapacity = await getStageCapacities();
  const timeline: WeeklyCapacity[] = [];
  
  let currentStart = new Date(startDate);

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(currentStart);
    const weekEnd = addDays(weekStart, 6);
    
    timeline.push({
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      capacity: { ...baseCapacity }
    });
    
    currentStart = addDays(currentStart, 7);
  }

  return timeline;
}
