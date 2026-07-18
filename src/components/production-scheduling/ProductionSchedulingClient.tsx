"use client";

import { useState, useMemo, useEffect } from "react";
import { format, addDays } from "date-fns";
import { Search, CalendarDays, User, Clock, AlertCircle, Settings, ChevronDown, ChevronRight, ChevronLeft, Lightbulb, X, BarChart2 } from "lucide-react";
import { ProjectSchedulingData, updateScheduledStart, fetchWeeklyCapacityBreakdown, InsightItem } from "@/app/actions/production-scheduling";
import { InsightsPanel } from "./InsightsPanel";
import { StageCapacity, WeeklyCapacityBreakdown } from "@/lib/stage-capacity";
import { cn } from "@/lib/utils";
import { GanttChart } from "./GanttChart";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { StageHoursPanel } from "./StageHoursPanel";

interface Props {
  initialData: {
    projects: ProjectSchedulingData[];
    stageCapacity: StageCapacity;
  };
  insights: InsightItem[];
  canDrag?: boolean;
  isAdmin?: boolean;
  isFinance?: boolean;
}

const DIMMED_STATUSES = ["On Hold", "Tested Passed"];

export function ProductionSchedulingClient({ initialData, insights, canDrag = false, isAdmin = false, isFinance = false }: Props) {
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
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const [showOnlyAtRisk, setShowOnlyAtRisk] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCapacityDrawerOpen, setIsCapacityDrawerOpen] = useState(false);
  const [isViewPopoverOpen, setIsViewPopoverOpen] = useState(false);

  const [selectedProject, setSelectedProject] = useState<ProjectSchedulingData | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isBottleneckPanelOpen, setIsBottleneckPanelOpen] = useState(false);
  const [weeklyBreakdown, setWeeklyBreakdown] = useState<WeeklyCapacityBreakdown[]>([]);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);

  useEffect(() => {
    async function loadCapacity() {
      const res = await fetchWeeklyCapacityBreakdown(12);
      if (res.success && res.data) {
        setWeeklyBreakdown(res.data);
      }
    }
    loadCapacity();
  }, []);

  const handleInsightFilterApply = (actionFilter: string) => {
    if (actionFilter === "overdue-unscheduled") {
      setActiveSummaryFilter("overdue");
    } else if (actionFilter === "at-risk") {
      setShowOnlyAtRisk(true);
    } else if (actionFilter === "recently-unblocked") {
      setActiveSummaryFilter(null);
      setShowOnlyAtRisk(false);
      setSearchQuery("");
      setSelectedManager("All");
      setSelectedType("All");
      setHideDimmed(false);
    }
  };

  const handleProjectClick = (projectId: number) => {
    const project = filteredProjects.find(p => p.id === projectId) || null;
    if (project) {
      setSelectedProject(project);
      setIsPanelOpen(true);
    }
  };

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

      const matchAtRisk = !showOnlyAtRisk || (() => {
        if (!p.effectiveStart || p.remainingHours <= 0 || !p.deliveryDate) return false;
        const pStart = new Date(p.effectiveStart);
        const daysNeeded = p.remainingHours / 7.6;
        const pFinish = addDays(pStart, daysNeeded);
        return pFinish > new Date(p.deliveryDate);
      })();

      return matchSearch && matchManager && matchType && matchHideDimmed && matchSummaryFilter && matchAtRisk;
    }).map(p => {
      let isBlocked = false;
      const blockReasons: string[] = [];
      const now = new Date().setHours(0,0,0,0);

      // Rule 1
      if (!p.drawingApprovalDate) {
        isBlocked = true;
        blockReasons.push("Awaiting drawing approval before work can begin");
      } else if (new Date(p.drawingApprovalDate).getTime() > now) {
        isBlocked = true;
        blockReasons.push(`Drawing approval due ${format(new Date(p.drawingApprovalDate), "dd MMM yy")}`);
      }

      // Rule 2
      if (!p.sheetmetalDeliveredDate) {
        isBlocked = true;
        blockReasons.push("Awaiting sheetmetal delivery before Switchgear, Busbar and Wiring can start");
      }

      return {
        ...p,
        isBlocked,
        blockReasons
      };
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

  const bottleneckData = useMemo(() => {
    const demand = {
      frameAssembly: 0,
      switchgearMount: 0,
      busbar: 0,
      wiring: 0,
      labels: 0,
      testing: 0,
      packagingFreight: 0,
    };

    filteredProjects.forEach(p => {
      if (p.stages.frameAssembly?.value) demand.frameAssembly += p.stages.frameAssembly.value;
      if (p.stages.switchgearMount?.value) demand.switchgearMount += p.stages.switchgearMount.value;
      if (p.stages.busbar?.value) demand.busbar += p.stages.busbar.value;
      if (p.stages.wiring?.value) demand.wiring += p.stages.wiring.value;
      if (p.stages.labels?.value) demand.labels += p.stages.labels.value;
      if (p.stages.testing?.value) demand.testing += p.stages.testing.value;
      if (p.stages.packagingFreight?.value) demand.packagingFreight += p.stages.packagingFreight.value;
    });

    const capacityToUse = weeklyBreakdown.length > 0 
      ? weeklyBreakdown[selectedWeekIndex].availableCapacity 
      : initialData.stageCapacity;

    const committedToUse = weeklyBreakdown.length > 0 
      ? weeklyBreakdown[selectedWeekIndex].committedHours 
      : { frameAssemblyIfc: 0, frameAssemblyIfm: 0, switchgearMount: 0, busbarIfc: 0, busbarIfm: 0, wiring: 0, labels: 0, testing: 0, packagingFreight: 0 };

    const rows = [
      {
        id: "frameAssembly",
        name: "Frame Assembly",
        available: capacityToUse.frameAssemblyIfc + capacityToUse.frameAssemblyIfm,
        committed: committedToUse.frameAssemblyIfc + committedToUse.frameAssemblyIfm,
        demand: demand.frameAssembly,
      },
      {
        id: "switchgearMount",
        name: "Switchgear Mount",
        available: capacityToUse.switchgearMount,
        committed: committedToUse.switchgearMount,
        demand: demand.switchgearMount,
      },
      {
        id: "busbar",
        name: "Busbar",
        available: capacityToUse.busbarIfc + capacityToUse.busbarIfm,
        committed: committedToUse.busbarIfc + committedToUse.busbarIfm,
        demand: demand.busbar,
      },
      {
        id: "wiring",
        name: "Wiring",
        available: capacityToUse.wiring,
        committed: committedToUse.wiring,
        demand: demand.wiring,
      },
      {
        id: "labels",
        name: "Labels",
        available: capacityToUse.labels,
        committed: committedToUse.labels,
        demand: demand.labels,
      },
      {
        id: "testing",
        name: "Testing",
        available: capacityToUse.testing,
        committed: committedToUse.testing,
        demand: demand.testing,
      },
      {
        id: "packagingFreight",
        name: "Packaging and Freight",
        available: capacityToUse.packagingFreight,
        committed: committedToUse.packagingFreight,
        demand: demand.packagingFreight,
      },
    ];

    return rows.map(row => {
      let utilisationDisplay = "N/A";
      let statusText = "N/A";
      let statusClass = "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700";
      
      if (row.available > 0) {
        const utilisation = (row.demand / row.available) * 100;
        utilisationDisplay = `${utilisation.toFixed(1)}%`;
        if (utilisation < 80) {
          statusText = "OK";
          statusClass = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50";
        } else if (utilisation <= 100) {
          statusText = "Busy";
          statusClass = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50";
        } else {
          statusText = "Overloaded";
          statusClass = "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50";
        }
      }

      return {
        ...row,
        utilisationDisplay,
        statusText,
        statusClass
      };
    });
  }, [filteredProjects, initialData.stageCapacity, weeklyBreakdown, selectedWeekIndex]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Production Scheduling</h1>
            {isAdmin && (
              <Link
                href="/settings"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </Link>
            )}
          </div>
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

          <div className="relative flex flex-col justify-end">
            <button
              onClick={() => setIsViewPopoverOpen(!isViewPopoverOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border h-[38px] transition-colors text-sm font-medium bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/80"
            >
              <Settings className="w-4 h-4" />
              View
            </button>
            {isViewPopoverOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsViewPopoverOpen(false)} />
                <div className="absolute top-[calc(100%+8px)] right-0 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-4 z-50 flex flex-col gap-5">
                  
                  {viewMode === "Gantt" && (
                    <div className="flex flex-col gap-1 w-full">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Scale</label>
                      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 w-full">
                        {(["Day", "Week", "Month", "Year"] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setGanttViewMode(mode)}
                            className={cn(
                              "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex-1",
                              ganttViewMode === mode ? "bg-white dark:bg-slate-900 text-brand shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1 w-full">
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 h-[38px] hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors w-full">
                      <input 
                        type="checkbox" 
                        checked={hideDimmed} 
                        onChange={(e) => setHideDimmed(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand/20"
                      />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">Hide completed/on hold</span>
                    </label>
                  </div>

                  <div className="flex flex-col gap-1 w-full relative">
                    <button
                      onClick={() => setIsSimulateOpen(!isSimulateOpen)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl border h-[38px] transition-colors text-sm font-medium w-full",
                        isSimulateOpen || overtimeHours > 0
                          ? "bg-brand text-white border-brand hover:bg-brand/90 shadow-sm"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                      )}
                    >
                      <Clock className="w-4 h-4" />
                      Simulate Overtime
                    </button>

                    {isSimulateOpen && (
                      <div className="absolute top-[calc(100%+8px)] right-0 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-4 z-[60]">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Extra hours this week
                        </label>
                        <p className="text-[10px] font-medium text-amber-600 dark:text-amber-500 mb-3">
                          This is a simulation — changes are not saved.
                        </p>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={overtimeHours}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val)) setOvertimeHours(Math.max(0, Math.min(20, val)));
                            else setOvertimeHours(0);
                          }}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 text-slate-900 dark:text-slate-100 mb-4"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setOvertimeHours(0);
                              setIsSimulateOpen(false);
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            Clear & Close
                          </button>
                          <button
                            onClick={() => setIsSimulateOpen(false)}
                            className="px-3 py-1.5 text-xs font-medium bg-brand text-white hover:bg-brand/90 rounded-lg transition-colors"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Layout</label>
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

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Tools</label>
            <div className="flex gap-2">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border h-[38px] transition-colors text-sm font-medium bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Lightbulb className={cn("w-4 h-4", insights.some(i => i.severity === 'critical') ? "text-amber-500" : "text-slate-400")} />
                Insights
                {insights.length > 0 && (
                  <span className={cn(
                    "ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold",
                    insights.some(i => i.severity === 'critical')
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  )}>
                    {insights.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setIsCapacityDrawerOpen(!isCapacityDrawerOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border h-[38px] transition-colors text-sm font-medium bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <BarChart2 className="w-4 h-4 text-slate-400" />
                Capacity
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* View Content Wrapper */}
      <div className="flex flex-col xl:flex-row gap-6 mt-6">
        <div className="flex-1 min-w-0">
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
          onProjectClick={handleProjectClick}
          overtimeHours={isSimulateOpen ? overtimeHours : (overtimeHours > 0 ? overtimeHours : 0)}
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

        {isSidebarOpen && (
          <div className="w-full xl:w-[380px] shrink-0 space-y-4">
            <div className="flex items-center justify-between pb-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Insights & Alerts</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(100vh-200px)] space-y-4 pr-1">
      <InsightsPanel insights={insights} onFilterApply={handleInsightFilterApply} />





            </div>
          </div>
        )}
      </div>

      <StageHoursPanel
        project={selectedProject}
        isOpen={isPanelOpen}
        onClose={() => {
          setIsPanelOpen(false);
          router.refresh();
        }}
        canEdit={isAdmin}
        isFinance={isFinance}
      />
    
      {/* Capacity & Bottlenecks Drawer */}
      {isCapacityDrawerOpen && (
        <>
          <div 
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setIsCapacityDrawerOpen(false)}
          />
          <div className="fixed top-0 right-0 h-full w-[85vw] min-w-[700px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex-none p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-brand" />
                Capacity & Bottlenecks
              </h2>
              <button onClick={() => setIsCapacityDrawerOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>


            <div className="flex-1 flex overflow-hidden">
              {/* Left Column - Stage Capacity */}
              <div className="w-[60%] overflow-y-auto p-4 border-r border-slate-200 dark:border-slate-800">
                {weeklyBreakdown.length > 0 && (
              <div className="flex items-center justify-between mb-4 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setSelectedWeekIndex(Math.max(0, selectedWeekIndex - 1))}
                  disabled={selectedWeekIndex === 0}
                  className="p-1 text-slate-500 hover:text-brand disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="sr-only">Prev Week</span>
                </button>
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {format(new Date(weeklyBreakdown[selectedWeekIndex].weekStart), "dd MMM")} - {format(new Date(weeklyBreakdown[selectedWeekIndex].weekEnd), "dd MMM")}
                </div>
                <button
                  onClick={() => setSelectedWeekIndex(Math.min(weeklyBreakdown.length - 1, selectedWeekIndex + 1))}
                  disabled={selectedWeekIndex === weeklyBreakdown.length - 1}
                  className="p-1 text-slate-500 hover:text-brand disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                  <span className="sr-only">Next Week</span>
                </button>
              </div>
            )}
                <div className="mt-4">
                  <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-t-lg">
                  <tr>
                    <th className="px-4 py-3 font-bold rounded-tl-lg">Stage</th>
                    <th className="px-4 py-3 font-bold text-right">Available hrs/week</th>
                    <th className="px-4 py-3 font-bold text-right text-brand">Committed</th>
                    <th className="px-4 py-3 font-bold text-right">Total demand</th>
                    <th className="px-4 py-3 font-bold text-right">Utilisation %</th>
                    <th className="px-4 py-3 font-bold text-center rounded-tr-lg">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {bottleneckData.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{row.name}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{row.available > 0 ? row.available.toFixed(1) : "0.0"}</td>
                      <td className="px-4 py-3 text-right font-medium text-brand">{row.committed > 0 ? row.committed.toFixed(1) : "-"}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{row.demand.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">{row.utilisationDisplay}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border", row.statusClass)}>
                          {row.statusText}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
              </div>

              {/* Right Column - Worker Utilisation */}
              <div className="w-[40%] overflow-y-auto p-4 bg-slate-50/30 dark:bg-slate-900/50">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Worker Utilisation</h3>
                {weeklyBreakdown.length > 0 ? (
                  <table className="w-full text-sm text-left">
                      <thead className="text-[10px] uppercase tracking-widest text-slate-500 bg-transparent border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-2 font-bold">Worker</th>
                          <th className="px-4 py-2 font-bold text-right">Committed</th>
                          <th className="px-4 py-2 font-bold text-right">Free</th>
                          <th className="px-4 py-2 font-bold w-1/3">Utilisation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {weeklyBreakdown[selectedWeekIndex].workerUtilisation.map(w => {
                          const total = w.committedHours + w.freeHours;
                          const pct = total > 0 ? (w.committedHours / total) * 100 : 0;
                          return (
                            <tr key={w.staffId}>
                              <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{w.name}</td>
                              <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">{w.committedHours.toFixed(1)}</td>
                              <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">{w.freeHours.toFixed(1)}</td>
                              <td className="px-4 py-2">
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                  <div 
                                    className={cn("h-full", pct > 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500")} 
                                    style={{ width: `${Math.min(100, pct)}%` }} 
                                  />
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                ) : (
                  <p className="text-xs text-slate-500 italic">No worker data available.</p>
                )}
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
}