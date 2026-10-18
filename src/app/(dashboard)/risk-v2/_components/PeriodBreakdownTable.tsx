"use client";

import React, { useState } from "react";
import { PeriodForecast, ProjectV2Demand } from "@/lib/risk-v2/types";
import { 
  Search, 
  ExternalLink, 
  Info, 
  Clock, 
  Calendar, 
  Building2, 
  User, 
  Filter,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Flame
} from "lucide-react";

interface PeriodBreakdownTableProps {
  periods: PeriodForecast[];
  selectedPeriodKey: string | null;
  allProjects: ProjectV2Demand[];
  onSelectProject: (project: ProjectV2Demand) => void;
}

export function PeriodBreakdownTable({
  periods,
  selectedPeriodKey,
  allProjects,
  onSelectProject,
}: PeriodBreakdownTableProps) {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");

  const selectedPeriod = selectedPeriodKey 
    ? periods.find(p => p.periodKey === selectedPeriodKey)
    : null;

  interface RowItem {
    projectId: number;
    projectNumber: string;
    projectName: string;
    clientName: string;
    projectManager: string;
    allocatedHours: number;
    totalForecastRemaining: number;
    allocationMethod: string;
    deliveryDate: string | null;
    isOverdue: boolean;
    isCompressedWindow?: boolean;
    periodKey?: string;
    periodLabel?: string;
  }

  let rows: RowItem[] = [];

  if (selectedPeriod) {
    rows = selectedPeriod.contributingProjects.map(p => ({
      ...p,
      periodKey: selectedPeriod.periodKey,
      periodLabel: selectedPeriod.label,
    }));
  } else {
    rows = periods.flatMap(period =>
      period.contributingProjects.map(p => ({
        ...p,
        periodKey: period.periodKey,
        periodLabel: period.label,
      }))
    );
  }

  // Filter
  const filteredRows = rows.filter(r => {
    const matchesSearch = 
      r.projectNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.projectName.toLowerCase().includes(search.toLowerCase()) ||
      r.clientName.toLowerCase().includes(search.toLowerCase()) ||
      r.projectManager.toLowerCase().includes(search.toLowerCase());

    const matchesMethod = 
      methodFilter === "all" ||
      (methodFilter === "scheduled" && r.allocationMethod === "scheduled") ||
      (methodFilter === "provisional" && r.allocationMethod === "provisional_window") ||
      (methodFilter === "overdue" && r.isOverdue);

    return matchesSearch && matchesMethod;
  });

  const getMethodBadge = (method: string, isOverdue: boolean, isCompressedWindow?: boolean) => {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {isOverdue ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
            <Clock className="w-3 h-3" /> Overdue Prov.
          </span>
        ) : method === 'scheduled' ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
            <CheckCircle2 className="w-3 h-3" /> Scheduled
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
            <Calendar className="w-3 h-3" /> Provisional
          </span>
        )}

        {isCompressedWindow && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300" title="Window pace exceeds 1.5x intake benchmark">
            <Flame className="w-2.5 h-2.5 text-amber-600" /> Strained Pace
          </span>
        )}
      </div>
    );
  };

  const handleRowClick = (projectId: number) => {
    const found = allProjects.find(p => p.id === projectId);
    if (found) {
      onSelectProject(found);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs" suppressHydrationWarning>
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Workload Allocation Breakdown</span>
            {selectedPeriod && (
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                selectedPeriod.isOverloaded 
                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900' 
                  : 'bg-brand/10 text-brand border-brand/20'
              }`}>
                {selectedPeriod.label} ({Math.round(selectedPeriod.demandHours)}h Demand vs {Math.round(selectedPeriod.netCapacityHours)}h Capacity)
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
            Provisional allocations represent unconstrained workload pressure distributed across intake windows. 
            Where demand exceeds available factory capacity, the unallocated workload is highlighted as a capacity shortfall. 
            This does not constitute a resource-feasible production schedule and does not modify WorkGuru due dates.
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search project or PM..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand/30 w-44 sm:w-56"
            />
          </div>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Methods</option>
            <option value="scheduled">Scheduled Only</option>
            <option value="provisional">Provisional Window</option>
            <option value="overdue">Overdue Active</option>
          </select>
        </div>
      </div>

      {/* Selected Period Absorption Banner */}
      {selectedPeriod && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 text-xs">
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Net Capacity</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              {Math.round(selectedPeriod.netCapacityHours)}h
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Demand</div>
            <div className={`text-sm font-bold mt-0.5 ${
              selectedPeriod.isOverloaded ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
            }`}>
              {Math.round(selectedPeriod.demandHours)}h ({selectedPeriod.utilisationPercent}%)
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Overdue Demand</div>
            <div className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {Math.round(selectedPeriod.overdueDemandHours || 0)}h
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Provisional Demand</div>
            <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">
              {Math.round(selectedPeriod.provisionalDemandHours || 0)}h
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Feasible Absorbed</div>
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {Math.round(selectedPeriod.feasibleAllocatedHours || Math.min(selectedPeriod.demandHours, selectedPeriod.netCapacityHours))}h
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Unallocated Overload</div>
            <div className={`text-sm font-bold mt-0.5 ${
              (selectedPeriod.unallocatedDemandHours || 0) > 0 ? 'text-rose-600 dark:text-rose-400 font-extrabold' : 'text-slate-500'
            }`}>
              {(selectedPeriod.unallocatedDemandHours || 0) > 0 
                ? `-${Math.round(selectedPeriod.unallocatedDemandHours)}h` 
                : '0h (Fully Absorbed)'}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800" suppressHydrationWarning>
        <table className="w-full text-left text-xs border-collapse" suppressHydrationWarning>
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Project</th>
              <th className="py-3 px-3">Client</th>
              <th className="py-3 px-3">PM</th>
              {!selectedPeriod && <th className="py-3 px-3">Period</th>}
              <th className="py-3 px-3 text-right">Allocated Hours</th>
              <th className="py-3 px-3 text-right">Forecast Remaining</th>
              <th className="py-3 px-3">Delivery Date</th>
              <th className="py-3 px-3">Confidence / Source</th>
              <th className="py-3 px-4 text-center">Audit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans" suppressHydrationWarning>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={selectedPeriod ? 8 : 9} className="py-8 text-center text-slate-400 text-xs">
                  No contributing projects match the selected criteria.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => (
                <tr
                  key={`${row.projectId}-${row.periodKey}-${idx}`}
                  onClick={() => handleRowClick(row.projectId)}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  suppressHydrationWarning
                >
                  <td className="py-3 px-4" suppressHydrationWarning>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5" suppressHydrationWarning>
                      <span className="font-mono text-brand">#{row.projectNumber}</span>
                      <span className="truncate max-w-[200px]">{row.projectName}</span>
                    </div>
                  </td>

                  <td className="py-3 px-3 text-slate-600 dark:text-slate-400 truncate max-w-[140px]" suppressHydrationWarning>
                    {row.clientName}
                  </td>

                  <td className="py-3 px-3 text-slate-600 dark:text-slate-400" suppressHydrationWarning>
                    {row.projectManager}
                  </td>

                  {!selectedPeriod && (
                    <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300" suppressHydrationWarning>
                      {row.periodLabel}
                    </td>
                  )}

                  <td className="py-3 px-3 text-right font-bold text-brand" suppressHydrationWarning>
                    {Math.round(row.allocatedHours * 10) / 10}h
                  </td>

                  <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-400 font-mono" suppressHydrationWarning>
                    {Math.round(row.totalForecastRemaining * 10) / 10}h
                  </td>

                  <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400" suppressHydrationWarning>
                    {row.deliveryDate || 'No date'}
                  </td>

                  <td className="py-3 px-3" suppressHydrationWarning>
                    {getMethodBadge(row.allocationMethod, row.isOverdue, row.isCompressedWindow)}
                  </td>

                  <td className="py-3 px-4 text-center" suppressHydrationWarning>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(row.projectId);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-brand hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Inspect project details"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
