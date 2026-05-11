import { getProcurementDashboardData } from "@/app/actions/procurement";
import { ProcurementSummaryCards } from "@/components/procurement/ProcurementSummaryCards";
import { ProcurementProjectList } from "@/components/procurement/ProcurementProjectList";
import { ProcurementSyncStatus } from "@/components/dashboard/ProcurementSyncStatus";
import { Info, HelpCircle } from "lucide-react";

export default async function ProcurementPage() {
  const result = await getProcurementDashboardData();

  if (!result.success || !result.data) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Procurement Hub</h1>
        <p className="text-red-500">Error loading data: {result.error}</p>
      </div>
    );
  }

  const { data, summary } = result;

  return (
    <div className="flex flex-col gap-8 p-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Procurement Hub</h1>
            <div className="group relative">
               <HelpCircle className="h-4 w-4 text-slate-300 cursor-help hover:text-slate-500 transition-colors" />
               <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-slate-900 text-white text-[11px] rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 shadow-2xl border border-slate-800 leading-relaxed">
                  <p className="font-bold text-slate-300 mb-1.5 uppercase tracking-widest text-[9px]">What is Delivery Risk?</p>
                  Delivery Risk means outstanding materials currently have ETAs later than the project delivery target. This requires immediate attention to prevent job delays.
               </div>
            </div>
          </div>
          <p className="text-slate-500 font-medium">Monitor project material delays and supplier delivery risks.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <ProcurementSyncStatus />
        </div>
      </div>

      <ProcurementSummaryCards summary={summary} />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Active Project Tracking</h2>
            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                <Info className="h-3 w-3" />
                <span>Showing {data.length} projects with active procurement</span>
            </div>
        </div>
        
        <ProcurementProjectList projects={data} />
      </div>

      <div className="mt-12 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-4 flex items-center gap-2">
          <HelpCircle className="h-4 w-4" />
          Understanding Risk Levels
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Delivery Risk</span>
            <p className="text-[11px] text-slate-500 leading-relaxed">Outstanding materials have ETAs later than the project delivery target. Timing conflict detected.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Delayed</span>
            <p className="text-[11px] text-slate-500 leading-relaxed">The supplier's expected delivery date has already passed, but items haven't been received.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">At Risk</span>
            <p className="text-[11px] text-slate-500 leading-relaxed">Materials are due within 7 days of project delivery. Requires close monitoring.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Missing ETA</span>
            <p className="text-[11px] text-slate-500 leading-relaxed">Active purchase order exists but no ETA has been provided by the supplier. Follow-up required.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
