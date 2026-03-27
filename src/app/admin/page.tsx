import { db } from "@/db";
import { syncLogs, displayStages, systemConfig, stageMappings } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { 
  Settings, 
  History, 
  Key, 
  Map as MapIcon, 
  Activity, 
  ShieldCheck,
  Save,
  Trash2,
  Plus
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default async function AdminPage() {
  const logs = await db.query.syncLogs.findMany({
    orderBy: [desc(syncLogs.timestamp)],
    limit: 10,
  });

  const stages = await db.query.displayStages.findMany({
    orderBy: [displayStages.order],
  });

  const mappings = await db.query.stageMappings.findMany({
    with: {
      displayStage: true,
    }
  });

  const config = await db.query.systemConfig.findMany();

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">System Administration</h1>
        <p className="text-sm text-slate-500 font-bold">Manage connectivity, mappings, and operational validation.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* API Credentials */}
        <section className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-6 group">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand/10 rounded-lg text-brand">
              <Key className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">WorkGuru Connectivity</h2>
          </div>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">Sensitive credentials are encrypted using AES-256-CBC and stored securely on the server. They are never sent to the browser.</p>
          
          <form className="space-y-4">
             <div className="space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WorkGuru API Key</label>
               <input type="password" placeholder="••••••••••••••••" className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand outline-none transition-all placeholder:text-slate-300" />
             </div>
             <div className="space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WorkGuru API Secret</label>
               <input type="password" placeholder="••••••••••••••••" className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand outline-none transition-all placeholder:text-slate-300" />
             </div>
             <button className="w-full bg-brand hover:bg-brand/90 text-white font-bold text-sm py-3 rounded-xl shadow-lg shadow-brand/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
               <Save className="h-4 w-4" />
               Update Credentials
             </button>
          </form>
        </section>

        {/* System Configuration */}
        <section className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
              <Activity className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Capacity & Risk Thresholds</h2>
          </div>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">Adjust the labor capacity and risk sensitivity used for production delivery assessment.</p>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1.5 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Labor Capacity</span>
                <div className="flex items-end gap-1">
                   <span className="text-xl font-black text-slate-900 dark:text-white">7.5</span>
                   <span className="text-[10px] font-bold text-slate-500 pb-1">hrs/day</span>
                </div>
             </div>
             <div className="space-y-1.5 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Risk Threshold</span>
                <div className="flex items-end gap-1">
                   <span className="text-xl font-black text-slate-900 dark:text-white">90</span>
                   <span className="text-[10px] font-bold text-slate-500 pb-1">% Util</span>
                </div>
             </div>
          </div>
          <button className="w-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-sm py-3 rounded-xl transition-all">
            Manage System Variables
          </button>
        </section>
      </div>

      {/* Stage Mappings */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                 <MapIcon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Stage Mapping Logic</h2>
           </div>
           <button className="text-brand hover:text-brand/80 text-xs font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors">
              <Plus className="h-4 w-4" />
              New Mapping
           </button>
        </div>
        <div className="overflow-x-auto">
           <table className="w-full text-left">
              <thead>
                 <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">WorkGuru Status</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Display Stage</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                 {mappings.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                       <td className="px-8 py-4 text-sm font-bold text-slate-700 dark:text-slate-300">{m.workguruStatus}</td>
                       <td className="px-8 py-4">
                          {m.displayStage ? (
                            <span 
                              className="px-2 py-0.5 rounded text-[10px] font-bold border"
                              style={{ 
                                backgroundColor: m.displayStage.color + '15', 
                                color: m.displayStage.color,
                                borderColor: m.displayStage.color + '30'
                              }}
                            >
                               {m.displayStage.name.toUpperCase()}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic font-medium tracking-tight">Unmapped Stage</span>
                          )}
                       </td>
                       <td className="px-8 py-4 text-right">
                          <button className="text-slate-400 hover:text-red-500 transition-colors">
                             <Trash2 className="h-4 w-4" />
                          </button>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </section>

      {/* Sync Health & Validation */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                 <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Sync Health & Sanity Check</h2>
           </div>
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Real-time Validation Active</span>
              </div>
           </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
           {logs.map((log) => (
              <div key={log.id} className="px-8 py-5 flex items-start justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                 <div className="space-y-1">
                    <div className="flex items-center gap-3">
                       <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border",
                        log.status === 'SUCCESS' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                        log.status === 'WARNING' ? "bg-orange-50 text-orange-600 border-orange-200" :
                        "bg-red-50 text-red-600 border-red-200"
                       )}>
                          {log.status}
                       </span>
                       <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{log.details}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium ml-[68px]">{format(log.timestamp, 'dd MMM yyyy, HH:mm:ss')}</p>
                 </div>
                 <History className="h-4 w-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
              </div>
           ))}
        </div>
      </section>
    </div>
  );
}
