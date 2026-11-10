import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';

export const SYDNEY_TZ = 'Australia/Sydney';

export type AttendanceFlagType = 'OVERLAPPING' | 'MISSING_TIMES' | 'INVALID_DURATION' | 'LONG_SHIFT';

export interface AttendanceFlag {
  type: AttendanceFlagType;
  severity: 'warning' | 'error';
  message: string;
}

export interface ParsedTimesheetEntry {
  workguruId: string;
  employeeName: string;
  employeeId?: string | null;
  projectId?: number | null;
  workguruProjectId?: string | null;
  projectNumber?: string | null;
  projectName?: string | null;
  taskId?: number | null;
  workguruTaskId?: string | null;
  taskName?: string | null;
  date: Date;
  startTime: Date | null;
  finishTime: Date | null;
  durationHours: number;
  status: string;
  cost: number;
  notes?: string | null;
  creationTime: Date | null;
  lastModifiedTime: Date | null;
  rawPayload?: unknown;
}

/**
 * Parses WorkGuru creation and last modified timestamps.
 * WorkGuru timestamps (e.g. "2026-11-10T06:30:00") are stored in UTC on the server
 * but serialized without a timezone offset ("Z").
 *
 * Appends 'Z' when missing so JavaScript and PostgreSQL interpret them as UTC.
 */
