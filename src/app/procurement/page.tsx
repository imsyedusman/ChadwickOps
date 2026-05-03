export const dynamic = "force-dynamic";

import { db } from "@/db";
import { projects, syncLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { TrendingUp, ShoppingBag, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProcurementTable } from "@/components/dashboard/procurement-table";
import { ProcurementSummaries } from "@/components/dashboard/ProcurementSummaries";
import { calculateProcurementRisk } from "@/lib/procurement-logic";
import { getMasterSuppliers } from "@/app/actions/procurement";
import { isProductiveProject, isActiveWorkStatus } from "@/lib/project-utils";

export default async function ProcurementPage() {
  const allProjects = await db.query.projects.findMany({
    with: {
      client: true,
      displayStage: true,
      suppliers: true,
    },
    where: eq(projects.isArchived, false),
    orderBy: [desc(projects.updatedAt)],
  });

  const masterSuppliers = await getMasterSuppliers();

  const projectsWithRisk = allProjects.map((p) => {
    const riskInfo = calculateProcurementRisk(p);
    return {
      ...p,
      procurementRisk: riskInfo.risk,
      procurementRiskReason: riskInfo.reason,
    };
  });

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

  const productiveProjects = projectsWithRisk.filter(p => isProductiveProject(p.projectNumber));
  const activeJobs = productiveProjects.filter(p => isActiveWorkStatus(p.rawStatus));

  // Calculate procurement stats
  const stats = {
    totalActive: activeJobs.length,
    delayedCount: projectsWithRisk.filter(p => p.procurementRisk === 'DELAYED').length,
    atRiskCount: projectsWithRisk.filter(p => p.procurementRisk === 'AT_RISK').length,
    pendingOrders: projectsWithRisk.filter(p => p.procurementStatus === 'Ordering' || p.procurementStatus === 'Partially Ordered').length,
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Procurement Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Tracking materials, suppliers, and delivery risks for active projects.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/50">
           <TrendingUp className="h-3 w-3 text-brand" />
           Sync Status: {lastUpdatedText}
        </div>
      </div>

      <ProcurementSummaries 
        totalCount={stats.totalActive}
        delayedCount={stats.delayedCount}
        atRiskCount={stats.atRiskCount}
        pendingOrdersCount={stats.pendingOrders}
      />

      <div className="w-full">
        <ProcurementTable 
          projects={projectsWithRisk} 
          masterSuppliers={masterSuppliers}
          lastUpdated={lastUpdatedText}
        />
      </div>
    </div>
  );
}
