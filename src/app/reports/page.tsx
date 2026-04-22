import { Suspense } from "react";
import { 
  TrendingUp, 
  Layers, 
  Calendar, 
  Info,
  ArrowRight,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/db";
import { projects, clients } from "@/db/schema";
import { and, gte, lte, eq, isNotNull, sql, desc, avg, sum, count } from "drizzle-orm";
import { PeriodSelector } from "@/components/reports/PeriodSelector";
import { Tooltip } from "@/components/ui/Tooltip";
import Link from "next/link";
import { 
  getPeriodBounds, 
  getComparisonBounds, 
  calculateTrend, 
  ReportingPreset,
  SYDNEY_TZ
} from "@/lib/reports";
import { format, toZonedTime } from "date-fns-tz";
import { startOfMonth, subMonths } from "date-fns";

export const dynamic = "force-dynamic";

interface ReportsPageProps {
  searchParams: Promise<{ p?: string }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const { p = "this_month" } = await searchParams;
  const preset = p as ReportingPreset;

  const currentPeriod = getPeriodBounds(preset);
  const previousPeriod = getComparisonBounds(currentPeriod);

  // 1. Fetch Current Metrics (Aggregated in SQL)
  const [ordersCurrent, workCurrent, ordersPrev, workPrev] = await Promise.all([
    // Current Orders Received
    db.select({
      totalValue: sum(projects.total),
      projectCount: count(),
      avgValue: avg(projects.total)
    }).from(projects).where(and(
      eq(projects.isArchived, false),
      isNotNull(projects.projectCreationDate),
      gte(projects.projectCreationDate, currentPeriod.from),
      lte(projects.projectCreationDate, currentPeriod.to)
    )),
    // Current Work Scheduled
    db.select({
      totalValue: sum(projects.total),
      projectCount: count(),
      avgValue: avg(projects.total)
    }).from(projects).where(and(
      eq(projects.isArchived, false),
      isNotNull(projects.startDate),
      gte(projects.startDate, currentPeriod.from),
      lte(projects.startDate, currentPeriod.to)
    )),
    // Previous Orders Received (for comparison)
    db.select({ totalValue: sum(projects.total) }).from(projects).where(and(
      eq(projects.isArchived, false),
      isNotNull(projects.projectCreationDate),
      gte(projects.projectCreationDate, previousPeriod.from),
      lte(projects.projectCreationDate, previousPeriod.to)
    )),
    // Previous Work Scheduled (for comparison)
    db.select({ totalValue: sum(projects.total) }).from(projects).where(and(
      eq(projects.isArchived, false),
      isNotNull(projects.startDate),
      gte(projects.startDate, previousPeriod.from),
      lte(projects.startDate, previousPeriod.to)
    ))
  ]);

  // 2. Fetch Breakdowns (One Source of Truth - using currentPeriod)
  const [pmBreakdown, clientBreakdown] = await Promise.all([
     db.select({
       name: projects.projectManager,
       totalValue: sum(projects.total),
       projectCount: count(),
       avgValue: avg(projects.total)
     })
     .from(projects)
     .where(and(
        eq(projects.isArchived, false),
        isNotNull(projects.projectCreationDate),
        gte(projects.projectCreationDate, currentPeriod.from),
        lte(projects.projectCreationDate, currentPeriod.to)
     ))
     .groupBy(projects.projectManager)
     .orderBy(desc(sql`sum(total)`))
     .limit(5),

     db.select({
       name: clients.name,
       totalValue: sum(projects.total),
       projectCount: count(),
       avgValue: avg(projects.total)
     })
     .from(projects)
     .innerJoin(clients, eq(projects.clientId, clients.id))
     .where(and(
        eq(projects.isArchived, false),
        isNotNull(projects.projectCreationDate),
        gte(projects.projectCreationDate, currentPeriod.from),
        lte(projects.projectCreationDate, currentPeriod.to)
     ))
     .groupBy(clients.name)
     .orderBy(desc(sql`sum(total)`))
     .limit(5)
  ]);

  // 3. Trend Preparation (Aggregated Monthly Totals for last 12 months)
  const twelveMonthsAgo = startOfMonth(subMonths(toZonedTime(new Date(), SYDNEY_TZ), 11));
  const trendData = await db.select({
    month: sql<string>`TO_CHAR(project_creation_date, 'YYYY-MM')`,
    ordersValue: sum(projects.total),
    ordersCount: count()
  })
  .from(projects)
  .where(and(
    eq(projects.isArchived, false),
    isNotNull(projects.projectCreationDate),
    gte(projects.projectCreationDate, twelveMonthsAgo)
  ))
  .groupBy(sql`TO_CHAR(project_creation_date, 'YYYY-MM')`)
  .orderBy(desc(sql`TO_CHAR(project_creation_date, 'YYYY-MM')`));

  console.log(`[Reports] Trend data prepared for ${trendData.length} months.`);

  // Pre-calculate Trend Info
  const ordersTrend = calculateTrend(Number(ordersCurrent[0]?.totalValue || 0), Number(ordersPrev[0]?.totalValue || 0));
  const workTrend = calculateTrend(Number(workCurrent[0]?.totalValue || 0), Number(workPrev[0]?.totalValue || 0));

  // Determine if it's a partial period (today < end of selected period)
  const isPartial = preset === "this_month";

  // Calculate Scheduling Ratio
  const ordersVal = Number(ordersCurrent[0]?.totalValue || 0);
  const workVal = Number(workCurrent[0]?.totalValue || 0);
  const schedulingRatio = ordersVal > 0 ? (workVal / ordersVal) * 100 : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-brand/10 rounded-lg">
              <PieChart className="h-5 w-5 text-brand" />
            </div>
            <span className="text-[10px] font-bold text-brand uppercase tracking-[0.2em]">Reporting Engine</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Business Intelligence</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {format(currentPeriod.from, "MMM d, yyyy", { timeZone: SYDNEY_TZ })} – {format(currentPeriod.to, "MMM d, yyyy", { timeZone: SYDNEY_TZ })}
            {isPartial && <span className="ml-2 text-[10px] bg-amber-50 dark:bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full uppercase font-bold tracking-widest border border-amber-100">Partial Period</span>}
          </p>
        </div>

        <div className="flex items-center gap-4">
           <Suspense fallback={<div className="h-10 w-48 bg-slate-100 animate-pulse rounded-2xl" />}>
             <PeriodSelector currentPreset={preset} />
           </Suspense>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportMetricCard 
           title="Orders Received"
           value={Number(ordersCurrent[0]?.totalValue || 0)}
           count={Number(ordersCurrent[0]?.projectCount || 0)}
           avg={Number(ordersCurrent[0]?.avgValue || 0)}
           trend={ordersTrend}
           description="Total value of projects created within the selected range (Sydney Time)."
           sourceField="Project Creation Date"
           insight={`Contribution to pipeline: ${ordersCurrent[0]?.projectCount || 0} jobs`}
           icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
           color="emerald"
           href={`/reports/projects?p=${preset}&m=orders_received`}
        />
        <ReportMetricCard 
           title="Work Scheduled"
           value={Number(workCurrent[0]?.totalValue || 0)}
           count={Number(workCurrent[0]?.projectCount || 0)}
           avg={Number(workCurrent[0]?.avgValue || 0)}
           trend={workTrend}
           description="Total value of projects scheduled to start within the selected range (Sydney Time)."
           sourceField="Start Date"
           insight={`Scheduling Ratio: ${schedulingRatio.toFixed(1)}% of work received`}
           icon={<Calendar className="h-5 w-5 text-blue-500" />}
           color="blue"
           href={`/reports/projects?p=${preset}&m=work_scheduled`}
        />
      </div>

      {/* Breakdown Layer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-slate-200/60 dark:border-slate-800/60">
        <BreakdownTable 
          title="Project Manager Performance" 
          subtitle="Top 5 Project Managers by total value received"
          icon={<Users className="h-4 w-4 text-indigo-500" />}
          data={pmBreakdown} 
        />
        <BreakdownTable 
          title="Top Clients" 
          subtitle="Top 5 Clients by total value received"
          icon={<Layers className="h-4 w-4 text-brand" />}
          data={clientBreakdown} 
        />
      </div>
    </div>
  );
}

function ReportMetricCard({ 
  title, 
  value, 
  count, 
  avg,
  trend,
  description, 
  sourceField, 
  insight,
  icon, 
  color,
  href
}: {
  title: string;
  value: number;
  count: number;
  avg: number;
  trend: { percent: number, direction: 'up' | 'down' };
  description: string;
  sourceField: string;
  insight: string;
  icon: React.ReactNode;
  color: "emerald" | "blue";
  href: string;
}) {
  const formattedValue = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0
  }).format(value);

  const formattedAvg = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0
  }).format(avg);

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm relative overflow-hidden group hover:shadow-xl hover:border-brand/20 transition-all duration-500">
      {/* Background Glow */}
      <div className={cn(
        "absolute -top-24 -right-24 w-64 h-64 blur-[80px] opacity-[0.03] dark:opacity-[0.08] transition-opacity duration-700 group-hover:opacity-[0.12]",
        color === "emerald" ? "bg-emerald-500" : "bg-blue-500"
      )} />

      <div className="flex items-start justify-between mb-8 relative z-10">
        <div className={cn(
          "p-3 rounded-2xl border transition-all duration-500",
          color === "emerald" 
            ? "bg-emerald-50/50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 group-hover:scale-110" 
            : "bg-blue-50/50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 group-hover:scale-110"
        )}>
          {icon}
        </div>
        
        <div className="flex items-center gap-3">
          <div className={cn(
             "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 border",
             trend.direction === 'up' 
                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20"
                : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-100 dark:border-red-500/20"
          )}>
            {trend.direction === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trend.percent}% vs Prev
          </div>

          <Tooltip 
            content={
              <div className="space-y-2 p-1">
                <p className="text-xs font-bold uppercase tracking-widest text-brand">Metric Definition</p>
                <p className="text-xs leading-relaxed opacity-90">{description}</p>
                <div className="pt-2 border-t border-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-tighter opacity-50 text-slate-400">Data Source</p>
                  <p className="text-xs font-medium">WorkGuru field: <span className="text-brand">{sourceField}</span></p>
                </div>
              </div>
            }
            className="w-[240px]"
          >
            <button className="p-2 text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
              <Info className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="space-y-2 relative z-10">
        <h3 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums">
          {formattedValue}
        </h3>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{title}</p>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <p className="text-xs font-medium text-slate-400">{count} Projects | Avg: {formattedAvg}</p>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800/50 relative z-10 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 italic">
          {insight}
        </p>
        <Link 
          href={href}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-brand transition-all group/btn"
        >
          View Details
          <ArrowRight className="h-3 w-3 mt-[-1px] group-hover/btn:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

function BreakdownTable({ title, subtitle, icon, data }: { 
  title: string; 
  subtitle: string;
  icon: React.ReactNode;
  data: any[]; 
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest">{title}</h3>
            <p className="text-[10px] font-medium text-slate-400">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 dark:bg-slate-800/30">
            <tr>
              <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name</th>
              <th className="px-2 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Jobs</th>
              <th className="px-2 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Avg</th>
              <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Total Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {data.map((item, idx) => (
              <tr key={idx} className="group hover:bg-slate-50/30 dark:hover:bg-slate-800/20 transition-colors">
                <td className="px-6 py-4">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-brand transition-colors block line-clamp-1">
                    {item.name || "Unassigned"}
                  </span>
                </td>
                <td className="px-2 py-4 text-center">
                  <span className="text-[11px] font-bold text-slate-900 dark:text-white tabular-nums">
                    {item.projectCount}
                  </span>
                </td>
                <td className="px-2 py-4 text-center">
                  <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                    {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(item.avgValue || 0))}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
                    {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(item.totalValue || 0))}
                  </span>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
               <tr>
                 <td colSpan={4} className="px-6 py-12 text-center text-xs text-slate-400 italic">No project data found for this period.</td>
               </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
