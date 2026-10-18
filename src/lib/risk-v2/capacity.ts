import { db } from "@/db";
import { systemConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateSession, hasRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { 
  CapacitySettingsV2, 
  PeriodCapacity 
} from "./types";
import { 
  DEFAULT_WORKING_PATTERN, 
  calculateMonthCapacity, 
  calculateWeekCapacity, 
  generateForwardMonths, 
  generateForwardWeeks, 
  getSydneyTodayDateString 
} from "./calendar";

export const DEFAULT_CAPACITY_SETTINGS_V2: CapacitySettingsV2 = {
  headcount: 22,
  efficiency: 0.80,
  workingPattern: DEFAULT_WORKING_PATTERN,
  riskThreshold: 90,
  actualsFactor: 0.70,
  provisionalDailyHoursPerProject: 25,
  factoryClosures: [],
  maxDailyHoursCeiling: 16, // Advisory technical upper limit (not employment policy)
  teamLeaderSupervisoryAllowanceHours: 0, // Default 0 off tools unless configured
  unratedWorkerPolicy: 'warn', // Explicit assessment-pending policy
};

export const CONFIG_KEY_V2 = 'capacity_settings_v2';

/**
 * Retrieves V2 capacity settings from system_config.
 * Completely separate from V1 capacity_settings.
 */
export async function getCapacitySettingsV2(): Promise<CapacitySettingsV2> {
  try {
    const record = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, CONFIG_KEY_V2),
    });

    if (!record || !record.value) {
      return DEFAULT_CAPACITY_SETTINGS_V2;
    }

    const val = record.value as Partial<CapacitySettingsV2>;

    return {
      headcount: typeof val.headcount === 'number' && val.headcount > 0 ? val.headcount : DEFAULT_CAPACITY_SETTINGS_V2.headcount,
      efficiency: typeof val.efficiency === 'number' && val.efficiency > 0 && val.efficiency <= 1 ? val.efficiency : DEFAULT_CAPACITY_SETTINGS_V2.efficiency,
      workingPattern: {
        mon: val.workingPattern?.mon ?? DEFAULT_WORKING_PATTERN.mon,
        tue: val.workingPattern?.tue ?? DEFAULT_WORKING_PATTERN.tue,
        wed: val.workingPattern?.wed ?? DEFAULT_WORKING_PATTERN.wed,
        thu: val.workingPattern?.thu ?? DEFAULT_WORKING_PATTERN.thu,
        fri: val.workingPattern?.fri ?? DEFAULT_WORKING_PATTERN.fri,
        sat: val.workingPattern?.sat ?? DEFAULT_WORKING_PATTERN.sat,
        sun: val.workingPattern?.sun ?? DEFAULT_WORKING_PATTERN.sun,
      },
      riskThreshold: typeof val.riskThreshold === 'number' && val.riskThreshold > 0 ? val.riskThreshold : DEFAULT_CAPACITY_SETTINGS_V2.riskThreshold,
      actualsFactor: typeof val.actualsFactor === 'number' && val.actualsFactor >= 0 ? val.actualsFactor : DEFAULT_CAPACITY_SETTINGS_V2.actualsFactor,
      provisionalDailyHoursPerProject: typeof val.provisionalDailyHoursPerProject === 'number' && val.provisionalDailyHoursPerProject > 0 
        ? val.provisionalDailyHoursPerProject 
        : DEFAULT_CAPACITY_SETTINGS_V2.provisionalDailyHoursPerProject,
      factoryClosures: Array.isArray(val.factoryClosures) ? val.factoryClosures : [],
    };
  } catch (error) {
    console.error(`[getCapacitySettingsV2] Failed to fetch ${CONFIG_KEY_V2}:`, error);
    return DEFAULT_CAPACITY_SETTINGS_V2;
  }
}

/**
 * Updates V2 capacity settings in system_config.
 * Enforces authorization (admin or scheduler role) and server-side validation.
 */
