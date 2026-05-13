import { getProcurementDashboardData, getBackordersData, getSupplierRiskData } from "@/app/actions/procurement";
import { ProcurementHubClient } from "@/components/procurement/ProcurementHubClient";
import { ProcurementSyncStatus } from "@/components/dashboard/ProcurementSyncStatus";
import { HelpCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProcurementPage() {
  const [dashboardResult, backordersResult, supplierResult] = await Promise.all([
    getProcurementDashboardData(),
    getBackordersData(),
    getSupplierRiskData()
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
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
        
        <div className="flex items-center gap-3">
          <ProcurementSyncStatus />
        </div>
      </div>

      <ProcurementHubClient 
        initialProjectData={projectData}
        initialBackorderData={backorderData}
        initialSupplierData={supplierData}
        summary={summary}
      />
    </div>
  );
}
