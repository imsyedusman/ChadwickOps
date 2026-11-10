'use server';

import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { attendanceRecords } from '@/db/schema';
import { getAuthorizedSession } from '@/lib/auth-helpers';
import {
  getTimingThresholdMinutes,
  type AttendanceFlag,
} from '@/lib/attendance-logic';
import { buildAttendanceWhere, resolveAttendanceFilters } from '@/lib/attendance-query';
import type {
  AttendanceDetailRecord,
  AttendanceDetailRequest,
  AttendanceDetailResponse,
} from '@/lib/attendance-types';

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export async function getEmployeeAttendanceDetail(
  input: AttendanceDetailRequest
): Promise<AttendanceDetailResponse> {
  const session = await getAuthorizedSession('attendance');
  if (!session) {
    return { success: false, error: 'You do not have access to attendance records.', records: [] };
  }

  const employee = input.employee?.trim();
  if (!employee) {
    return { success: false, error: 'Choose an employee first.', records: [] };
  }

  const filters = resolveAttendanceFilters({ ...input, employee });
  const threshold = getTimingThresholdMinutes();
  const where = buildAttendanceWhere(filters, { timingThresholdMinutes: threshold });

  try {
    const rows = await db
      .select({
        id: attendanceRecords.id,
        workguruId: attendanceRecords.workguruId,
        employeeName: attendanceRecords.employeeName,
        projectNumber: attendanceRecords.projectNumber,
        projectName: attendanceRecords.projectName,
        taskName: attendanceRecords.taskName,
        workguruTaskId: attendanceRecords.workguruTaskId,
        date: attendanceRecords.date,
        startTime: attendanceRecords.startTime,
        finishTime: attendanceRecords.finishTime,
        durationHours: attendanceRecords.durationHours,
        status: attendanceRecords.status,
        cost: attendanceRecords.cost,
        notes: attendanceRecords.notes,
        creationTime: attendanceRecords.creationTime,
        lastModifiedTime: attendanceRecords.lastModifiedTime,
        latitude: attendanceRecords.latitude,
        longitude: attendanceRecords.longitude,
        hasFlags: attendanceRecords.hasFlags,
        flags: attendanceRecords.flags,
      })
      .from(attendanceRecords)
      .where(where)
      .orderBy(desc(attendanceRecords.date), desc(attendanceRecords.startTime), desc(attendanceRecords.id));

    const records: AttendanceDetailRecord[] = rows.map((row) => ({
      id: row.id,
      workguruId: row.workguruId,
      employeeName: row.employeeName,
      projectNumber: row.projectNumber,
      projectName: row.projectName,
      taskName: row.taskName,
      workguruTaskId: row.workguruTaskId,
      date: row.date.toISOString(),
      startTime: toIso(row.startTime),
      finishTime: toIso(row.finishTime),
      durationHours: Number(row.durationHours || 0),
      status: row.status,
      cost: Number(row.cost || 0),
      notes: row.notes,
      creationTime: toIso(row.creationTime),
      lastModifiedTime: toIso(row.lastModifiedTime),
      latitude: row.latitude,
      longitude: row.longitude,
      hasFlags: row.hasFlags,
      flags: (row.flags || []) as AttendanceFlag[],
    }));

    return { success: true, records };
  } catch (error) {
    console.error('[getEmployeeAttendanceDetail] Error:', error);
    return {
      success: false,
      error: 'Could not load this employee’s timesheets. Try again.',
      records: [],
    };
  }
}
