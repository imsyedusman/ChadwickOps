import React from "react";
import { ShoppingBag, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcurementSummariesProps {
  totalCount: number;
  delayedCount: number;
  atRiskCount: number;
  pendingOrdersCount: number;
}

export function ProcurementSummaries({
  totalCount,
  delayedCount,
  atRiskCount,
  pendingOrdersCount,
}: ProcurementSummariesProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Total Projects"
        value={totalCount}
        icon={<ShoppingBag className="h-5 w-5 text-brand" />}
        description="Active projects being tracked"
      />
      <StatCard
        title="Delayed Deliveries"
        value={delayedCount}
        icon={<AlertCircle className="h-5 w-5 text-red-500" />}
        trend={delayedCount > 0 ? "ACTION REQUIRED" : "ALL CLEAR"}
        trendColor={delayedCount > 0 ? "text-red-600 bg-red-50 ring-red-100" : "text-emerald-600 bg-emerald-50 ring-emerald-100"}
        description="Supplier expected date passed"
      />
      <StatCard
        title="At Risk"
        value={atRiskCount}
        icon={<Clock className="h-5 w-5 text-amber-500" />}
        description="Deliveries due soon or partial"
      />
      <StatCard
        title="Pending Orders"
        value={pendingOrdersCount}
        icon={<CheckCircle2 className="h-5 w-5 text-indigo-500" />}
        description="Currently in ordering phase"
      />
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendColor?: string;
  description: string;
}

function StatCard({ title, value, icon, trend, trendColor, description }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm group hover:shadow-md hover:border-brand/20 transition-all duration-300 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-8 transform translate-x-4 -translate-y-4 opacity-[0.03] dark:opacity-[0.05] group-hover:scale-110 group-hover:text-brand transition-all duration-500 pointer-events-none">
        {icon}
      </div>
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/50 group-hover:border-brand/20 transition-colors">
           {icon}
        </div>
        {trend && (
           <div className={cn("text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ring-1 ring-inset transition-all", trendColor)}>
              {trend}
           </div>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums leading-none">
          {value}
        </h3>
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 tracking-tight">{title}</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium pt-1">{description}</p>
      </div>
    </div>
  );
}
