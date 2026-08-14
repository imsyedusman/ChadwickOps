'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { triggerProfitabilitySync } from '@/app/actions/profitability';
import { toast } from 'sonner';

export function ProfitabilitySyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);

  async function handleSync() {
    setIsSyncing(true);
    const loadingToastId = toast.loading('Syncing profitability data from WorkGuru...', {
      description: 'This may take a moment as we fetch both active and historical projects.'
    });

    try {
      const result = await triggerProfitabilitySync();
      
      if (result.success) {
        toast.success('Profitability sync complete', {
          id: loadingToastId,
          description: `Active: ${result.stats?.activeProcessed || 0} | Historical: ${result.stats?.historicalProcessed || 0}`
        });
      } else {
        toast.error('Sync failed', {
          id: loadingToastId,
          description: result.error
        });
      }
    } catch (err: any) {
      toast.error('Sync failed', {
        id: loadingToastId,
        description: err.message
      });
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <button 
      onClick={handleSync}
      disabled={isSyncing}
      className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
      {isSyncing ? 'Syncing...' : 'Sync Profitability'}
    </button>
  );
}
