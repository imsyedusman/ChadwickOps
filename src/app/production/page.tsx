export const dynamic = "force-dynamic";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCapacitySettings } from "@/actions/capacity";
import ProductionClientView from "./_components/ProductionClientView";
import { isActiveWorkStatus } from "@/lib/project-utils";

export const metadata = {
  title: "Production Plan | WorkGuru Operations",
};

export default async function ProductionPlanPage() {
  const allProjects = await db.query.projects.findMany({
    where: eq(projects.isArchived, false),
    orderBy: [desc(projects.updatedAt)],
    with: {
      client: true
    }
  });

  // Filter by active production status
  const activeProjects = allProjects.filter((p) => isActiveWorkStatus(p.rawStatus));

  const settings = await getCapacitySettings();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Production Plan</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Execution timeline and weekly load view.</p>
        </div>
      </div>

      <ProductionClientView 
        initialSettings={settings} 
        activeProjects={activeProjects} 
      />
    </div>
  );
}
