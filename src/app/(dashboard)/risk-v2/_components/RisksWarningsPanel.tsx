"use client";

import React, { useState } from "react";
import { PeriodForecast, ProjectV2Demand } from "@/lib/risk-v2/types";
import { 
  AlertTriangle, 
  ClockAlert, 
  AlertCircle, 
  HelpCircle, 
  CalendarX, 
  TrendingDown, 
  Info,
  DollarSign,
  FileCheck2,
  Flame,
  CheckCircle2,
  ExternalLink
} from "lucide-react";

interface RisksWarningsPanelProps {
  periods: PeriodForecast[];
  allProjects: ProjectV2Demand[];
  onSelectProject: (project: ProjectV2Demand) => void;
  initialSubtab?: string;
}

export function RisksWarningsPanel({
  periods,
  allProjects,
  onSelectProject,
  initialSubtab = 'manufacturing',
}: RisksWarningsPanelProps) {
  const [overdueView, setOverdueView] = useState<'manufacturing' | 'zero_remaining' | 'closeout'>(
    initialSubtab === 'closeout' ? 'closeout' : 'manufacturing'
  );

  const overloadedPeriods = periods.filter((p) => p.isOverloaded);
  const atRiskPeriods = periods.filter((p) => p.isAtRisk);

  // 3-Way Overdue / Review Separation
  const overdueManufacturing = allProjects.filter(
    (p) => p.category === 'overdue_manufacturing' || (p.category === 'overdue' && p.forecastRemainingHours > 0)
  );
  const overdueZeroRemaining = allProjects.filter(
    (p) => p.category === 'overdue_zero_remaining' || (p.category === 'overdue' && p.forecastRemainingHours === 0)
  );
  const administrativeCloseout = allProjects.filter(
    (p) => p.category === 'administrative_closeout'
  );

  const compressedProjects = allProjects.filter((p) => p.isCompressedWindow);
  const overBudgetProjects = allProjects.filter((p) => p.isOverBudget);
  const missingBudgetProjects = allProjects.filter((p) => p.hasMissingBudget);

  const formatHours = (h: number) => Math.round(h * 10) / 10 + " hrs";
  const formatCurrency = (val: number) => "$" + Math.round(val).toLocaleString();

  return (
    <div className="space-y-6" suppressHydrationWarning>
      {/* 1A. Overloaded Periods Warning (>100% Demand) */}
      {overloadedPeriods.length > 0 && (
        <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-rose-950 dark:text-rose-200 flex items-center gap-2">
                <span>Critical: Overloaded Working Periods ({overloadedPeriods.length})</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-200/80 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold">
                  Demand &gt; 100% Capacity
                </span>
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                Forecast demand exceeds workshop net capacity. Production resequencing, overtime, or temporary capacity adjustments required.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            {overloadedPeriods.map((p) => (
              <div
                key={p.periodKey}
                className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/40 shadow-2xs"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{p.label}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
                    {p.utilisationPercent}% Utilised
                  </span>
                </div>
                <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400 mt-2">
                  <div className="flex justify-between">
                    <span>Demand:</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">{formatHours(p.demandHours)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Net Capacity:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{formatHours(p.netCapacityHours)}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-rose-600">Capacity Shortfall:</span>
                    <span className="text-rose-600">-{formatHours(Math.abs(p.shortfallOrSurplusHours))}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                    <span>Unallocated Overload:</span>
                    <span className="font-semibold">{formatHours(p.unallocatedDemandHours || 0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1B. At Risk Periods Warning */}
      {atRiskPeriods.length > 0 && (
        <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-950 dark:text-amber-200 flex items-center gap-2">
                <span>At Risk Working Periods ({atRiskPeriods.length})</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900 text-amber-800 dark:text-amber-200 font-bold">
                  Near Capacity Limit
                </span>
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Period demand is close to total net capacity. Minor job variations or material delays could push these periods into overload.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            {atRiskPeriods.map((p) => (
              <div
                key={p.periodKey}
                className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/40 shadow-2xs"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{p.label}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                    {p.utilisationPercent}% Utilised
                  </span>
                </div>
                <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400 mt-2">
                  <div className="flex justify-between">
                    <span>Demand:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{formatHours(p.demandHours)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Net Capacity:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{formatHours(p.netCapacityHours)}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-amber-700 dark:text-amber-400">Remaining Buffer:</span>
                    <span className="text-amber-700 dark:text-amber-400">+{formatHours(p.shortfallOrSurplusHours)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Overdue & Operational Review Workload (Separated Tabs) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <ClockAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Overdue & Operational Review Pipeline
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Segmented by physical manufacturing demand versus commercial/administrative review.
              </p>
            </div>
          </div>

          {/* Subtab Segmented Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold self-start sm:self-auto">
            <button
              onClick={() => setOverdueView('manufacturing')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                overdueView === 'manufacturing'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Manufacturing Demand</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px]">
                {overdueManufacturing.length}
              </span>
            </button>

            <button
              onClick={() => setOverdueView('zero_remaining')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                overdueView === 'zero_remaining'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>0h Remaining (PM Review)</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px]">
                {overdueZeroRemaining.length}
              </span>
            </button>

            <button
              onClick={() => setOverdueView('closeout')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                overdueView === 'closeout'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Invoiced / Closeout</span>
              <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px]">
                {administrativeCloseout.length}
              </span>
            </button>
          </div>
        </div>

        {/* Subtab 1: Overdue Manufacturing Demand */}
        {overdueView === 'manufacturing' && (
          <div>
            <div className="mb-3 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Active Shop-Floor Workload ({overdueManufacturing.length} projects, {formatHours(overdueManufacturing.reduce((acc, p) => acc + p.forecastRemainingHours, 0))}): </span>
                These projects have past delivery dates and outstanding calculated hours. They represent genuine shop-floor labour waiting to be completed. 
                Allocated forward from today at the provisional intake rate.
              </div>
            </div>

            <ProjectTable 
              projects={overdueManufacturing} 
              onSelectProject={onSelectProject} 
              showDaysOverdue={true}
              formatHours={formatHours}
              formatCurrency={formatCurrency}
            />
          </div>
        )}

        {/* Subtab 2: Overdue with 0h Remaining */}
        {overdueView === 'zero_remaining' && (
          <div>
            <div className="mb-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Operational Review Required ({overdueZeroRemaining.length} projects): </span>
                These projects have past delivery dates in WorkGuru, but their calculated remaining labour is 0h (either timesheet actuals exceeded budget or no task budget was set).
                <strong className="block mt-0.5 text-slate-900 dark:text-white">Do not assume zero hours means physical completion. PMs must verify if more work is required or update project dates/budgets.</strong>
              </div>
            </div>

            <ProjectTable 
              projects={overdueZeroRemaining} 
              onSelectProject={onSelectProject} 
              showDaysOverdue={true}
              formatHours={formatHours}
              formatCurrency={formatCurrency}
            />
          </div>
        )}

        {/* Subtab 3: Administrative Closeout (Invoiced unarchived) */}
        {overdueView === 'closeout' && (
          <div>
            <div className="mb-3 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
              <FileCheck2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Administrative Closeout Candidates ({administrativeCloseout.length} projects): </span>
                These projects have status <span className="font-mono font-bold">3.1 - Invoiced</span> in WorkGuru but have not been marked Archived. 
                Commercial manufacturing is complete; they do not demand workshop labour. PM action required: verify final invoicing and archive in WorkGuru.
              </div>
            </div>

            <ProjectTable 
              projects={administrativeCloseout} 
              onSelectProject={onSelectProject} 
              showDaysOverdue={false}
              formatHours={formatHours}
              formatCurrency={formatCurrency}
            />
          </div>
        )}
      </div>

      {/* 3. Compressed Window Warnings */}
      {compressedProjects.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Compressed Delivery Windows ({compressedProjects.length})</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold">
                  Pace &gt; 1.5x Intake Benchmark
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Jobs with tight delivery deadlines requiring an intake rate significantly exceeding benchmark workshop throughput.
              </p>
            </div>
          </div>

          <ProjectTable 
            projects={compressedProjects} 
            onSelectProject={onSelectProject} 
            showDaysOverdue={false}
            formatHours={formatHours}
            formatCurrency={formatCurrency}
          />
        </div>
      )}

      {/* 4. Missing Budget Warnings */}
      {missingBudgetProjects.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Missing Task Budgets ({missingBudgetProjects.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Active projects with 0 budgeted hours recorded in WorkGuru. Labour demand cannot be accurately modeled until task budgets are entered.
              </p>
            </div>
          </div>

          <ProjectTable 
            projects={missingBudgetProjects} 
            onSelectProject={onSelectProject} 
            showDaysOverdue={false}
            formatHours={formatHours}
            formatCurrency={formatCurrency}
          />
        </div>
      )}
    </div>
  );
}

function ProjectTable({
  projects,
  onSelectProject,
  showDaysOverdue,
  formatHours,
  formatCurrency,
}: {
  projects: ProjectV2Demand[];
  onSelectProject: (p: ProjectV2Demand) => void;
  showDaysOverdue: boolean;
  formatHours: (h: number) => string;
  formatCurrency: (v: number) => string;
}) {
  if (projects.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-slate-400">
        No projects in this category.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800" suppressHydrationWarning>
      <table className="w-full text-left text-xs border-collapse" suppressHydrationWarning>
        <thead>
          <tr className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800 font-semibold uppercase tracking-wider text-[11px]">
            <th className="py-3 px-4">Project</th>
            <th className="py-3 px-3">Client</th>
            <th className="py-3 px-3">PM</th>
            <th className="py-3 px-3">Status</th>
            <th className="py-3 px-3">Delivery Date</th>
            {showDaysOverdue && <th className="py-3 px-3">Days Overdue</th>}
            <th className="py-3 px-3 text-right">Remaining Demand</th>
            <th className="py-3 px-3 text-right">Contract Value</th>
            <th className="py-3 px-4 text-center">Audit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60" suppressHydrationWarning>
          {projects.map((proj) => (
            <tr
              key={proj.id}
              onClick={() => onSelectProject(proj)}
              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
              suppressHydrationWarning
            >
              <td className="py-3 px-4" suppressHydrationWarning>
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5" suppressHydrationWarning>
                  <span className="font-mono text-brand">#{proj.projectNumber}</span>
                  <span className="truncate max-w-[200px]">{proj.name}</span>
                </div>
              </td>
              <td className="py-3 px-3 text-slate-600 dark:text-slate-400 truncate max-w-[140px]" suppressHydrationWarning>
                {proj.clientName}
              </td>
              <td className="py-3 px-3 text-slate-600 dark:text-slate-400" suppressHydrationWarning>
                {proj.projectManager}
              </td>
              <td className="py-3 px-3" suppressHydrationWarning>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {proj.normalizedStatus}
                </span>
              </td>
              <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400" suppressHydrationWarning>
                {proj.deliveryDate || 'No date'}
              </td>
              {showDaysOverdue && (
                <td className="py-3 px-3" suppressHydrationWarning>
                  <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold text-[10px]">
                    +{proj.daysOverdue} days
                  </span>
                </td>
              )}
              <td className="py-3 px-3 text-right font-bold text-brand" suppressHydrationWarning>
                {formatHours(proj.forecastRemainingHours)}
              </td>
              <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-300" suppressHydrationWarning>
                {formatCurrency(proj.contractValue)}
              </td>
              <td className="py-3 px-4 text-center" suppressHydrationWarning>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProject(proj);
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-brand hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
