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

async function CapacityAISummaryWrapper({ activeCount }: { activeCount: number }) {
  const baseCapacity = await getStageCapacityPerWeek();
  const breakdown = await getWeeklyCapacityBreakdown(1);
  const currentWeek = breakdown.length > 0 ? breakdown[0] : null;
  
  const stages: Array<keyof typeof baseCapacity> = [
    'frameAssemblyIfc', 'frameAssemblyIfm', 'switchgearMount',
    'busbarIfc', 'busbarIfm', 'wiring', 'labels', 'testing', 'packagingFreight'
  ];

  const over100: string[] = [];
  const between80And100: string[] = [];
  let totalCommitted = 0;
  let totalBase = 0;

  if (currentWeek && baseCapacity) {
    for (const stage of stages) {
      const base = baseCapacity[stage];
      // Current week availableCapacity is actually the free hours, committedHours is what's assigned.
      const committed = currentWeek.committedHours[stage] as number;
      
      if (typeof base === 'number' && typeof committed === 'number') {
        totalBase += base;
        totalCommitted += committed;

        if (base > 0) {
          const util = (committed / base) * 100;
          if (util > 100) {
            over100.push(stage);
          } else if (util >= 80) {
            between80And100.push(stage);
          }
        }
      }
    }
  }

  const avgUtil = totalBase > 0 ? Math.round((totalCommitted / totalBase) * 100) : 0;

  const context = {
    activeProjectCount: activeCount,
    stagesOver100PercentUtilisation: over100.length > 0 ? over100.join(', ') : 'None',
    stagesBetween80And100PercentUtilisation: between80And100.length > 0 ? between80And100.join(', ') : 'None',
    overallAverageUtilisation: `${avgUtil}%`
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
              <CapacityAISummaryWrapper activeCount={activeProjects.length} />
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
