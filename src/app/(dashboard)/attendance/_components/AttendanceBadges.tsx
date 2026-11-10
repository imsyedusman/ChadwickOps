"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Clock3,
  MapPin,
  MapPinOff,
  Timer,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  evaluateTimingReview,
  formatSydneyDateTime,
  hasGenuineAttendanceLocation,
  type AttendanceFlag,
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

const flagStyles: Record<string, { className: string; icon: typeof AlertTriangle; label: string }> = {
  OVERLAPPING: {
    className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    icon: AlertCircle,
    label: "Overlap",
  },
  INVALID_DURATION: {
    className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    icon: AlertCircle,
    label: "Invalid duration",
  },
  MISSING_TIMES: {
    className: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    icon: Clock,
    label: "Missing time",
  },
  LONG_SHIFT: {
    className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
    icon: Timer,
    label: "Long shift",
  },
};

export function ReviewFlagPills({
  flags,
  timingNeedsReview = false,
}: {
  flags: AttendanceFlag[];
  timingNeedsReview?: boolean;
}) {
  if ((!flags || flags.length === 0) && !timingNeedsReview) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <CheckCircle2 className="h-3 w-3 text-emerald-500/80" /> Clean
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {timingNeedsReview && (
        <Tooltip content="Creation time is more than the review threshold before the start or after the finish.">
          <span className="inline-flex cursor-help items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
            Timing
          </span>
        </Tooltip>
      )}
      {flags.map((flag, index) => {
        const style = flagStyles[flag.type] ?? {
          className:
            "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
          icon: AlertTriangle,
          label: flag.type.replace(/_/g, " ").toLowerCase(),
        };
        const Icon = style.icon;

        return (
          <Tooltip key={`${flag.type}-${index}`} content={flag.message}>
            <span
              className={cn(
                "inline-flex cursor-help items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]",
                style.className
              )}
            >
              <Icon className="h-2.5 w-2.5 shrink-0" />
              {style.label}
            </span>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function TimingBadge({
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
    <Tooltip
      content={
        <>
          {timing.detail}
          <span className="mt-1 block text-slate-300">
            Created {formatSydneyDateTime(creationTime)}
          </span>
        </>
      }
    >
      <span
        className={cn(
          "inline-flex cursor-help items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
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
    </Tooltip>
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
      <Tooltip content={`${latitude.toFixed(5)}, ${longitude.toFixed(5)} — returned by WorkGuru.`}>
        <span className="inline-flex cursor-help items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <MapPin className="h-2.5 w-2.5 shrink-0" />
          GPS
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip content="WorkGuru returned no GPS coordinates for this entry. This is not a review flag.">
      <span className="inline-flex cursor-help items-center gap-1 rounded border border-transparent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        <MapPinOff className="h-2.5 w-2.5 shrink-0" />
        No GPS
      </span>
    </Tooltip>
  );
}
