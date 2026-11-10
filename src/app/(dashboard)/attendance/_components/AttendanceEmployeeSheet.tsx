"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CalendarDays, Clock3, MapPin, Users } from "lucide-react";

import { getEmployeeAttendanceDetail } from "@/app/actions/attendance";
import type { AttendanceDetailRecord } from "@/lib/attendance-types";
import {
  evaluateTimingReview,
  formatSydneyDateOnly,
  formatSydneyDateTime,
  formatSydneyTime,
  hasGenuineAttendanceLocation,
} from "@/lib/attendance-logic";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  LocationBadge,
  ReviewFlagPills,
  StatusBadge,
  TimingBadge,
} from "./AttendanceBadges";

export interface AttendanceSheetFilters {
  period: string;
  from?: string;
  to?: string;
  project?: string;
  status?: string;
  flag?: string;
}

interface AttendanceEmployeeSheetProps {
  employee: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AttendanceSheetFilters;
  timingThresholdMinutes: number;
}

function asDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function SummaryTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums text-foreground">{value}</div>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function EmployeeSheetBody({
  employee,
  period,
  from,
  to,
  project,
  status,
  flag,
  timingThresholdMinutes,
}: {
  employee: string;
  period: string;
  from?: string;
  to?: string;
  project?: string;
  status?: string;
  flag?: string;
  timingThresholdMinutes: number;
}) {
  const [records, setRecords] = useState<AttendanceDetailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getEmployeeAttendanceDetail({ employee, period, from, to, project, status, flag })
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setRecords(result.records);
        } else {
          setError(result.error);
          setRecords(result.records);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this employee’s timesheets. Try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employee, period, from, to, project, status, flag]);

  const summary = useMemo(() => {
    let totalHours = 0;
    let timingReviews = 0;
    let reviewCount = 0;
    let gpsCount = 0;

    const days = new Map<
      string,
      { label: string; hours: number; entries: number; reviews: number }
    >();

    for (const record of records) {
      totalHours += Number(record.durationHours || 0);

      const timing = evaluateTimingReview(
        {
          startTime: asDate(record.startTime),
          finishTime: asDate(record.finishTime),
          creationTime: asDate(record.creationTime),
        },
        timingThresholdMinutes
      );

      if (timing.needsReview) timingReviews += 1;
      if (record.hasFlags || timing.needsReview) reviewCount += 1;
      if (hasGenuineAttendanceLocation(record.latitude, record.longitude)) gpsCount += 1;

      const key = formatSydneyDateOnly(record.date, "yyyy-MM-dd");
      const day = days.get(key) ?? {
        label: formatSydneyDateOnly(record.date, "EEE d MMM"),
        hours: 0,
        entries: 0,
        reviews: 0,
      };
      day.hours += Number(record.durationHours || 0);
      day.entries += 1;
      if (record.hasFlags || timing.needsReview) day.reviews += 1;
      days.set(key, day);
    }

    return {
      totalHours,
      timingReviews,
      reviewCount,
      gpsCount,
      days: Array.from(days.values()),
      maxDayHours: Math.max(1, ...Array.from(days.values()).map((day) => day.hours)),
    };
  }, [records, timingThresholdMinutes]);

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading timesheets">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-[74px] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
            />
          ))}
        </div>
        <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        <div className="space-y-2">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        {error}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Clock3 className="h-7 w-7 text-muted-foreground/50" />
        <p className="text-sm font-semibold">No timesheets in this view</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Adjust the date range or filters to see this employee’s entries.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryTile
          label="Total hours"
          value={summary.totalHours.toFixed(1)}
          hint={`${records.length} entries`}
          icon={<Clock3 className="h-3.5 w-3.5" />}
        />
        <SummaryTile
          label="Days"
          value={String(summary.days.length)}
          hint="With timesheets"
          icon={<CalendarDays className="h-3.5 w-3.5" />}
        />
        <SummaryTile
          label="Timing flags"
          value={String(summary.timingReviews)}
          hint="Outside threshold"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <SummaryTile
          label="Need review"
          value={String(summary.reviewCount)}
          hint="Flags or timing"
          icon={<Users className="h-3.5 w-3.5" />}
        />
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Daily breakdown
          </h3>
          <span className="text-[10px] text-muted-foreground">
            Threshold {timingThresholdMinutes} min
          </span>
        </div>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/70 dark:divide-slate-800 dark:border-slate-800">
          {summary.days.map((day) => (
            <div key={day.label} className="px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-foreground">{day.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {day.entries} {day.entries === 1 ? "entry" : "entries"} · {day.hours.toFixed(1)}h
                  {day.reviews > 0
                    ? ` · ${day.reviews} ${day.reviews === 1 ? "review" : "reviews"}`
                    : ""}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.max(4, (day.hours / summary.maxDayHours) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Timesheets
          </h3>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <MapPin className="h-3 w-3" /> {summary.gpsCount} of {records.length} with GPS
          </span>
        </div>

        <div className="space-y-2">
          {records.map((record) => {
            const timing = evaluateTimingReview(
              {
                startTime: asDate(record.startTime),
                finishTime: asDate(record.finishTime),
                creationTime: asDate(record.creationTime),
              },
              timingThresholdMinutes
            );

            return (
              <article
                key={record.id}
                className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      {formatSydneyDateOnly(record.date, "EEE d MMM yyyy")}
                      <span className="ml-2 font-normal tabular-nums text-muted-foreground">
                        {formatSydneyTime(record.startTime)} – {formatSydneyTime(record.finishTime)}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium text-foreground">
                      {record.projectNumber ? `${record.projectNumber} · ` : ""}
                      {record.projectName || "No project name"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      Task: {record.taskName || "—"}
                      {record.workguruTaskId ? ` (WG task ${record.workguruTaskId})` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums">{record.durationHours.toFixed(2)}h</p>
                    <StatusBadge status={record.status} />
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <TimingBadge
                    startTime={record.startTime}
                    finishTime={record.finishTime}
                    creationTime={record.creationTime}
                    thresholdMinutes={timingThresholdMinutes}
                  />
                  <ReviewFlagPills flags={record.flags} timingNeedsReview={timing.needsReview} />
                  <LocationBadge latitude={record.latitude} longitude={record.longitude} />
                </div>

                <p className="mt-1.5 text-[11px] text-muted-foreground">{timing.detail}</p>

                {record.notes && (
                  <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                    {record.notes}
                  </p>
                )}

                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Created {formatSydneyDateTime(record.creationTime)} · Updated{" "}
                  {formatSydneyDateTime(record.lastModifiedTime)} · WG #{record.workguruId}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

export function AttendanceEmployeeSheet({
  employee,
  open,
  onOpenChange,
  filters,
  timingThresholdMinutes,
}: AttendanceEmployeeSheetProps) {
  if (!open || !employee) return null;

  const sheetKey = [
    employee,
    filters.period,
    filters.from ?? "",
    filters.to ?? "",
    filters.project ?? "",
    filters.status ?? "",
    filters.flag ?? "",
  ].join("|");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-slate-200/70 px-5 pb-4 pt-5 dark:border-slate-800">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {employee
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </span>
            {employee}
          </SheetTitle>
          <SheetDescription className="text-xs">
            Timesheets matching the date, project, status and review filters.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <EmployeeSheetBody
            key={sheetKey}
            employee={employee}
            period={filters.period}
            from={filters.from}
            to={filters.to}
            project={filters.project}
            status={filters.status}
            flag={filters.flag}
            timingThresholdMinutes={timingThresholdMinutes}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
