'use client';

import { 
  AlertTriangle, 
  CheckCircle2, 
  Layers,
  Calendar,
  Clock,
  HelpCircle,
  ArrowUpRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Tooltip } from "@/components/ui/Tooltip";

interface DashboardSummariesProps {
  totalCount: number;
  atRiskCount: number;
  onTrackCount: number;
  dueThisWeekCount: number;
  overdueCount: number;
  thisMonthCount: number;
  currentFilter: string;
}

export function DashboardSummaries({ 
  totalCount, 
  atRiskCount, 
  onTrackCount, 
  dueThisWeekCount,
  overdueCount,
  thisMonthCount,
  currentFilter 
}: DashboardSummariesProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard 
        title="Active Jobs" 
        value={totalCount.toString()} 
        icon={<Layers className="h-6 w-6 text-indigo-500" />}
        description="All live production records"
        href="/"
        isActive={currentFilter === ""}
        tooltip="Total volume of active projects currently tracked in the system."
      />
      <StatCard 
        title="At Risk" 
        value={atRiskCount.toString()} 
        icon={<AlertTriangle className="h-6 w-6 text-red-500" />}
        description="Utilization > 90%"
        href="/?filter=at_risk"
        isActive={currentFilter === "at_risk"}
        tooltip="Projects where remaining hours exceed 90% of availability based on daily capacity profiles."
      />
      <StatCard 
        title="Due This Week" 
        value={dueThisWeekCount.toString()} 
        icon={<Calendar className="h-6 w-6 text-brand" />}
        description="Deadline approaching"
        href="/?filter=due_this_week"
        isActive={currentFilter === "due_this_week"}
        tooltip="Jobs with a delivery date set within the current business week (Mon-Fri)."
      />
      <StatCard 
        title="Overdue" 
        value={overdueCount.toString()} 
        icon={<Clock className="h-6 w-6 text-orange-500" />}
        description="Past delivery date"
        href="/?filter=overdue"
        isActive={currentFilter === "overdue"}
        tooltip="Active projects where the delivery date has already passed."
      />
      <StatCard 
        title="This Month" 
        value={thisMonthCount.toString()} 
        icon={<Calendar className="h-6 w-6 text-blue-500" />}
        description="Due in current month"
        href="/?filter=this_month"
        isActive={currentFilter === "this_month"}
        tooltip="Projects with a delivery date in the current calendar month."
      />
      <StatCard 
        title="At Risk" 
        value={atRiskCount.toString()} 
        icon={<AlertTriangle className="h-6 w-6 text-red-500" />}
        description="Utilization > 90%"
        href="/?filter=at_risk"
        isActive={currentFilter === "at_risk"}
        tooltip="Projects where remaining hours exceed 90% of availability based on daily capacity profiles."
      />
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  description, 
  href,
  isActive,
  tooltip
}: { 
  title: string; 
  value: string; 
  icon: React.ReactNode; 
  description: string;
  href?: string;
  isActive?: boolean;
  tooltip?: string;
}) {
  const content = (
    <div className={cn(
      "bg-white dark:bg-slate-900 p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden group",
      isActive 
        ? "border-brand ring-2 ring-brand/5 shadow-md" 
        : "border-slate-200/60 dark:border-slate-800/60 hover:border-brand/40 shadow-sm hover:shadow-md"
    )}>
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl group-hover:scale-110 transition-transform duration-300">
           {icon}
        </div>
        <div className="flex gap-2">
          {isActive && <ArrowUpRight className="h-4 w-4 text-brand animate-in fade-in slide-in-from-bottom-2" />}
          {tooltip && (
            <Tooltip content={tooltip}>
              <HelpCircle className="h-3.5 w-3.5 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
            </Tooltip>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{title}</h3>
        <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{value}</p>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{description}</p>
        {isActive && <div className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />}
      </div>
    </div>
  );

  return href ? (
    <Link href={href}>
      {content}
    </Link>
  ) : content;
}
