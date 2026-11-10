"use client";

import {
  AlertCircle,
  AlertTriangle,
  Clock,
  Clock3,
  MapPin,
  MapPinOff,
  Timer,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  evaluateTimingReview,
  hasGenuineAttendanceLocation,
  type AttendanceFlag,
  type AttendanceFlagType,
} from "@/lib/attendance-logic";

type DateLike = Date | string | null;

function asDate(value: DateLike): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

export function StatusBadge({ status }: { status: string }) {
  const value = status.toLowerCase();
  const className =
    value === "approved"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800"
      : value === "submitted"
        ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800"
        : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";

  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold", className)}>
      {status || "Draft"}
    </span>
  );
}

const flagStyles: Record<AttendanceFlagType, { className: string; icon: typeof AlertTriangle; label: string }> = {
  OVERLAPPING: {
    className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    icon: AlertCircle,
    label: "Overlaps another entry",
  },
  INVALID_DURATION: {
    className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    icon: AlertCircle,
    label: "Duration looks wrong",
  },
  MISSING_TIMES: {
    className: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    icon: Clock,
    label: "Times missing",
  },
  LONG_SHIFT: {
    className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
    icon: Timer,
    label: "Over 12 hours",
  },
};

const fallbackFlagStyle = {
  className:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  icon: AlertTriangle,
  label: "Check this entry",
};

export function ReviewFlags({ flags }: { flags: AttendanceFlag[] }) {
  if (!flags || flags.length === 0) return null;

  return (
    <>
      {flags.map((flag, index) => {
        const style = flagStyles[flag.type] ?? {
          ...fallbackFlagStyle,
          label: flag.type.replace(/_/g, " ").toLowerCase(),
        };
        const Icon = style.icon;

        return (
          <span
            key={`${flag.type}-${index}`}
            className={cn(
              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
              style.className
            )}
          >
            <Icon className="h-2.5 w-2.5 shrink-0" />
            {style.label}
          </span>
        );
      })}
    </>
  );
}

/**
 * States when the timesheet was added, relative to the task's entered start.
 * The exact difference is always visible; the amber accent only appears when
 * the configurable review rule is met, never for every delayed entry.
 */
export function TimingNote({
  startTime,
  finishTime,
  creationTime,
  thresholdMinutes,
}: {
  startTime: DateLike;
  finishTime: DateLike;
  creationTime: DateLike;
  thresholdMinutes: number;
}) {
  const timing = evaluateTimingReview(
    {
      startTime: asDate(startTime),
      finishTime: asDate(finishTime),
      creationTime: asDate(creationTime),
    },
    thresholdMinutes
  );

  const className =
    timing.status === "unknown"
      ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
      : timing.needsReview
        ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
        : timing.status === "during"
          ? "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800"
          : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
        className
      )}
    >
      {timing.needsReview ? (
        <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
      ) : (
        <Clock3 className="h-2.5 w-2.5 shrink-0" />
      )}
      {timing.label}
    </span>
  );
}

export function ReviewCell({
  startTime,
  finishTime,
  creationTime,
  thresholdMinutes,
  flags,
}: {
  startTime: DateLike;
  finishTime: DateLike;
  creationTime: DateLike;
  thresholdMinutes: number;
  flags: AttendanceFlag[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <TimingNote
        startTime={startTime}
        finishTime={finishTime}
        creationTime={creationTime}
        thresholdMinutes={thresholdMinutes}
      />
      <ReviewFlags flags={flags} />
    </div>
  );
}

export function LocationBadge({
  latitude,
  longitude,
}: {
  latitude: number | null;
  longitude: number | null;
}) {
  if (latitude !== null && longitude !== null && hasGenuineAttendanceLocation(latitude, longitude)) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        title={`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}
      >
        <MapPin className="h-2.5 w-2.5 shrink-0" />
        GPS
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      <MapPinOff className="h-2.5 w-2.5 shrink-0" />
      Not recorded
    </span>
  );
}
