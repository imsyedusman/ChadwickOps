import { and, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { attendanceRecords } from '@/db/schema';
import {
  getAttendancePeriodBounds,
  normalizeFlagSlug,
  type AttendanceFlagSlug,
  type AttendanceFlagType,
  type AttendancePeriodBounds,
} from './attendance-logic';

export interface AttendanceFilterInput {
  period?: string | null;
  from?: string | null;
  to?: string | null;
  employee?: string | null;
  project?: string | null;
  status?: string | null;
  flag?: string | null;
}

export interface ResolvedAttendanceFilters {
  bounds: AttendancePeriodBounds;
  employee: string | null;
  project: string | null;
  status: string | null;
  flag: AttendanceFlagSlug;
}

export function resolveAttendanceFilters(input: AttendanceFilterInput): ResolvedAttendanceFilters {
  return {
    bounds: getAttendancePeriodBounds(input.period, input.from, input.to),
    employee: input.employee && input.employee !== 'all' ? input.employee : null,
    project: input.project && input.project !== 'all' ? input.project : null,
    status: input.status && input.status !== 'all' ? input.status : null,
    flag: normalizeFlagSlug(input.flag),
  };
}

function clampThreshold(thresholdMinutes: number): number {
  if (!Number.isFinite(thresholdMinutes) || thresholdMinutes < 0) return 30;
  return Math.min(24 * 60, Math.round(thresholdMinutes));
}

/**
 * Derived timing review: creation time more than the threshold before the
 * entered start, or after the entered finish. Creation time is never treated
 * as clock-in. Entries created during the shift never match this condition.
 */
export function timingReviewCondition(thresholdMinutes: number): SQL {
  const threshold = clampThreshold(thresholdMinutes);
  return sql`(
    ${attendanceRecords.creationTime} is not null
    and (
      (
        ${attendanceRecords.startTime} is not null
        and ${attendanceRecords.creationTime} < ${attendanceRecords.startTime} - make_interval(mins => ${threshold})
      )
      or (
        ${attendanceRecords.finishTime} is not null
        and ${attendanceRecords.creationTime} > ${attendanceRecords.finishTime} + make_interval(mins => ${threshold})
      )
    )
  )`;
}

export function buildAttendanceBaseConditions(filters: ResolvedAttendanceFilters): SQL[] {
  const conditions: SQL[] = [];

  if (filters.bounds.dateFrom) {
    conditions.push(gte(attendanceRecords.date, filters.bounds.dateFrom));
  }
  if (filters.bounds.dateTo) {
    conditions.push(lte(attendanceRecords.date, filters.bounds.dateTo));
  }
  if (filters.employee) {
    conditions.push(eq(attendanceRecords.employeeName, filters.employee));
  }
  if (filters.project) {
    conditions.push(eq(attendanceRecords.projectNumber, filters.project));
  }
  if (filters.status) {
    conditions.push(eq(attendanceRecords.status, filters.status));
  }

  return conditions;
}

export function buildAttendanceBaseWhere(filters: ResolvedAttendanceFilters): SQL | undefined {
  const conditions = buildAttendanceBaseConditions(filters);
  return conditions.length > 0 ? and(...conditions) : undefined;
}

const STORED_FLAG_TYPES: Partial<Record<AttendanceFlagSlug, AttendanceFlagType>> = {
  overlapping: 'OVERLAPPING',
  'missing-times': 'MISSING_TIMES',
  'invalid-duration': 'INVALID_DURATION',
  'long-shift': 'LONG_SHIFT',
};

export function buildAttendanceFlagCondition(
  flag: AttendanceFlagSlug,
  thresholdMinutes: number
): SQL | undefined {
  if (flag === 'all') return undefined;

  if (flag === 'needs-review') {
    return sql`(${attendanceRecords.hasFlags} = true or ${timingReviewCondition(thresholdMinutes)})`;
  }

  if (flag === 'timing-review') {
    return timingReviewCondition(thresholdMinutes);
  }

  const storedType = STORED_FLAG_TYPES[flag];
  if (!storedType) return undefined;

  return sql`${attendanceRecords.flagTypes} @> ${JSON.stringify([storedType])}::jsonb`;
}

export function buildAttendanceWhere(
  filters: ResolvedAttendanceFilters,
  options: { includeFlag?: boolean; timingThresholdMinutes: number }
): SQL | undefined {
  const conditions = buildAttendanceBaseConditions(filters);
  const flagCondition =
    options.includeFlag === false
      ? undefined
      : buildAttendanceFlagCondition(filters.flag, options.timingThresholdMinutes);

  if (flagCondition) conditions.push(flagCondition);
  return conditions.length > 0 ? and(...conditions) : undefined;
}
