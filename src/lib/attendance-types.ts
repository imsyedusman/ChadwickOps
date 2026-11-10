import type { AttendanceFlag } from './attendance-logic';

export interface AttendanceDetailRecord {
  id: number;
  workguruId: string;
  employeeName: string;
  projectNumber: string | null;
  projectName: string | null;
  taskName: string | null;
  workguruTaskId: string | null;
  date: string;
  startTime: string | null;
  finishTime: string | null;
  durationHours: number;
  status: string;
  cost: number;
  notes: string | null;
  creationTime: string | null;
  lastModifiedTime: string | null;
  latitude: number | null;
  longitude: number | null;
  hasFlags: boolean;
  flags: AttendanceFlag[];
}

export interface AttendanceDetailRequest {
  employee: string;
  period?: string;
  from?: string;
  to?: string;
  project?: string;
  status?: string;
  flag?: string;
}

export type AttendanceDetailResponse =
  | { success: true; records: AttendanceDetailRecord[] }
  | { success: false; error: string; records: AttendanceDetailRecord[] };
