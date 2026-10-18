"use client";

import React from "react";
import { 
  TrendingUp, 
  AlertTriangle, 
  CalendarClock, 
  Hourglass, 
  Users, 
  CheckCircle2, 
  HelpCircle,
  ClockAlert,
  CalendarDays,
  FileCheck2,
  Activity
} from "lucide-react";
import { RiskV2DashboardData } from "@/lib/risk-v2/types";

interface SummaryCardsProps {
  data: RiskV2DashboardData;
  onSelectTab?: (tab: string, subtab?: string) => void;
}

export function SummaryCards({ data, onSelectTab }: SummaryCardsProps) {
  const { summary, settings } = data;

  const formatHours = (hrs: number) => {
    return Math.round(hrs).toLocaleString() + " hrs";
  };

  const formatCurrency = (val: number) => {
    return "$" + Math.round(val).toLocaleString();
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4" suppressHydrationWarning>
      {/* 1. HERO KPI: Current Month Utilisation & Shortfall */}
      <div 
        onClick={() => onSelectTab && onSelectTab('overview')}
        className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between cursor-pointer transition-all ${
          summary.currentPeriod.isOverloaded
            ? 'border-rose-300 dark:border-rose-900/60 ring-2 ring-rose-500/10 hover:border-rose-400'
            : summary.currentPeriod.isAtRisk
            ? 'border-amber-300 dark:border-amber-900/60 hover:border-amber-400'
            : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Current Month ({summary.currentPeriod.label})
          </span>
          <div className={`p-1.5 rounded-xl ${
            summary.currentPeriod.isOverloaded
              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
              : summary.currentPeriod.isAtRisk
              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
          }`}>
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold tracking-tight ${
              summary.currentPeriod.isOverloaded 
                ? 'text-rose-600 dark:text-rose-400' 
                : summary.currentPeriod.isAtRisk 
                ? 'text-amber-600 dark:text-amber-400' 
                : 'text-slate-900 dark:text-white'
            }`}>
              {summary.currentPeriod.utilisationPercent}%
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
              summary.currentPeriod.isOverloaded
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/80 dark:text-rose-200'
                : summary.currentPeriod.isAtRisk
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/80 dark:text-amber-200'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/80 dark:text-emerald-200'
            }`}>
              {summary.currentPeriod.loadStatus}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Demand {formatHours(summary.currentPeriod.demandHours)} / Cap {formatHours(summary.currentPeriod.netCapacityHours)}
          </p>
          <p className={`text-[11px] font-bold mt-0.5 ${
            summary.currentPeriod.shortfallHours < 0 
              ? 'text-rose-600 dark:text-rose-400' 
              : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            {summary.currentPeriod.shortfallHours < 0 
              ? `Shortfall: ${formatHours(Math.abs(summary.currentPeriod.shortfallHours))}` 
              : `Surplus: +${formatHours(summary.currentPeriod.shortfallHours)}`}
          </p>
        </div>
      </div>

      {/* 2. Rolling Next 30 Days */}
      <div className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all ${
        summary.next30Days.isOverloaded
          ? 'border-rose-200 dark:border-rose-900/40'
          : summary.next30Days.isAtRisk
          ? 'border-amber-200 dark:border-amber-900/40'
          : 'border-slate-200/80 dark:border-slate-800'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Rolling 30 Days
          </span>
          <div className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <CalendarDays className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold tracking-tight ${
              summary.next30Days.isOverloaded 
                ? 'text-rose-600 dark:text-rose-400' 
                : summary.next30Days.isAtRisk 
                ? 'text-amber-600 dark:text-amber-400' 
                : 'text-slate-900 dark:text-white'
            }`}>
              {summary.next30Days.utilisationPercent}%
            </span>
            <span className="text-xs text-slate-400 font-medium">
              ({summary.next30Days.workingDaysCount} working shifts)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Demand {formatHours(summary.next30Days.demandHours)} / Cap {formatHours(summary.next30Days.netCapacityHours)}
          </p>
          <p className={`text-[11px] font-bold mt-0.5 ${
            summary.next30Days.shortfallHours < 0 
              ? 'text-rose-600 dark:text-rose-400' 
              : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            {summary.next30Days.shortfallHours < 0 
              ? `Shortfall: ${formatHours(Math.abs(summary.next30Days.shortfallHours))}` 
              : `Buffer: +${formatHours(summary.next30Days.shortfallHours)}`}
          </p>
        </div>
      </div>

      {/* 3. Peak Overloaded Period */}
      <div 
        onClick={() => onSelectTab && onSelectTab('risks')}
        className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-all"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Peak Bottleneck
          </span>
          <div className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {summary.peakPeriod.label}
            </span>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
              {summary.peakPeriod.utilisationPercent}%
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Demand {formatHours(summary.peakPeriod.demandHours)} / Cap {formatHours(summary.peakPeriod.netCapacityHours)}
          </p>
          <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">
            Shortfall: {formatHours(Math.abs(summary.peakPeriod.shortfallHours))}
          </p>
        </div>
      </div>

      {/* 4. Overdue Manufacturing Demand */}
      <div 
        onClick={() => onSelectTab && onSelectTab('risks', 'manufacturing')}
        className="bg-white dark:bg-slate-900 border border-amber-200/90 dark:border-amber-900/50 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between cursor-pointer hover:border-amber-300 transition-all"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Overdue Manufacturing
          </span>
          <div className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <ClockAlert className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {summary.overdueManufacturing.count} Jobs
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-bold">
              ({formatHours(summary.overdueManufacturing.hours)})
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Active shop-floor demand past due
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Value: {formatCurrency(summary.overdueManufacturing.contractValue)}
          </p>
        </div>
      </div>

      {/* 5. Operational Review & Closeout */}
      <div 
        onClick={() => onSelectTab && onSelectTab('risks', 'closeout')}
        className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-all"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Review & Closeout
          </span>
          <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            <FileCheck2 className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {summary.administrativeCloseout.count + summary.overdueZeroRemaining.count} Jobs
            </span>
            <span className="text-xs text-slate-400 font-medium">
              (0h demand)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {summary.administrativeCloseout.count} Invoiced + {summary.overdueZeroRemaining.count} PM Review
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Value: {formatCurrency(summary.administrativeCloseout.contractValue + summary.overdueZeroRemaining.contractValue)}
          </p>
        </div>
      </div>

      {/* 6. Secondary Metric: 6-Month Pipeline Ratio */}
      <div 
        onClick={() => onSelectTab && onSelectTab('overview')}
        className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-all"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            6M Pipeline Ratio
          </span>
          <div className="p-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {summary.sixMonthPipeline.utilisationPercent}%
            </span>
            {summary.sixMonthPipeline.isFrontLoaded && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                Front-Loaded
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium truncate" title={summary.sixMonthPipeline.characterization}>
            {summary.sixMonthPipeline.isFrontLoaded 
              ? 'Near-term overload; spare Q1 2027 cap' 
              : 'Across 6-month forward horizon'}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {formatHours(summary.sixMonthPipeline.totalDemandHours)} / {formatHours(summary.sixMonthPipeline.totalNetCapacityHours)}
          </p>
        </div>
      </div>
    </div>
  );
}
