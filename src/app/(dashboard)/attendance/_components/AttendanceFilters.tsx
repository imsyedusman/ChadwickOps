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
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AttendanceFiltersProps {
  employees: string[];
  projects: Array<{ number: string; name?: string | null }>;
  statuses: string[];
  currentParams: {
    p?: string;
    from?: string;
    to?: string;
    employee?: string;
    project?: string;
    status?: string;
    flag?: string;
  };
}

const PRESETS = [
  { label: "Past 7 Days", value: "past_7" },
  { label: "Past 14 Days", value: "past_14" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Past 60 Days", value: "past_60" },
  { label: "All Records", value: "all" },
];

const FLAG_FILTERS = [
  { label: "All Records", value: "all" },
  { label: "Flagged Only", value: "flagged" },
  { label: "Overlapping", value: "OVERLAPPING" },
  { label: "Missing Times", value: "MISSING_TIMES" },
  { label: "Invalid Duration", value: "INVALID_DURATION" },
  { label: "Long Shift (>12h)", value: "LONG_SHIFT" },
];

export function AttendanceFilters({
  employees,
  projects,
  statuses,
  currentParams,
}: AttendanceFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [selectedPreset, setSelectedPreset] = useState(currentParams.p || "past_60");
  const [selectedEmployee, setSelectedEmployee] = useState(currentParams.employee || "");
  const [selectedProject, setSelectedProject] = useState(currentParams.project || "");
  const [selectedStatus, setSelectedStatus] = useState(currentParams.status || "");
  const [selectedFlag, setSelectedFlag] = useState(currentParams.flag || "all");
  const [customFrom, setCustomFrom] = useState(currentParams.from || "");
  const [customTo, setCustomTo] = useState(currentParams.to || "");

  useEffect(() => {
    setSelectedPreset(currentParams.p || "past_60");
    setSelectedEmployee(currentParams.employee || "");
    setSelectedProject(currentParams.project || "");
    setSelectedStatus(currentParams.status || "");
    setSelectedFlag(currentParams.flag || "all");
    setCustomFrom(currentParams.from || "");
    setCustomTo(currentParams.to || "");
  }, [currentParams]);

  const updateFilters = (newVals: Partial<{
    p: string;
    from: string;
    to: string;
    employee: string;
    project: string;
    status: string;
    flag: string;
  }>) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      // Reset page when filters change
      params.delete("page");

      const merged = {
        p: selectedPreset,
        from: customFrom,
        to: customTo,
        employee: selectedEmployee,
        project: selectedProject,
        status: selectedStatus,
        flag: selectedFlag,
        ...newVals,
      };

      Object.entries(merged).forEach(([key, val]) => {
        if (!val || val === "all" || (key === "p" && val === "past_60" && !merged.from)) {
          params.delete(key);
        } else {
          params.set(key, val);
        }
      });

      router.push(`/attendance?${params.toString()}`);
    });
  };

  const handleClearAll = () => {
    startTransition(() => {
      router.push("/attendance");
    });
  };

  const hasActiveFilters = Boolean(
    (currentParams.p && currentParams.p !== "past_60") ||
    currentParams.from ||
    currentParams.to ||
    currentParams.employee ||
    currentParams.project ||
    currentParams.status ||
    (currentParams.flag && currentParams.flag !== "all")
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-4 md:p-5 shadow-sm space-y-4">
      {/* Top Row: Presets and Flag Filter Chips */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/60">
        {/* Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1.5 flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Period:
          </span>
          {PRESETS.map((preset) => {
            const isActive = selectedPreset === preset.value && !customFrom;
            return (
              <button
                key={preset.value}
                onClick={() => {
                  setSelectedPreset(preset.value);
                  setCustomFrom("");
                  setCustomTo("");
                  updateFilters({ p: preset.value, from: "", to: "" });
                }}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer",
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Flag Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1.5 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" /> Exceptions:
          </span>
          {FLAG_FILTERS.map((item) => {
            const isActive = selectedFlag === item.value;
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
                    ? item.value === "all"
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-amber-500 text-white dark:bg-amber-500 dark:text-slate-950 font-bold shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Row: Granular Dropdown Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
        {/* Employee Selector */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <User className="h-2.5 w-2.5" /> Employee
          </label>
          <select
            value={selectedEmployee}
            onChange={(e) => {
              setSelectedEmployee(e.target.value);
              updateFilters({ employee: e.target.value });
            }}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">All Employees ({employees.length})</option>
            {employees.map((emp) => (
              <option key={emp} value={emp}>
                {emp}
              </option>
            ))}
          </select>
        </div>

        {/* Project Selector */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Briefcase className="h-2.5 w-2.5" /> Project
          </label>
          <select
            value={selectedProject}
            onChange={(e) => {
              setSelectedProject(e.target.value);
              updateFilters({ project: e.target.value });
            }}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">All Projects ({projects.length})</option>
            {projects.map((proj) => (
              <option key={proj.number} value={proj.number}>
                {proj.number} {proj.name ? `— ${proj.name}` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Status Selector */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Tag className="h-2.5 w-2.5" /> Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              updateFilters({ status: e.target.value });
            }}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">All Statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Date Range From/To */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            From Date
          </label>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              setSelectedPreset("custom");
              updateFilters({ p: "custom", from: e.target.value });
            }}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              To Date
            </label>
            {hasActiveFilters && (
              <button
                onClick={handleClearAll}
                className="text-[10px] text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <X className="h-2.5 w-2.5" /> Reset
              </button>
            )}
          </div>
          <input
            type="date"
            value={customTo}
            onChange={(e) => {
              setCustomTo(e.target.value);
              setSelectedPreset("custom");
              updateFilters({ p: "custom", to: e.target.value });
            }}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
      </div>
    </div>
  );
}

