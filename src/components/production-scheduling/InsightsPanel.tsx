import { useState, useEffect } from "react";
import { Lightbulb, ChevronDown, ChevronRight, AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { InsightItem } from "@/app/actions/production-scheduling";

interface InsightsPanelProps {
  insights: InsightItem[];
  onFilterApply: (filter: string) => void;
}

export function InsightsPanel({ insights, onFilterApply }: InsightsPanelProps) {
  const hasCritical = insights.some((i) => i.severity === "critical");
  const hasWarning = insights.some((i) => i.severity === "warning");
  
  const [isOpen, setIsOpen] = useState(hasCritical);

  // Update default open state if insights change and we haven't interacted? 
  // Requirements say "Default expanded state: expanded if any critical insights exist, collapsed otherwise."
  // Using initial state is usually enough, but we can sync if needed. Let's just use it as initial state or sync it when insights change.
  useEffect(() => {
    setIsOpen(hasCritical);
  }, [hasCritical]);

  let badgeColor = "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50";
  if (hasCritical) {
    badgeColor = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50";
  } else if (hasWarning) {
    badgeColor = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50";
  }

  if (insights.length === 0) {
    badgeColor = "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700";
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <h2 className="font-bold text-slate-900 dark:text-white">Insights &amp; Alerts</h2>
          <span className={cn("ml-2 px-2 py-0.5 text-xs font-bold rounded-full border", badgeColor)}>
            {insights.length}
          </span>
        </div>
        {isOpen ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          {insights.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 p-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>No alerts at this time. Everything looks on track.</span>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {insights.map((insight) => {
                let dotColor = "bg-blue-500";
                if (insight.severity === "critical") dotColor = "bg-red-500";
                else if (insight.severity === "warning") dotColor = "bg-amber-500";

                return (
                  <div key={insight.type} className="flex items-center gap-3 py-3">
                    <div className={cn("w-2 h-2 rounded-full shrink-0 mt-1 self-start", dotColor)} />
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white inline mr-2">
                        {insight.title}
                      </h3>
                      <span className="text-sm text-slate-500 dark:text-slate-400 inline">
                        {insight.description}
                      </span>
                    </div>
                    {insight.actionLabel && insight.actionFilter && (
                      <button
                        onClick={() => onFilterApply(insight.actionFilter!)}
                        className="text-xs font-medium text-brand hover:text-brand/80 transition-colors whitespace-nowrap shrink-0 self-start mt-1"
                      >
                        {insight.actionLabel} &rarr;
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
