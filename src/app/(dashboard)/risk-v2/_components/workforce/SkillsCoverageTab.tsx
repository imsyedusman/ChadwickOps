"use client";

import React from "react";
import { 
  StageSkillCoverage, 
  WorkshopEmployee 
} from "@/lib/risk-v2/workforce";
import { 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Award, 
  Users, 
  Zap 
} from "lucide-react";

interface SkillsCoverageTabProps {
  stageSkillCoverage: StageSkillCoverage[];
  totalActiveStaffCount: number;
  totalNetAvailableHours: number;
}

export function SkillsCoverageTab({
  stageSkillCoverage,
  totalActiveStaffCount,
  totalNetAvailableHours,
}: SkillsCoverageTabProps) {
  return (
    <div className="space-y-6">
      {/* Critical Anti-Double-Counting Warning Banner */}
      <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/60 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-950 dark:text-blue-200 space-y-1">
          <div className="font-bold">Important Capacity Planning Principle:</div>
          <div>
            The potential hours shown below represent <strong>qualified bench depth</strong> — i.e., how much available labor <em>could</em> be directed to a stage if needed.
          </div>
          <div className="text-[11px] text-blue-800 dark:text-blue-300 font-semibold">
            Stage-specific potential capacities must <u>never</u> be added together into a single total, because multi-skilled workers cannot simultaneously build frames, bend busbars, and wire panels. Total factory capacity is strictly constrained by actual individual roster clock hours ({totalNetAvailableHours}h across {totalActiveStaffCount} active workers).
          </div>
        </div>
      </div>

      {/* Stage Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stageSkillCoverage.map(stage => {
          const isShortage = stage.qualifiedStaffCount <= 2;
          const isDeep = stage.qualifiedStaffCount >= 6;

          return (
            <div 
              key={stage.stageKey}
              className={`rounded-2xl border p-4 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between ${
                isShortage 
                  ? 'border-amber-200 dark:border-amber-900/50' 
                  : 'border-slate-200/80 dark:border-slate-800'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="font-bold text-xs text-slate-900 dark:text-white">
                      {stage.stageName}
                    </h3>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Bench Depth: <strong className={isShortage ? 'text-amber-600' : 'text-slate-700 dark:text-slate-200'}>
                        {stage.qualifiedStaffCount} qualified staff
                      </strong>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                      {stage.potentialQualifiedHours}h
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Potential Pool
                    </div>
                  </div>
                </div>

                {/* Qualified Staff List */}
                <div className="mt-3 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Qualified Personnel & Pace Ratings
                  </div>
                  {stage.qualifiedStaff.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400">
                      No staff currently rated for this stage.
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {stage.qualifiedStaff.map(staff => (
                        <div 
                          key={staff.staffId}
                          className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs"
                        >
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                            {staff.fullName}
                          </span>
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                            {(staff.rating * 100).toFixed(0)}% pace
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer status */}
              <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] flex items-center justify-between">
                {isShortage ? (
                  <span className="text-amber-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Thin Bench (Bottleneck Risk)
                  </span>
                ) : isDeep ? (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Solid Bench Depth
                  </span>
                ) : (
                  <span className="text-slate-500 font-medium">
                    Moderate Coverage
                  </span>
                )}
                <span className="text-slate-400 font-mono">
                  {((stage.qualifiedStaffCount / (totalActiveStaffCount || 1)) * 100).toFixed(0)}% of roster
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
