import { Suspense } from "react";
import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { attendanceRecords, attendanceSyncLogs, projects } from "@/db/schema";
import { and, gte, lte, eq, sql, desc, sum, count, isNotNull } from "drizzle-orm";
import {
  Clock,
  Users,
  AlertTriangle,
  Briefcase,
  Layers,
  CheckCircle2,
  Timer,
  AlertCircle
} from "lucide-react";
import { AttendanceSyncButton } from "./_components/AttendanceSyncButton";
import { AttendanceFilters } from "./_components/AttendanceFilters";
import { AttendanceTable, type AttendanceRecordRow } from "./_components/AttendanceTable";
import {
  SYDNEY_TZ,
  formatSydneyDateTime,
  getAttendancePeriodBounds,
  normalizeFlagSlug,
  type AttendanceFlag
} from "@/lib/attendance-logic";

export const dynamic = "force-dynamic";

interface AttendancePageProps {
  searchParams: Promise<{
    period?: string;
    p?: string;
    from?: string;
    to?: string;
    employee?: string;
    project?: string;
    status?: string;
    flag?: string;
    page?: string;
    pageSize?: string;
  }>;
}

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const session = await validateSession();
  if (!session) {
    redirect("/login");
  }

  const canSync = hasPermission(session, "sync");
  const params = await searchParams;

  // 1. Calculate Date Range in Sydney Local Time (Defaults to 'this-week')
  const periodParam = params.period || params.p;
  const customFrom = params.from;
  const customTo = params.to;
  const bounds = getAttendancePeriodBounds(periodParam, customFrom, customTo);

  const employeeFilter = params.employee;
  const projectFilter = params.project;
  const statusFilter = params.status;
  const flagSlug = normalizeFlagSlug(params.flag);
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = Math.max(10, Math.min(100, parseInt(params.pageSize || "25", 10)));

  // 2. Fetch Latest Sync Log for Freshness Indicator
  let latestSync: any = null;
  try {
    latestSync = await db.query.attendanceSyncLogs.findFirst({
      orderBy: [desc(attendanceSyncLogs.timestamp)],
    });
  } catch (err) {
    console.warn("[AttendancePage] attendanceSyncLogs table not ready or empty:", err);
  }

  const lastSyncText = latestSync
    ? formatSydneyDateTime(latestSync.timestamp)
    : "Never";

  // 3. Build Query Filter Conditions
  const conditions: any[] = [];

  if (bounds.dateFrom) {
    conditions.push(gte(attendanceRecords.date, bounds.dateFrom));
  }
  if (bounds.dateTo) {
    conditions.push(lte(attendanceRecords.date, bounds.dateTo));
  }
  if (employeeFilter && employeeFilter !== "all") {
    conditions.push(eq(attendanceRecords.employeeName, employeeFilter));
  }
  if (projectFilter && projectFilter !== "all") {
    conditions.push(eq(attendanceRecords.projectNumber, projectFilter));
  }
  if (statusFilter && statusFilter !== "all") {
    conditions.push(eq(attendanceRecords.status, statusFilter));
  }

  if (flagSlug === "needs-review") {
    conditions.push(eq(attendanceRecords.hasFlags, true));
  } else if (flagSlug === "overlapping") {
    conditions.push(sql`${attendanceRecords.flagTypes} @> '["OVERLAPPING"]'::jsonb`);
  } else if (flagSlug === "missing-times") {
    conditions.push(sql`${attendanceRecords.flagTypes} @> '["MISSING_TIMES"]'::jsonb`);
  } else if (flagSlug === "invalid-duration") {
    conditions.push(sql`${attendanceRecords.flagTypes} @> '["INVALID_DURATION"]'::jsonb`);
  } else if (flagSlug === "long-shift") {
    conditions.push(sql`${attendanceRecords.flagTypes} @> '["LONG_SHIFT"]'::jsonb`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 4. Query KPI Summary Metrics & Records Safely
  let totalHours = 0;
  let totalRecords = 0;
  let activeStaff = 0;
  let flaggedCount = 0;
  let overlappingCount = 0;
  let missingTimesCount = 0;
  let invalidDurationCount = 0;
  let longShiftCount = 0;
  let cleanRecords: AttendanceRecordRow[] = [];
  let employeeOptions: string[] = [];
  let projectOptions: Array<{ number: string; name: string | null }> = [];
  let statusOptions: string[] = [];

  try {
    const [metricResult, breakdownResult, totalCountResult, rows, distinctEmployees, distinctProjects, distinctStatuses] =
      await Promise.all([
        db
          .select({
            totalHours: sum(attendanceRecords.durationHours),
            totalRecords: count(),
            distinctStaff: sql<number>`count(distinct ${attendanceRecords.employeeName})`,
            flaggedCount: sql<number>`count(case when ${attendanceRecords.hasFlags} = true then 1 end)`,
          })
          .from(attendanceRecords)
          .where(whereClause),

        db
          .select({
            overlappingCount: sql<number>`count(case when ${attendanceRecords.flagTypes} @> '["OVERLAPPING"]'::jsonb then 1 end)`,
            missingTimesCount: sql<number>`count(case when ${attendanceRecords.flagTypes} @> '["MISSING_TIMES"]'::jsonb then 1 end)`,
            invalidDurationCount: sql<number>`count(case when ${attendanceRecords.flagTypes} @> '["INVALID_DURATION"]'::jsonb then 1 end)`,
            longShiftCount: sql<number>`count(case when ${attendanceRecords.flagTypes} @> '["LONG_SHIFT"]'::jsonb then 1 end)`,
          })
          .from(attendanceRecords)
          .where(whereClause),

        db
          .select({ count: count() })
          .from(attendanceRecords)
          .where(whereClause),

        db
          .select({
            id: attendanceRecords.id,
            workguruId: attendanceRecords.workguruId,
            employeeName: attendanceRecords.employeeName,
            projectNumber: attendanceRecords.projectNumber,
            projectName: attendanceRecords.projectName,
            taskName: attendanceRecords.taskName,
            date: attendanceRecords.date,
            startTime: attendanceRecords.startTime,
            finishTime: attendanceRecords.finishTime,
            durationHours: attendanceRecords.durationHours,
            status: attendanceRecords.status,
            creationTime: attendanceRecords.creationTime,
            lastModifiedTime: attendanceRecords.lastModifiedTime,
            hasFlags: attendanceRecords.hasFlags,
            flagTypes: attendanceRecords.flagTypes,
            flags: attendanceRecords.flags,
          })
          .from(attendanceRecords)
          .where(whereClause)
          .orderBy(desc(attendanceRecords.date), desc(attendanceRecords.startTime), desc(attendanceRecords.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),

        db
          .select({ name: attendanceRecords.employeeName })
          .from(attendanceRecords)
          .groupBy(attendanceRecords.employeeName)
          .orderBy(attendanceRecords.employeeName),

        db
          .select({
            number: attendanceRecords.projectNumber,
            name: attendanceRecords.projectName,
          })
          .from(attendanceRecords)
          .where(isNotNull(attendanceRecords.projectNumber))
          .groupBy(attendanceRecords.projectNumber, attendanceRecords.projectName)
          .orderBy(attendanceRecords.projectNumber),

        db
          .select({ status: attendanceRecords.status })
          .from(attendanceRecords)
          .groupBy(attendanceRecords.status)
          .orderBy(attendanceRecords.status),
      ]);

    totalHours = Number(metricResult[0]?.totalHours || 0);
    totalRecords = Number(totalCountResult[0]?.count || 0);
    activeStaff = Number(metricResult[0]?.distinctStaff || 0);
    flaggedCount = Number(metricResult[0]?.flaggedCount || 0);

    overlappingCount = Number(breakdownResult[0]?.overlappingCount || 0);
    missingTimesCount = Number(breakdownResult[0]?.missingTimesCount || 0);
    invalidDurationCount = Number(breakdownResult[0]?.invalidDurationCount || 0);
    longShiftCount = Number(breakdownResult[0]?.longShiftCount || 0);

    cleanRecords = rows.map((r) => ({
      ...r,
      flags: (r.flags || []) as AttendanceFlag[],
    }));

    employeeOptions = distinctEmployees.map((e) => e.name).filter(Boolean);
    projectOptions = distinctProjects
      .filter((p): p is { number: string; name: string | null } => Boolean(p.number))
      .map((p) => ({ number: p.number, name: p.name }));
    statusOptions = distinctStatuses.map((s) => s.status).filter(Boolean);
  } catch (err) {
    console.error("[AttendancePage] Error querying attendance records:", err);
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Time & Attendance
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Weekly staff timesheets, project allocations and shift review.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Freshness Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 shadow-xs text-xs">
            <div className={`h-2 w-2 rounded-full ${latestSync?.status === "SUCCESS" ? "bg-emerald-500" : latestSync ? "bg-amber-500" : "bg-slate-400"}`} />
            <span className="text-slate-500 dark:text-slate-400">Last Synced:</span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{lastSyncText}</span>
          </div>

          {/* Sync Button */}
          <AttendanceSyncButton canSync={canSync} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Hours */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Total Logged Hours
            </span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black tabular-nums text-slate-900 dark:text-white">
              {totalHours.toLocaleString("en-AU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs text-slate-400 font-medium">hrs</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            Logged hours in selected view
          </p>
        </div>

        {/* Active Staff */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Active Employees
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black tabular-nums text-slate-900 dark:text-white">
              {activeStaff}
            </span>
            <span className="text-xs text-slate-400 font-medium">staff members</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            Staff with timesheets in period
          </p>
        </div>

        {/* Total Timesheets */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Total Timesheets
            </span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/50 rounded-xl text-purple-600 dark:text-purple-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-black tabular-nums text-slate-900 dark:text-white">
              {totalRecords.toLocaleString("en-AU")}
            </span>
            <span className="text-xs text-slate-400 font-medium">entries</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            Recorded timesheet entries
          </p>
        </div>

        {/* Needs Review */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Needs Review
            </span>
            <div className={`p-2 rounded-xl ${flaggedCount > 0 ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"}`}>
              {flaggedCount > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl md:text-3xl font-black tabular-nums ${flaggedCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {flaggedCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">requiring review</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {overlappingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                {overlappingCount} Overlap
              </span>
            )}
            {missingTimesCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                {missingTimesCount} Missing
              </span>
            )}
            {invalidDurationCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                {invalidDurationCount} Invalid
              </span>
            )}
            {longShiftCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                {longShiftCount} Long
              </span>
            )}
            {flaggedCount === 0 && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> No shift anomalies detected
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <AttendanceFilters
        employees={employeeOptions}
        projects={projectOptions}
        statuses={statusOptions}
        currentParams={{
          period: bounds.period,
          from: customFrom,
          to: customTo,
          employee: employeeFilter,
          project: projectFilter,
          status: statusFilter,
          flag: flagSlug,
        }}
        activeRangeLabel={bounds.label}
      />

      {/* Attendance Records Table */}
      <AttendanceTable
        records={cleanRecords}
        totalRecords={totalRecords}
        currentPage={page}
        pageSize={pageSize}
      />
    </div>
  );
}
