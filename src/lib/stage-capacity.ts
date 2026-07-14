import { db } from "@/db";
import { staffEfficiency, systemConfig } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { addDays } from "date-fns";

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
};

export type WeeklyCapacity = {
  weekStartDate: Date;
  weekEndDate: Date;
  capacity: StageCapacity;
};

export { getStageCapacities as getStageCapacityPerWeek };

/**
 * Calculates effective hours available per build stage per week across all active workshop staff.
 */
export async function getStageCapacities(): Promise<StageCapacity> {
  // Fetch configured capacity settings to get hoursPerWeek, falling back to 38 from DEFAULT_SETTINGS
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

  // Round to 2 decimal places for cleaner output
  for (const key of Object.keys(capacities) as Array<keyof StageCapacity>) {
    capacities[key] = Math.round(capacities[key] * 100) / 100;
  }

  return capacities;
}

/**
 * Generates a week-by-week capacity breakdown for a given number of weeks starting from a given date.
 */
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
