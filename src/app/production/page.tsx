import { Clock, Calendar } from "lucide-react";

export default function ProductionPlanPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Production Plan</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium italic">Detailed shop floor scheduling and capacity management coming soon.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 min-h-[400px]">
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-12 text-center">
           <div className="h-16 w-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-6">
              <Calendar className="h-8 w-8 text-brand" />
           </div>
           <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Resource Timeline</h3>
           <p className="max-w-xs text-xs text-slate-400 font-medium leading-relaxed">A Gantt-style view of all active projects, mapped against workshop labor capacity.</p>
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-12 text-center">
           <div className="h-16 w-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-6">
              <Clock className="h-8 w-8 text-emerald-500" />
           </div>
           <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Shop Load Analysis</h3>
           <p className="max-w-xs text-xs text-slate-400 font-medium leading-relaxed">Weekly capacity balancing view to identify over-allocated resources.</p>
        </div>
      </div>
    </div>
  );
}
