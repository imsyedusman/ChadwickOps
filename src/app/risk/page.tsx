import { AlertTriangle, BarChart3, TrendingUp } from "lucide-react";

export default function RiskAnalysisPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Capacity & Risk Analysis</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium italic">Predictive delivery analytics and resource risk assessment coming soon.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-12 text-center min-h-[350px]">
           <div className="h-16 w-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-6">
              <BarChart3 className="h-8 w-8 text-brand" />
           </div>
           <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delivery Risk Forecasting</h3>
           <p className="max-w-md text-xs text-slate-400 font-medium leading-relaxed italic">Analyzing budget vs. actual hours to predict delivery delays before they occur on the workshop floor.</p>
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-12 text-center">
           <div className="h-16 w-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-6">
              <AlertTriangle className="h-8 w-8 text-red-500" />
           </div>
           <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">High-Risk Queue</h3>
           <p className="max-w-xs text-xs text-slate-400 font-medium leading-relaxed italic">Projects exceeding 90% utilization while more than 2 weeks from deadline.</p>
        </div>
      </div>
    </div>
  );
}
