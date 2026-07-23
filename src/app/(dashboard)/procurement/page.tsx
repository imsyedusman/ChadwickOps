import { getProcurementDashboardData, getBackordersData, getSupplierRiskData } from "@/app/actions/procurement";
import { getProcurementSyncProgress } from "@/app/actions/procurement-sync";
import { ProcurementHubClient } from "@/components/procurement/ProcurementHubClient";
import { ProcurementSyncStatus } from "@/components/dashboard/ProcurementSyncStatus";
import { ProcurementIntegrityBanner } from "@/components/procurement/ProcurementIntegrityBanner";
import { HelpCircle } from "lucide-react";
import { generatePageAISummary } from "@/app/actions/ai-insights";
import { AISummaryCard } from "@/components/ui/AISummaryCard";
import { Suspense } from "react";
import { db } from "@/db";
import { purchaseOrders } from "@/db/schema";
import { notInArray, count } from "drizzle-orm";

async function ProcurementAISummaryWrapper({ backorderData, outstandingValue }: { backorderData: any[], outstandingValue: number }) {
  const resultData = await db.select({
    count: count()
  }).from(purchaseOrders).where(notInArray(purchaseOrders.status, ['Fully Received', 'Cancelled']));
  const totalOpenPOs = resultData[0]?.count || 0;

  const backorderedPOCount = new Set(backorderData.map(b => b.poNumber)).size;
  const overduePOCount = new Set(backorderData.filter(b => b.daysOutstanding > 0).map(b => b.poNumber)).size;

  const context = {
    totalOpenPOCount: totalOpenPOs,
    backorderedPOCount,
    overduePOCount,
    totalOutstandingValue: outstandingValue
  };

  const result = await generatePageAISummary("procurement", context);
  const summary = result.success && result.data ? result.data.summary : null;
  return <AISummaryCard summary={summary} loading={false} compact={true} />;
}

export const dynamic = "force-dynamic";

export default async function ProcurementPage() {
  const [dashboardResult, backordersResult, supplierResult, syncProgressResult] = await Promise.all([
    getProcurementDashboardData(),
    getBackordersData(),
    getSupplierRiskData(),
    getProcurementSyncProgress()
  ]);

  if (!dashboardResult.success || !dashboardResult.data) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Procurement Hub</h1>
        <p className="text-red-500">Error loading data: {dashboardResult.error}</p>
      </div>
    );
  }

  const { data: projectData, summary } = dashboardResult;
  const backorderData = backordersResult.data || [];
  const supplierData = supplierResult.data || [];

  return (
    <div className="flex flex-col gap-8 p-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Procurement Hub</h1>
            <div className="group relative">
               <HelpCircle className="h-4 w-4 text-slate-300 cursor-help hover:text-slate-500 transition-colors" />
               <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-slate-900 text-white text-[11px] rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 shadow-2xl border border-slate-800 leading-relaxed">
                  <p className="font-bold text-slate-300 mb-1.5 uppercase tracking-widest text-[9px]">Investigation Workspace</p>
                  This workspace identifies procurement bottlenecks and material delays. Trace problems from suppliers to project impacts.
               </div>
            </div>
          </div>
          <p className="text-slate-500 font-medium text-sm">Operational investigation and traceability command center.</p>
        </div>
        
        <div className="flex flex-col items-end gap-3 w-full md:w-[45%]">
          <div className="w-full">
            <Suspense fallback={<AISummaryCard summary={null} loading={true} compact={true} />}>
              <ProcurementAISummaryWrapper 
                backorderData={backorderData} 
                outstandingValue={summary.outstandingMaterialCost} 
              />
            </Suspense>
          </div>
          <div className="flex justify-end items-center gap-4">
            <ProcurementSyncStatus initialProgress={syncProgressResult} />
          </div>
        </div>
      </div>
      
      {summary.integrity && (
        <div className="mb-8">
          <ProcurementIntegrityBanner 
            integrity={summary.integrity} 
            syncHealth={summary.syncHealth} 
            isSyncing={!!syncProgressResult?.active}
          />
        </div>
      )}

      <ProcurementHubClient 
        initialProjectData={projectData}
        initialBackorderData={backorderData}
        initialSupplierData={supplierData}
        summary={summary}
      />
    </div>
  );
}
