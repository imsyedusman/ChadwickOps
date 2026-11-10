"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  AlertTriangle, 
  Clock, 
  AlertCircle, 
  Timer, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  HelpCircle,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  formatSydneyTime, 
  formatSydneyDateTime, 
  formatSydneyDateOnly,
  type AttendanceFlag
} from "@/lib/attendance-logic";
import { Tooltip } from "@/components/ui/Tooltip";

export interface AttendanceRecordRow {
  id: number;
  workguruId: string;
  employeeName: string;
  projectNumber: string | null;
  projectName: string | null;
  taskName: string | null;
  date: Date | string;
  startTime: Date | string | null;
  finishTime: Date | string | null;
  durationHours: number;
  status: string;
  creationTime: Date | string | null;
  lastModifiedTime: Date | string | null;
  hasFlags: boolean;
  flagTypes: string[];
  flags: AttendanceFlag[];
}

interface AttendanceTableProps {
  records: AttendanceRecordRow[];
  totalRecords: number;
  currentPage: number;
  pageSize: number;
}

export function AttendanceTable({
  records,
  totalRecords,
  currentPage,
  pageSize,
}: AttendanceTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", newPage.toString());
      router.push(`/attendance?${params.toString()}`);
    });
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || "ST";
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "approved") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          Approved
        </span>
      );
    }
    if (s === "submitted") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
          Submitted
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        {status || "Draft"}
      </span>
    );
  };

  const renderFlagPills = (flags: AttendanceFlag[]) => {
    if (!flags || flags.length === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
          <CheckCircle2 className="h-3 w-3 text-emerald-500/80" /> Clean
        </span>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-1">
        {flags.map((flag, idx) => {
          let badgeClass = "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800";
          let Icon = AlertTriangle;

          if (flag.type === "OVERLAPPING") {
            badgeClass = "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-bold";
            Icon = AlertCircle;
          } else if (flag.type === "INVALID_DURATION") {
            badgeClass = "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800";
            Icon = AlertCircle;
          } else if (flag.type === "LONG_SHIFT") {
            badgeClass = "bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800";
            Icon = Timer;
          } else if (flag.type === "MISSING_TIMES") {
            badgeClass = "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800";
            Icon = Clock;
          }

          return (
            <Tooltip key={idx} content={flag.message}>
              <span className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border cursor-help",
                badgeClass
              )}>
                <Icon className="h-2.5 w-2.5 shrink-0" />
                <span>
                  {flag.type === "OVERLAPPING" && "Overlap"}
                  {flag.type === "MISSING_TIMES" && "Missing Time"}
                  {flag.type === "INVALID_DURATION" && "Invalid Duration"}
                  {flag.type === "LONG_SHIFT" && "Long Shift"}
                </span>
              </span>
            </Tooltip>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden flex flex-col">
      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-800/60 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Employee</th>
              <th className="py-3 px-3">Date</th>
              <th className="py-3 px-3">Project</th>
              <th className="py-3 px-3">Task</th>
              <th className="py-3 px-3">Start / Finish</th>
              <th className="py-3 px-3 text-right">Duration</th>
              <th className="py-3 px-3 text-center">Status</th>
              <th className="py-3 px-3">Review Flags</th>
              <th className="py-3 px-3">Created</th>
              <th className="py-3 px-3">Last Modified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {records.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-500 dark:text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Clock className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-semibold">No attendance records found</p>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Try adjusting the date range or filters above, or click &ldquo;Sync Attendance&rdquo; to fetch the latest timesheets from WorkGuru.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const startStr = formatSydneyTime(r.startTime);
                const finishStr = formatSydneyTime(r.finishTime);
                const hasMissingTimes = !r.startTime || !r.finishTime;

                return (
                  <tr
                    key={r.id}
                    className={cn(
                      "hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors",
                      r.hasFlags && "bg-amber-50/20 dark:bg-amber-950/10"
                    )}
                  >
                    {/* Employee */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {getInitials(r.employeeName)}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[130px]">
                          {r.employeeName}
                        </span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatSydneyDateOnly(r.date, "dd MMM yyyy")}
                    </td>

                    {/* Project */}
                    <td className="py-2.5 px-3">
                      {r.projectNumber ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {r.projectNumber}
                          </span>
                          {r.projectName && (
                            <span className="text-[10px] text-slate-400 truncate max-w-[140px]" title={r.projectName}>
                              {r.projectName}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Task */}
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-[120px] truncate" title={r.taskName || ""}>
                      {r.taskName || "—"}
                    </td>

                    {/* Start / Finish */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {hasMissingTimes ? (
                        <div className="flex items-center gap-1.5">
                          {!r.startTime && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              Missing Start
                            </span>
                          )}
                          {!r.finishTime && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              Missing Finish
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 tabular-nums text-[11px] text-slate-700 dark:text-slate-300">
                          <span>{startStr}</span>
                          <span className="text-slate-400">→</span>
                          <span>{finishStr}</span>
                        </div>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      {r.durationHours.toFixed(2)} hrs
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {getStatusBadge(r.status)}
                    </td>

                    {/* Flags / Audit */}
                    <td className="py-2.5 px-3">
                      {renderFlagPills(r.flags)}
                    </td>

                    {/* Creation Time (Sydney Local) */}
                    <td className="py-2.5 px-3 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatSydneyDateTime(r.creationTime)}
                    </td>

                    {/* Last Modified Time (Sydney Local) */}
                    <td className="py-2.5 px-3 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatSydneyDateTime(r.lastModifiedTime)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50/60 dark:bg-slate-800/40 border-t border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-500 dark:text-slate-400">
        <div>
          Showing{" "}
          <span className="font-semibold text-slate-900 dark:text-white">
            {records.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
          </span>{" "}
          to{" "}
          <span className="font-semibold text-slate-900 dark:text-white">
            {Math.min(currentPage * pageSize, totalRecords)}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-slate-900 dark:text-white">
            {totalRecords}
          </span>{" "}
          timesheets
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isPending}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </button>
          <span className="text-xs font-medium px-2">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isPending}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

