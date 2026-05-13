import { ProcurementActionMetadata } from "@/lib/procurement-logic";
import { cn } from "@/lib/utils";
import { AlertCircle, Clock, Info, CheckCircle2, MoreHorizontal } from "lucide-react";

interface RiskBadgeProps {
  action: ProcurementActionMetadata;
  showAction?: boolean;
  showReason?: boolean;
  className?: string;
}

export function RiskBadge({ action, showAction = true, showReason = true, className }: RiskBadgeProps) {
  const Icon = action.type === 'ACTION_ESCALATE' ? AlertCircle :
               action.type === 'ACTION_FOLLOW_UP' ? Clock :
               action.type === 'ACTION_CONFIRM_ETA' ? Info :
               action.type === 'ACTION_NONE' ? CheckCircle2 :
               MoreHorizontal;

  return (
    <div className={cn("flex flex-col gap-1 w-fit", className)}>
        <div 
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-widest"
            style={{ 
                backgroundColor: action.bgTint, 
                borderColor: `${action.color}15`, 
                color: action.color
            }}
        >
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: action.color }} />
            <span className="text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap">
                {action.label}
            </span>
        </div>
        
        <div className="flex flex-col gap-0.5 ml-1">
            {showAction && action.severity < 4 && (
                <div className="text-[10px] font-semibold text-slate-900 uppercase tracking-tight">
                    {action.actionRequired}
                </div>
            )}
            {showReason && action.severity < 4 && (
                <div className="text-[9px] font-medium text-slate-400 italic">
                    {action.reason}
                </div>
            )}
        </div>
    </div>
  );
}
