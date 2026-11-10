import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { attendanceRecords, attendanceSyncLogs } from "@/db/schema";
import { desc, isNotNull, sql, sum, count } from "drizzle-orm";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Users,
} from "lucide-react";
import { AttendanceSyncButton } from "./_components/AttendanceSyncButton";
import { AttendanceFilters } from "./_components/AttendanceFilters";
import { AttendanceTable, type AttendanceRecordRow } from "./_components/AttendanceTable";
import {
  formatSydneyDateTime,
  getTimingThresholdMinutes,
  type AttendanceFlag,
} from "@/lib/attendance-logic";
import {
  buildAttendanceBaseWhere,
  buildAttendanceWhere,
  resolveAttendanceFilters,
  timingReviewCondition,
} from "@/lib/attendance-query";

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

function KpiCard({
  label,
  value,
  unit,
  hint,
  icon,
  iconClassName,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  unit: string;
  hint: ReactNode;
  icon: ReactNode;
  iconClassName: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-xs dark:border-slate-800/60 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <div className={`rounded-lg p-1.5 ${iconClassName}`}>{icon}</div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-black tabular-nums ${valueClassName ?? "text-slate-900 dark:text-white"}`}>
          {value}
        </span>
        <span className="text-xs font-medium text-slate-400">{unit}</span>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const session = await validateSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, "attendance")) redirect("/");

  const canSync = hasPermission(session, "sync");
  const params = await searchParams;

  const filters = resolveAttendanceFilters({
    period: params.period || params.p,
    from: params.from,
    to: params.to,
    employee: params.employee,
    project: params.project,
    status: params.status,
    flag: params.flag,
  });

  const timingThresholdMinutes = getTimingThresholdMinutes();
  const where = buildAttendanceWhere(filters, { timingThresholdMinutes });
  const baseWhere = buildAttendanceBaseWhere(filters);

  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = Math.max(10, Math.min(100, parseInt(params.pageSize || "25", 10)));

  let latestSync: typeof attendanceSyncLogs.$inferSelect | null = null;
  try {
    latestSync = (await db.query.attendanceSyncLogs.findFirst({
      orderBy: [desc(attendanceSyncLogs.timestamp)],
    })) ?? null;
  } catch (error) {
    console.warn("[AttendancePage] attendanceSyncLogs table not ready or empty:", error);
  }

  const lastSyncText = latestSync ? formatSydneyDateTime(latestSync.timestamp) : "Never";

  let totalHours = 0;
  let totalRecords = 0;
  let activeStaff = 0;
  let flaggedCount = 0;
  let timingCount = 0;
  let overlappingCount = 0;
  let missingTimesCount = 0;
  let invalidDurationCount = 0;
  let longShiftCount = 0;
  let records: AttendanceRecordRow[] = [];
  let employeeOptions: string[] = [];
  let projectOptions: Array<{ number: string; name: string | null }> = [];
  let statusOptions: string[] = [];

  try {
    const timingCondition = timingReviewCondition(timingThresholdMinutes);

    const [metrics, review, rows, employees, projects, statuses] = await Promise.all([
      db
        .select({
          totalHours: sum(attendanceRecords.durationHours),
          totalRecords: count(),
          activeStaff: sql<number>`count(distinct ${attendanceRecords.employeeName})`,
        })
        .from(attendanceRecords)
        .where(where),

      // Review counts deliberately exclude the review filter so they cannot count themselves.
      db
        .select({
          flaggedCount: sql<number>`count(case when ${attendanceRecords.hasFlags} = true or ${timingCondition} then 1 end)`,
          timingCount: sql<number>`count(case when ${timingCondition} then 1 end)`,
          overlappingCount: sql<number>`count(case when ${attendanceRecords.flagTypes} @> '["OVERLAPPING"]'::jsonb then 1 end)`,
          missingTimesCount: sql<number>`count(case when ${attendanceRecords.flagTypes} @> '["MISSING_TIMES"]'::jsonb then 1 end)`,
          invalidDurationCount: sql<number>`count(case when ${attendanceRecords.flagTypes} @> '["INVALID_DURATION"]'::jsonb then 1 end)`,
          longShiftCount: sql<number>`count(case when ${attendanceRecords.flagTypes} @> '["LONG_SHIFT"]'::jsonb then 1 end)`,
        })
        .from(attendanceRecords)
        .where(baseWhere),

      db
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
          creationTime: attendanceRecords.creationTime,
          latitude: attendanceRecords.latitude,
          longitude: attendanceRecords.longitude,
          hasFlags: attendanceRecords.hasFlags,
          flagTypes: attendanceRecords.flagTypes,
          flags: attendanceRecords.flags,
        })
        .from(attendanceRecords)
        .where(where)
        .orderBy(
          desc(attendanceRecords.date),
          desc(attendanceRecords.startTime),
          desc(attendanceRecords.id)
        )
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

    totalHours = Number(metrics[0]?.totalHours || 0);
    totalRecords = Number(metrics[0]?.totalRecords || 0);
    activeStaff = Number(metrics[0]?.activeStaff || 0);

    flaggedCount = Number(review[0]?.flaggedCount || 0);
    timingCount = Number(review[0]?.timingCount || 0);
    overlappingCount = Number(review[0]?.overlappingCount || 0);
    missingTimesCount = Number(review[0]?.missingTimesCount || 0);
    invalidDurationCount = Number(review[0]?.invalidDurationCount || 0);
    longShiftCount = Number(review[0]?.longShiftCount || 0);

    records = rows.map((row) => ({
      ...row,
      flags: (row.flags || []) as AttendanceFlag[],
    }));

    employeeOptions = employees.map((employee) => employee.name).filter(Boolean);
    projectOptions = projects
      .filter((project): project is { number: string; name: string | null } => Boolean(project.number))
      .map((project) => ({ number: project.number, name: project.name }));
    statusOptions = statuses.map((status) => status.status).filter(Boolean);
  } catch (error) {
    console.error("[AttendancePage] Error querying attendance records:", error);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white md:text-3xl">
            Time &amp; Attendance
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 md:text-sm">
            Staff timesheets, hours and timing checks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white px-3 py-1.5 text-xs shadow-xs dark:border-slate-800/60 dark:bg-slate-900">
            <div
              className={`h-2 w-2 rounded-full ${
                latestSync?.status === "SUCCESS"
                  ? "bg-emerald-500"
                  : latestSync
                    ? "bg-amber-500"
                    : "bg-slate-400"
              }`}
            />
            <span className="text-slate-500 dark:text-slate-400">Last synced:</span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {lastSyncText}
            </span>
          </div>

          <AttendanceSyncButton canSync={canSync} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total hours"
          value={totalHours.toLocaleString("en-AU", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
          unit="hrs"
          hint="All matching timesheets"
          icon={<Clock className="h-4 w-4" />}
          iconClassName="bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
        />
        <KpiCard
          label="Employees"
          value={activeStaff}
          unit="people"
          hint="With timesheets in this view"
          icon={<Users className="h-4 w-4" />}
          iconClassName="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
        />
        <KpiCard
          label="Timesheets"
          value={totalRecords.toLocaleString("en-AU")}
          unit="entries"
          hint="Across every matching record, not just this page"
          icon={<Layers className="h-4 w-4" />}
          iconClassName="bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400"
        />
        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-xs dark:border-slate-800/60 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Needs review
            </span>
            <div
              className={`rounded-lg p-1.5 ${
                flaggedCount > 0
                  ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
              }`}
            >
              {flaggedCount > 0 ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-black tabular-nums ${
                flaggedCount > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {flaggedCount}
            </span>
            <span className="text-xs font-medium text-slate-400">entries</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {timingCount > 0 && (
              <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
                {timingCount} timing
              </span>
            )}
            {overlappingCount > 0 && (
              <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-400">
                {overlappingCount} overlap
              </span>
            )}
            {missingTimesCount > 0 && (
              <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
                {missingTimesCount} missing
              </span>
            )}
            {invalidDurationCount > 0 && (
              <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-400">
                {invalidDurationCount} invalid
              </span>
            )}
            {longShiftCount > 0 && (
              <span className="rounded border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-400">
                {longShiftCount} long
              </span>
            )}
            {flaggedCount === 0 && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> All clear
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] text-slate-400">Date, employee, project and status only</p>
        </div>
      </div>

      <AttendanceFilters
        employees={employeeOptions}
        projects={projectOptions}
        statuses={statusOptions}
        currentParams={{
          period: filters.bounds.period,
          from: params.from,
          to: params.to,
          employee: filters.employee ?? undefined,
          project: filters.project ?? undefined,
          status: filters.status ?? undefined,
          flag: filters.flag,
        }}
        activeRangeLabel={filters.bounds.label}
      />

      <AttendanceTable
        records={records}
        totalRecords={totalRecords}
        currentPage={page}
        pageSize={pageSize}
        filters={{
          period: filters.bounds.period,
          from: params.from,
          to: params.to,
          project: filters.project ?? undefined,
          status: filters.status ?? undefined,
          flag: filters.flag,
        }}
        timingThresholdMinutes={timingThresholdMinutes}
      />
    </div>
  );
}
