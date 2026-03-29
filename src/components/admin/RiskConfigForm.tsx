'use client';

import { useState } from 'react';
import { Activity, Save, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { updateRiskConfig } from '@/app/actions/sync';
import { RiskConfig } from '@/lib/risk';
import { cn } from '@/lib/utils';

interface RiskConfigFormProps {
  initialConfig: RiskConfig;
}

export function RiskConfigForm({ initialConfig }: RiskConfigFormProps) {
  const [config, setConfig] = useState<RiskConfig>(initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatus({ type: null, message: '' });

    try {
      const result = await updateRiskConfig(config);
      if (result.success) {
        setStatus({ type: 'success', message: 'Risk configuration updated successfully.' });
      } else {
        setStatus({ type: 'error', message: result.error || 'Failed to update configuration.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'An unexpected error occurred while saving.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
          <Activity className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Capacity & Risk Thresholds</h2>
      </div>
      <p className="text-xs text-slate-400 font-medium leading-relaxed">
        Adjust the total daily labor capacity and the utilization threshold for risk assessment.
      </p>
      
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Total Daily Labour Capacity</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.5"
                  value={config.dailyCapacity}
                  onChange={(e) => setConfig({ ...config, dailyCapacity: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand outline-none transition-all" 
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">Hours / Day</span>
              </div>
              <p className="text-[10px] text-slate-400 italic ml-1 leading-relaxed">
                Sum of all available labor hours per business day (e.g., 5 workers × 7.5 hrs = 37.5).
              </p>
           </div>
           
           <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Risk Threshold (%)</label>
              <div className="relative">
                <input 
                  type="number" 
                  min="1" 
                  max="100"
                  value={config.riskThreshold}
                  onChange={(e) => setConfig({ ...config, riskThreshold: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-brand outline-none transition-all" 
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span>
              </div>
              <p className="text-[10px] text-slate-400 italic ml-1 leading-relaxed">
                Jobs exceeding this utilization percentage are flagged as "At Risk".
              </p>
           </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-start gap-3">
           <Info className="h-4 w-4 text-brand mt-0.5 shrink-0" />
           <div className="space-y-1">
             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Risk Formula</span>
             <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
               Utilization % = Remaining Hours / (Remaining Business Days × {config.dailyCapacity} hrs)
             </p>
             <div className="flex flex-wrap gap-3 pt-1">
               <div className="flex items-center gap-1">
                 <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                 <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">On Track: &lt; {config.riskThreshold}%</span>
               </div>
               <div className="flex items-center gap-1">
                 <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                 <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">At Risk: ≥ {config.riskThreshold}%</span>
               </div>
               <div className="flex items-center gap-1">
                 <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                 <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Over Capacity: &gt; 100%</span>
               </div>
             </div>
           </div>
        </div>

        {status.type && (
          <div className={cn(
            "flex items-start gap-3 p-3 rounded-xl border text-xs font-medium animate-in fade-in slide-in-from-top-2",
            status.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400" : 
            "bg-red-50 border-red-100 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400"
          )}>
            {status.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{status.message}</span>
          </div>
        )}

        <button 
          type="submit"
          disabled={isSaving}
          className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm py-3 rounded-xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? "Saving..." : (
            <>
              <Save className="h-4 w-4" />
              Update Configuration
            </>
          )}
        </button>
      </form>
    </section>
  );
}
