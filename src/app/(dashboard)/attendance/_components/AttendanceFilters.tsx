"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Calendar, 
  User, 
  Briefcase, 
  Tag, 
  AlertTriangle, 
  X, 
  Filter,
  Check,
  CalendarRange,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import {
  ATTENDANCE_PERIOD_PRESETS,
  ATTENDANCE_FLAG_PRESETS,
  normalizePeriodSlug,
  normalizeFlagSlug,
  type AttendancePeriodValue,
  type AttendanceFlagSlug,
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

  const activePeriod = normalizePeriodSlug(currentParams.period);
  const activeFlag = normalizeFlagSlug(currentParams.flag);

  const [selectedPeriod, setSelectedPeriod] = useState<AttendancePeriodValue>(activePeriod);
  const [selectedFlag, setSelectedFlag] = useState<AttendanceFlagSlug>(activeFlag);
  const [selectedEmployee, setSelectedEmployee] = useState(currentParams.employee || "");
  const [selectedProject, setSelectedProject] = useState(currentParams.project || "");
  const [selectedStatus, setSelectedStatus] = useState(currentParams.status || "");
  const [customFrom, setCustomFrom] = useState(currentParams.from || "");
  const [customTo, setCustomTo] = useState(currentParams.to || "");

  useEffect(() => {
    setSelectedPeriod(normalizePeriodSlug(currentParams.period));
    setSelectedFlag(normalizeFlagSlug(currentParams.flag));
    setSelectedEmployee(currentParams.employee || "");
    setSelectedProject(currentParams.project || "");
    setSelectedStatus(currentParams.status || "");
    setCustomFrom(currentParams.from || "");
    setCustomTo(currentParams.to || "");
  }, [currentParams]);

  const updateFilters = (newVals: Partial<{
    period: string;
    from: string;
    to: string;
    employee: string;
    project: string;
    status: string;
    flag: string;
  }>) => {
    startTransition(() => {
      const params = new URLSearchParams();

      const merged = {
        period: selectedPeriod,
        from: customFrom,
        to: customTo,
        employee: selectedEmployee,
        project: selectedProject,
        status: selectedStatus,
        flag: selectedFlag,
        ...newVals,
      };

      // 1. Period & Custom Dates
      const targetPeriod = merged.period;
      if (targetPeriod === "custom") {
        params.set("period", "custom");
        if (merged.from) params.set("from", merged.from);
        if (merged.to) params.set("to", merged.to);
      } else if (targetPeriod && targetPeriod !== "this-week") {
        // Omit default 'this-week' from URL for clean human-readable URLs
        params.set("period", targetPeriod);
      }

      // 2. Flag
      if (merged.flag && merged.flag !== "all") {
        params.set("flag", merged.flag);
      }

      // 3. Employee
      if (merged.employee && merged.employee !== "all") {
        params.set("employee", merged.employee);
      }

      // 4. Project
      if (merged.project && merged.project !== "all") {
        params.set("project", merged.project);
      }

      // 5. Status
      if (merged.status && merged.status !== "all") {
        params.set("status", merged.status);
      }

      // Reset page when filters change
      const queryString = params.toString();
      router.push(queryString ? `/attendance?${queryString}` : "/attendance");
    });
  };

  const handlePeriodChange = (preset: AttendancePeriodValue) => {
    setSelectedPeriod(preset);
    if (preset !== "custom") {
      setCustomFrom("");
      setCustomTo("");
      updateFilters({ period: preset, from: "", to: "" });
    } else {
      updateFilters({ period: "custom" });
    }
  };

  const handleCustomRangeChange = (start: string, end: string) => {
    setCustomFrom(start);
    setCustomTo(end);
    setSelectedPeriod("custom");
    updateFilters({ period: "custom", from: start, to: end });
  };

  const handleReset = () => {
    startTransition(() => {
      router.push("/attendance");
    });
  };

  const hasActiveFilters = Boolean(
    (selectedPeriod !== "this-week" && selectedPeriod !== undefined) ||
    customFrom ||
    customTo ||
    selectedEmployee ||
    selectedProject ||
    selectedStatus ||
    (selectedFlag !== "all" && selectedFlag !== undefined)
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-4 md:p-5 shadow-xs space-y-4">
      {/* Top Section: Period Presets & Review State Chips */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/60">
        {/* Period Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Period
          </span>
          {ATTENDANCE_PERIOD_PRESETS.map((p) => {
            const isActive = selectedPeriod === p.value;
            return (
              <button
                key={p.value}
                onClick={() => handlePeriodChange(p.value)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer",
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Review Flag Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Review
          </span>
          {ATTENDANCE_FLAG_PRESETS.map((item) => {
            const isActive = selectedFlag === item.value;
            const isWarningItem = item.value !== "all";
            return (
              <button
                key={item.value}
                onClick={() => {
                  setSelectedFlag(item.value);
                  updateFilters({ flag: item.value });
                }}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer",
                  isActive
                    ? isWarningItem
                      ? "bg-amber-500 text-slate-950 font-semibold shadow-xs"
                      : "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Middle Bar: Active Range Indicator & Quick Reset */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 font-medium">
            <CalendarRange className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Range: {activeRangeLabel}</span>
          </div>

          {selectedPeriod === "custom" && (
            <DateRangePicker
              label="Select Custom Dates"
              startDate={customFrom}
              endDate={customTo}
              onRangeChange={handleCustomRangeChange}
              className="shrink-0"
            />
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer font-medium"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset filters</span>
          </button>
        )}
      </div>

      {/* Bottom Row: Granular Shadcn Dropdown Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Employee Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <User className="h-3 w-3" /> Employee
          </label>
          <Select
            value={selectedEmployee || "all"}
            onValueChange={(val) => {
              const mapped = val === "all" ? "" : val;
              setSelectedEmployee(mapped);
              updateFilters({ employee: mapped });
            }}
          >
            <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 rounded-xl text-xs h-9 font-medium">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">All Employees ({employees.length})</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp} value={emp}>
                  {emp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Project Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Briefcase className="h-3 w-3" /> Project
          </label>
          <Select
            value={selectedProject || "all"}
            onValueChange={(val) => {
              const mapped = val === "all" ? "" : val;
              setSelectedProject(mapped);
              updateFilters({ project: mapped });
            }}
          >
            <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 rounded-xl text-xs h-9 font-medium">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">All Projects ({projects.length})</SelectItem>
              {projects.map((proj) => (
                <SelectItem key={proj.number} value={proj.number}>
                  {proj.number} {proj.name ? `— ${proj.name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Tag className="h-3 w-3" /> Approval Status
          </label>
          <Select
            value={selectedStatus || "all"}
            onValueChange={(val) => {
              const mapped = val === "all" ? "" : val;
              setSelectedStatus(mapped);
              updateFilters({ status: mapped });
            }}
          >
            <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 rounded-xl text-xs h-9 font-medium">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
