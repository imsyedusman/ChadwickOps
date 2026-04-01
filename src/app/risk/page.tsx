export const dynamic = "force-dynamic";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getCapacitySettings } from "@/actions/capacity";
import CapacityClientView from "./_components/CapacityClientView";

export default async function CapacityPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>;
}) {
  const { months = "3" } = await searchParams;
  const horizon = parseInt(months, 10) || 3;

  const allProjects = await db.query.projects.findMany({
    orderBy: [desc(projects.updatedAt)],
  });

  // Filter exact same as WIP active projects
  const activeProjects = allProjects.filter(
    (p) => !['Completed', 'Archived'].includes(p.rawStatus)
  );

  const settings = await getCapacitySettings();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Capacity & Risk</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Forward-looking view of workload vs available capacity.</p>
        </div>
      </div>

      <CapacityClientView 
        initialSettings={settings} 
        activeProjects={activeProjects} 
        initialHorizon={horizon}
      />
    </div>
  );
}
