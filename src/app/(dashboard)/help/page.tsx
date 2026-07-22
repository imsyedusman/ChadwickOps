"use client";

import { useState, useEffect } from "react";
import { 
  Info, 
  CheckCircle2, 
  XCircle, 
  BarChart3, 
  RefreshCcw, 
  Archive,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Zap,
  Clock,
  PieChart,
  CalendarDays,
  Menu,
  ChevronDown
} from "lucide-react";
import { ACTIVE_STATUSES, EXCLUDED_WIP_STATUSES } from "@/lib/project-utils";
import { cn } from "@/lib/utils";

const toc = [
  {
    heading: "General",
    items: [
      { id: "active-work", label: "Active Work vs. Excluded" },
      { id: "metrics", label: "KPI Definitions" },
      { id: "sync", label: "Data Synchronization" },
      { id: "job-cost", label: "Job Cost Report" },
      { id: "archives", label: "Archived Projects" },
    ]
  },
  {
    heading: "Production Scheduling",
    items: [
      { id: "production-scheduling", label: "Overview" },
      { id: "ps-gantt-bars", label: "Understanding the Gantt bars" },
      { id: "ps-scheduling", label: "Scheduling a project" },
      { id: "ps-padlocks", label: "Dependency padlocks" },
      { id: "ps-markers", label: "Delivery date markers" },
      { id: "ps-stage-hours", label: "Stage Hours panel" },
      { id: "ps-assigning", label: "Assigning workers" },
      { id: "ps-capacity", label: "Capacity and Bottlenecks" },
      { id: "ps-insights", label: "Insights and Alerts" },
      { id: "ps-auto-schedule", label: "Auto-Schedule" },
      { id: "ps-absences", label: "Staff Absences" },
    ]
  }
];

