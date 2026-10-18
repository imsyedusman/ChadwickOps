"use client";

import React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { ProjectV2Demand } from "@/lib/risk-v2/types";
import { 
  Calculator, 
  Calendar, 
  User, 
  Building2, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Info 
} from "lucide-react";

interface ProjectDetailModalProps {
  project: ProjectV2Demand | null;
  actualsFactor: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectDetailModal({
  project,
  actualsFactor,
  isOpen,
  onClose,
}: ProjectDetailModalProps) {
  if (!project) return null;

  const formatHours = (h: number) => Math.round(h * 10) / 10 + " hrs";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-brand/10 text-brand border border-brand/20">
              #{project.projectNumber}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
              {project.normalizedStatus}
            </span>
            {project.category === 'overdue' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold">
                Overdue ({project.daysOverdue} days)
              </span>
            )}
            {project.category === 'unscheduled_2030' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-bold">
                Unscheduled Backlog
              </span>
            )}
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
            {project.name}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-4 pt-1">
            <span className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              {project.clientName}
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              PM: {project.projectManager}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Warnings list */}
        {project.warnings.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/50 space-y-1">
            <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Operational Notes & Review Flags
            </div>
            <ul className="list-disc list-inside text-xs text-amber-700 dark:text-amber-400 space-y-0.5 pl-1">
              {project.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Calculation Transparency Breakdown */}
        <div className="space-y-4">
          <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-brand" />
              Demand Calculation Formula
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">1. Raw Budget</div>
                <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {formatHours(project.budgetHours)}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">2. Raw Actual</div>
                <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {formatHours(project.actualHours)}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">
                  3. Adj. Actual (@ {Math.round(actualsFactor * 100)}%)
                </div>
                <div className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                  {formatHours(project.adjustedActualHours)}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-brand/5 dark:bg-brand/10 border border-brand/20 shadow-2xs">
                <div className="text-[10px] text-brand uppercase font-bold">4. Forecast Remaining</div>
                <div className="text-base font-bold text-brand mt-0.5">
                  {formatHours(project.forecastRemainingHours)}
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/40 dark:border-slate-700/40 font-mono">
              <div>• Adjusted Actual = {project.actualHours}h × {actualsFactor} = {project.adjustedActualHours}h</div>
              <div>• Calculated Remaining = {project.budgetHours}h − {project.adjustedActualHours}h = {project.calculatedRemainingHours}h</div>
              <div>• Forecast Demand = MAX(0, {project.calculatedRemainingHours}h) = <span className="font-bold text-slate-900 dark:text-white">{project.forecastRemainingHours}h</span></div>
            </div>
          </div>

          {/* Planning Window & Allocation Method */}
          <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              Workload Distribution Window
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Delivery Date</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {project.deliveryDate || 'Unscheduled'}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Allocation Method</div>
                <div className="text-xs font-bold text-slate-900 dark:text-white mt-1 capitalize">
                  {project.allocationMethod.replace('_', ' ')}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Window Working Shifts</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {project.windowWorkingDays ?? 'N/A'} shifts
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Required Daily Pace</div>
                <div className={`text-sm font-bold mt-0.5 ${project.isCompressedWindow ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                  {project.requiredDailyIntakeHours ? `${project.requiredDailyIntakeHours}h / shift` : 'N/A'}
                </div>
              </div>
            </div>

            {project.windowStartDate && project.windowEndDate && (
              <div className="mt-2 text-[11px] text-slate-500 flex justify-between items-center bg-white/40 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-200/40 dark:border-slate-700/40">
                <span>Planning Window: <strong className="font-mono text-slate-700 dark:text-slate-300">{project.windowStartDate} → {project.windowEndDate}</strong></span>
                {project.isCompressedWindow && (
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    ⚠ Compressed Window Pace
                  </span>
                )}
              </div>
            )}

            {/* Allocated hours by period */}
            {Object.keys(project.allocatedHoursPerPeriod).length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  Period Distribution Breakdown:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(project.allocatedHoursPerPeriod).map(([periodKey, hrs]) => (
                    <div key={periodKey} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/40 dark:border-slate-700/40 flex justify-between items-center text-xs">
                      <span className="font-mono text-slate-500">{periodKey}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{Math.round(hrs * 10) / 10}h</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
