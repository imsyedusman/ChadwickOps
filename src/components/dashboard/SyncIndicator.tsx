'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getLatestSyncStatus } from '@/app/actions/sync';
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

  const handleSync = async () => {
    if (isSyncing || isSyncingGlobal) return;
    
    setIsSyncing(true);
    
    try {
      const { triggerSync } = await import('@/app/actions/sync');
      const result = await triggerSync();
      if (result.success) {
        await fetchStatus();
      }
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setIsSyncing(false);
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
    }
  }, [isSyncingGlobal, isSyncing]);

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
            {isSyncingGlobal ? "Syncing..." : isSuccess ? "Status: Operational" : isFailure ? "Sync Failed" : "Sync Warning"}
          </span>
          {syncStatus && (
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none tabular-nums">
              Manual Sync Only
            </span>
          )}
        </div>
      </div>

      {syncStatus?.details && (
        <>
          <div className="h-4 w-[1px] bg-slate-100 dark:bg-slate-800 mx-1" />
          <div className="hidden md:flex items-center gap-1 max-w-[250px] truncate">
            <span className={cn(
               "text-[9px] font-bold truncate",
               isFailure ? "text-red-500" : isWarning ? "text-amber-500" : "text-slate-500"
            )}>
              {syncStatus.details}
            </span>
          </div>
        </>
      )}

      <button 
        onClick={handleSync}
        className={cn(
            "ml-auto px-3 py-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-800 hover:bg-brand/10 hover:text-brand border border-slate-200 dark:border-slate-700 rounded-lg transition-all active:scale-95 disabled:opacity-50 group",
            (isSyncing || isSyncingGlobal) && "animate-pulse"
        )}
        disabled={isSyncing || isSyncingGlobal}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Sync Now</span>
        <RefreshCw className={cn(
          "h-3 w-3 text-slate-400 group-hover:text-brand transition-colors",
          (isSyncing || isSyncingGlobal) && "animate-spin text-brand"
        )} />
      </button>
    </div>
  );
}