export function parseWorkGuruUtcDate(val: unknown): Date | null {
  if (!val) return null;
  const str = String(val).trim();
  if (!str || str === 'null' || str === 'undefined') return null;

  // If missing offset / 'Z', treat as UTC by appending 'Z'
  const hasOffset = str.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(str);
  const isoUtc = hasOffset ? str : `${str}Z`;
  const date = new Date(isoUtc);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Parses WorkGuru entered start and finish times.
 * WorkGuru timestamps for start and finish represent local Australian wall-clock time
 * (e.g. 07:30 AM in Sydney) even if serialized with `+00:00` or `Z`.
 *
 * We strip any trailing offset and interpret the components as Sydney wall-clock time.
 */
export function parseWorkGuruWallClockDate(dateVal: unknown, timeVal?: unknown): Date | null {
  if (!dateVal && !timeVal) return null;

  // Determine date string in YYYY-MM-DD and time in HH:mm:ss
  let datePart: string | null = null;
  let timePart: string | null = null;

  if (dateVal) {
    let dStr = String(dateVal).trim();
    // Strip trailing offsets (+00:00, Z, etc.)
    dStr = dStr.replace(/(Z|[+-]\d{2}:?\d{2})$/, '').trim();

    if (dStr.includes('T')) {
      const [dp, tp] = dStr.split('T');
      datePart = dp;
      if (!timeVal && tp) {
        timePart = tp.split('.')[0];
      }
    } else if (dStr.includes(' ') && dStr.includes('-')) {
      const [dp, tp] = dStr.split(' ');
      datePart = dp;
      if (!timeVal && tp) {
        timePart = tp.split('.')[0];
      }
    } else if (/^\d{4}-\d{2}-\d{2}/.test(dStr)) {
      datePart = dStr.slice(0, 10);
    } else if (dStr.includes('/')) {
      const parts = dStr.split(' ')[0].split('/');
      if (parts.length === 3) {
        const [d, m, y] = parts.map(Number);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          const fullYear = y < 100 ? 2000 + y : y;
          datePart = `${fullYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
      }
    }
  }

  // Determine time string in HH:mm:ss
  if (timeVal) {
    let tStr = String(timeVal).trim();
    // Strip trailing offsets (+00:00, Z, etc.)
    tStr = tStr.replace(/(Z|[+-]\d{2}:?\d{2})$/, '').trim();

    if (tStr.includes('T')) {
      const [fullDate, fullTime] = tStr.split('T');
      if (!datePart) datePart = fullDate;
      timePart = fullTime.split('.')[0];
    } else if (tStr.includes(' ')) {
      const parts = tStr.split(' ');
      if (parts.length >= 2 && parts[0].includes('-')) {
        if (!datePart) datePart = parts[0];
        timePart = parts[1].split('.')[0];
      } else if (parts.length >= 2 && (parts[1] === 'AM' || parts[1] === 'PM')) {
        // 12-hour format "07:30 AM"
        const [hStr, mStr] = parts[0].split(':');
        let h = parseInt(hStr, 10);
        const m = parseInt(mStr || '0', 10);
        if (parts[1] === 'PM' && h < 12) h += 12;
        if (parts[1] === 'AM' && h === 12) h = 0;
        timePart = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
      } else {
        timePart = parts[parts.length - 1].split('.')[0];
      }
    } else if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(tStr)) {
      const chunks = tStr.split(':');
      const h = chunks[0].padStart(2, '0');
      const m = chunks[1].padStart(2, '0');
      const s = (chunks[2] || '00').padStart(2, '0');
      timePart = `${h}:${m}:${s}`;
    }
  }

  if (!datePart) return null;
  const isoWallClock = `${datePart}T${timePart || '00:00:00'}`;

  try {
    const zoned = fromZonedTime(isoWallClock, SYDNEY_TZ);
    return isNaN(zoned.getTime()) ? null : zoned;
  } catch {
    return null;
  }
}

/**
 * Formats a Date object in Sydney local time as HH:mm AM/PM.
 */
export function formatSydneyTime(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return format(toZonedTime(d, SYDNEY_TZ), 'h:mm a', { timeZone: SYDNEY_TZ });
}

/**
 * Formats a Date object in Sydney local time as "dd MMM yyyy, h:mm a".
 */
export function formatSydneyDateTime(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return format(toZonedTime(d, SYDNEY_TZ), 'dd MMM yyyy, h:mm a', { timeZone: SYDNEY_TZ });
}

/**
 * Formats a Date object in Sydney local time as "dd MMM yyyy" or "EEE, dd MMM".
 */
export function formatSydneyDateOnly(date: Date | string | null, pattern = 'EEE, dd MMM yyyy'): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return format(toZonedTime(d, SYDNEY_TZ), pattern, { timeZone: SYDNEY_TZ });
}

/**
 * Pure flag evaluation logic.
 * Detects:
 *   1. MISSING_TIMES: missing start or finish time
 *   2. INVALID_DURATION: negative/zero duration, duration > 24h, finish <= start, or mismatch
 *   3. LONG_SHIFT: duration >= 12h
 *   4. OVERLAPPING: overlapping timespans for the same employee
 *
 * NOTE: Never assumes creation time is actual clock-in time! Only entered start and finish are used.
 */
export function evaluateAttendanceFlags(
  entries: ParsedTimesheetEntry[]
): Map<string, AttendanceFlag[]> {
  const flagsMap = new Map<string, AttendanceFlag[]>();

  for (const entry of entries) {
    const entryFlags: AttendanceFlag[] = [];

    // 1. Missing Times Check
    if (!entry.startTime && !entry.finishTime) {
      entryFlags.push({
        type: 'MISSING_TIMES',
        severity: 'warning',
        message: 'Missing both start and finish time',
      });
    } else if (!entry.startTime) {
      entryFlags.push({
        type: 'MISSING_TIMES',
        severity: 'warning',
        message: 'Missing start time',
      });
    } else if (!entry.finishTime) {
      entryFlags.push({
        type: 'MISSING_TIMES',
        severity: 'warning',
        message: 'Missing finish time',
      });
    }

    // 2. Invalid Duration Check
    if (entry.durationHours <= 0) {
      entryFlags.push({
        type: 'INVALID_DURATION',
        severity: 'error',
        message: 'Duration must be greater than 0 hours',
      });
    } else if (entry.durationHours > 24) {
      entryFlags.push({
        type: 'INVALID_DURATION',
        severity: 'error',
        message: `Duration (${entry.durationHours.toFixed(2)}h) exceeds maximum limit of 24 hours`,
      });
    } else if (entry.startTime && entry.finishTime) {
      const elapsedMs = entry.finishTime.getTime() - entry.startTime.getTime();
      const elapsedHours = elapsedMs / (1000 * 60 * 60);

      if (elapsedMs <= 0) {
        entryFlags.push({
          type: 'INVALID_DURATION',
          severity: 'error',
          message: 'Finish time is before or equal to start time',
        });
      } else if (Math.abs(elapsedHours - entry.durationHours) > 2.0) {
        entryFlags.push({
          type: 'INVALID_DURATION',
          severity: 'warning',
          message: `Logged duration (${entry.durationHours.toFixed(2)}h) diverges from elapsed time (${elapsedHours.toFixed(2)}h)`,
        });
      }
    }

    // 3. Unusually Long Shift (> 12 hours)
    if (entry.durationHours >= 12 && entry.durationHours <= 24) {
      entryFlags.push({
        type: 'LONG_SHIFT',
        severity: 'warning',
        message: `Unusually long shift: ${entry.durationHours.toFixed(2)} hrs (threshold: 12 hrs)`,
      });
    }

    flagsMap.set(entry.workguruId, entryFlags);
  }

  // 4. Overlapping Timesheets Check (grouped by employee)
  const employeeGroups = new Map<string, ParsedTimesheetEntry[]>();
  for (const entry of entries) {
    if (!entry.startTime || !entry.finishTime || entry.finishTime.getTime() <= entry.startTime.getTime()) {
      continue;
    }
    const empKey = entry.employeeName.trim().toLowerCase();
    if (!employeeGroups.has(empKey)) {
      employeeGroups.set(empKey, []);
    }
    employeeGroups.get(empKey)!.push(entry);
  }

  for (const [, group] of employeeGroups.entries()) {
    if (group.length < 2) continue;

    // Sort by startTime
    group.sort((a, b) => a.startTime!.getTime() - b.startTime!.getTime());

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];

        // Check if interval [a.start, a.finish] and [b.start, b.finish] overlap
        // Overlap condition: a.startTime < b.finishTime && b.startTime < a.finishTime
        if (a.startTime!.getTime() < b.finishTime!.getTime() && b.startTime!.getTime() < a.finishTime!.getTime()) {
          const aFlags = flagsMap.get(a.workguruId) || [];
          const bFlags = flagsMap.get(b.workguruId) || [];

          const aProj = a.projectNumber || a.projectName || 'another project';
          const bProj = b.projectNumber || b.projectName || 'another project';

          const bStartStr = formatSydneyTime(b.startTime);
          const bFinishStr = formatSydneyTime(b.finishTime);
          const aStartStr = formatSydneyTime(a.startTime);
          const aFinishStr = formatSydneyTime(a.finishTime);

          if (!aFlags.some((f) => f.type === 'OVERLAPPING' && f.message.includes(b.workguruId))) {
            aFlags.push({
              type: 'OVERLAPPING',
              severity: 'error',
              message: `Overlaps with ${bProj} (${bStartStr} - ${bFinishStr}) [ID:${b.workguruId}]`,
            });
          }

          if (!bFlags.some((f) => f.type === 'OVERLAPPING' && f.message.includes(a.workguruId))) {
            bFlags.push({
              type: 'OVERLAPPING',
              severity: 'error',
              message: `Overlaps with ${aProj} (${aStartStr} - ${aFinishStr}) [ID:${a.workguruId}]`,
            });
          }

          flagsMap.set(a.workguruId, aFlags);
          flagsMap.set(b.workguruId, bFlags);
        }
      }
    }
  }

  return flagsMap;
}
