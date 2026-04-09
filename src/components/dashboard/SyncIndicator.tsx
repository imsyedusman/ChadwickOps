'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Clock, RefreshCw, Loader2, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getLatestSyncStatus, getSyncProgress } from '@/app/actions/sync';
import { cn } from '@/lib/utils';

interface SyncStatus {
  timestamp: Date;
  status: string;
  details: string | null;
}

export function SyncIndicator({ isSyncingGlobal }: { isSyncingGlobal?: boolean }) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
  
  // Placeholder for admin check
  const isAdmin = true; 


  const fetchStatus = async () => {
    const result = await getLatestSyncStatus();
    if (result.success && result.data) {
      setSyncStatus({
        ...result.data,
        timestamp: new Date(result.data.timestamp)
      });
    }
    setLoading(false);
  };

  const handleSync = async (mode: 'QUICK' | 'FULL') => {
    if (isSyncing || isSyncingGlobal) return;
    
    setIsSyncing(true);
    setCurrentStep("Initializing...");
    
    try {
      const { triggerQuickSync, triggerFullSync } = await import('@/app/actions/sync');
      
      setCurrentStep(mode === 'QUICK' ? "Syncing latest activity..." : "Performing full deep sync...");
      
      const result = mode === 'QUICK' ? await triggerQuickSync() : await triggerFullSync();
      
      if (result.success && result.stats) {
        const stats = result.stats;
        const msg = `${mode} Sync: ${stats.processedCount} success, ${stats.failedCount} failed.`;
        
        setCurrentStep(msg);
        await fetchStatus();
      } else {
        setCurrentStep(`Sync failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Manual sync failed:', error);
      setCurrentStep("Sync encountered a critical error.");
    } finally {
      setIsSyncing(false);
      // Keep result message for 5 seconds
      setTimeout(() => setCurrentStep(null), 5000);
    }
  };

  useEffect(() => {
    fetchStatus();
    // REMOVED: Automatic polling disabled to respect API limits
  }, []);

  // Also refetch when a global sync finishes
  useEffect(() => {
    if (!isSyncingGlobal && !isSyncing) {
      fetchStatus();
      setProgress(null);
    }
  }, [isSyncingGlobal, isSyncing]);

  // Polling for progress
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isSyncing || isSyncingGlobal) {
      interval = setInterval(async () => {
        const result = await getSyncProgress();
        if (result.success && result.active && result.progress) {
          setProgress({ 
            processed: result.progress.processed, 
            total: result.progress.total 
          });
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSyncing, isSyncingGlobal]);

  if (loading && !syncStatus) return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl h-10 animate-pulse">
      <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
    </div>
  );

  const isSuccess = syncStatus?.status === 'SUCCESS';
  const isWarning = syncStatus?.status === 'WARNING';
  const isFailure = syncStatus?.status === 'FAILED';

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-900 border rounded-2xl h-10 transition-all shadow-sm",
      isFailure ? "border-red-200 dark:border-red-900/40" : "border-slate-200/60 dark:border-slate-800/60"
    )}>
      <div className="flex items-center gap-2">
        {isSyncingGlobal ? (
          <Loader2 className="h-3.5 w-3.5 text-brand animate-spin" />
        ) : isSuccess ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        ) : isWarning ? (
          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
        )}
        
        <div className="flex flex-col">
          <span className={cn(
            "text-[9px] font-bold uppercase tracking-widest leading-none mb-0.5",
            isSyncingGlobal ? "text-brand" : 
            isSuccess ? "text-emerald-600 dark:text-emerald-400" : 
            isFailure ? "text-red-500" : "text-amber-500"
          )}>
            {isSyncingGlobal || isSyncing ? "Syncing..." : isSuccess ? "Status: Operational" : isFailure ? "Sync Failed" : "Sync Warning"}
          </span>
          {(isSyncing || isSyncingGlobal) && progress && (
            <span className="text-[9px] text-brand font-bold uppercase tracking-widest leading-none tabular-nums animate-pulse">
              Processing {progress.processed} / {progress.total}
            </span>
          )}
          {!isSyncing && !isSyncingGlobal && syncStatus && (
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none tabular-nums">
              Manual Sync Only
            </span>
          )}
        </div>
      </div>

      {syncStatus?.details && !isSyncing && !isSyncingGlobal && (
        <>
          <div className="h-4 w-[1px] bg-slate-100 dark:bg-slate-800 mx-1" />
          <div className="hidden md:flex items-center gap-1 max-w-[300px] truncate">
            <span className={cn(
               "text-[9px] font-bold truncate",
               isFailure ? "text-red-500" : isWarning ? "text-amber-500" : "text-slate-500"
            )}>
              {(() => {
                try {
                  const summary = JSON.parse(syncStatus.details || '{}');
                  if (summary.mode) {
                    return `${summary.mode}: ${summary.success} OK, ${summary.failed} FAIL`;
                  }
                  return syncStatus.details;
                } catch (e) {
                  return syncStatus.details;
                }
              })()}
            </span>
          </div>
        </>
      )}

      <div className="flex items-center gap-2 ml-auto">
        <button 
          onClick={() => handleSync('QUICK')}
          className={cn(
              "px-3 py-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-800 hover:bg-brand/10 hover:text-brand border border-slate-200 dark:border-slate-700 rounded-lg transition-all active:scale-95 disabled:opacity-50 group whitespace-nowrap",
              (isSyncing || isSyncingGlobal) && "opacity-50 pointer-events-none"
          )}
          disabled={isSyncing || isSyncingGlobal}
          title="Metadata update + 15 recent projects"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Quick Sync</span>
          <RefreshCw className={cn(
            "h-3 w-3 text-slate-400 group-hover:text-brand transition-colors",
            isSyncing && "animate-spin text-brand"
          )} />
        </button>

        {isAdmin && (
          <button 
            onClick={() => handleSync('FULL')}
            className={cn(
                "px-3 py-1 flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 hover:text-indigo-600 border border-indigo-200 dark:border-indigo-800/40 rounded-lg transition-all active:scale-95 disabled:opacity-50 group whitespace-nowrap",
                (isSyncing || isSyncingGlobal) && "opacity-50 pointer-events-none"
            )}
            disabled={isSyncing || isSyncingGlobal}
            title="Full Deep Sync (Resumable)"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Full (Admin)</span>
            <Activity className={cn(
              "h-3 w-3 text-indigo-400 group-hover:text-indigo-600 transition-colors",
              isSyncing && "animate-pulse text-indigo-500"
            )} />
          </button>
        )}
      </div>

      {currentStep && (
        <div className="absolute top-12 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 shadow-xl z-50 flex items-center gap-2 animate-in slide-in-from-top-2">
          <Loader2 className="h-3 w-3 text-brand animate-spin" />
          <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{currentStep}</span>
        </div>
      )}
    </div>
  );
}
