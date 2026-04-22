import { Suspense } from "react";
import { db } from "@/db";
import { projects, clients, displayStages } from "@/db/schema";
import { and, gte, lte, eq, isNotNull, desc } from "drizzle-orm";
import { getPeriodBounds, ReportingPreset, SYDNEY_TZ } from "@/lib/reports";
import { ProjectTable } from "@/components/dashboard/project-table";
import { ChevronLeft, FileBarChart, Filter, Calendar } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns-tz";

export const dynamic = "force-dynamic";

interface DrillDownPageProps {
  searchParams: Promise<{ p?: string; m?: string }>;
}

export default async function DrillDownPage({ searchParams }: DrillDownPageProps) {
  const { p = "this_month", m = "orders_received" } = await searchParams;
  const preset = p as ReportingPreset;
  const metric = m as "orders_received" | "work_scheduled";

  const bounds = getPeriodBounds(preset);
  
  // Define filtering logic based on metric
  const dateField = metric === "orders_received" ? projects.projectCreationDate : projects.startDate;
  const metricLabel = metric === "orders_received" ? "Orders Received" : "Work Scheduled";
  const fieldLabel = metric === "orders_received" ? "Project Creation Date" : "Start Date";

  const data = await db.query.projects.findMany({
    with: {
      client: true,
      displayStage: true,
    },
    where: and(
      eq(projects.isArchived, false),
      isNotNull(dateField),
      gte(dateField, bounds.from),
      lte(dateField, bounds.to)
    ),
    orderBy: [desc(dateField)]
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Breadcrumbs & Header */}
      <div className="space-y-4">
        <Link 
          href="/reports" 
          className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-brand transition-colors group"
        >
          <ChevronLeft className="h-3 w-3 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-brand/10 rounded-lg">
                <FileBarChart className="h-5 w-5 text-brand" />
              </div>
              <span className="text-[10px] font-bold text-brand uppercase tracking-[0.2em]">Report Detail</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{metricLabel}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium italic">
              Showing {data.length} projects where {fieldLabel} is within the selected period.
            </p>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Active Filter</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-brand" />
                {format(bounds.from, "MMM d, yyyy", { timeZone: SYDNEY_TZ })} – {format(bounds.to, "MMM d, yyyy", { timeZone: SYDNEY_TZ })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Project Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden p-1">
        <Suspense fallback={<div className="h-96 flex items-center justify-center text-xs text-slate-400 italic">Mounting operational table...</div>}>
          <ProjectTable projects={data as any} />
        </Suspense>
      </div>
    </div>
  );
}
