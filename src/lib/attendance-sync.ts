import { db } from '@/db';
import { attendanceRecords, attendanceSyncLogs, projects, tasks } from '@/db/schema';
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm';
import { WorkGuruClient, type WorkGuruTimeSheet } from './workguru';
import { assessCollection, planOrphanCleanup } from './sync-safety';
import { createPostgresSyncLock } from './sync-lock';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import {
  SYDNEY_TZ,
  type AttendanceFlagType,
  type AttendanceFlag,
  type ParsedTimesheetEntry,
  parseWorkGuruUtcDate,
  parseWorkGuruWallClockDate,
  evaluateAttendanceFlags,
  extractEmployeeName,
  extractEmployeeId,
} from './attendance-logic';

export {
  SYDNEY_TZ,
  type AttendanceFlagType,
  type AttendanceFlag,
  type ParsedTimesheetEntry,
  parseWorkGuruUtcDate,
  parseWorkGuruWallClockDate,
  evaluateAttendanceFlags,
  extractEmployeeName,
  extractEmployeeId,
};

export const ATTENDANCE_SYNC_LOCK_KEY = 'SYNC_LOCK:ATTENDANCE';
export const ATTENDANCE_SYNC_TTL_MS = 10 * 60 * 1000;

export interface AttendanceSyncStats {
  fetched: number;
  upserted: number;
  deleted: number;
  skipped: number;
  flagged: number;
  durationMs: number;
}

export class AttendanceSyncService {
  private client: WorkGuruClient;

  constructor(apiKey: string, apiSecret: string) {
    this.client = new WorkGuruClient(apiKey, apiSecret);
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 3): Promise<T | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const status = error?.response?.status;
        const isTransient = !status || status === 429 || status >= 500;

