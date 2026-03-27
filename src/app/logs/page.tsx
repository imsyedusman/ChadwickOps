import { db } from "@/db";
import { syncLogs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { format } from "date-fns";
import { History, CheckCircle2, AlertTriangle, XCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function LogsPage() {
  const logs = await db.query.syncLogs.findMany({
    orderBy: [desc(syncLogs.timestamp)],
    limit: 50,
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Sync History</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-bold">Audit trail for all WorkGuru data synchronization events.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand transition-colors" />
              <input 
                type="text" 
                placeholder="Search history..." 
                className="pl-11 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:ring-4 focus:ring-brand/5 focus:border-brand/30 outline-none transition-all w-72 shadow-sm"
              />
           </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden transition-colors duration-300">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            Activity Log
            <span className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />
            <span className="text-xs font-semibold text-slate-500 normal-case">Showing last 50 events</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest w-1/4">Timestamp</th>
                <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center w-32">Status</th>
                <th className="px-6 py-3.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Event Details & Validation Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <History className="h-8 w-8 opacity-20" />
                      <p className="text-sm font-medium italic">No synchronization history found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all duration-200 cursor-default">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                          {format(new Date(log.timestamp), 'dd MMM yyyy, HH:mm:ss')}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Event Time</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                         <StatusBadge status={log.status} />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        {log.details || 'System event triggered without additional metadata.'}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    'SUCCESS': { label: 'SUCCESS', classes: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 shadow-emerald-500/5' },
    'WARNING': { label: 'WARNING', classes: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20 shadow-orange-500/5' },
    'FAILURE': { label: 'FAILURE', classes: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20 shadow-red-500/5' },
  };
  const config = configs[status] || { label: status, classes: 'bg-slate-100 text-slate-600' };
  return (
    <span className={cn(
      "inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest border transition-all duration-300 shadow-sm uppercase shrink-0",
      config.classes
    )}>
       {config.label}
    </span>
  );
}
