import { Suspense } from "react";
import {
  FileText,
  ArrowLeft,
  Calendar,
  Info,
  PieChart,
  Database,
  Calculator,
  DollarSign,
  CheckCircle2,
  Clock,
  PackageCheck,
  Plus,
  Minus,
  Equal,
  AlertTriangle,
  Receipt,
  Forward
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { getJobCostReport } from "@/app/actions/financials";
import { JobCostTable } from "@/app/reports/job-cost/job-cost-table";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";
import { PENDING_LABOUR_THRESHOLD_RATIO, PENDING_LABOUR_THRESHOLD_ABSOLUTE } from "@/lib/constants/financials";


export const dynamic = "force-dynamic";

interface JobCostReportPageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function JobCostReportPage({ searchParams }: JobCostReportPageProps) {
  const { month = format(new Date(), 'yyyy-MM') } = await searchParams;
  
  const reportData = await getJobCostReport(month);
  
  const totalOpening = reportData.reduce((acc, p) => acc + (p.openingBalance || 0), 0);
  const totalApprovedLabour = reportData.reduce((acc, p) => acc + (p.approvedLabourThisMonth || 0), 0);
  const totalPendingLabour = reportData.reduce((acc, p) => acc + (p.pendingLabourCostThisMonth || 0), 0);
  const totalMaterials = reportData.reduce((acc, p) => acc + (p.financials?.materialCostThisMonth || 0), 0);
  const totalBilled = reportData.reduce((acc, p) => acc + (p.invoicedThisMonth || 0), 0);
  const totalClosing = reportData.reduce((acc, p) => acc + (p.closingBalance || 0), 0);

  const isHighPendingRisk = totalPendingLabour > (totalApprovedLabour * PENDING_LABOUR_THRESHOLD_RATIO) || 
                            totalPendingLabour > PENDING_LABOUR_THRESHOLD_ABSOLUTE;

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
            This report explains the movement from Opening WIP to Closing WIP, tracking every dollar spent and billed during the month.
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
            <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                   Report Period: {format(new Date(month + '-01'), 'MMMM yyyy')}
                </span>
            </div>
            {isHighPendingRisk && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20 rounded-lg animate-pulse">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tight">High volume of labour awaiting approval</span>
              </div>
            )}
        </div>
      </div>

      {/* Financial Flow Summary */}
      <div className="grid grid-cols-1 gap-8 animate-in slide-in-from-bottom-4 duration-1000 delay-200">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-end gap-4 lg:gap-0">
          
          {/* Section: Carry Over */}
          <div className="flex-none lg:w-64 space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Forward className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Balance Forward</span>
            </div>
            <SummaryCard
              title="Opening WIP"
              value={totalOpening}
              icon={<DollarSign className="h-4 w-4" />}
              description="Carried from previous month"
              tooltip="Value of work done but not yet billed at the start of the month."
              color="slate"
            />
          </div>

          <div className="pb-10">
            <MathOperator type="plus" />
          </div>

          {/* Section: Monthly Movement */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Calendar className="h-3.5 w-3.5 text-brand/60" />
              <span className="text-[10px] font-bold text-brand/60 uppercase tracking-widest">This Month's Movement</span>
            </div>
            <div className="flex flex-col lg:flex-row items-stretch gap-2">
              <SummaryCard
                title="Approved Labour"
                value={totalApprovedLabour}
                icon={<CheckCircle2 className="h-4 w-4" />}
                description="Finalized costs"
                tooltip="Approved or invoiced labour costs for this month."
                color="blue"
              />
              <div className="hidden lg:flex items-center"><Plus className="h-3 w-3 text-slate-300" /></div>
              <SummaryCard
                title="Pending Labour"
                value={totalPendingLabour}
                icon={<Clock className="h-4 w-4" />}
                description="Awaiting approval"
                tooltip="Labour entered but still in Draft or Pending status."
                color="amber"
                highlight={isHighPendingRisk}
              />
              <div className="hidden lg:flex items-center"><Plus className="h-3 w-3 text-slate-300" /></div>
              <SummaryCard
                title="Materials"
                value={totalMaterials}
                icon={<PackageCheck className="h-4 w-4" />}
                description="Received POs"
                tooltip="Purchase orders marked as 'Received' this month."
                color="indigo"
              />
              <div className="hidden lg:flex items-center"><Minus className="h-3 w-3 text-slate-300" /></div>
              <SummaryCard
                title="Money Billed"
                value={totalBilled}
                icon={<Receipt className="h-4 w-4" />}
                description="Invoiced to clients"
                tooltip="Total amount invoiced to customers during this month."
                color="emerald"
              />
            </div>
          </div>

          <div className="pb-10">
            <MathOperator type="equal" />
          </div>

          {/* Section: Final Position */}
          <div className="flex-none lg:w-72 space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Calculator className="h-3.5 w-3.5 text-brand" />
              <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Final Position</span>
            </div>
            <SummaryCard
              title="Closing WIP"
              value={totalClosing}
              icon={<Calculator className="h-4 w-4" />}
              description="Month-end balance"
              subtext="Costs incurred but not yet billed."
              tooltip="Total value of all active projects waiting to be recovered at month end."
              color="brand"
            />
          </div>
        </div>
      </div>

      <Suspense fallback={<div className="h-96 w-full bg-slate-100 animate-pulse rounded-3xl" />}>
        <JobCostTable initialData={reportData} currentMonth={month} />
      </Suspense>
    </div>
  );
}

function MathOperator({ type }: { type: 'plus' | 'minus' | 'equal' }) {
  return (
    <div className="flex items-center justify-center py-2 lg:px-4">
      <div className="flex items-center justify-center">
        {type === 'plus' && <Plus className="h-5 w-5 text-slate-300" />}
        {type === 'minus' && <Minus className="h-5 w-5 text-slate-300" />}
        {type === 'equal' && <div className="text-2xl font-light text-slate-300 leading-none">=</div>}
      </div>
    </div>
  );
}

function SummaryCard({ 
  title, 
  value, 
  icon, 
  description, 
  color, 
  tooltip, 
  highlight,
  subtext
}: { 
  title: string, 
  value: number, 
  icon: any, 
  description: string, 
  color: string, 
  tooltip: string,
  highlight?: boolean,
  subtext?: string
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    slate: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    indigo: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    brand: "bg-brand/10 text-brand border-brand/20",
  };

  return (
    <div className={cn(
      "flex-1 bg-white dark:bg-slate-900 p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden",
      highlight ? "border-amber-500/50 shadow-lg shadow-amber-500/5 bg-amber-50/5" : "border-slate-200/60 dark:border-slate-800/60 shadow-sm",
      "hover:border-brand/30"
    )}>
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className={cn("p-2 rounded-xl border", colorClasses[color])}>
          {icon}
        </div>
      </div>
      
      <div className="space-y-1 relative z-10">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{title}</p>
          <Tooltip content={tooltip}>
            <Info className="h-3 w-3 text-slate-300 cursor-help" />
          </Tooltip>
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
          {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(value)}
        </h3>
        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{description}</p>
        {subtext && (
          <p className="text-[10px] text-slate-400 italic mt-2 leading-tight">{subtext}</p>
        )}
      </div>
    </div>
  );
}
