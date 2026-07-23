export const dynamic = "force-dynamic";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCapacitySettings } from "@/actions/capacity";
import CapacityClientView from "./_components/CapacityClientView";
import { isActiveWorkStatus } from "@/lib/project-utils";
import { generatePageAISummary } from "@/app/actions/ai-insights";
import { AISummaryCard } from "@/components/ui/AISummaryCard";
import { Suspense } from "react";
import { getStageCapacityPerWeek, getWeeklyCapacityBreakdown } from "@/lib/stage-capacity";
import { format, addMonths, startOfMonth, parseISO } from "date-fns";
import { isProductiveProject } from "@/lib/project-utils";

async function CapacityAISummaryWrapper({ activeProjects, settings }: { activeProjects: any[], settings: any }) {
  const currentCapacity = settings.staff * settings.hoursPerWeek * settings.weeksPerMonth * settings.efficiency;

  const months: string[] = [];
  const now = startOfMonth(new Date());
  for (let i = 0; i < 6; i++) {
      months.push(format(addMonths(now, i), 'yyyy-MM'));
  }
  
  const monthlyData: Record<string, { remaining: number }> = {};
  months.forEach(m => monthlyData[m] = { remaining: 0 });

  activeProjects.forEach(p => {
      if (!p.deliveryDate) return;
      const m = format(new Date(p.deliveryDate), 'yyyy-MM');
      if (monthlyData[m] && isProductiveProject(p.projectNumber)) {
          const adjustedActual = p.actualHours * (settings.actualsFactor ?? 0.7);
          monthlyData[m].remaining += (p.budgetHours - adjustedActual);
      }
  });

  const monthlyBreakdown = months.map(m => {
     const demand = monthlyData[m].remaining;
     const utilisation = currentCapacity > 0 ? Math.round((demand / currentCapacity) * 100) : 0;
     return {
        month: format(parseISO(`${m}-01`), 'MMM yyyy'),
        demandHours: Math.round(demand),
        availableHours: Math.round(currentCapacity),
        utilisationPercentage: utilisation
     }
  });

  const baseCapacity = await getStageCapacityPerWeek();
  const breakdown = await getWeeklyCapacityBreakdown(1);
  const currentWeek = breakdown.length > 0 ? breakdown[0] : null;
  
  const stages: Array<keyof typeof baseCapacity> = [
    'frameAssemblyIfc', 'frameAssemblyIfm', 'switchgearMount',
    'busbarIfc', 'busbarIfm', 'wiring', 'labels', 'testing', 'packagingFreight'
  ];

  const over100: string[] = [];
  
  if (currentWeek && baseCapacity) {
    for (const stage of stages) {
      const base = baseCapacity[stage];
      const committed = currentWeek.committedHours[stage] as number;
      if (typeof base === 'number' && typeof committed === 'number' && base > 0) {
        if ((committed / base) > 1) {
          over100.push(stage);
        }
      }
    }
  }

  const context = {
    monthlyBreakdown,
    currentBottleneckStages: over100.length > 0 ? over100.join(', ') : 'None'
  };

  const result = await generatePageAISummary("capacity", context);
  const summary = result.success && result.data ? result.data.summary : null;
  return <AISummaryCard summary={summary} loading={false} compact={true} />;
}

export default async function CapacityPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>;
}) {
  const { months = "3" } = await searchParams;
  const horizon = parseInt(months, 10) || 3;

  const allProjects = await db.query.projects.findMany({
    where: eq(projects.isArchived, false),
    orderBy: [desc(projects.updatedAt)],
  });

  // Filter by active production status
  const activeProjects = allProjects.filter((p) => isActiveWorkStatus(p.rawStatus));

  const settings = await getCapacitySettings();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Capacity & Risk</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Forward-looking view of workload vs available capacity.</p>
        </div>
        <div className="flex flex-col items-end gap-3 w-full md:w-[45%]">
          <div className="w-full">
            <Suspense fallback={<AISummaryCard summary={null} loading={true} compact={true} />}>
              <CapacityAISummaryWrapper activeProjects={activeProjects} settings={settings} />
            </Suspense>
          </div>
        </div>
      </div>

      <CapacityClientView 
        initialSettings={settings} 
        allProjects={allProjects} 
        initialHorizon={horizon}
      />
    </div>
  );
}
