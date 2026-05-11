import { Card } from "@/components/ui/card";
import { AlertCircle, Clock, Info, Package, BarChart3, Activity, Ban, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface SummaryProps {
  summary: {
    totalProjects: number;
    deliveryRiskCount: number;
    delayedCount: number;
    atRiskCount: number;
    missingEtaCount: number;
    syncHealth: {
      lastSyncAt: Date | null;
      lastStatus: string;
      retryQueueCount: number;
      permFailureCount: number;
    };
  };
}

export function ProcurementSummaryCards({ summary }: SummaryProps) {
  const { syncHealth } = summary;

  const mainCards = [
    {
      label: "Total Projects",
      value: summary.totalProjects,
      icon: <Package className="h-4 w-4" />,
      color: "text-slate-600 dark:text-slate-400",
      bg: "bg-slate-50 dark:bg-slate-800/50",
    },
    {
      label: "Delivery Risk",
      value: summary.deliveryRiskCount,
      icon: <AlertCircle className="h-4 w-4" />,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/20",
      subtext: "ETA > Delivery Date",
    },
    {
        label: "Delayed",
        value: summary.delayedCount,
        icon: <Clock className="h-4 w-4" />,
        color: "text-orange-600 dark:text-orange-400",
        bg: "bg-orange-50 dark:bg-orange-950/20",
        subtext: "Past ETA",
    },
    {
      label: "At Risk",
      value: summary.atRiskCount,
      icon: <BarChart3 className="h-4 w-4" />,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      subtext: "Nearing Due Date",
    },
    {
      label: "Missing ETA",
      value: summary.missingEtaCount,
      icon: <Info className="h-4 w-4" />,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/20",
      subtext: "Follow-up required",
    },
  ];

  const healthCards = [
    {
      label: "Sync Health",
      value: syncHealth.lastStatus,
      icon: <Activity className="h-4 w-4" />,
      color: syncHealth.lastStatus === 'SUCCESS' ? "text-emerald-600" : "text-amber-600",
      bg: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800",
      subtext: syncHealth.lastSyncAt ? `${formatDistanceToNow(new Date(syncHealth.lastSyncAt))} ago` : "Never synced",
    },
    {
      label: "Retry Queue",
      value: syncHealth.retryQueueCount,
      icon: <Activity className="h-4 w-4" />,
      color: syncHealth.retryQueueCount > 0 ? "text-amber-600" : "text-slate-400",
      bg: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800",
      subtext: "Pending reconciliation",
    },
    {
      label: "Failed POs",
      value: syncHealth.permFailureCount,
      icon: <Ban className="h-4 w-4" />,
      color: syncHealth.permFailureCount > 0 ? "text-red-600" : "text-slate-400",
      bg: "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800",
      subtext: "Exhausted all retries",
    }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {mainCards.map((card) => (
          <Card key={card.label} className={cn("p-4 border-none shadow-sm", card.bg)}>
            <div className="flex items-center justify-between mb-2">
              <div className={cn("p-2 rounded-lg bg-white dark:bg-slate-900 shadow-sm", card.color)}>
                {card.icon}
              </div>
              <span className="text-2xl font-bold tracking-tight">{card.value}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{card.label}</span>
              {card.subtext && <span className="text-[10px] text-slate-400 font-medium">{card.subtext}</span>}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
         {healthCards.map((card) => (
           <div key={card.label} className={cn(
             "flex items-center gap-4 px-4 py-3 rounded-2xl border shadow-sm transition-all",
             card.bg
           )}>
             <div className={cn("p-2 rounded-xl bg-slate-50 dark:bg-slate-800", card.color)}>
               {card.icon}
             </div>
             <div className="flex flex-col min-w-[100px]">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">{card.label}</span>
                <div className="flex items-baseline gap-2">
                  <span className={cn("text-sm font-bold tracking-tight", card.color)}>{card.value}</span>
                  <span className="text-[10px] text-slate-500 font-medium">{card.subtext}</span>
                </div>
             </div>
           </div>
         ))}
      </div>
    </div>
  );
}
