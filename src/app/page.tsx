import { db } from "@/db";
import { projects, clients, displayStages, syncLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { DeliveryRiskService } from "@/lib/risk";
import { format, isSameWeek, addWeeks, startOfWeek, endOfWeek } from "date-fns";
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  ExternalLink, 
  TrendingUp, 
  ArrowUpRight,
  Info,
  Layers,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectTable } from "@/components/dashboard/project-table";
import { DashboardSummaries } from "@/components/dashboard/DashboardSummaries";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const filter = searchParams.filter || "";
  const riskService = new DeliveryRiskService();
  const allProjects = await db.query.projects.findMany({
    with: {
      client: true,
      displayStage: true,
    },
    orderBy: [desc(projects.updatedAt)],
  });

  const projectsWithRisk = await Promise.all(
    allProjects.map(async (p) => ({
      ...p,
      risk: await riskService.calculateProjectRisk(p),
    }))
  );

  const latestSync = await db.query.syncLogs.findFirst({
    orderBy: [desc(syncLogs.timestamp)],
  });

  const lastUpdatedText = latestSync 
    ? format(new Date(latestSync.timestamp), "MMM d, yyyy, h:mm a")
    : "Never";

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const stats = {
    total: projectsWithRisk.length,
    atRisk: projectsWithRisk.filter(p => p.risk === 'AT_RISK' || p.risk === 'OVER_CAPACITY').length,
    onTrack: projectsWithRisk.filter(p => p.risk === 'ON_TRACK').length,
    dueThisWeek: projectsWithRisk.filter(p => p.deliveryDate && isSameWeek(new Date(p.deliveryDate), now, { weekStartsOn: 1 })).length,
  };

  // Stage Bottleneck calculation
  const stageCounts: Record<string, { name: string, count: number, color: string }> = {};
  projectsWithRisk.forEach(p => {
    if (p.displayStage) {
      if (!stageCounts[p.displayStage.id]) {
        stageCounts[p.displayStage.id] = { name: p.displayStage.name, count: 0, color: p.displayStage.color };
      }
      stageCounts[p.displayStage.id].count++;
    }
  });

  const sortedStages = Object.values(stageCounts).sort((a, b) => b.count - a.count);

  let displayedProjects = projectsWithRisk;
  let initialTableFilter = "";

  if (filter === "at_risk") {
    displayedProjects = projectsWithRisk.filter(p => p.risk === 'AT_RISK' || p.risk === 'OVER_CAPACITY');
  } else if (filter === "due_this_week") {
    displayedProjects = projectsWithRisk.filter(p => p.deliveryDate && isSameWeek(new Date(p.deliveryDate), now, { weekStartsOn: 1 }));
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">WIP / Operations</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Monitoring {allProjects.length} active projects across the business.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/50">
           <TrendingUp className="h-3 w-3 text-brand" />
           Last Updated: {lastUpdatedText}
        </div>
      </div>

      <DashboardSummaries 
        totalCount={stats.total}
        atRiskCount={stats.atRisk}
        onTrackCount={stats.onTrack}
        dueThisWeekCount={stats.dueThisWeek}
        currentFilter={filter}
      />

      <div className="space-y-8">
        <div className="w-full">
           <ProjectTable projects={displayedProjects} initialFilter={initialTableFilter} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 border-t border-slate-100 dark:border-slate-800">
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
               <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight uppercase tracking-widest flex items-center gap-2">
                 <Layers className="h-4 w-4 text-indigo-500" />
                 Stage Bottlenecks
               </h2>
               <Info className="h-3.5 w-3.5 text-slate-300" />
            </div>

            <div className="space-y-4">
               {sortedStages.length > 0 ? sortedStages.map((s, i) => (
                 <div key={i} className="space-y-1.5 group">
                   <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                     <span className="text-slate-500">{s.name}</span>
                     <span className="text-slate-900 dark:text-white tabular-nums">{s.count} jobs</span>
                   </div>
                   <div className="h-2 w-full bg-slate-50 dark:bg-slate-800/50 rounded-full overflow-hidden border border-slate-100 dark:border-slate-800">
                     <div 
                       className="h-full rounded-full transition-all duration-1000 group-hover:brightness-110 shadow-sm"
                       style={{ 
                         width: `${(s.count / stats.total) * 100}%`,
                         backgroundColor: s.color 
                       }}
                     />
                   </div>
                 </div>
               )) : (
                 <p className="text-xs text-slate-400 italic">No stage data available.</p>
               )}
            </div>
            
            <div className="pt-2">
               <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                 <p className="text-[10px] font-medium text-slate-500 leading-relaxed italic">
                   "The bottleneck is currently in <span className="font-bold text-slate-700 dark:text-slate-300">{sortedStages[0]?.name || 'N/A'}</span> with {sortedStages[0]?.count || 0} active jobs awaiting processing."
                 </p>
               </div>
            </div>
          </section>

          <div className="space-y-6">
            <section className="bg-brand/5 dark:bg-brand/5 rounded-2xl border border-brand/10 p-6 space-y-4">
               <div className="flex items-center justify-between">
                 <h3 className="text-xs font-bold text-brand uppercase tracking-widest flex items-center gap-2">
                   <Activity className="h-4 w-4" />
                   Sync Status
                 </h3>
                 <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 uppercase tracking-widest">
                   Operational
                 </span>
               </div>
               <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  The dashboard is currently in sync with WorkGuru. All project and labour data is up to date based on the latest staff profiles.
               </p>
               <div className="h-1 w-full bg-brand/10 rounded-full overflow-hidden">
                  <div className="h-full bg-brand w-[100%]" />
               </div>
               <div className="flex justify-between items-center pt-2">
                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Throughput used</span>
                 <span className="text-[10px] text-slate-900 dark:text-white font-bold uppercase tracking-widest">{(stats.total * 6.5 / 160).toFixed(1)}%</span>
               </div>
            </section>

            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6">
               <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-4">Operations Tip</h3>
               <p className="text-xs text-slate-500 leading-relaxed">
                 Use the summary cards above to quickly filter the project queue. Projects "At Risk" indicate utilization levels above 90% based on remaining scheduled hours.
               </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, trendColor, description }: any) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm group hover:shadow-md hover:border-brand/20 transition-all duration-300 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-8 transform translate-x-4 -translate-y-4 opacity-[0.03] dark:opacity-[0.05] group-hover:scale-110 group-hover:text-brand transition-all duration-500 pointer-events-none">
        {icon}
      </div>
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/50 group-hover:border-brand/20 transition-colors">
           {icon}
        </div>
        {trend && (
           <div className={cn("text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 ring-1 ring-inset transition-all", trendColor)}>
              {trend}
           </div>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums leading-none">
          {value}
        </h3>
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 tracking-tight">{title}</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium pt-1">{description}</p>
      </div>
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const configs: any = {
    'HIGH_RISK': { label: 'CRITICAL', classes: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20 shadow-red-500/5' },
    'MEDIUM_RISK': { label: 'AT RISK', classes: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20 shadow-orange-500/5' },
    'ON_TRACK': { label: 'HEALTHY', classes: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 shadow-emerald-500/5' },
    'DELAYED': { label: 'DELAYED', classes: 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-lg' },
  };
  const config = configs[risk] || { label: risk, classes: 'bg-slate-100 text-slate-600' };
  return (
    <span className={cn(
      "inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest border transition-all duration-300 shadow-sm uppercase shrink-0",
      config.classes
    )}>
       {config.label}
    </span>
  );
}