        if (isTransient && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`[AttendanceSync] ${label} failed (${status || error.message}). Attempt ${attempt}/${maxRetries}. Retrying in ${delay / 1000}s...`);
          await this.sleep(delay);
          continue;
        }

        console.error(`[AttendanceSync] ${label} exhausted retries (${status || error.message})`);
        return null;
      }
    }
    return null;
  }

  /**
   * Main sync method for WorkGuru Timesheets.
   * Pulls rolling window (default 60 days) or custom date range, paginates safely,
   * performs incremental upserts and flag evaluations, and logs to attendance_sync_logs.
   */
  public async runSync(options: { daysBack?: number; startDate?: string; endDate?: string } = {}): Promise<AttendanceSyncStats> {
    const startTime = Date.now();
    const stats: AttendanceSyncStats = {
      fetched: 0,
      upserted: 0,
      deleted: 0,
      skipped: 0,
      flagged: 0,
      durationMs: 0,
    };

    const lockStore = createPostgresSyncLock(ATTENDANCE_SYNC_LOCK_KEY);
    const ownerId = `attendance-sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const acquired = await lockStore.acquire(ownerId, ATTENDANCE_SYNC_TTL_MS);

    if (!acquired) {
      throw new Error('Another attendance synchronization is currently in progress. Please wait.');
    }

    try {
      // 1. Calculate Date Range (Sydney Time)
      const nowSydney = toZonedTime(new Date(), SYDNEY_TZ);
      let startDateStr: string;
      let endDateStr: string;

      if (options.startDate && options.endDate) {
        startDateStr = options.startDate;
        endDateStr = options.endDate;
      } else {
        const daysBack = options.daysBack ?? 60;
        const fromDate = startOfDay(subDays(nowSydney, daysBack));
        const toDate = endOfDay(nowSydney);
        startDateStr = format(fromDate, 'yyyy-MM-dd');
        endDateStr = format(toDate, 'yyyy-MM-dd');
      }

      console.log(`[AttendanceSync] Fetching timesheets from ${startDateStr} to ${endDateStr}...`);

      // 2. Fetch Timesheets with Pagination & Safety Assessment
      let allRawItems: WorkGuruTimeSheet[] = [];
      let isVerifiedComplete = false;

      // First attempt: try range endpoint if available
      try {
        const rangeRes = await this.withRetry(
          () => this.client.getTimeSheetsInDateRange(startDateStr, endDateStr),
          'Fetch Timesheets In Range'
        );
        if (rangeRes) {
          const assessment = assessCollection<WorkGuruTimeSheet>(rangeRes, 'TimeSheetRange');
          if (assessment.complete && assessment.items.length > 0) {
            allRawItems = assessment.items;
            isVerifiedComplete = true;
          }
        }
      } catch (err) {
        console.warn('[AttendanceSync] Range endpoint failed or unavailable, falling back to paged GetTimeSheets:', err);
      }

      // Fallback / standard method: Paginated GetTimeSheets
      if (allRawItems.length === 0) {
        let skipCount = 0;
        const pageSize = 1000;
        let totalCount = 0;
        let pagedComplete = true;

        do {
          const response = await this.withRetry(
            () =>
              this.client.getTimeSheetsPaged({
                startDate: startDateStr,
                endDate: endDateStr,
                SkipCount: skipCount,
                MaxResultCount: pageSize,
                Sorting: 'Date DESC',
              }),
            `Fetch Timesheets Page (skip=${skipCount})`
          );

          if (!response) {
            pagedComplete = false;
            break;
          }

          const assessment = assessCollection<WorkGuruTimeSheet>(response, 'TimeSheetPage', {
            requestedLimit: pageSize,
          });

          if (!assessment.items || assessment.items.length === 0) {
            break;
          }

          allRawItems.push(...assessment.items);
          const envelope = response.result || response;
          totalCount = envelope.totalCount ?? allRawItems.length;
          skipCount += pageSize;

          // Heartbeat lock during long pagination
          await lockStore.heartbeat(ownerId, ATTENDANCE_SYNC_TTL_MS);
        } while (allRawItems.length < totalCount && skipCount < totalCount);

        isVerifiedComplete = pagedComplete;
      }

      stats.fetched = allRawItems.length;
      console.log(`[AttendanceSync] Retrieved ${allRawItems.length} raw timesheet rows.`);

      if (allRawItems.length === 0) {
        stats.durationMs = Date.now() - startTime;
        await db.insert(attendanceSyncLogs).values({
          status: 'SUCCESS',
          totalFetched: 0,
          totalUpserted: 0,
          totalDeleted: 0,
          flaggedCount: 0,
          durationMs: stats.durationMs,
          details: `Completed sync between ${startDateStr} and ${endDateStr}. No records found.`,
        });
        return stats;
      }

      // 3. Deduplicate by WorkGuru ID in memory
      const uniqueRemoteMap = new Map<string, WorkGuruTimeSheet>();
      for (const item of allRawItems) {
        const id = (item.id || item.Id || item.TimeSheetID || item.timeSheetId || item.timesheetId)?.toString();
        if (id && !uniqueRemoteMap.has(id)) {
          uniqueRemoteMap.set(id, item);
        }
      }

      // 4. Build Project & Task Lookup Maps for local relational mapping
      const allProjects = await db
        .select({
          id: projects.id,
          workguruId: projects.workguruId,
          projectNumber: projects.projectNumber,
          name: projects.name,
        })
        .from(projects);

      const projectByWgId = new Map(allProjects.map((p) => [p.workguruId, p]));
      const projectByNumber = new Map(allProjects.map((p) => [p.projectNumber.trim().toLowerCase(), p]));

      const allTasks = await db
        .select({
          id: tasks.id,
          workguruId: tasks.workguruId,
          name: tasks.name,
          projectId: tasks.projectId,
        })
        .from(tasks);
      const taskByWgId = new Map(allTasks.map((t) => [t.workguruId, t]));

      // 5. Parse Timesheet Records into Normalized Structures
      const parsedEntries: ParsedTimesheetEntry[] = [];

      for (const [id, remote] of uniqueRemoteMap.entries()) {
        const rObj = remote as any;
        const projectObj = rObj.project || rObj.Project;
        const remoteProjectId = (
          remote.projectId ||
          remote.ProjectId ||
          remote.ProjectID ||
          projectObj?.id ||
          projectObj?.projectId
        )?.toString();

        const taskObj = rObj.task || rObj.Task;
        const remoteTaskId = (
          remote.taskId ||
          remote.TaskId ||
          remote.TaskID ||
          taskObj?.id ||
          taskObj?.taskId
        )?.toString();

        // Project Resolution
        let localProject = remoteProjectId ? projectByWgId.get(remoteProjectId) : undefined;
        const projectNumCandidate = (
          remote.projectNo ||
          remote.ProjectNo ||
          remote.projectNumber ||
          remote.ProjectNumber ||
          projectObj?.projectNo ||
          projectObj?.projectNumber
        )?.toString().trim();
        if (!localProject && projectNumCandidate) {
          localProject = projectByNumber.get(projectNumCandidate.toLowerCase());
        }

        // Task Resolution
        const localTask = remoteTaskId ? taskByWgId.get(remoteTaskId) : undefined;
        const taskNameCandidate = (
          remote.taskName ||
          remote.TaskName ||
          taskObj?.name ||
          taskObj?.taskName
        )?.toString().trim();

        // Date and Time Parsing
        const rawDate = remote.date || remote.Date;
        const rawStartTime = remote.startTime || remote.StartTime || remote.start || remote.Start;
        const rawFinishTime = remote.finishTime || remote.FinishTime || remote.endTime || remote.EndTime || remote.end || remote.End;

        const date = parseWorkGuruWallClockDate(rawDate || rawStartTime) || new Date();
        const startTime = parseWorkGuruWallClockDate(rawDate, rawStartTime);
        let finishTime = parseWorkGuruWallClockDate(rawDate, rawFinishTime);

        // If finishTime is earlier than startTime on the same calendar day, it may span into the next day
        if (startTime && finishTime && finishTime.getTime() < startTime.getTime()) {
          // If difference is within 24 hours, shift finishTime by +24h
          const adjusted = new Date(finishTime.getTime() + 24 * 60 * 60 * 1000);
          if (adjusted.getTime() - startTime.getTime() <= 24 * 60 * 60 * 1000) {
            finishTime = adjusted;
          }
        }

        const duration = Number(remote.hours || remote.Hours || remote.length || remote.Length || remote.duration || remote.Duration || 0);
        const cost = Number(remote.cost || remote.Cost || remote.internalCosting || remote.InternalCosting || 0);

        const creationTime = parseWorkGuruUtcDate(remote.creationTime || remote.CreationTime);
        const lastModifiedTime = parseWorkGuruUtcDate(
          remote.lastModificationTime || remote.LastModificationTime || remote.lastModifierTime || remote.creationTime
        );

        const employeeName = extractEmployeeName(remote);
        const employeeId = extractEmployeeId(remote);

        parsedEntries.push({
          workguruId: id,
          employeeName,
          employeeId,
          projectId: localProject?.id ?? null,
          workguruProjectId: remoteProjectId || null,
          projectNumber: localProject?.projectNumber || projectNumCandidate || null,
          projectName: localProject?.name || remote.projectName || remote.ProjectName || projectObj?.name || projectObj?.projectName || null,
          taskId: localTask?.id ?? null,
          workguruTaskId: remoteTaskId || null,
          taskName: localTask?.name || taskNameCandidate || null,
          date,
          startTime,
          finishTime,
          durationHours: duration,
          status: remote.status || remote.Status || 'Draft',
          cost,
          notes: remote.notes || remote.Notes || remote.description || remote.Description || remote.comments || null,
          creationTime,
          lastModifiedTime,
          rawPayload: remote,
        });
      }

      // 6. Evaluate Flags Across All Entries
      const flagsMap = evaluateAttendanceFlags(parsedEntries);

      // 7. Prepare Database Upsert Payload
      const recordsToUpsert = parsedEntries.map((entry) => {
        const entryFlags = flagsMap.get(entry.workguruId) || [];
        const hasFlags = entryFlags.length > 0;
        const flagTypes = Array.from(new Set(entryFlags.map((f) => f.type)));

        if (hasFlags) stats.flagged++;

        return {
          workguruId: entry.workguruId,
          employeeName: entry.employeeName,
          employeeId: entry.employeeId,
          projectId: entry.projectId,
          workguruProjectId: entry.workguruProjectId,
          projectNumber: entry.projectNumber,
          projectName: entry.projectName,
          taskId: entry.taskId,
          workguruTaskId: entry.workguruTaskId,
          taskName: entry.taskName,
          date: entry.date,
          startTime: entry.startTime,
          finishTime: entry.finishTime,
          durationHours: entry.durationHours,
          status: entry.status,
          cost: entry.cost,
          notes: entry.notes,
          creationTime: entry.creationTime,
          lastModifiedTime: entry.lastModifiedTime,
          hasFlags,
          flagTypes,
          flags: entryFlags,
          rawPayload: entry.rawPayload,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        };
      });

      // 8. Batch Upsert (chunks of 100)
      const chunkSize = 100;
      for (let i = 0; i < recordsToUpsert.length; i += chunkSize) {
        const chunk = recordsToUpsert.slice(i, i + chunkSize);
        await db
          .insert(attendanceRecords)
          .values(chunk)
          .onConflictDoUpdate({
            target: attendanceRecords.workguruId,
            set: {
              employeeName: sql`excluded.employee_name`,
              employeeId: sql`excluded.employee_id`,
              projectId: sql`excluded.project_id`,
              workguruProjectId: sql`excluded.workguru_project_id`,
              projectNumber: sql`excluded.project_number`,
              projectName: sql`excluded.project_name`,
              taskId: sql`excluded.task_id`,
              workguruTaskId: sql`excluded.workguru_task_id`,
              taskName: sql`excluded.task_name`,
              date: sql`excluded.date`,
              startTime: sql`excluded.start_time`,
              finishTime: sql`excluded.finish_time`,
              durationHours: sql`excluded.duration_hours`,
              status: sql`excluded.status`,
              cost: sql`excluded.cost`,
              notes: sql`excluded.notes`,
              creationTime: sql`excluded.creation_time`,
              lastModifiedTime: sql`excluded.last_modified_time`,
              hasFlags: sql`excluded.has_flags`,
              flagTypes: sql`excluded.flag_types`,
              flags: sql`excluded.flags`,
              rawPayload: sql`excluded.raw_payload`,
              lastSeenAt: sql`excluded.last_seen_at`,
              updatedAt: new Date(),
            },
          });
        stats.upserted += chunk.length;
      }

      // 9. Safe Orphan Cleanup for Deleted Records (ONLY if remote collection was verified complete)
      if (isVerifiedComplete) {
        const localInWindow = await db
          .select({
            id: attendanceRecords.id,
            workguruId: attendanceRecords.workguruId,
          })
          .from(attendanceRecords)
          .where(
            and(
              gte(attendanceRecords.date, parseWorkGuruWallClockDate(startDateStr) || new Date(0)),
              lte(attendanceRecords.date, parseWorkGuruWallClockDate(endDateStr, '23:59:59') || new Date())
            )
          );

        const remoteIdSet = new Set(uniqueRemoteMap.keys());
        const cleanupPlan = planOrphanCleanup({
          local: localInWindow,
          verified: isVerifiedComplete,
          keepIds: remoteIdSet,
          getWorkguruId: (row) => row.workguruId,
        });

        if (!cleanupPlan.skipped && cleanupPlan.delete.length > 0) {
          const deleteIds = cleanupPlan.delete.map((d) => d.id);
          await db.delete(attendanceRecords).where(inArray(attendanceRecords.id, deleteIds));
          stats.deleted = deleteIds.length;
          console.log(`[AttendanceSync] Cleaned up ${stats.deleted} deleted remote records in verified window.`);
        }
      }

      stats.durationMs = Date.now() - startTime;

      // 10. Record Sync Log
      await db.insert(attendanceSyncLogs).values({
        status: isVerifiedComplete ? 'SUCCESS' : 'PARTIAL',
        totalFetched: stats.fetched,
        totalUpserted: stats.upserted,
        totalDeleted: stats.deleted,
        flaggedCount: stats.flagged,
        durationMs: stats.durationMs,
        details: `Synced ${stats.upserted} timesheets (${stats.flagged} flagged, ${stats.deleted} deleted) for ${startDateStr} to ${endDateStr}. Verification: ${isVerifiedComplete ? 'COMPLETE' : 'PARTIAL'}.`,
      });

      console.log(`[AttendanceSync] Synchronization completed successfully in ${stats.durationMs}ms.`);
      return stats;
    } catch (error) {
      stats.durationMs = Date.now() - startTime;
      console.error('[AttendanceSync] Execution error:', error);

      try {
        await db.insert(attendanceSyncLogs).values({
          status: 'FAILURE',
          totalFetched: stats.fetched,
          totalUpserted: stats.upserted,
          totalDeleted: stats.deleted,
          flaggedCount: stats.flagged,
          durationMs: stats.durationMs,
          details: error instanceof Error ? error.message : 'Unknown error during sync',
        });
      } catch (logErr) {
        console.error('[AttendanceSync] Failed to log failure to database:', logErr);
      }

      throw error;
    } finally {
      await lockStore.release(ownerId);
    }
  }
}
