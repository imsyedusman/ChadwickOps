import { db } from "@/db";
import { profitabilityData, projects } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { TrendingUp } from "lucide-react";
import { ProfitabilitySyncButton } from "@/components/sync/profitability-sync-button";
import { ProfitabilityTable, MergedProfitabilityProject } from "@/components/profitability/profitability-table";

export const dynamic = "force-dynamic";

export default async function ProfitabilityPage() {
  let latestSync = null;
  let mergedData: MergedProfitabilityProject[] = [];

  try {
    latestSync = await db.query.profitabilityData.findFirst({
      orderBy: [desc(profitabilityData.lastSyncedAt)],
    });

    const allProfitData = await db.query.profitabilityData.findMany();
    const allWipProjects = await db.query.projects.findMany({
      with: {
        client: true,
      },
    });

    // Create lookup map for WIP projects
    const wipMap = new Map();
    allWipProjects.forEach((p) => {
      wipMap.set(p.projectNumber, p);
    });

    // Merge data based on profitabilityData records since they define what profit data we have
    mergedData = allProfitData.map((profitRecord) => {
      const wipProject = wipMap.get(profitRecord.projectNumber);
      
      return {
        id: wipProject?.id || profitRecord.projectNumber,
        workguruId: wipProject?.workguruId || null,
        projectNumber: profitRecord.projectNumber,
        projectName: wipProject?.name || "Historical Project",
        clientName: wipProject?.client?.name || null,
        projectManager: wipProject?.projectManager || null,
        rawStatus: wipProject?.rawStatus || null,
        projectType: wipProject?.projectType || null,
        startDate: wipProject?.startDate ? new Date(wipProject.startDate) : null,
        deliveryDate: wipProject?.deliveryDate ? new Date(wipProject.deliveryDate) : null,
        
        quotedProfit: profitRecord.quotedProfit,
        actualProfit: profitRecord.actualProfit,
        invoicedAmount: profitRecord.invoicedAmount || 0,
        totalCost: profitRecord.totalCost,
        labourCost: profitRecord.labourCost,
        materialsCost: profitRecord.materialsCost,
        purchasesCost: profitRecord.purchasesCost,
        estimatedLabourCost: profitRecord.estimatedLabourCost,
        estimatedMaterialsCost: profitRecord.estimatedMaterialsCost,
        estimatedTotalCost: profitRecord.estimatedTotalCost,
        estimatedInvoicedAmount: profitRecord.estimatedInvoicedAmount,
        completionDate: profitRecord.completionDate ? new Date(profitRecord.completionDate) : null,
        isHistorical: profitRecord.isHistorical,
      };
    });

  } catch (error) {
    console.warn("Could not fetch profitability sync data - schema might not be pushed yet.");
  }

  const lastUpdatedText = latestSync 
    ? new Date(latestSync.lastSyncedAt).toLocaleString('en-AU', {
        timeZone: 'Australia/Sydney',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : "Never";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Profitability</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Financial performance and profitability data for all projects.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100/50 dark:bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
             <TrendingUp className="h-3 w-3 text-brand" />
             Last Synced: {lastUpdatedText}
          </div>
          <ProfitabilitySyncButton />
        </div>
      </div>

      <ProfitabilityTable data={mergedData} />
    </div>
  );
}
