"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Search, CalendarDays, User, Clock, AlertCircle } from "lucide-react";
import { ProjectSchedulingData, updateScheduledStart } from "@/app/actions/production-scheduling";
import { StageCapacity } from "@/lib/stage-capacity";
import { cn } from "@/lib/utils";
import { GanttChart } from "./GanttChart";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
  initialData: {
    projects: ProjectSchedulingData[];
    stageCapacity: StageCapacity;
  };
  canDrag?: boolean;
}

const DIMMED_STATUSES = ["On Hold", "Tested Passed", "Ready for Invoicing"];

export function ProductionSchedulingClient({ initialData, canDrag = false }: Props) {
  const { projects } = initialData;
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedManager, setSelectedManager] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [viewMode, setViewMode] = useState<"Gantt" | "List">("Gantt");
  const [ganttViewMode, setGanttViewMode] = useState<"Day" | "Week" | "Month" | "Year">("Week");
  const [hideDimmed, setHideDimmed] = useState(false);
  const [activeSummaryFilter, setActiveSummaryFilter] = useState<"active" | "testing" | "onHold" | "overdue" | null>(null);
  const [sortBy, setSortBy] = useState("Due Date");

  const uniqueManagers = useMemo(() => {
    const managers = new Set<string>();
    projects.forEach((p) => {
      if (p.projectManager) managers.add(p.projectManager);
    });
    return Array.from(managers).sort();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    let result = projects.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.projectNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchManager = selectedManager === "All" || p.projectManager === selectedManager;
      const matchType = selectedType === "All" || (p.projectType && p.projectType.toUpperCase().includes(selectedType));
      
      const isDimmed = p.rawStatus && DIMMED_STATUSES.includes(p.rawStatus);
      const matchHideDimmed = !hideDimmed || !isDimmed;
      
      const isOverdue = p.deliveryDate && new Date(p.deliveryDate).getTime() < new Date().setHours(0,0,0,0);
      const isTesting = p.rawStatus && ["2.3 - Ready for Testing", "2.4 - Tested Defective"].includes(p.rawStatus);
      const isOnHold = p.rawStatus === "On Hold";
      const isActiveStatus = !isDimmed;

      let matchSummaryFilter = true;
      if (activeSummaryFilter === "overdue") matchSummaryFilter = !!isOverdue;
      else if (activeSummaryFilter === "testing") matchSummaryFilter = !!isTesting;
      else if (activeSummaryFilter === "onHold") matchSummaryFilter = !!isOnHold;
      else if (activeSummaryFilter === "active") matchSummaryFilter = !!isActiveStatus;

      return matchSearch && matchManager && matchType && matchHideDimmed && matchSummaryFilter;
    });

    result.sort((a, b) => {
      if (sortBy === "Due Date") {
        const dateA = a.deliveryDate ? new Date(a.deliveryDate).getTime() : Infinity;
        const dateB = b.deliveryDate ? new Date(b.deliveryDate).getTime() : Infinity;
        return dateA - dateB;
      }
      if (sortBy === "Project Number") {
        return a.projectNumber.localeCompare(b.projectNumber);
      }
      if (sortBy === "Project Manager") {
        return (a.projectManager || "").localeCompare(b.projectManager || "");
      }
      if (sortBy === "Remaining Hours") {
        return b.remainingHours - a.remainingHours;
      }
      if (sortBy === "Status") {
        return (a.rawStatus || "").localeCompare(b.rawStatus || "");
      }
      return 0;
    });
    return result;
  }, [projects, searchQuery, selectedManager, selectedType, hideDimmed, activeSummaryFilter, sortBy]);

  const summaryCounts = useMemo(() => {
    let active = 0;
    let testing = 0;
    let onHold = 0;
    let overdue = 0;
    const now = new Date().setHours(0,0,0,0);
    
    projects.forEach(p => {
      const isDimmed = p.rawStatus && DIMMED_STATUSES.includes(p.rawStatus);
      if (p.rawStatus === "On Hold") onHold++;
      else if (p.rawStatus && ["2.3 - Ready for Testing", "2.4 - Tested Defective"].includes(p.rawStatus)) testing++;
      else if (!isDimmed) active++;
      
      if (p.deliveryDate && new Date(p.deliveryDate).getTime() < now) {
        overdue++;
      }
    });
    
    return { active, testing, onHold, overdue };
  }, [projects]);

  const handleDateChange = async (projectIdStr: string, start: Date) => {
    const projectId = parseInt(projectIdStr, 10);
    const toastId = toast.loading("Saving...");

    try {
      const res = await updateScheduledStart(projectId, start);
      if (res.success) {
        toast.success("Scheduled start updated", { id: toastId });
        router.refresh();
      } else {
        toast.error(res.error || "Failed to save", { id: toastId });
      }
    } catch (error) {
      toast.error("Failed to save", { id: toastId });
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd MMM yyyy");
  };

  const getStatusClasses = (status: string | null) => {
    if (!status) return "bg-slate-100 text-slate-600";
    if (DIMMED_STATUSES.includes(status)) {
      return "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 border-slate-200 dark:border-slate-700/50";
    }
    return "bg-brand/10 text-brand border-brand/20 dark:bg-brand/20 dark:text-brand-300 dark:border-brand/30 shadow-sm";
  };

  const stageKeys: (keyof ProjectSchedulingData["stages"])[] = [
    "frameAssembly",
    "switchgearMount",
    "busbar",
    "wiring",
    "labels",
    "testing",
    "packagingFreight"
  ];
  const stageNames: Record<string, string> = {
    frameAssembly: "Frame",
    switchgearMount: "Mount",
    busbar: "Busbar",
    wiring: "Wiring",
    labels: "Labels",
    testing: "Testing",
    packagingFreight: "Pack",
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Production Scheduling</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Showing {filteredProjects.length} of {projects.length} projects
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all text-slate-900 dark:text-slate-100"
          />
        </div>
        
        <div className="flex gap-4 w-full md:w-auto">
          <div className="flex flex-col gap-1 w-full md:w-48">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Manager</label>
            <select
              value={selectedManager}
              onChange={(e) => setSelectedManager(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 text-slate-900 dark:text-slate-100"
            >
              <option value="All">All Managers</option>
              {uniqueManagers.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 w-full md:w-48">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 text-slate-900 dark:text-slate-100"
            >
              <option value="All">All Types</option>
              <option value="IFC">IFC</option>
              <option value="IFM">IFM</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 w-full md:w-48">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Sort</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 text-slate-900 dark:text-slate-100"
            >
              <option value="Due Date">Due Date</option>
              <option value="Project Number">Project Number</option>
              <option value="Project Manager">Project Manager</option>
              <option value="Remaining Hours">Remaining Hours</option>
              <option value="Status">Status</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 w-full md:w-auto self-end md:mb-[1px]">
            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 h-[38px] hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
              <input 
                type="checkbox" 
                checked={hideDimmed} 
                onChange={(e) => setHideDimmed(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand/20"
              />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">Hide completed/on hold</span>
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">View</label>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode("Gantt")}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-lg transition-colors",
                  viewMode === "Gantt" ? "bg-white dark:bg-slate-900 text-brand shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                Gantt
              </button>
              <button
                onClick={() => setViewMode("List")}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-lg transition-colors",
                  viewMode === "List" ? "bg-white dark:bg-slate-900 text-brand shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                List
              </button>
            </div>
          </div>

          {viewMode === "Gantt" && (
            <div className="flex flex-col gap-1 hidden sm:flex">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Scale</label>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                {(["Day", "Week", "Month", "Year"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setGanttViewMode(mode)}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                      ganttViewMode === mode ? "bg-white dark:bg-slate-900 text-brand shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View Content */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-2">Summary</div>
        <button 
          onClick={() => setActiveSummaryFilter(activeSummaryFilter === "active" ? null : "active")}
          className={cn(
            "px-3 py-1 border rounded-lg text-xs font-bold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50 focus:ring-offset-2",
            activeSummaryFilter === "active" 
              ? "bg-brand text-white border-brand hover:bg-brand/90" 
              : "bg-brand/10 text-brand border-brand/20 hover:bg-brand/20 dark:bg-brand/20 dark:text-brand-300 dark:border-brand/30 dark:hover:bg-brand/30"
          )}
        >
          Active: {summaryCounts.active}
        </button>
        <button 
          onClick={() => setActiveSummaryFilter(activeSummaryFilter === "testing" ? null : "testing")}
          className={cn(
            "px-3 py-1 border rounded-lg text-xs font-bold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2",
            activeSummaryFilter === "testing"
              ? "bg-purple-600 text-white border-purple-700 hover:bg-purple-700"
              : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800 dark:hover:bg-purple-900/50"
          )}
        >
          Testing: {summaryCounts.testing}
        </button>
        <button 
          onClick={() => setActiveSummaryFilter(activeSummaryFilter === "onHold" ? null : "onHold")}
          className={cn(
            "px-3 py-1 border rounded-lg text-xs font-bold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2",
            activeSummaryFilter === "onHold"
              ? "bg-slate-700 text-white border-slate-800 hover:bg-slate-800"
              : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700"
          )}
        >
          On Hold: {summaryCounts.onHold}
        </button>
        <button 
          onClick={() => setActiveSummaryFilter(activeSummaryFilter === "overdue" ? null : "overdue")}
          className={cn(
            "px-3 py-1 border rounded-lg text-xs font-bold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
            activeSummaryFilter === "overdue"
              ? "bg-red-600 text-white border-red-700 hover:bg-red-700" 
              : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/50"
          )}
        >
          Overdue: {summaryCounts.overdue}
        </button>
      </div>

      {viewMode === "Gantt" ? (
        <GanttChart 
          projects={filteredProjects} 
          viewMode={ganttViewMode}
          canDrag={canDrag}
          onDateChange={handleDateChange}
        />
      ) : (
        <div className="space-y-4">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 border-dashed">
            <p className="text-sm font-medium text-slate-500">No projects found matching the current filters.</p>
          </div>
        ) : (
          filteredProjects.map((p) => {
            const isIfm = p.projectType?.toUpperCase().includes("IFM");
            const typeLabel = isIfm ? "IFM" : "IFC";
            const typeColor = isIfm ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-sky-50 text-sky-700 border-sky-200";

            return (
              <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
                <div className="p-5 flex flex-col xl:flex-row xl:items-start justify-between gap-6">
                  {/* Left Col - Identity */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className={cn("px-2 py-1 rounded text-[10px] font-bold tracking-widest border", typeColor)}>
                        {typeLabel}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          {p.projectNumber} <span className="text-slate-300 font-normal">|</span> {p.name}
                        </h3>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 font-medium">
                          {p.projectManager && (
                            <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {p.projectManager}</span>
                          )}
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border", getStatusClasses(p.rawStatus))}>
                            {p.rawStatus || "Unknown"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mid Col - Schedule details */}
                  <div className="flex gap-8 text-sm">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Scheduled Start
                      </p>
                      {p.scheduledStart ? (
                        <p className="font-semibold text-slate-900 dark:text-slate-200">{formatDate(p.scheduledStart)}</p>
                      ) : (
                        <p className="font-medium text-slate-400 italic">Unscheduled</p>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> WG Delivery
                      </p>
                      <p className="font-semibold text-slate-900 dark:text-slate-200">{formatDate(p.deliveryDate)}</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progress</p>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-brand">{p.remainingHours.toFixed(1)}h left</p>
                        <span className="text-xs text-slate-400">({Math.round(p.progressPercent * 10) / 10}%)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stage Breakdown Footer */}
                <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-3">
                  {stageKeys.map(key => {
                    const stageInfo = p.stages[key];
                    if (!stageInfo) return null;
                    return (
                      <div key={key} className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-300">{stageNames[key]}</span>
                        <span className="text-slate-900 dark:text-white font-medium">{stageInfo.value}h</span>
                        <span className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider",
                          stageInfo.source === "wg" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                        )}>
                          {stageInfo.source}
                        </span>
                      </div>
                    );
                  })}
                  {stageKeys.every(k => !p.stages[k]) && (
                    <span className="text-xs text-slate-400 italic">No stage hours recorded.</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      )}
    </div>
  );
}
