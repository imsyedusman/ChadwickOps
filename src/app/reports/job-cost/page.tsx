import { Suspense } from "react";
import {
  FileText,
  ArrowLeft,
  Calendar,
  Info,
  PieChart,
  Database,
  Calculator
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { getJobCostReport } from "@/app/actions/financials";
import { JobCostTable } from "@/app/reports/job-cost/job-cost-table";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";


export const dynamic = "force-dynamic";

interface JobCostReportPageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function JobCostReportPage({ searchParams }: JobCostReportPageProps) {
  const { month = format(new Date(), 'yyyy-MM') } = await searchParams;
  
  const reportData = await getJobCostReport(month);
  
  const totalOpening = reportData.reduce((acc, p) => acc + (p.openingBalance || 0), 0);
  const totalLabour = reportData.reduce((acc, p) => acc + (p.financials?.labourCostThisMonth || 0), 0);
  const totalMaterials = reportData.reduce((acc, p) => acc + (p.financials?.materialCostThisMonth || 0), 0);
  const totalClosing = reportData.reduce((acc, p) => acc + (p.closingBalance || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex-1">
          <Link 
            href="/reports"
            className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-brand transition-colors mb-4"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Reports
          </Link>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-emerald-500/10 rounded-lg">
              <PieChart className="h-5 w-5 text-emerald-500" />
            </div>
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em]">Financial Intelligence</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Monthly Job Cost Report</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium max-w-2xl leading-relaxed">
            This report shows how much we spent on jobs, how much we billed customers, and how much money is still waiting to be recovered.
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
            <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                   Report Period: {format(new Date(month + '-01'), 'MMMM yyyy')}
                </span>
            </div>
        </div>
      </div>

      {/* Financial Flow Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Opening WIP"
          value={totalOpening}
          icon={<Calendar className="h-4 w-4 text-slate-400" />}
          description="Cumulative balance at month start"
          tooltip="This is the value of work done but not yet billed or completed at the start of the month."
          color="slate"
        />
        <SummaryCard
          title="Labour Added"
          value={totalLabour}
          icon={<PieChart className="h-4 w-4 text-blue-500" />}
          description="Timesheets added this month"
          tooltip="This includes all labour costs from timesheets in WorkGuru for this month."
          color="blue"
        />
        <SummaryCard
          title="Materials Received"
          value={totalMaterials}
          icon={<PieChart className="h-4 w-4 text-indigo-500" />}
          description="POs received this month"
          tooltip="ONLY includes purchase orders with status 'Received' where the receipt date is within this month."
          color="indigo"
        />

        <SummaryCard
          title="Closing WIP"
          value={totalClosing}
          icon={<Info className="h-4 w-4 text-brand" />}
          description="Cumulative balance at month end"
          tooltip="This is the total value of all active projects waiting to be recovered at the end of the month."
          color="brand"
        />
      </div>

      <Suspense fallback={<div className="h-96 w-full bg-slate-100 animate-pulse rounded-3xl" />}>
        <JobCostTable initialData={reportData} currentMonth={month} />
      </Suspense>
    </div>
  );
}

function SummaryCard({ title, value, icon, description, color, tooltip }: { title: string, value: number, icon: any, description: string, color: string, tooltip: string }) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-500",
    emerald: "bg-emerald-500/10 text-emerald-500",
    amber: "bg-amber-500/10 text-amber-500",
    slate: "bg-slate-500/10 text-slate-500",
    brand: "bg-brand/10 text-brand",
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm group hover:border-brand/20 transition-all duration-300">
      <div className="flex items-start justify-between mb-6">
        <div className={cn("p-3 rounded-2xl", colorClasses[color])}>
          {icon}
        </div>
        <Tooltip content={tooltip}>
          <div className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-help">
            <Info className="h-4 w-4 text-slate-300" />
          </div>
        </Tooltip>
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
          {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value)}
        </h3>
        <p className="text-[11px] font-medium text-slate-400 mt-2">{description}</p>
      </div>
    </div>
  );
}