export async function updateCapacitySettingsV2(data: CapacitySettingsV2): Promise<{ success: boolean; error?: string }> {
  const session = await validateSession();
  if (!session) {
    throw new Error("Unauthorized. Please log in.");
  }

  // Restrict saving to appropriate authorised roles
  const isAuthorized = 
    session.user.role === 'admin' || 
    hasRole(session, 'admin') || 
    hasRole(session, 'scheduler');

  if (!isAuthorized) {
    throw new Error("Unauthorized. Only Admins and Schedulers can update capacity settings.");
  }

  // Validation
  if (!data.headcount || data.headcount <= 0 || !Number.isInteger(data.headcount)) {
    throw new Error("Headcount must be a positive integer.");
  }
  if (data.efficiency <= 0 || data.efficiency > 1) {
    throw new Error("Efficiency must be between 0.01 and 1.0 (e.g. 0.80 for 80%).");
  }
  if (data.actualsFactor < 0 || data.actualsFactor > 2) {
    throw new Error("Actuals Factor must be between 0 and 2.0.");
  }
  if (data.riskThreshold < 1 || data.riskThreshold > 200) {
    throw new Error("Risk Threshold must be between 1% and 200%.");
  }
  if (!data.provisionalDailyHoursPerProject || data.provisionalDailyHoursPerProject <= 0 || data.provisionalDailyHoursPerProject > 200) {
    throw new Error("Provisional daily hours per project must be between 1 and 200 hours/day.");
  }

  // Validate working pattern
  const wp = data.workingPattern;
  if (
    wp.mon < 0 || wp.tue < 0 || wp.wed < 0 || wp.thu < 0 || 
    wp.fri < 0 || wp.sat < 0 || wp.sun < 0
  ) {
    throw new Error("Shift hours cannot be negative.");
  }
  const weeklyHours = wp.mon + wp.tue + wp.wed + wp.thu + wp.fri + wp.sat + wp.sun;
  if (weeklyHours <= 0) {
    throw new Error("Total weekly working hours must be greater than zero.");
  }

  // Validate factory closures format
  const validClosures = (data.factoryClosures || []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));

  const cleanData: CapacitySettingsV2 = {
    headcount: data.headcount,
    efficiency: Math.round(data.efficiency * 100) / 100,
    workingPattern: {
      mon: Number(wp.mon) || 0,
      tue: Number(wp.tue) || 0,
      wed: Number(wp.wed) || 0,
      thu: Number(wp.thu) || 0,
      fri: Number(wp.fri) || 0,
      sat: Number(wp.sat) || 0,
      sun: Number(wp.sun) || 0,
    },
    riskThreshold: Number(data.riskThreshold) || 90,
    actualsFactor: Math.round(data.actualsFactor * 100) / 100,
    provisionalDailyHoursPerProject: Number(data.provisionalDailyHoursPerProject) || 25,
    factoryClosures: Array.from(new Set(validClosures)).sort(),
  };

  const existing = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, CONFIG_KEY_V2),
  });

  if (existing) {
    await db.update(systemConfig)
      .set({ value: cleanData, updatedAt: new Date() })
      .where(eq(systemConfig.key, CONFIG_KEY_V2));
  } else {
    await db.insert(systemConfig).values({
      key: CONFIG_KEY_V2,
      value: cleanData,
    });
  }

  revalidatePath('/risk-v2');
  return { success: true };
}

/**
 * Calculates PeriodCapacity objects for the forecast horizon.
 */
export function calculateForecastPeriods(
  viewMode: 'monthly' | 'weekly',
  horizonMonths: number,
  settings: CapacitySettingsV2,
  referenceDateStr: string = getSydneyTodayDateString()
): PeriodCapacity[] {
  if (viewMode === 'monthly') {
    const monthKeys = generateForwardMonths(horizonMonths, referenceDateStr);
    return monthKeys.map(mKey => calculateMonthCapacity(mKey, settings, referenceDateStr));
  } else {
    // For weekly, 1 month ~ 4.33 weeks, so horizonMonths * 4.33 weeks (e.g. 3 months = 13 weeks, 6 = 26 weeks)
    const weeksCount = Math.round(horizonMonths * 4.33);
    const mondayDates = generateForwardWeeks(weeksCount, referenceDateStr);
    return mondayDates.map(monStr => calculateWeekCapacity(monStr, settings, referenceDateStr));
  }
}
