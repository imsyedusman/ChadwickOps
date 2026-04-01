export const dynamic = "force-dynamic";
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
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "" } = await searchParams;
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

  console.log(`[UI] Fetched ${projectsWithRisk.length} projects for display.`);
  if (projectsWithRisk.length > 0) {
      console.log(`[UI] Sample project:`, JSON.stringify(projectsWithRisk[0]).substring(0, 200));
  }

  const latestSync = await db.query.syncLogs.findFirst({
    orderBy: [desc(syncLogs.timestamp)],
  });

  const lastUpdatedText = latestSync 
    ? new Date(latestSync.timestamp).toLocaleString('en-AU', {
        timeZone: 'Australia/Sydney',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : "Never";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const stats = {
    total: projectsWithRisk.length,
    activeJobs: projectsWithRisk.filter(p => !['Completed', 'Archived'].includes(p.rawStatus)).length,
    dueThisWeek: projectsWithRisk.filter(p => {
      if (!p.deliveryDate) return false;
      const d = new Date(p.deliveryDate);
      return d >= todayStart && d <= weekEnd;
    }).length,
    overdue: projectsWithRisk.filter(p => {
      if (!p.deliveryDate) return false;
      const d = new Date(p.deliveryDate);
      return d < todayStart && !['Completed', 'Archived'].includes(p.rawStatus);
    }).length,
    thisMonth: projectsWithRisk.filter(p => {
      if (!p.deliveryDate) return false;
      const d = new Date(p.deliveryDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
  };

  // Monthly Aggregation (Planning Foundation)
  const monthlyStats = projectsWithRisk.reduce((acc, p) => {
    if (!p.deliveryDate) return acc;
    const monthKey = format(new Date(p.deliveryDate), 'yyyy-MM');
    if (!acc[monthKey]) {
      acc[monthKey] = { totalBudgetHours: 0, totalRemainingHours: 0, projectCount: 0 };
    }
    acc[monthKey].totalBudgetHours += p.budgetHours;
    acc[monthKey].totalRemainingHours += p.remainingHours;
    acc[monthKey].projectCount += 1;
    return acc;
  }, {} as Record<string, { totalBudgetHours: number, totalRemainingHours: number, projectCount: number }>);

  console.log(`[UI] Monthly aggregation:`, monthlyStats);

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

  if (filter === "due_this_week") {
    displayedProjects = projectsWithRisk.filter(p => {
      if (!p.deliveryDate) return false;
      const d = new Date(p.deliveryDate);
      return d >= todayStart && d <= weekEnd;
    });
  } else if (filter === "overdue") {
    displayedProjects = projectsWithRisk.filter(p => {
      if (!p.deliveryDate) return false;
      const d = new Date(p.deliveryDate);
      return d < todayStart && !['Completed', 'Archived'].includes(p.rawStatus);
    });
  } else if (filter === "this_month") {
    displayedProjects = projectsWithRisk.filter(p => {
      if (!p.deliveryDate) return false;
      const d = new Date(p.deliveryDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
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
        totalCount={stats.activeJobs}
        dueThisWeekCount={stats.dueThisWeek}
        overdueCount={stats.overdue}
        thisMonthCount={stats.thisMonth}
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

            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-6">
               <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-4">Operations Tip</h3>
               <p className="text-xs text-slate-500 leading-relaxed font-medium italic">
                 "Data freshness is tracked per-project. If a project is flagged as <span className="text-amber-500 font-bold uppercase tracking-tighter">Stale</span>, use <span className="font-bold whitespace-nowrap">Quick Sync</span> to prioritize its refresh."
               </p>
            </section>
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
