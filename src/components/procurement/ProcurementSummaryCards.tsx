"use client";

import { Card } from "@/components/ui/card";
import { AlertCircle, Clock, Info, BarChart3, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcurementSummaryCardsProps {
  summary: {
    totalProjects: number;
    backorderItemCount: number;
    outstandingMaterialCost: number;
    projectsWaitingOnMaterials: number;
    lateSupplierDeliveries: number;
    missingSupplierEtas: number;
  };
  onMetricClick?: (tab: string, filter?: string) => void;
}

export function ProcurementSummaryCards({ summary, onMetricClick }: ProcurementSummaryCardsProps) {
  const cards = [
    {
      title: "BACKORDER ITEMS",
      value: summary.backorderItemCount,
      subtitle: `${summary.projectsWaitingOnMaterials} Projects waiting`,
      icon: AlertCircle,
      color: "text-red-500",
      bg: "bg-red-50",
      tab: "backorders",
      filter: "PROBLEMS"
    },
    {
      title: "OUTSTANDING COST",
      value: `$${(summary.outstandingMaterialCost / 1000).toFixed(1)}k`,
      subtitle: "Total purchase value",
      icon: BarChart3,
      color: "text-brand",
      bg: "bg-blue-50",
      tab: "backorders",
      filter: "ALL"
    },
    {
        title: "LATE DELIVERIES",
        value: summary.lateSupplierDeliveries,
        subtitle: "Past expected date",
        icon: Clock,
        color: "text-orange-500",
        bg: "bg-orange-50",
        tab: "backorders",
        filter: "ACTION_FOLLOW_UP"
    },
    {
        title: "MISSING ETAS",
        value: summary.missingSupplierEtas,
        subtitle: "Awaiting supplier date",
        icon: Info,
        color: "text-purple-500",
        bg: "bg-purple-50",
        tab: "backorders",
        filter: "ACTION_CONFIRM_ETA"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card 
            key={card.title} 
            className={cn(
                "group relative transition-all hover:shadow-md border-slate-200 dark:border-slate-800",
                onMetricClick ? "cursor-pointer" : ""
            )}
            onClick={() => onMetricClick?.(card.tab, card.filter)}
        >
          <div className="p-5 flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">
                {card.title}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    {card.value}
                </span>
                {onMetricClick && (
                    <ArrowUpRight className="h-3 w-3 text-slate-300 group-hover:text-brand transition-colors" />
                )}
              </div>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-tight">
                {card.subtitle}
              </span>
            </div>
            <div className={cn("p-2.5 rounded-xl transition-transform group-hover:scale-105", card.bg, card.color)}>
              <card.icon className="h-5 w-5" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
