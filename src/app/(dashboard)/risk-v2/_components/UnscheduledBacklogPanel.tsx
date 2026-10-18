"use client";

import React, { useState } from "react";
import { BacklogSummary, ProjectV2Demand } from "@/lib/risk-v2/types";
import { 
  CalendarClock, 
  HelpCircle, 
  AlertCircle, 
  Users, 
  DollarSign, 
  Hourglass, 
  Search,
  Building2,
  Calendar
} from "lucide-react";

interface UnscheduledBacklogPanelProps {
  unscheduled2030: BacklogSummary;
  unscheduledMissingDate: BacklogSummary;
  onSelectProject: (project: ProjectV2Demand) => void;
}

export function UnscheduledBacklogPanel({
  unscheduled2030,
  unscheduledMissingDate,
  onSelectProject,
}: UnscheduledBacklogPanelProps) {
  const [subTab, setSubTab] = useState<'2030' | 'missing'>('2030');
  const [search, setSearch] = useState("");

  const currentSummary = subTab === '2030' ? unscheduled2030 : unscheduledMissingDate;

  const formatHours = (h: number) => Math.round(h).toLocaleString() + " hrs";
  const formatCurrency = (val: number) => "$" + Math.round(val).toLocaleString();

  const filteredProjects = currentSummary.projects.filter(p =>
    p.projectNumber.toLowerCase().includes(search.toLowerCase()) ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.clientName.toLowerCase().includes(search.toLowerCase()) ||
    p.projectManager.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Informational Banner */}
      <div className="bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-400 mt-0.5">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-purple-950 dark:text-purple-200">
              Unscheduled Project Backlog
            </h3>
            <p className="text-xs text-purple-800 dark:text-purple-300 mt-1 max-w-4xl leading-relaxed">
              In WorkGuru, <strong>December 2030</strong> is the standard convention used for won contracts that have not yet been sequenced onto the physical production calendar. 
              The V2 forecasting engine preserves these WorkGuru dates but <strong>strictly excludes them</strong> from monthly/weekly workshop utilisation metrics so standard capacity is not distorted.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs between Dec 2030 and Missing Date */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setSubTab('2030')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            subTab === '2030'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          December 2030 Placeholder ({unscheduled2030.projectCount})
        </button>

        <button
          onClick={() => setSubTab('missing')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            subTab === 'missing'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Missing Delivery Dates ({unscheduledMissingDate.projectCount})
        </button>
      </div>

      {/* Summary Stats for active subtab */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Projects</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {currentSummary.projectCount}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Contract Value</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {formatCurrency(currentSummary.totalContractValue)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Budget Hours</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {formatHours(currentSummary.totalBudgetHours)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Forecast Remaining</div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
            {formatHours(currentSummary.totalForecastRemainingHours)}
          </div>
        </div>
      </div>

      {/* PM Breakdown Cards */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-600" />
          <span>Project Manager Portfolio Breakdown</span>
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(currentSummary.pmBreakdown).map(([pm, stats]) => (
            <div key={pm} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{pm}</div>
              <div className="text-[11px] text-slate-500 mt-1">{stats.count} projects</div>
              <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 mt-0.5">
                {formatHours(stats.hours)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {formatCurrency(stats.value)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Backlog Projects List
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Awaiting confirmed factory scheduling dates before being drawn into forward workshop capacity.
            </p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search backlog..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none w-56"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-3">Client</th>
                <th className="py-3 px-3">PM</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">WorkGuru Delivery Date</th>
                <th className="py-3 px-3 text-right">Remaining Demand</th>
                <th className="py-3 px-3 text-right">Contract Value</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-slate-400">
                    No projects found in this backlog category.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => onSelectProject(p)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="font-mono text-purple-600 dark:text-purple-400">#{p.projectNumber}</span>
                        <span className="truncate max-w-[200px]">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 truncate max-w-[140px]">
                      {p.clientName}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {p.projectManager}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {p.normalizedStatus}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                      {p.deliveryDate ? (
                        <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold">
                          {p.deliveryDate}
                        </span>
                      ) : (
                        <span className="text-rose-500 font-semibold">Missing Date</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-brand">
                      {formatHours(p.forecastRemainingHours)}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                      {formatCurrency(p.contractValue)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProject(p);
                        }}
                        className="px-2 py-1 text-[11px] font-semibold text-brand hover:underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
