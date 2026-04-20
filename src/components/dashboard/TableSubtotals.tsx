'use client';

import React from 'react';
import { 
  TrendingUp, 
  Clock, 
  Activity, 
  Target,
  BarChart3,
  HelpCircle
} from "lucide-react";
import { StatCard } from "./DashboardSummaries";

interface TableSubtotalsProps {
  totalValue: number;
  totalBudget: number;
  totalActual: number;
  totalRemaining: number;
  overallProgress: number;
}

export function TableSubtotals({ 
  totalValue, 
  totalBudget, 
  totalActual, 
  totalRemaining, 
  overallProgress 
}: TableSubtotalsProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-32 w-full animate-pulse bg-slate-100 dark:bg-slate-800 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center gap-2 px-1">
        <div className="h-4 w-1 bg-brand rounded-full" />
        <h2 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Subtotals (Filtered Results)</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <StatCard 
        title="Filtered Value" 
        value={new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(totalValue)} 
        icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
        description="Total for visible rows"
        tooltip="Sum of project value for the filtered results."
      />
      <StatCard 
        title="Budget Hours" 
        value={`${Math.round(totalBudget).toLocaleString()}h`}
        icon={<Target className="h-5 w-5 text-indigo-500" />}
        description="Total allocated time"
        tooltip="Total budget hours for the filtered results."
      />
      <StatCard 
        title="Actual Hours" 
        value={`${Math.round(totalActual).toLocaleString()}h`}
        icon={<Activity className="h-5 w-5 text-blue-500" />}
        description="Total time logged"
        tooltip="Total actual hours for the filtered results."
      />
      <StatCard 
        title="Hours to Go" 
        value={`${Math.round(totalRemaining).toLocaleString()}h`}
        icon={<Clock className="h-5 w-5 text-orange-500" />}
        description="Remaining work"
        tooltip="Total remaining hours for the filtered results (Budget - Actual)."
      />
      <StatCard 
        title="Overall Progress" 
        value={`${Math.round(overallProgress)}%`}
        icon={<BarChart3 className="h-5 w-5 text-brand" />}
        description="Combined completion"
        tooltip="Overall progress percentage: (Total Actual / Total Budget) * 100"
      />
      </div>
    </div>
  );
}
