"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ATTENDANCE_PAGE_SIZES,
  formatSydneyDateOnly,
  formatSydneyDateTime,
  formatSydneyTime,
  type AttendanceFlag,
} from "@/lib/attendance-logic";
import { LocationBadge, ReviewCell, StatusBadge } from "./AttendanceBadges";
import {
  AttendanceEmployeeSheet,
  type AttendanceSheetFilters,
} from "./AttendanceEmployeeSheet";

export interface AttendanceRecordRow {
  id: number;
  workguruId: string;
  employeeName: string;
  projectNumber: string | null;
  projectName: string | null;
  taskName: string | null;
  workguruTaskId: string | null;
  date: Date | string;
  startTime: Date | string | null;
  finishTime: Date | string | null;
  durationHours: number;
  status: string;
  creationTime: Date | string | null;
  latitude: number | null;
  longitude: number | null;
  hasFlags: boolean;
  flagTypes: string[];
  flags: AttendanceFlag[];
}

interface AttendanceTableProps {
  records: AttendanceRecordRow[];
  totalRecords: number;
  currentPage: number;
  pageSize: number;
  filters: AttendanceSheetFilters;
  timingThresholdMinutes: number;
}

function ColumnHeading({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <>
      <span className="block">{children}</span>
      {hint ? (
        <span className="mt-0.5 block text-[9px] font-medium normal-case tracking-normal text-slate-400 dark:text-slate-500">
          {hint}
        </span>
      ) : null}
    </>
  );
}

export function AttendanceTable({
  records,
  totalRecords,
  currentPage,
  pageSize,
  filters,
  timingThresholdMinutes,
}: AttendanceTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", newPage.toString());
      router.push(`/attendance?${params.toString()}`);
    });
  };

  const handlePageSizeChange = (value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("pageSize", value);
      params.delete("page");
      router.push(`/attendance?${params.toString()}`);
    });
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase() || "ST";
  };

  return (
    <>
      <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-800/60 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800/60 dark:bg-slate-800/50 dark:text-slate-400">
                <th className="px-4 py-2.5">Employee</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Project</th>
                <th className="px-3 py-2.5">Task</th>
                <th className="px-3 py-2.5">
                  <ColumnHeading hint="Entered">Task start</ColumnHeading>
                </th>
                <th className="px-3 py-2.5">
                  <ColumnHeading hint="Entered">Task finish</ColumnHeading>
                </th>
                <th className="px-3 py-2.5">
                  <ColumnHeading hint="When saved">Timesheet added</ColumnHeading>
                </th>
                <th className="px-3 py-2.5 text-right">Hours</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5">
                  <ColumnHeading hint="Added time and checks">Review</ColumnHeading>
                </th>
                <th className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Location
                  </span>
                  <span className="mt-0.5 block text-[9px] font-medium normal-case tracking-normal text-slate-400 dark:text-slate-500">
                    Only if returned
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-semibold">No timesheets in this view</p>
                      <p className="max-w-sm text-xs text-slate-400">
                        Try another date range or filter, or sync attendance to fetch the latest timesheets.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr
                    key={record.id}
                    className={cn(
                      "transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30",
                      record.hasFlags && "bg-amber-50/20 dark:bg-amber-950/10"
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => setSelectedEmployee(record.employeeName)}
                        className="group flex items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900"
                        title={`View ${record.employeeName}’s timesheets`}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {getInitials(record.employeeName)}
                        </span>
                        <span className="max-w-[150px] truncate font-semibold text-slate-900 group-hover:text-primary group-hover:underline dark:text-white">
                          {record.employeeName}
                        </span>
                      </button>
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700 dark:text-slate-300">
                      {formatSydneyDateOnly(record.date, "dd MMM yyyy")}
                    </td>

                    <td className="px-3 py-2.5">
                      {record.projectNumber ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {record.projectNumber}
                          </span>
                          {record.projectName && (
                            <span
                              className="max-w-[170px] truncate text-[10px] text-slate-400"
                              title={record.projectName}
                            >
                              {record.projectName}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td
                      className="max-w-[160px] truncate px-3 py-2.5 text-slate-600 dark:text-slate-300"
                      title={record.taskName || ""}
                    >
                      {record.taskName || <span className="text-slate-400">Not set</span>}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-[11px] tabular-nums text-slate-700 dark:text-slate-300">
                      {record.startTime ? (
                        formatSydneyTime(record.startTime)
                      ) : (
                        <span className="text-slate-400">Not set</span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-[11px] tabular-nums text-slate-700 dark:text-slate-300">
                      {record.finishTime ? (
                        formatSydneyTime(record.finishTime)
                      ) : (
                        <span className="text-slate-400">Not set</span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-[11px] tabular-nums text-slate-600 dark:text-slate-300">
                      {record.creationTime ? (
                        formatSydneyDateTime(record.creationTime)
                      ) : (
                        <span className="text-slate-400">Not recorded</span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-white">
                      {record.durationHours.toFixed(2)}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-center">
                      <StatusBadge status={record.status} />
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="max-w-[320px]">
                        <ReviewCell
                          startTime={record.startTime}
                          finishTime={record.finishTime}
                          creationTime={record.creationTime}
                          thresholdMinutes={timingThresholdMinutes}
                          flags={record.flags}
                        />
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      <LocationBadge latitude={record.latitude} longitude={record.longitude} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/60 bg-slate-50/60 px-4 py-3 text-xs text-slate-500 dark:border-slate-800/60 dark:bg-slate-800/40 dark:text-slate-400">
          <div>
            Showing{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {records.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {Math.min(currentPage * pageSize, totalRecords)}
            </span>{" "}
            of <span className="font-semibold text-slate-900 dark:text-white">{totalRecords}</span>{" "}
            timesheets
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-medium">
              Rows per page
              <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="h-7 w-[68px] px-2 text-xs shadow-xs" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)} className="text-xs">
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isPending}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <span className="px-1 text-xs font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isPending}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <AttendanceEmployeeSheet
        employee={selectedEmployee}
        open={selectedEmployee !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEmployee(null);
        }}
        filters={filters}
        timingThresholdMinutes={timingThresholdMinutes}
      />
    </>
  );
}
