"use client";

import { ShieldCheck, RefreshCw, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";

interface ProcurementIntegrityBannerProps {
  integrity: {
    hydratedCount: number;
    summaryOnlyCount: number;
    failedCount: number;
    totalCount: number;
  };
  syncHealth: {
    lastSyncAt: Date | null;
    lastStatus: string;
    retryQueueCount: number;
    permFailureCount: number;
  };
}

export function ProcurementIntegrityBanner({ integrity, syncHealth }: ProcurementIntegrityBannerProps) {
  const loadingPercent = integrity.totalCount > 0 
    ? Math.round((integrity.hydratedCount / integrity.totalCount) * 100) 
    : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-2 px-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/60 rounded-xl mb-4">
      {/* Title & Overall Status */}
      <div className="flex items-center gap-2 border-r border-slate-200 dark:border-slate-800 pr-6 h-6">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Data Status</h3>
        <span className={cn(
          "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight",
          loadingPercent === 100 ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
        )}>
          {loadingPercent}% Loaded
        </span>
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100">{integrity.hydratedCount}</span>
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">Fully Loaded</span>
        </div>

        <Tooltip 
            content={
                <div className="text-left">
                    <p className="font-bold mb-1">Still Loading</p>
                    <p>Purchase order exists but detailed material lines are still being downloaded from WorkGuru.</p>
                </div>
            }
        >
            <div className="flex items-center gap-1.5 cursor-help group">
              <span className={cn(
                "text-[11px] font-bold",
                integrity.summaryOnlyCount > 0 ? "text-amber-600" : "text-slate-400"
              )}>{integrity.summaryOnlyCount}</span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight group-hover:text-slate-700 dark:group-hover:text-slate-300">Still Loading</span>
              <Info className="h-3 w-3 text-slate-300" />
            </div>
        </Tooltip>

        {integrity.failedCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-red-600">{integrity.failedCount}</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">Failed To Load</span>
          </div>
        )}
      </div>

      {/* Sync Metadata / Retry Queue */}
      <div className="ml-auto flex items-center gap-4">
        {syncHealth.retryQueueCount > 0 && (
          <div className="flex items-center gap-2 bg-blue-500/5 px-2 py-1 rounded-lg border border-blue-500/10">
            <RefreshCw className="h-3 w-3 text-blue-500 animate-spin-slow" />
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">
              {syncHealth.retryQueueCount} Retrying
            </span>
          </div>
        )}
        
        <div className="flex items-center gap-1.5 text-slate-400">
          <ShieldCheck className={cn("h-3.5 w-3.5", loadingPercent === 100 ? "text-emerald-500" : "text-slate-300")} />
          <span className="text-[10px] font-medium tracking-tight">
            {loadingPercent === 100 ? "Sync Verified" : "Syncing..."}
          </span>
        </div>
      </div>
    </div>
  );
}
