export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth-helpers";
import { fetchRiskV2Data } from "@/actions/capacity-v2";
import RiskV2ClientView from "./_components/RiskV2ClientView";
import { Sparkles, History, Layers } from "lucide-react";

export default async function CapacityRiskV2Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; horizon?: string }>;
}) {
  const session = await validateSession();
  if (!session) {
    redirect("/login");
  }

  const { view = "monthly", horizon = "6" } = await searchParams;
  const viewMode = view === "weekly" ? "weekly" : "monthly";
  const horizonMonths = [3, 6, 12].includes(Number(horizon)) ? Number(horizon) : 6;

  const dashboardData = await fetchRiskV2Data(viewMode, horizonMonths);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Capacity & Risk V2
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Sparkles className="w-3 h-3" /> Beta Phase 1
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Intelligent production capacity & demand forecasting engine with real Chadwick calendar shifts.
          </p>
        </div>

        {/* Data Freshness Indicator */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
          <History className="w-3.5 h-3.5 text-slate-400" />
          <span>Last WorkGuru Sync:</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {dashboardData.lastSyncTimestamp || "Unavailable"}
          </span>
        </div>
      </div>

      {/* Main Client Dashboard */}
      <RiskV2ClientView initialData={dashboardData} />
    </div>
  );
}
