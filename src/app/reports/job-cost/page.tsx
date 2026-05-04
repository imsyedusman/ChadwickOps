import { Suspense } from "react";
import {
  FileText,
  ArrowLeft,
  Calendar,
  Info,
  PieChart
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { getJobCostReport } from "@/app/actions/financials";
import { JobCostTable } from "@/app/reports/job-cost/job-cost-table";
import { cn } from "@/lib/utils";


export const dynamic = "force-dynamic";

interface JobCostReportPageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function JobCostReportPage({ searchParams }: JobCostReportPageProps) {
  const { month = format(new Date(), 'yyyy-MM') } = await searchParams;
  
  const reportData = await getJobCostReport(month);
  
  const totalUnrecovered = reportData.reduce((acc, p) => acc + (p.financials?.unrecoveredAmount || 0), 0);
  const totalInvoiced = reportData.reduce((acc, p) => acc + (p.financials?.totalInvoicedToDate || 0), 0);
  const totalCost = reportData.reduce((acc, p) => acc + (p.financials?.totalCostToDate || 0), 0);

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
            This report shows how much we’ve spent on each job vs how much we’ve invoiced.
            <br />
            <span className="text-brand">If ‘Unrecovered’ is high, it means we’ve spent money but haven’t billed the client yet.</span>
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

      {/* Summary Mini Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard
          title="Money Spent on Jobs (So Far)"
          value={totalCost}
          icon={<PieChart className="h-5 w-5 text-blue-500" />}
          description="Total labour + material costs incurred"
          color="blue"
        />
        <SummaryCard
          title="Money Invoiced to Clients"
          value={totalInvoiced}
          icon={<FileText className="h-5 w-5 text-emerald-500" />}
          description="What we’ve billed so far (excl. drafts)"
          color="emerald"
        />
        <SummaryCard
          title="Money Still Not Recovered"
          value={totalUnrecovered}
          icon={<Info className="h-5 w-5 text-amber-500" />}
          description="Cost we haven’t been paid for yet"
          color="amber"
        />
      </div>

      {/* Main Table Content */}
      <Suspense fallback={<div className="h-96 w-full bg-slate-100 animate-pulse rounded-3xl" />}>
        <JobCostTable initialData={reportData} currentMonth={month} />
      </Suspense>
    </div>
  );
}

// Wrapper for filters to use Suspense
async function JobCostTableFilters({ month }: { month: string }) {
  return null; // The MonthPicker is inside JobCostTable, so we don't need this yet.
  // However, if we wanted to move it out, we could.
}

function SummaryCard({ title, value, icon, description, color }: { title: string, value: number, icon: any, description: string, color: string }) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-500",
    emerald: "bg-emerald-500/10 text-emerald-500",
    amber: "bg-amber-500/10 text-amber-500",
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm group hover:border-brand/20 transition-all duration-300">
      <div className="flex items-start justify-between mb-6">
        <div className={cn("p-3 rounded-2xl", colorClasses[color])}>
          {icon}
        </div>
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
