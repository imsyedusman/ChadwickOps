import { toZonedTime, fromZonedTime, format } from "date-fns-tz";
import { startOfDay } from "date-fns";

export const SYDNEY_TZ = "Australia/Sydney";

/**
 * IMPORTANT: 
 * These status mappings are tied to specific WorkGuru status names.
 * If WorkGuru introduces new statuses or renames existing ones, this logic MUST be reviewed.
 * terminalStatuses represent projects that are finished, cancelled, or delivered.
 */
export const TERMINAL_STATUSES = [
  'cancelled',
  'completed',
  'invoiced',
  'closed',
  'delivered',
  'tested passed'
];

/**
 * Returns the current time in Australia/Sydney.
 */
export function getSydneyNow(): Date {
  return toZonedTime(new Date(), SYDNEY_TZ);
}

/**
 * Returns the start of day (00:00:00) for a date in Sydney time.
 */
export function getSydneyStartOfDay(date: Date = new Date()): Date {
  const zoned = toZonedTime(date, SYDNEY_TZ);
  return startOfDay(zoned);
}

/**
 * Formats a date using Sydney's timezone.
 */
export function formatSydneyDate(date: Date | string | null, formatStr: string = "dd MMM yyyy"): string {
  if (!date) return "—";
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return format(toZonedTime(d, SYDNEY_TZ), formatStr, { timeZone: SYDNEY_TZ });
}

/**
 * Checks if a raw status is considered "Terminal" (finished/cancelled).
 */
export function isTerminalStatus(status: string | null): boolean {
  if (!status) return false;
  const cleaned = status.replace(/^[\d.]+ - /, '').trim().toLowerCase();
  return TERMINAL_STATUSES.includes(cleaned);
}

export type ScheduleStatus = 'UNSCHEDULED' | 'FUTURE' | 'STARTED' | 'TERMINAL';

/**
 * Determines the schedule status of a project.
 * Single source of truth for WIP table and Reports.
 * 
 * Dependencies:
 * - startDate: Planned start date from WorkGuru
 * - rawStatus: Project status from WorkGuru
 * - isArchived: local archived flag
 */
export function getProjectScheduleStatus(project: { 
  startDate: Date | string | null, 
  rawStatus: string | null,
  isArchived?: boolean 
}, now: Date = getSydneyNow()): ScheduleStatus {
  if (project.isArchived || isTerminalStatus(project.rawStatus)) {
    return 'TERMINAL';
  }

  if (!project.startDate) {
    return 'UNSCHEDULED';
  }

  const startDate = typeof project.startDate === 'string' ? new Date(project.startDate) : project.startDate;
  
  // Normalize comparison to "Day" level or simple timestamp? 
  // User says "future" vs "today or past".
  // We use Sydney 'now' to compare.
  if (startDate > now) {
    return 'FUTURE';
  }

  return 'STARTED';
}

/**
 * Backlog Definition (Absolute):
 * Received work that has NOT yet started.
 * Includes: Projects with NO start date OR a start date in the FUTURE.
 * Excludes: Archived, Terminal (Completed/Cancelled), and productive work that has already started.
 */
export function isProjectBacklog(project: { 
  startDate: Date | string | null, 
  rawStatus: string | null,
  isArchived?: boolean 
}, now: Date = getSydneyNow()): boolean {
  const status = getProjectScheduleStatus(project, now);
  return status === 'UNSCHEDULED' || status === 'FUTURE';
}
