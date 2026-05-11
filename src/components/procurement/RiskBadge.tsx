import { ProcurementRiskLevel, getRiskLevelDefinition } from "@/lib/procurement-logic";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, Clock, Info, CheckCircle2 } from "lucide-react";

interface RiskBadgeProps {
  level: ProcurementRiskLevel;
  className?: string;
  showIcon?: boolean;
}

export function RiskBadge({ level, className, showIcon = true }: RiskBadgeProps) {
  const definition = getRiskLevelDefinition(level);

  const styles = {
    DELIVERY_RISK: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30",
    AT_RISK: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30",
    DELAYED_PROCUREMENT: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30",
    MISSING_ETA: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700",
    ON_TRACK: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30",
  };

  const icons = {
    DELIVERY_RISK: <AlertCircle className="h-3 w-3" />,
    AT_RISK: <AlertTriangle className="h-3 w-3" />,
    DELAYED_PROCUREMENT: <Clock className="h-3 w-3" />,
    MISSING_ETA: <Info className="h-3 w-3" />,
    ON_TRACK: <CheckCircle2 className="h-3 w-3" />,
  };

  const labels = {
    DELIVERY_RISK: "Delivery Risk",
    AT_RISK: "At Risk",
    DELAYED_PROCUREMENT: "Delayed",
    MISSING_ETA: "Missing ETA",
    ON_TRACK: "On Track",
  };

  return (
    <div 
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
        styles[level],
        className
      )}
      title={definition}
    >
      {showIcon && icons[level]}
      {labels[level]}
    </div>
  );
}
