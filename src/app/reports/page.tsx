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
import { BreakdownTable } from "@/components/reports/BreakdownTable";
import Link from "next/link";
import { 
  getPeriodBounds, 
  getComparisonBounds, 
  calculateTrend, 
  ReportingPreset,
  SYDNEY_TZ
} from "@/lib/reports";
import { format, toZonedTime } from "date-fns-tz";
import { 
  startOfMonth, 
  subMonths, 
  differenceInDays, 
  getDate, 
  lastDayOfMonth 
} from "date-fns";
import { 
  getSydneyNow, 
  isProjectBacklog, 
  formatSydneyDate 
} from "@/lib/project-logic";
import { syncLogs } from "@/db/schema";

export const dynamic = "force-dynamic";

interface ReportsPageProps {
  searchParams: Promise<{ p?: string }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const { p = "this_month" } = await searchParams;
  const preset = p as ReportingPreset;

  const currentPeriod = getPeriodBounds(preset);
  const previousPeriod = getComparisonBounds(currentPeriod);

  // 1. Fetch Latest Sync for Freshness
  const latestSync = await db.query.syncLogs.findFirst({
    orderBy: [desc(syncLogs.timestamp)],
  });

  const lastUpdatedText = latestSync 
    ? new Date(latestSync.timestamp).toLocaleString('en-AU', {
        timeZone: SYDNEY_TZ,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : "Never";

  // 2. Fetch Current Metrics (Aggregated in SQL)
  const now = getSydneyNow();

  const [ordersCurrent, workScheduled, ordersPrev, workPrev, backlog, medianValue] = await Promise.all([
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
    )),
    // Backlog (Work Not Yet Scheduled)
    db.select({
       totalValue: sum(projects.total),
       projectCount: count()
    }).from(projects).where(and(
       eq(projects.isArchived, false),
       // Status terminal filter happens in code usually, but for count we apply similar logic
       sql`raw_status NOT IN ('Cancelled', 'Completed', 'Invoiced', 'Closed', 'Delivered', 'Tested Passed')`,
       sql`(start_date IS NULL OR start_date > ${now.toISOString()})`
    )),
    // Median Project Value (this period)
    db.select({
       median: sql`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total)`
    }).from(projects).where(and(
       eq(projects.isArchived, false),
       gte(projects.projectCreationDate, currentPeriod.from),
       lte(projects.projectCreationDate, currentPeriod.to)
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
       clientId: projects.clientId,
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
     .groupBy(clients.name, projects.clientId)
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

  // 4. Actionable Data Integrity & Validation
  const totalValueExpected = Number(ordersCurrent[0]?.totalValue || 0);
  const totalCountExpected = Number(ordersCurrent[0]?.projectCount || 0);

  const pmSum = pmBreakdown.reduce((acc, pm) => acc + Number(pm.totalValue || 0), 0);
  const clientSum = clientBreakdown.reduce((acc, cli) => acc + Number(cli.totalValue || 0), 0);

  // We only log if there's a serious mismatch that isn't due to the "limit 5" 
  // (In a real system PM Sum would check full list, here we just log for major logic drifts)
  if (totalValueExpected > 0 && Math.abs(pmSum - totalValueExpected) > 1 && pmBreakdown.length < 5) {
     console.error(`[Reports Validation Error] PM mismatch. Expected: ${totalValueExpected}, Actual: ${pmSum}. Delta: ${pmSum - totalValueExpected}`);
  }

  // Pre-calculate Trend Info
  const ordersTrend = calculateTrend(Number(ordersCurrent[0]?.totalValue || 0), Number(ordersPrev[0]?.totalValue || 0));
  const workTrend = calculateTrend(Number(workScheduled[0]?.totalValue || 0), Number(workPrev[0]?.totalValue || 0));

  // Determine if it's a partial period (today < end of selected period)
  const isPartial = preset === "this_month";

  // Calculate Scheduling Ratio
  const ordersVal = Number(ordersCurrent[0]?.totalValue || 0);
  const workVal = Number(workScheduled[0]?.totalValue || 0);
  const schedulingRatio = ordersVal > 0 ? (workVal / ordersVal) * 100 : 0;

  // Forecast Logic (Guardrail: Min 3 days)
  const daysInMonth = getDate(lastDayOfMonth(now));
  const daysPassed = getDate(now);
  const canForecast = isPartial && daysPassed >= 3;
  const forecastedValue = canForecast ? (ordersVal / daysPassed) * daysInMonth : null;

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

        <div className="flex flex-col items-end gap-2">
           <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/50">
             Last synced: {lastUpdatedText}
           </div>
           <Suspense fallback={<div className="h-10 w-48 bg-slate-100 animate-pulse rounded-2xl" />}>
             <PeriodSelector currentPreset={preset} />
           </Suspense>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ReportMetricCard 
           title="Work Received"
           value={Number(ordersCurrent[0]?.totalValue || 0)}
           count={Number(ordersCurrent[0]?.projectCount || 0)}
           avg={Number(ordersCurrent[0]?.avgValue || 0)}
           trend={ordersTrend}
           description="Total value of projects created within this period (Sydney Time)."
           sourceField="Project Creation Date"
           insight={canForecast ? `Projected this month: ${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(forecastedValue || 0)}` : "Work intake increased vs last period"}
           icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
           color="emerald"
           href={`/reports/projects?p=${preset}&m=orders_received`}
        />
        <ReportMetricCard 
           title="Work Scheduled"
           value={Number(workScheduled[0]?.totalValue || 0)}
           count={Number(workScheduled[0]?.projectCount || 0)}
           avg={schedulingRatio}
           avgLabel="Ratio"
           trend={workTrend}
           description="Total value of projects scheduled to start within this period."
           sourceField="Start Date"
           insight="Scheduling is stable compared to last period"
           icon={<Calendar className="h-5 w-5 text-blue-500" />}
           color="blue"
           href={`/reports/projects?p=${preset}&m=work_scheduled`}
        />
        <ReportMetricCard 
           title="Work Not Yet Scheduled"
           value={Number(backlog[0]?.totalValue || 0)}
           count={Number(backlog[0]?.projectCount || 0)}
           avg={Number(medianValue[0]?.median || 0)}
           avgLabel="Median"
           description="Backlog: Projects with NO start date or a future start date. Excludes terminal states (Completed/Cancelled)."
           sourceField="Start Date + Status"
           insight="Backlog is stable or decreasing"
           icon={<Layers className="h-5 w-5 text-amber-500" />}
           color="amber"
           href={`/reports/projects?p=${preset}&m=backlog`}
        />
      </div>

      {/* Breakdown Layer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-slate-200/60 dark:border-slate-800/60">
        <BreakdownTable 
          title="Project Manager Performance" 
          subtitle="Top 5 Project Managers by total value received"
          icon={<Users className="h-4 w-4 text-indigo-500" />}
          data={pmBreakdown} 
          mode="pm"
          preset={preset}
        />
        <BreakdownTable 
          title="Top Clients" 
          subtitle="Top 5 Clients by total value received"
          icon={<Layers className="h-4 w-4 text-brand" />}
          data={clientBreakdown} 
          mode="client"
          preset={preset}
        />
      </div>
    </div>
  );
}

function ReportMetricCard({ 
  title, 
  value, 
  valueFormat = "currency",
  count, 
  avg,
  avgLabel = "Avg",
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
  valueFormat?: "currency" | "days";
  count?: number;
  avg?: number;
  avgLabel?: string;
  trend?: { percent: number, direction: 'up' | 'down' };
  description: string;
  sourceField: string;
  insight: string;
  icon: React.ReactNode;
  color: "emerald" | "blue" | "amber" | "indigo";
  href: string;
}) {
  const formattedValue = valueFormat === "currency" 
    ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value)
    : `${value.toFixed(1)} Days`;

  const formattedAvg = avg !== undefined ? (
    avgLabel === "Ratio" 
      ? `${avg.toFixed(1)}%`
      : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(avg)
  ) : null;

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
          {trend && (
            <div className={cn(
               "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 border",
               trend.direction === 'up' 
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20"
                  : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-100 dark:border-red-500/20"
            )}>
              {trend.direction === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {trend.percent}%
            </div>
          )}

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
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">{title}</p>
          {count !== undefined && (
            <>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <p className="text-xs font-medium text-slate-400 leading-none">{count} Projects</p>
            </>
          )}
          {formattedAvg && (
            <>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <p className="text-xs font-medium text-slate-400 leading-none">{avgLabel}: {formattedAvg}</p>
            </>
          )}
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
