"use client";

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

  const period: AttendancePeriodValue =
    currentParams.from && currentParams.to
      ? "custom"
      : normalizePeriodSlug(currentParams.period);
  const employee = currentParams.employee || "all";
  const project = currentParams.project || "all";
  const status = currentParams.status || "all";
  const flag = normalizeFlagSlug(currentParams.flag);

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

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/60 bg-white p-3 shadow-xs dark:border-slate-800/60 dark:bg-slate-900",
        isPending && "opacity-70"
      )}
      aria-busy={isPending}
    >
      <div className="flex flex-wrap items-center gap-2">
        <RangeDatePicker
          period={period}
          from={currentParams.from || ""}
          to={currentParams.to || ""}
          activeLabel={activeRangeLabel}
          onChange={(next) => {
            pushFilters({ period: next.period, from: next.from, to: next.to });
          }}
        />

        <Combobox
          options={employeeOptions}
          value={employee}
          onValueChange={(value) => pushFilters({ employee: value })}
          placeholder="All employees"
          searchPlaceholder="Search employees…"
          icon={<User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          className="w-[170px]"
          ariaLabel="Employee"
        />

        <Combobox
          options={projectOptions}
          value={project}
          onValueChange={(value) => pushFilters({ project: value })}
          placeholder="All projects"
          searchPlaceholder="Search projects…"
          icon={<Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          className="w-[220px]"
          ariaLabel="Project"
        />

        <Select value={status} onValueChange={(value) => pushFilters({ status: value })}>
          <SelectTrigger
            className="h-9 w-[145px] rounded-md text-xs font-medium shadow-xs"
            aria-label="Status"
          >
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

        <Select value={flag} onValueChange={(value) => pushFilters({ flag: value })}>
          <SelectTrigger
            className="h-9 w-[165px] rounded-md text-xs font-medium shadow-xs"
            aria-label="Review filter"
          >
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

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 px-2.5 text-xs"
          onClick={() => startTransition(() => router.push("/attendance"))}
          disabled={!isDirty}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
    </div>
  );
}
