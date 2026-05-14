'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, Loader2, Package, Truck, Info } from 'lucide-react';
import { getLatestProcurementSyncStatus, getProcurementSyncProgress, triggerProcurementSync } from '@/app/actions/procurement-sync';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SyncStatus {
  timestamp: Date;
  status: string;
  details: string | null;
}

export function ProcurementSyncStatus({ initialProgress }: { initialProgress?: any }) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(initialProgress?.active || false);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; percent: number; lastPo: string } | null>(initialProgress?.progress || null);
  const [integrityStats, setIntegrityStats] = useState<{ summaryOnlyCount: number, failedCount: number } | null>(null);
  
  const isAdmin = true; 

  const fetchStatus = async () => {
    const result = await getLatestProcurementSyncStatus();
    if (result.success && result.data) {
      setSyncStatus({
        ...result.data,
        timestamp: new Date(result.data.timestamp)
      });
    }
    if (result.success && result.stats) {
        setIntegrityStats(result.stats);
    }
    setLoading(false);
  };

  const handleSync = async (mode: 'INCREMENTAL' | 'FULL' | 'RETRY_FAILED') => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    setCurrentStep("Initializing Procurement Sync...");
    
    try {
      const result = await triggerProcurementSync(mode);
      
      if (result.success && result.stats) {
        const stats = result.stats;
        toast.success(`Procurement Sync Complete: ${stats.processedCount} POs processed.`);
        await fetchStatus();
      } else {
        toast.error(`Sync failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Procurement sync failed:', error);
      toast.error("Sync encountered a critical error.");
    } finally {
      setIsSyncing(false);
      setCurrentStep(null);
      setProgress(null);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, []);

  // Polling for progress
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isSyncing) {
      interval = setInterval(async () => {
        const result = await getProcurementSyncProgress();
        if (result.success && result.active && result.progress) {
          setProgress(result.progress);
          setCurrentStep(`Updating details for PO ${result.progress.lastPo}...`);
        } else if (result.success && !result.active && isSyncing) {
            // Sync finished in background
            setIsSyncing(false);
            setProgress(null);
            setCurrentStep(null);
            await fetchStatus();
        }
      }, 1500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSyncing]);

  if (loading && !syncStatus) return null;

  const isSuccess = syncStatus?.status === 'SUCCESS';
  const isPartial = syncStatus?.status === 'PARTIAL';
  const isFailure = syncStatus?.status === 'FAILURE';

  // Extract metrics from details if available or from new fields
  const stats = syncStatus as any;

  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        "flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-900 border rounded-2xl h-10 transition-all shadow-sm group/sync",
        isSyncing ? "border-brand/40 ring-4 ring-brand/5" : 
        isPartial ? "border-amber-200 bg-amber-50/10" :
        "border-slate-200/60 dark:border-slate-800/60"
      )}>
        <div className="flex items-center gap-2">
          {isSyncing ? (
            <Loader2 className="h-3.5 w-3.5 text-brand animate-spin" />
          ) : isSuccess ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          ) : isPartial ? (
            <Info className="h-3.5 w-3.5 text-amber-500" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
          )}
          
          <div className="flex flex-col min-w-[120px]">
            <span className={cn(
              "text-[9px] font-bold uppercase tracking-widest leading-none mb-0.5",
              isSyncing ? "text-brand" : isPartial ? "text-amber-600" : "text-slate-500"
            )}>
              {isSyncing ? "Syncing Procurement" : isPartial ? "Last sync completed with missing PO details" : "Procurement Data"}
            </span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none tabular-nums">
              {isSyncing && progress ? (
                <span className="text-brand animate-pulse">
                  {progress.percent}% ({progress.current}/{progress.total})
                </span>
              ) : syncStatus ? (
                <div className="flex items-center gap-1.5">
                   <span>{syncStatus.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                   {stats.totalFailed > 0 && (
                       <span className="text-red-500 font-bold">({stats.totalFailed} MISSING DETAILS)</span>
                   )}
                </div>
              ) : (
                "Not Synced"
              )}
            </span>
          </div>

          {!isSyncing && syncStatus && (
              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 text-white text-[11px] rounded-xl opacity-0 group-hover/sync:opacity-100 pointer-events-none transition-all z-50 shadow-2xl border border-slate-800 leading-relaxed">
                  <p className="font-bold text-slate-300 mb-1.5 uppercase tracking-widest text-[9px]">Last Sync Details</p>
                  <div className="grid grid-cols-2 gap-y-1 gap-x-4">
                      <span className="text-slate-400">Status:</span>
                      <span className={cn("font-bold", isSuccess ? "text-emerald-400" : "text-amber-400")}>{syncStatus.status === 'PARTIAL' ? 'Incomplete' : syncStatus.status}</span>
                      
                      <span className="text-slate-400">Fetched:</span>
                      <span className="font-bold">{stats.totalFetched || 0} POs</span>
                      
                      <span className="text-slate-400">Details Loaded:</span>
                      <span className="font-bold text-emerald-400">{stats.totalHydrated || 0}</span>
                      
                      <span className="text-slate-400">Failed:</span>
                      <span className={cn("font-bold", stats.totalFailed > 0 ? "text-red-400" : "text-slate-300")}>{stats.totalFailed || 0}</span>
                      
                      {stats.retryCount > 0 && (
                          <>
                              <span className="text-slate-400">Retries:</span>
                              <span className="font-bold text-blue-400">{stats.retryCount}</span>
                          </>
                      )}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500 border-t border-slate-800 pt-2">{syncStatus.details?.replace(/Hydrated/g, 'Details Loaded')}</p>
              </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button 
            onClick={() => handleSync('INCREMENTAL')}
            className={cn(
                "px-3 py-1.5 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-brand/10 hover:text-brand border border-slate-200 dark:border-slate-700 rounded-lg transition-all active:scale-95 disabled:opacity-50 group whitespace-nowrap",
                isSyncing && "opacity-50 pointer-events-none"
            )}
            disabled={isSyncing}
            title="Sync recent procurement data"
          >
            <RefreshCw className={cn(
              "h-3 w-3 text-slate-400 group-hover:text-brand transition-colors",
              isSyncing && "animate-spin text-brand"
            )} />
          </button>
          
          <div className="relative group">
             <button 
               onClick={() => {
                 if(confirm("Full Rebuild will re-sync ALL project purchase orders. This may take several minutes. Continue?")) {
                   handleSync('FULL');
                 }
               }}
               className={cn(
                   "px-2 py-1.5 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 hover:bg-amber-500/10 hover:text-amber-600 border border-slate-200 dark:border-slate-700 rounded-lg transition-all active:scale-95 disabled:opacity-50",
                   isSyncing && "opacity-50 pointer-events-none"
               )}
               disabled={isSyncing}
             >
               <Truck className="h-3 w-3" />
             </button>
             <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 shadow-xl border border-slate-800">
                <p className="font-bold mb-1 flex items-center gap-1"><Info className="h-3 w-3" /> Full Rebuild Mode</p>
                Re-syncs line items for all active projects. Use only if data drift is detected.
             </div>
          </div>

          <div className="relative group">
             <button 
               onClick={() => handleSync('RETRY_FAILED')}
               className={cn(
                   "px-2 py-1.5 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 hover:bg-red-500/10 hover:text-red-600 border border-slate-200 dark:border-slate-700 rounded-lg transition-all active:scale-95 disabled:opacity-50",
                   (isSyncing || (!integrityStats || (integrityStats.failedCount === 0 && integrityStats.summaryOnlyCount === 0))) && "opacity-50 pointer-events-none"
               )}
               disabled={isSyncing || (!integrityStats || (integrityStats.failedCount === 0 && integrityStats.summaryOnlyCount === 0))}
             >
               <AlertCircle className="h-3 w-3" />
             </button>
             <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 shadow-xl border border-slate-800">
                <p className="font-bold mb-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Retry Failed Only</p>
                Attempts to load missing details for failed or incomplete purchase orders.
             </div>
          </div>
        </div>
      </div>

      {isSyncing && progress && (
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-brand/5 border border-brand/20 rounded-xl animate-in slide-in-from-left-2">
           <span className="text-[10px] font-bold text-brand uppercase tracking-tighter truncate max-w-[150px]">
             Updating: {progress.lastPo}
           </span>
        </div>
      )}
    </div>
  );
}
