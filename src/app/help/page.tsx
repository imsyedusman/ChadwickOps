import { 
  Info, 
  CheckCircle2, 
  XCircle, 
  BarChart3, 
  RefreshCcw, 
  Archive,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Zap,
  Clock,
  PieChart
} from "lucide-react";
import { ACTIVE_STATUSES, EXCLUDED_WIP_STATUSES } from "@/lib/project-utils";

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-bold uppercase tracking-wider">
          <BookOpen className="h-3 w-3" />
          Documentation
        </div>
        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          System Guide & Definitions
        </h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
          Understand how the dashboard tracks and calculates your production data from WorkGuru.
        </p>
      </div>

      {/* Grid Sections */}
      <div className="grid grid-cols-1 gap-12">
        
        {/* 1. Active Work Section */}
        <section id="active-work" className="space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="p-2 bg-indigo-500 rounded-lg text-white">
              <Zap className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Active Work vs. Excluded</h2>
          </div>
          
          <p className="text-slate-600 dark:text-slate-400 font-medium">
            The dashboard classifies work into <strong>Active</strong> and <strong>Inactive</strong> states based on their WorkGuru status. The <strong>Active Jobs</strong> filter on the main dashboard uses these definitions to focus on live production.
          </p>


          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl p-6">
              <h3 className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold mb-4">
                <CheckCircle2 className="h-5 w-5" />
                Included (Active Production)
              </h3>
              <ul className="grid grid-cols-1 gap-2">
                {ACTIVE_STATUSES.map(status => (
                  <li key={status} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {status}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <h3 className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-bold mb-4">
                <XCircle className="h-5 w-5" />
                Excluded (Inactive/Finished)
              </h3>
              <ul className="grid grid-cols-1 gap-2">
              {EXCLUDED_WIP_STATUSES.map(status => (
                  <li key={status} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                    {status}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] text-slate-400 italic">
                * Projects starting with internal code &quot;99xxx&quot; are also excluded from capacity metrics.
              </p>
            </div>
          </div>
        </section>

        {/* 2. Metrics Section */}
        <section id="metrics" className="space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="p-2 bg-brand rounded-lg text-white">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">KPI Definitions</h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <MetricCard 
              title="Budget Hours" 
              definition="The total estimated hours defined in the Project Tasks within WorkGuru."
              source="Pulled directly from WorkGuru 'Estimated Hours' column."
            />
            <MetricCard 
              title="Actual Hours" 
              definition="The total time logged by staff against project tasks."
              source="Pulled from WorkGuru Timesheets."
            />
            <MetricCard 
              title="Remaining Hours" 
              definition="Budget Hours minus Actual Hours. This represents the outstanding workload."
              source="Calculated locally: (Budget - Actual)."
            />
            <MetricCard 
              title="Capacity" 
              definition="The total available production hours for the workshop per month."
              source="Calculated: (Staff × Weekly Hours × Weeks per Month × Efficiency)."
            />
            <MetricCard 
              title="Utilization" 
              definition="How much of your available capacity is consumed by the current workload."
              source="Calculated: (Remaining Hours ÷ Capacity) × 100."
            />
          </div>
        </section>

        {/* 3. Sync Section */}
        <section id="sync" className="space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="p-2 bg-blue-500 rounded-lg text-white">
              <RefreshCcw className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Data Synchronization</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Quick Sync
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Happens automatically every hour. It updates the 15 most recently modified projects to ensure today&apos;s changes reflect quickly.
              </p>
            </div>
            <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Full Sync
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Runs daily or when manually triggered. It scans every project in WorkGuru to ensure the entire database is aligned.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-2xl p-6 flex gap-4">
            <Info className="h-6 w-6 text-amber-500 shrink-0" />
            <div>
              <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm mb-1">What does &quot;Stale&quot; mean?</h4>
              <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed">
                If a project hasn&apos;t been synced in over 24 hours, it may be marked as stale. This usually indicates the project was not found in the latest WorkGuru scan and may be a candidate for archiving.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Job Cost Report Section */}
        <section id="job-cost" className="space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="p-2 bg-emerald-500 rounded-lg text-white">
              <PieChart className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Job Cost Report</h2>
          </div>

          <p className="text-slate-600 dark:text-slate-400 font-medium">
            This report shows <strong>how much we’ve spent vs. how much we’ve invoiced</strong> for each project. It helps you see which projects are making money and which ones still have costs to recover.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Where does the data come from?
              </h3>
              <ul className="space-y-3">
                <li className="text-sm text-slate-600 dark:text-slate-400">
                  <strong className="text-slate-900 dark:text-white">Labour:</strong> Pulled from timesheets logged by the team.
                </li>
                <li className="text-sm text-slate-600 dark:text-slate-400">
                  <strong className="text-slate-900 dark:text-white">Materials:</strong> Pulled from approved or received purchase orders.
                </li>
                <li className="text-sm text-slate-600 dark:text-slate-400">
                  <strong className="text-slate-900 dark:text-white">Invoices:</strong> Pulled from billing records sent to clients.
                </li>
              </ul>
            </div>

            <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-emerald-500" />
                What do the numbers mean?
              </h3>
              <ul className="space-y-3">
                <li className="text-sm text-slate-600 dark:text-slate-400">
                  <strong className="text-slate-900 dark:text-white">Total Cost:</strong> Everything we&apos;ve spent on the job so far.
                </li>
                <li className="text-sm text-slate-600 dark:text-slate-400">
                  <strong className="text-slate-900 dark:text-white">Invoiced:</strong> The total amount we&apos;ve billed the client.
                </li>
                <li className="text-sm text-slate-600 dark:text-slate-400">
                  <strong className="text-slate-900 dark:text-white">Unrecovered Amount:</strong> The gap between what we spent and what we billed.
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">How it calculates each month</h3>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center">
              <div className="flex-1 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Opening</p>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Last month&apos;s closing balance</p>
              </div>
              <div className="text-slate-400 font-bold">+</div>
              <div className="flex-1 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Costs</p>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Labour & materials spent this month</p>
              </div>
              <div className="text-slate-400 font-bold">-</div>
              <div className="flex-1 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Invoices</p>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Amount billed this month</p>
              </div>
              <div className="text-slate-400 font-bold">=</div>
              <div className="flex-1 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 shadow-sm">
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Closing</p>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">The new total position</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-2xl p-6 flex gap-4">
            <Info className="h-6 w-6 text-amber-500 shrink-0" />
            <div>
              <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm mb-1">Important Note</h4>
              <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed font-medium">
                The numbers in this report depend on the latest data sync from WorkGuru. If you just added a timesheet or invoice and don’t see it here yet, it may still be waiting for the next scheduled sync.
              </p>
            </div>
          </div>
        </section>

        {/* 6. Archives Section */}
        <section id="archives" className="space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="p-2 bg-slate-700 rounded-lg text-white">
              <Archive className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Archived Projects</h2>
          </div>

          <p className="text-slate-600 dark:text-slate-400">
            Projects are moved to the Archive if they are no longer visible in WorkGuru for two consecutive Full Syncs. This ensures the main dashboard stays focused on real work.
          </p>

          <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-1">Where to find them?</h4>
                <p className="text-sm text-slate-500">Administrators can view all archived records in the Admin Panel.</p>
              </div>
              <ArrowRight className="h-6 w-6 text-slate-300" />
            </div>
          </div>
        </section>

      </div>

      <footer className="pt-12 pb-8 border-t border-slate-200 dark:border-slate-800 text-center">
        <p className="text-sm text-slate-400 font-medium tracking-tight">
          Chadwick Operations Dashboard • {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}

function MetricCard({ title, definition, source }: { title: string, definition: string, source: string }) {
  return (
    <div className="group p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-brand/40 transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="w-40 shrink-0">
          <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">{title}</span>
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">{definition}</p>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Clock className="h-3 w-3" />
            Source: <span className="text-slate-500 dark:text-slate-300">{source}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
