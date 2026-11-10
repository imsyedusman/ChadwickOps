"use client";

import type { ReactNode } from "react";
import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Briefcase, RotateCcw, Tag, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RangeDatePicker } from "@/components/ui/range-date-picker";
import {
  ATTENDANCE_FLAG_PRESETS,
  getAttendancePresetRange,
  normalizeFlagSlug,
  normalizePeriodSlug,
  type AttendancePeriodValue,
} from "@/lib/attendance-logic";

interface AttendanceFiltersProps {
  employees: string[];
  projects: Array<{ number: string; name?: string | null }>;
  statuses: string[];
  currentParams: {
    period?: string;
    from?: string;
    to?: string;
    employee?: string;
    project?: string;
    status?: string;
    flag?: string;
  };
  activeRangeLabel: string;
}

interface FilterState {
  period: AttendancePeriodValue;
  from: string;
  to: string;
  employee: string;
  project: string;
  status: string;
  flag: string;
}

function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {children}
    </div>
  );
}

export function AttendanceFilters({
  employees,
  projects,
  statuses,
  currentParams,
  activeRangeLabel,
}: AttendanceFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const period = normalizePeriodSlug(currentParams.period);
  const employee = currentParams.employee || "all";
  const project = currentParams.project || "all";
  const status = currentParams.status || "all";
  const flag = normalizeFlagSlug(currentParams.flag);

  // Presets have no from/to in the URL, so resolve them for the picker display.
  const fallbackRange = getAttendancePresetRange(period === "custom" ? "this-week" : period);
  const rangeFrom = currentParams.from || fallbackRange.from;
  const rangeTo = currentParams.to || fallbackRange.to;

  const employeeOptions = [
    { value: "all", label: `All employees (${employees.length})` },
    ...employees.map((name) => ({ value: name, label: name })),
  ];

  const projectOptions = [
    { value: "all", label: `All projects (${projects.length})` },
    ...projects.map((item) => ({
      value: item.number,
      label: item.name ? `${item.number} · ${item.name}` : item.number,
    })),
  ];

  const statusOptions = [
    { value: "all", label: "All statuses" },
    ...statuses.map((value) => ({ value, label: value })),
  ];

  const isDirty =
    period !== "this-week" ||
    employee !== "all" ||
    project !== "all" ||
    status !== "all" ||
    flag !== "all";

  const pushFilters = (patch: Partial<FilterState>) => {
    const merged: FilterState = {
      period,
      from: currentParams.from || "",
      to: currentParams.to || "",
      employee,
      project,
      status,
      flag,
      ...patch,
    };

    const params = new URLSearchParams();
    if (merged.period !== "this-week") params.set("period", merged.period);
    if (merged.period === "custom") {
      if (merged.from) params.set("from", merged.from);
      if (merged.to) params.set("to", merged.to);
    }
    if (merged.employee !== "all") params.set("employee", merged.employee);
    if (merged.project !== "all") params.set("project", merged.project);
    if (merged.status !== "all") params.set("status", merged.status);
    if (merged.flag !== "all") params.set("flag", merged.flag);

    const pageSize = searchParams.get("pageSize");
    if (pageSize) params.set("pageSize", pageSize);

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/attendance?${query}` : "/attendance");
    });
  };

  const resetFilters = () => {
    const params = new URLSearchParams();
    const pageSize = searchParams.get("pageSize");
    if (pageSize) params.set("pageSize", pageSize);
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/attendance?${query}` : "/attendance");
    });
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/60 bg-white p-3 shadow-xs sm:p-4 dark:border-slate-800/60 dark:bg-slate-900",
        isPending && "opacity-70"
      )}
      aria-busy={isPending}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(240px,1.1fr)_minmax(190px,0.9fr)_minmax(240px,1.2fr)_150px_180px]">
          <FilterField label="Date range">
            <RangeDatePicker
              period={period}
              from={rangeFrom}
              to={rangeTo}
              activeLabel={activeRangeLabel}
              className="w-full"
              onChange={(next) => {
                pushFilters({ period: next.period, from: next.from, to: next.to });
              }}
            />
          </FilterField>

          <FilterField label="Employee">
            <Combobox
              options={employeeOptions}
              value={employee}
              onValueChange={(value) => pushFilters({ employee: value })}
              placeholder="All employees"
              searchPlaceholder="Search employees…"
              icon={<User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              className="w-full"
              ariaLabel="Employee"
            />
          </FilterField>

          <FilterField label="Project">
            <Combobox
              options={projectOptions}
              value={project}
              onValueChange={(value) => pushFilters({ project: value })}
              placeholder="All projects"
              searchPlaceholder="Search projects…"
              icon={<Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              className="w-full"
              ariaLabel="Project"
            />
          </FilterField>

          <FilterField label="Status">
            <Select value={status} onValueChange={(value) => pushFilters({ status: value })}>
              <SelectTrigger className="h-9 w-full rounded-md text-xs font-medium shadow-xs" aria-label="Status">
                <Tag className="mr-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Review">
            <Select value={flag} onValueChange={(value) => pushFilters({ flag: value })}>
              <SelectTrigger className="h-9 w-full rounded-md text-xs font-medium shadow-xs" aria-label="Review filter">
                <AlertTriangle className="mr-1 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <SelectValue placeholder="All records" />
              </SelectTrigger>
              <SelectContent>
                {ATTENDANCE_FLAG_PRESETS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-full shrink-0 gap-1.5 px-3 text-xs sm:w-auto"
          onClick={resetFilters}
          disabled={!isDirty}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
    </div>
  );
}
