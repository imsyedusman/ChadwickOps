'use client';

import { useState } from 'react';
import { triggerInvoiceSync } from '@/app/actions/invoice-sync';
import { RefreshCw, Receipt } from 'lucide-react';
import { toast } from 'sonner';

interface InvoiceSyncButtonProps {
  lastSyncedText: string;
  onSuccess?: () => void;
}

export function InvoiceSyncButton({ lastSyncedText, onSuccess }: InvoiceSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    const toastId = toast.loading('Syncing invoices from WorkGuru...');
    
    try {
      const result = await triggerInvoiceSync();
      
      if (result.success && result.stats) {
        toast.success(
          `Invoice Sync Complete`, 
          { 
            id: toastId,
            description: `Fetched ${result.stats.fetched} invoices. Upserted ${result.stats.upserted}.`
          }
        );
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error('Invoice Sync Failed', { 
          id: toastId,
          description: result.error || 'Unknown error occurred'
        });
      }
    } catch (error) {
      toast.error('Invoice Sync Failed', { 
        id: toastId,
        description: 'An unexpected error occurred'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/50">
      <span className="flex items-center gap-1.5 border-r border-slate-300 dark:border-slate-600 pr-2">
        <Receipt className="h-3 w-3 text-emerald-500" />
        Invoices: {lastSyncedText}
      </span>
      <button 
        onClick={handleSync}
        disabled={isSyncing}
        className="pl-1 hover:text-emerald-500 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin text-emerald-500' : ''}`} />
        {isSyncing ? 'Syncing...' : 'Sync Now'}
      </button>
    </div>
  );
}
