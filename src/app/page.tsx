import { db } from "@/db";
import { projects, clients, displayStages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { DeliveryRiskService } from "@/lib/risk";
import { format } from "date-fns";
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  ExternalLink, 
  TrendingUp, 
  ArrowUpRight,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectTable } from "@/components/dashboard/project-table";

export default async function DashboardPage() {
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">WIP / Operations</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Monitoring {allProjects.length} active projects across the business.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/50">
           <TrendingUp className="h-3 w-3 text-brand" />
           Last Updated: {format(new Date(), 'HH:mm')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Workload" 
          value={allProjects.length.toString()} 
          icon={<Clock className="h-6 w-6 text-brand" />}
          description="Active production queue"
        />
        <StatCard 
          title="Critical Risk" 
          value={projectsWithRisk.filter(p => p.risk === 'HIGH_RISK').length.toString()} 
          icon={<AlertTriangle className="h-6 w-6 text-red-500" />}
          trend="Immediate Action"
          trendColor="text-red-500"
          description="Utilization > 90%"
        />
        <StatCard 
          title="On Schedule" 
          value={projectsWithRisk.filter(p => p.risk === 'ON_TRACK').length.toString()} 
          icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />}
          trend="Healthy"
          trendColor="text-emerald-500"
          description="Utilization < 70%"
        />
      </div>

      <ProjectTable projects={projectsWithRisk} />
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
           <div className={cn("text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 ring-1 ring-inset transition-all", trendColor)}>
              {trend}
           </div>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums leading-none">
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
      "inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest border transition-all duration-300 shadow-sm uppercase shrink-0",
      config.classes
    )}>
       {config.label}
    </span>
  );
}
