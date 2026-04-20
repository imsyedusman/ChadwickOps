export const dynamic = "force-dynamic";
import { db } from "@/db";
import { syncLogs, displayStages, systemConfig, stageMappings, projects } from "@/db/schema";
import { desc, eq, count } from "drizzle-orm";
import { 
  Settings, 
  History, 
  Key, 
  Map as MapIcon, 
  Activity, 
  ShieldCheck,
  Save,
  Trash2,
  Plus,
  Clock,
  AlertTriangle,
  Archive
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ApiCredentialsForm } from "@/components/admin/ApiCredentialsForm";

export default async function AdminPage() {
  const archivedCountResults = await db.select({ value: count() }).from(projects).where(eq(projects.isArchived, true));
  const archivedCount = archivedCountResults[0]?.value || 0;

  const archivedProjects = await db.query.projects.findMany({
    where: eq(projects.isArchived, true),
    orderBy: [desc(projects.archivedAt)],
  });

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
  
  const credentialsConfig = config.find(c => c.key === 'WORKGURU_API_CREDENTIALS');

  const isEncryptionKeySet = process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length === 32;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">System Administration</h1>
        <p className="text-sm text-slate-500 font-bold">Manage connectivity, mappings, and operational validation.</p>
      </div>

      {!isEncryptionKeySet && (
        <div className="p-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl flex items-start gap-4 animate-in zoom-in-95 duration-500">
           <div className="p-2 bg-red-100 dark:bg-red-500/20 rounded-xl text-red-600 dark:text-red-400">
              <AlertTriangle className="h-6 w-6" />
           </div>
           <div className="space-y-2">
              <h3 className="text-sm font-bold text-red-800 dark:text-red-400">Security Configuration Required</h3>
              <p className="text-xs text-red-700/80 dark:text-red-400/80 leading-relaxed font-medium">
                The <code className="bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded text-[10px] font-bold">ENCRYPTION_KEY</code> environment variable is missing or invalid. 
                API credentials cannot be saved or read until a 32-character key is set in your <code className="bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded text-[10px] font-bold">.env</code> file.
              </p>
              <div className="pt-2 flex flex-col gap-2">
                 <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Recommended Key (copy to .env):</span>
                 <code className="bg-white/50 dark:bg-black/20 p-2 rounded-lg text-xs font-mono border border-red-100 dark:border-red-900/40 break-all select-all">
                    ENCRYPTION_KEY=&quot;8a07cf0a4e89f1b4e927e4c6ea2eafbd&quot;
                 </code>
              </div>
           </div>
        </div>
      )}

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* API Credentials */}
        <ApiCredentialsForm hasExistingCredentials={!!credentialsConfig} />
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
           <button className="text-brand hover:text-brand/80 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors">
              <Plus className="h-4 w-4" />
              New Mapping
           </button>
        </div>
        <div className="overflow-x-auto">
           <table className="w-full text-left">
              <thead>
                 <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">WorkGuru Status</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Display Stage</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                 {mappings.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                       <td className="px-8 py-4 text-sm font-bold text-slate-700 dark:text-slate-300">{m.workguruStatus}</td>
                       <td className="px-8 py-4">
                          {m.displayStage ? (
                            <span 
                               className="px-2 py-0.5 rounded text-[10px] font-bold border shadow-sm uppercase tracking-wider"
                               style={{ 
                                 backgroundColor: m.displayStage.color + '15', 
                                 color: m.displayStage.color,
                                 borderColor: m.displayStage.color + '30'
                               }}
                            >
                               {m.displayStage.name}
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

      {/* Sync Status Section */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                 <Activity className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Sync Status & Validation</h2>
           </div>
           <div className="flex items-center gap-4">
               <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700/50">
                  ARCHIVED PROJECTS: {archivedCount}
               </div>
               <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-100 dark:border-emerald-500/20">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  REAL-TIME VALIDATION ACTIVE
               </div>
            </div>
        </div>
        
        {/* Persistent Sync Summary Card */}
        {logs.length > 0 && (
          <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-800/10 border-b border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {(() => {
                const latest = logs[0];
                let summary: any = null;
                try {
                  summary = JSON.parse(latest.details || '{}');
                } catch (e) {
                  summary = { legacy: true, details: latest.details };
                }

                return (
                  <>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Attempt</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {format(new Date(latest.timestamp), 'dd MMM, HH:mm:ss')}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          latest.status === 'SUCCESS' ? "bg-emerald-500" :
                          latest.status === 'PARTIAL' ? "bg-amber-500" : "bg-red-500"
                        )} />
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          {latest.status.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    {summary && !summary.legacy && (
                      <>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Projects Processed</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                             <span className="text-emerald-500">{summary.success || 0}</span>
                             <span className="text-slate-300 mx-1">/</span>
                             <span>{summary.total || (summary.success + (summary.failed || 0)) || 0}</span>
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">API Failures</p>
                          <p className={cn(
                            "text-sm font-bold",
                            (summary.failed || 0) > 0 ? "text-red-500" : "text-slate-400"
                          )}>
                             {summary.failed || 0}
                          </p>
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
           {logs.length > 0 ? logs.map((log) => (
               <div key={log.id} className="px-8 py-5 flex items-start justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                  <div className="space-y-1.5 flex-1 pr-8">
                     <div className="flex items-center gap-3">
                         <span className={cn(
                          "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border shadow-sm",
                          log.status === 'SUCCESS' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                          log.status === 'PARTIAL' ? "bg-amber-50 text-amber-600 border-amber-200 shadow-amber-100/20" :
                          log.status === 'WARNING' ? "bg-amber-50 text-amber-600 border-amber-200" :
                          "bg-red-50 text-red-600 border-red-200"
                         )}>
                            {log.status === 'SUCCESS' ? 'OK' : log.status.replace('_', ' ')}
                         </span>
                         <span className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">
                           {(() => {
                             try {
                               const summary = JSON.parse(log.details || '{}');
                               if (summary.mode) {
                                  return `${summary.mode} sync processed ${summary.success} projects${summary.failed > 0 ? ` (${summary.failed} failures skipped)` : ''}.`;
                               }
                               return summary.error || log.details;
                             } catch (e) {
                               return log.status === 'SUCCESS' ? 'Direct labour and project hours synchronized successfully.' : log.details;
                             }
                           })()}
                         </span>
                     </div>
                     <div className="flex items-center gap-2 ml-[52px]">
                         <Clock className="h-3 w-3 text-slate-300" />
                        <span className="text-[10px] text-slate-400 font-bold tabular-nums">
                          {format(new Date(log.timestamp), 'dd MMM yyyy, HH:mm:ss')}
                        </span>
                        {(() => {
                          try {
                            const summary = JSON.parse(log.details || '{}');
                            if (summary.archived !== undefined || summary.restored !== undefined) {
                              return (
                                <span className="text-[10px] text-indigo-400 font-bold ml-2 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/5 rounded border border-indigo-100 dark:border-indigo-500/10">
                                  {summary.archived} ARCHIVED | {summary.restored} RESTORED
                                </span>
                              );
                            }
                          } catch (e) {}
                          return null;
                        })()}
                     </div>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <History className="h-4 w-4 text-slate-400" />
                  </div>
               </div>
            )) : (
              <div className="p-12 text-center text-slate-400 text-xs italic">
                 No synchronization logs found.
              </div>
            )}
        </div>
      </section>

      {/* Archived Projects Section */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-700/10 rounded-lg text-slate-700 dark:text-slate-400">
                 <Archive className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Archived Projects</h2>
           </div>
           <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full uppercase tracking-widest">
              Total Archived: {archivedCount}
           </span>
        </div>
        <div className="overflow-x-auto">
           <table className="w-full text-left">
              <thead>
                 <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Project Name</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Status</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Last Seen</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Archived Date</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                 {archivedProjects.length > 0 ? archivedProjects.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                       <td className="px-8 py-4">
                          <div className="flex flex-col">
                             <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{p.projectNumber}</span>
                          </div>
                       </td>
                       <td className="px-8 py-4 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-tight">{p.rawStatus}</td>
                       <td className="px-8 py-4 text-xs font-bold text-slate-400 tabular-nums">
                          {p.lastSeenAt ? format(new Date(p.lastSeenAt), 'dd MMM yyyy') : 'Never'}
                       </td>
                       <td className="px-8 py-4 text-xs font-bold text-indigo-500 tabular-nums">
                          {p.archivedAt ? format(new Date(p.archivedAt), 'dd MMM yyyy') : 'Unknown'}
                       </td>
                    </tr>
                 )) : (
                    <tr>
                       <td colSpan={4} className="px-8 py-12 text-center text-slate-400 text-xs italic">
                          No projects have been archived yet.
                       </td>
                    </tr>
                 )}
              </tbody>
           </table>
        </div>
      </section>
    </div>
  );
}