export default function HelpPage() {
  const [activeId, setActiveId] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-100px 0px -60% 0px" }
    );

    const elements = toc.flatMap(group => group.items).map(item => document.getElementById(item.id));
    elements.forEach(el => {
      if (el) observer.observe(el);
    });

    return () => {
      elements.forEach(el => {
        if (el) observer.unobserve(el);
      });
    };
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setMobileMenuOpen(false);
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col space-y-6">
      {toc.map((group, i) => (
        <div key={i}>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-2">
            {group.heading}
          </h4>
          <nav className="flex flex-col space-y-1">
            {group.items.map((item) => {
              const isActive = activeId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={cn(
                    "text-left p-2.5 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center",
                    isActive
                      ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {isActive && (
                    <div className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-in fade-in zoom-in duration-500" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Mobile Dropdown */}
      <div className="md:hidden mb-6">
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm font-bold text-slate-900 dark:text-white"
        >
          <span>Table of Contents</span>
          <ChevronDown className={cn("w-5 h-5 transition-transform", mobileMenuOpen && "rotate-180")} />
        </button>
        {mobileMenuOpen && (
          <div className="mt-2 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm max-h-[60vh] overflow-y-auto z-10 relative">
            <SidebarContent />
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-56 shrink-0">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pr-4 pb-8">
            <SidebarContent />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 pb-24">
          <div className="space-y-12">
            {/* Header */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-bold uppercase tracking-wider">
                <BookOpen className="h-3 w-3" />
                Documentation
              </div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                System Guide & Definitions
              </h1>
              <p className="text-lg text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
                Understand how the dashboard tracks and calculates your production data from WorkGuru.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-12">
              
              {/* 1. Active Work Section */}
              <section id="active-work" className="space-y-6 scroll-mt-6">
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="p-2 bg-indigo-500 rounded-lg text-white">
                    <Zap className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Active Work vs. Excluded</h2>
                </div>
                
                <p className="text-slate-600 dark:text-slate-400 font-medium">
                  The dashboard classifies work into <strong>Active</strong> and <strong>Inactive</strong> states based on their WorkGuru status. The <strong>Active Jobs</strong> filter on the main dashboard uses these definitions to focus on live production.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl p-6">
                    <h3 className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold mb-4">
                      <CheckCircle2 className="h-5 w-5" />
                      Included (Active Production)
                    </h3>
                    <ul className="grid grid-cols-1 gap-2">
                      {ACTIVE_STATUSES.map(status => (
                        <li key={status} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          {status}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                    <h3 className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-bold mb-4">
                      <XCircle className="h-5 w-5" />
                      Excluded (Inactive/Finished)
                    </h3>
                    <ul className="grid grid-cols-1 gap-2">
                    {EXCLUDED_WIP_STATUSES.map(status => (
                        <li key={status} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                          {status}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-[11px] text-slate-400 italic">
                      * Projects starting with internal code &quot;99xxx&quot; are also excluded from capacity metrics.
                    </p>
                  </div>
                </div>
              </section>

              {/* 2. Metrics Section */}
              <section id="metrics" className="space-y-6 scroll-mt-6">
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="p-2 bg-brand rounded-lg text-white">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">KPI Definitions</h2>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <MetricCard 
                    title="Budget Hours" 
                    definition="The total estimated hours defined in the Project Tasks within WorkGuru."
                    source="Pulled directly from WorkGuru 'Estimated Hours' column."
                  />
                  <MetricCard 
                    title="Actual Hours" 
                    definition="The total time logged by staff against project tasks."
                    source="Pulled from WorkGuru Timesheets."
                  />
                  <MetricCard 
                    title="Remaining Hours" 
                    definition="Budget Hours minus Actual Hours. This represents the outstanding workload."
                    source="Calculated locally: (Budget - Actual)."
                  />
                  <MetricCard 
                    title="Capacity" 
                    definition="The total available production hours for the workshop per month."
                    source="Calculated: (Staff × Weekly Hours × Weeks per Month × Efficiency)."
                  />
                  <MetricCard 
                    title="Utilization" 
                    definition="How much of your available capacity is consumed by the current workload."
                    source="Calculated: (Remaining Hours ÷ Capacity) × 100."
                  />
                </div>
              </section>

              {/* 3. Sync Section */}
              <section id="sync" className="space-y-6 scroll-mt-6">
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="p-2 bg-blue-500 rounded-lg text-white">
                    <RefreshCcw className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Data Synchronization</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      Quick Sync
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      Happens automatically every hour. It updates the 15 most recently modified projects to ensure today&apos;s changes reflect quickly.
                    </p>
                  </div>
                  <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      Full Sync
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      Runs daily or when manually triggered. It scans every project in WorkGuru to ensure the entire database is aligned.
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-2xl p-6 flex gap-4">
                  <Info className="h-6 w-6 text-amber-500 shrink-0" />
                  <div>
                    <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm mb-1">What does &quot;Stale&quot; mean?</h4>
                    <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed">
                      If a project hasn&apos;t been synced in over 24 hours, it may be marked as stale. This usually indicates the project was not found in the latest WorkGuru scan and may be a candidate for archiving.
                    </p>
                  </div>
                </div>
              </section>

              {/* 5. Job Cost Report Section */}
              <section id="job-cost" className="space-y-6 scroll-mt-6">
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="p-2 bg-emerald-500 rounded-lg text-white">
                    <PieChart className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Job Cost Report</h2>
                </div>

                <p className="text-slate-600 dark:text-slate-400 font-medium">
                  This report shows <strong>how much we’ve spent vs. how much we’ve invoiced</strong> for each project. It helps you see which projects are making money and which ones still have costs to recover.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      Where does the data come from?
                    </h3>
                    <ul className="space-y-3">
                      <li className="text-sm text-slate-600 dark:text-slate-400">
                        <strong className="text-slate-900 dark:text-white">Labour:</strong> Pulled from timesheets logged by the team.
                      </li>
                      <li className="text-sm text-slate-600 dark:text-slate-400">
                        <strong className="text-slate-900 dark:text-white">Materials:</strong> Pulled from approved or received purchase orders.
                      </li>
                      <li className="text-sm text-slate-600 dark:text-slate-400">
                        <strong className="text-slate-900 dark:text-white">Invoices:</strong> Pulled from billing records sent to clients.
                      </li>
                    </ul>
                  </div>

                  <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <Info className="h-4 w-4 text-emerald-500" />
                      What do the numbers mean?
                    </h3>
                    <ul className="space-y-3">
                      <li className="text-sm text-slate-600 dark:text-slate-400">
                        <strong className="text-slate-900 dark:text-white">Total Cost:</strong> Everything we&apos;ve spent on the job so far.
                      </li>
                      <li className="text-sm text-slate-600 dark:text-slate-400">
                        <strong className="text-slate-900 dark:text-white">Invoiced:</strong> The total amount we&apos;ve billed the client.
                      </li>
                      <li className="text-sm text-slate-600 dark:text-slate-400">
                        <strong className="text-slate-900 dark:text-white">Unrecovered Amount:</strong> The gap between what we spent and what we billed.
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold text-slate-900 dark:text-white mb-4">How it calculates each month</h3>
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center">
                    <div className="flex-1 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Opening</p>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Last month&apos;s closing balance</p>
                    </div>
                    <div className="text-slate-400 font-bold">+</div>
                    <div className="flex-1 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Costs</p>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Labour & materials spent this month</p>
                    </div>
                    <div className="text-slate-400 font-bold">-</div>
                    <div className="flex-1 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Invoices</p>
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Amount billed this month</p>
                    </div>
                    <div className="text-slate-400 font-bold">=</div>
                    <div className="flex-1 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 shadow-sm">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Closing</p>
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">The new total position</p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-2xl p-6 flex gap-4">
                  <Info className="h-6 w-6 text-amber-500 shrink-0" />
                  <div>
                    <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm mb-1">Important Note</h4>
                    <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed font-medium">
                      The numbers in this report depend on the latest data sync from WorkGuru. If you just added a timesheet or invoice and don’t see it here yet, it may still be waiting for the next scheduled sync.
                    </p>
                  </div>
                </div>
              </section>

              {/* 6. Production Scheduling Section */}
              <section id="production-scheduling" className="space-y-6 scroll-mt-6">
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="p-2 bg-purple-500 rounded-lg text-white">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Production Scheduling</h2>
                </div>

                <p className="text-slate-600 dark:text-slate-400 font-medium">
                  The Production Scheduling page shows all active projects on a visual timeline (Gantt chart). It helps plan when floor work begins, tracks material delivery dependencies, and manages workshop staff assignments.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div id="ps-gantt-bars" className="scroll-mt-6 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2">Understanding the Gantt bars</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      Bar position shows when work starts, bar length shows estimated duration based on remaining hours. Colours indicate status (blue = active/in progress, amber = approved/ordered awaiting start, purple = testing, dashed grey = on hold or similar paused status). A dashed border means it is unscheduled (no start date has been set yet).
                    </p>
                  </div>
                  <div id="ps-scheduling" className="scroll-mt-6 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2">Scheduling a project</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      Dragging a bar sets its scheduled start date and saves automatically. Resizing a bar only previews duration and is never saved. Clicking a bar opens the Stage Hours panel for entering hours and assigning workers. The small X that appears on hover clears a project&apos;s schedule back to unscheduled.
                    </p>
                  </div>
                  <div id="ps-padlocks" className="scroll-mt-6 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2">Dependency padlocks</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      A padlock icon appears on a bar when sheetmetal has not yet been delivered — Switchgear Mount, Busbar, and Wiring cannot begin until it arrives. Hover the padlock to see the specific reason.
                    </p>
                  </div>
                  <div id="ps-markers" className="scroll-mt-6 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2">Delivery date markers</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      The dark marker on a bar shows when materials (sheetmetal or switchgear) were delivered for that project.
                    </p>
                  </div>
                  <div id="ps-stage-hours" className="scroll-mt-6 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2">Stage Hours panel</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      Clicking any project bar opens a panel to enter hours per manufacturing stage. Hours are either pulled automatically from WorkGuru (shown with a &quot;WG&quot; badge) or entered manually (shown with a &quot;Manual&quot; badge) when WorkGuru has no data yet. This panel is also where workers get assigned to each stage.
                    </p>
                  </div>
                  <div id="ps-assigning" className="scroll-mt-6 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2">Assigning workers</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      For each stage, click &quot;Assign Worker&quot; to see a ranked list of suitable staff. Workers are ranked Recommended, Good, or Available based on cost-effectiveness (their rate divided by their skill rating for that stage). Workers on recorded leave are shown greyed out and cannot be assigned during their absence period.
                    </p>
                  </div>
                  <div id="ps-capacity" className="scroll-mt-6 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2">Capacity and Bottlenecks</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      This panel (opened via the Capacity button) shows how much work each stage can handle per week based on rated staff, how many hours are already committed, and whether a stage is on track, busy, or overloaded for the selected week. The Worker Utilisation table alongside it shows each worker&apos;s committed and free hours for that week.
                    </p>
                  </div>
                  <div id="ps-insights" className="scroll-mt-6 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2">Insights and Alerts</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      This panel automatically surfaces things needing attention — overdue unscheduled projects, projects at risk of missing their due date, scheduling conflicts with staff leave, and stages with no rated staff.
                    </p>
                  </div>
                  <div id="ps-auto-schedule" className="scroll-mt-6 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm md:col-span-2">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2">Auto-Schedule</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      Auto-Schedule automatically suggests start dates and worker assignments for all unscheduled projects. It prioritises overdue projects and those with materials already delivered, then finds the earliest week where a suitable worker is actually available — not just theoretically possible. Projects you have already scheduled manually are never touched. Before applying, you can review every suggestion and deselect any project you don&apos;t want auto-scheduled. If the result isn&apos;t right, use Undo Auto-Schedule to revert every automatically created schedule and worker assignment in one click — your manual scheduling is never affected by undo.
                    </p>
                  </div>
                  <div id="ps-absences" className="scroll-mt-6 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm md:col-span-2">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2">Staff Absences</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      Found in Settings, this records when workshop staff are on leave. The system automatically prevents new assignments during recorded absences and flags any existing assignment that conflicts with newly recorded leave.
                    </p>
                  </div>
                </div>
              </section>

              {/* 7. Archives Section */}
              <section id="archives" className="space-y-6 scroll-mt-6">
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="p-2 bg-slate-700 rounded-lg text-white">
                    <Archive className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Archived Projects</h2>
                </div>

                <p className="text-slate-600 dark:text-slate-400">
                  Projects are moved to the Archive if they are no longer visible in WorkGuru for two consecutive Full Syncs. This ensures the main dashboard stays focused on real work.
                </p>

                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1">Where to find them?</h4>
                      <p className="text-sm text-slate-500">Administrators can view all archived records in the Admin Panel.</p>
                    </div>
                    <ArrowRight className="h-6 w-6 text-slate-300" />
                  </div>
                </div>
              </section>

            </div>
          </div>

          <footer className="pt-12 pb-8 border-t border-slate-200 dark:border-slate-800 text-center">
            <p className="text-sm text-slate-400 font-medium tracking-tight">
              Chadwick Operations Dashboard • {new Date().getFullYear()}
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, definition, source }: { title: string, definition: string, source: string }) {
  return (
    <div className="group p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-brand/40 transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="w-40 shrink-0">
          <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">{title}</span>
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">{definition}</p>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Clock className="h-3 w-3" />
            Source: <span className="text-slate-500 dark:text-slate-300">{source}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
