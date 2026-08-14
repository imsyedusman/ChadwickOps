"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { format } from "date-fns";
import { 
  Search, ChevronDown, ChevronRight, TrendingUp, AlertTriangle, ExternalLink,
  Clock, FileText, FileCheck, ShoppingCart, PlayCircle, ShieldAlert, XCircle, 
  PauseCircle, Timer, CheckCircle2, Receipt, DollarSign, Truck, Archive, Ban, HelpCircle,
  Filter, Layers, Check, Briefcase, TrendingDown, Calendar, ArrowUp, ArrowDown
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/utils";

export interface MergedProfitabilityProject {
  id: number | string;
  workguruId: string | null;
  projectNumber: string;
  projectName: string;
  clientName: string | null;
  projectManager: string | null;
  rawStatus: string | null;
  projectType: string | null;
  startDate: Date | null;
  deliveryDate: Date | null;
  quotedProfit: number;
  actualProfit: number;
  invoicedAmount: number;
  completionDate: Date | null;
  isHistorical: boolean;
}

const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
  'Not Drawn': { color: 'slate', icon: Clock },
  'Drawings Submitted': { color: 'blue', icon: FileText },
  'Drawings Approved': { color: 'indigo', icon: FileCheck },
  'Ordered': { color: 'amber', icon: ShoppingCart },
  'In Progress': { color: 'brand', icon: PlayCircle },
  'Ready for Testing': { color: 'purple', icon: ShieldAlert },
  'Tested Defective': { color: 'red', icon: XCircle },
  'On Hold': { color: 'orange', icon: PauseCircle },
  'Waiting to Start': { color: 'slate', icon: Timer },
  'Tested Passed': { color: 'emerald', icon: CheckCircle2 },
  'Ready for Invoicing': { color: 'cyan', icon: Receipt },
  'Invoiced': { color: 'emerald', icon: DollarSign },
  'Delivered': { color: 'slate', icon: Truck },
  'Completed': { color: 'emerald', icon: Archive },
  'Cancelled': { color: 'red', icon: Ban },
  'default': { color: 'slate', icon: HelpCircle }
};

const getStatusStyles = (status: string | null) => {
  if (!status) return STATUS_CONFIG.default;
  const cleaned = status.replace(/^[\d.]+ - /, '').trim();
  return STATUS_CONFIG[cleaned] || STATUS_CONFIG.default;
};

const getColorClasses = (color: string) => {
  const base = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border shadow-sm uppercase tracking-wider transition-all duration-200";
  const colors: Record<string, string> = {
    brand: "bg-brand/5 text-brand border-brand/20 dark:bg-brand/10 dark:border-brand/30",
    blue: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-900/30",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-900/30",
    red: "bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-900/30",
    amber: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-900/30",
    orange: "bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-900/30",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-900/30",
    purple: "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-900/30",
    cyan: "bg-cyan-50 text-cyan-600 border-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-900/30",
    slate: "bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-800",
  };
  return cn(base, colors[color] || colors.slate);
};

function FilterPopover({
  label,
  icon: Icon,
  options,
  selected,
  onChange
}: {
  label: string;
  icon: any;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 bg-white dark:bg-slate-950 border rounded-xl px-2.5 py-1.5 transition-all h-10",
          selected.length > 0
            ? "border-brand ring-2 ring-brand/5 bg-brand/[0.02]"
            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", selected.length > 0 ? "text-brand" : "text-slate-400")} />
        <span className={cn("text-[11px] font-bold whitespace-nowrap", selected.length > 0 ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400")}>
          {selected.length === 0 ? label : `${label}: ${selected.length}`}
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-56 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg text-[11px] outline-none focus:ring-2 focus:ring-brand/10 transition-all font-medium"
            />

            <div className="flex items-center justify-between px-1">
              <button
                onClick={() => onChange(options)}
                className="text-[10px] font-bold text-brand hover:underline"
              >
                Select All
              </button>
              <button
                onClick={() => onChange([])}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            </div>

            <div className="space-y-0.5 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredOptions.length > 0 ? filteredOptions.map((opt) => (
                <div
                  key={opt}
                  onClick={() => {
                    const next = selected.includes(opt)
                      ? selected.filter(s => s !== opt)
                      : [...selected, opt];
                    onChange(next);
                  }}
                  className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg cursor-pointer group transition-colors"
                >
                  <Checkbox checked={selected.includes(opt)} onChange={() => { }} className="pointer-events-none" />
                  <span className={cn(
                    "text-[11px] font-medium transition-colors line-clamp-1",
                    selected.includes(opt) ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"
                  )}>
                    {opt}
                  </span>
                </div>
              )) : (
                <div className="py-4 text-center text-[10px] text-slate-400 font-medium italic">No results found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const formatDate = (date: Date | null | undefined) => {
  if (!date) return '--';
  return format(date, "dd-MMM-yy");
};

const getMarginPct = (est: number, act: number) => {
  return est > 0 ? (act - est) / Math.abs(est) * 100 : 0;
};

const getMarginColor = (marginPct: number) => {
  if (marginPct < 0) return "text-red-600 dark:text-red-400";
  if (marginPct <= 15) return "text-amber-500 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

type SortKey = "project" | "client" | "schedule" | "status" | "profit";

export function ProfitabilityTable({ data }: { data: MergedProfitabilityProject[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterActive, setFilterActive] = useState<"active" | "completed">("active");
  const [filterLoss, setFilterLoss] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [monthFilter, setMonthFilter] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  
  const [sortKey, setSortKey] = useState<SortKey>("profit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Reset sorting defaults when switching active/completed tabs
  useEffect(() => {
    if (filterActive === "active") {
      setSortKey("profit");
      setSortDir("asc"); // Worst performing at the top
    } else {
      setSortKey("schedule");
      setSortDir("desc"); // Newest completed at the top
    }
  }, [filterActive]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "profit" || key === "schedule" ? "desc" : "asc"); // logical defaults for new columns
    }
  };

  const allStatuses = useMemo(() => {
    const s = new Set<string>();
    data.forEach(p => {
      const st = p.rawStatus?.replace(/^[\d.]+ - /, '').trim() || 'Unknown';
      s.add(st);
    });
    return Array.from(s).sort();
  }, [data]);

  const allTypes = useMemo(() => {
    const t = new Set<string>();
    data.forEach(p => {
      t.add(p.projectType || 'Standard');
    });
    return Array.from(t).sort();
  }, [data]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    data.forEach(p => {
      if (p.completionDate) years.add(new Date(p.completionDate).getFullYear().toString());
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [data]);

  const filteredProjects = useMemo(() => {
    return data.filter((project) => {
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        const matchesSearch = 
          project.projectNumber.toLowerCase().includes(lowerSearch) ||
          project.projectName.toLowerCase().includes(lowerSearch) ||
          (project.clientName && project.clientName.toLowerCase().includes(lowerSearch));
        if (!matchesSearch) return false;
      }

      const rawStatusStr = project.rawStatus?.toLowerCase() || "";
      const isCompletedStatus = 
        rawStatusStr.includes("completed") || 
        rawStatusStr.includes("delivered") || 
        rawStatusStr.includes("cancelled") ||
        rawStatusStr.includes("invoiced") ||
        rawStatusStr.includes("ready for invoicing");
        
      const isCompleted = isCompletedStatus || project.isHistorical;

      if (filterActive === "active" && isCompleted) return false;
      if (filterActive === "completed" && !isCompleted) return false;

      if (filterLoss && project.actualProfit >= 0) return false;

      if (statusFilter.length > 0) {
        const st = project.rawStatus?.replace(/^[\d.]+ - /, '').trim() || 'Unknown';
        if (!statusFilter.includes(st)) return false;
      }

      if (typeFilter.length > 0) {
        const t = project.projectType || 'Standard';
        if (!typeFilter.includes(t)) return false;
      }

      if (filterActive === "completed") {
        const d = project.completionDate ? new Date(project.completionDate) : null;
        if (d) {
          const mStr = MONTH_NAMES[d.getMonth()];
          const yStr = d.getFullYear().toString();
          
          if (monthFilter.length > 0 && !monthFilter.includes(mStr)) return false;
          if (yearFilter.length > 0 && !yearFilter.includes(yStr)) return false;
        } else if (monthFilter.length > 0 || yearFilter.length > 0) {
          // If filtering by dates but project has no date, exclude it
          return false;
        }
      }

      return true;
    });
  }, [data, searchTerm, filterActive, filterLoss, statusFilter, typeFilter, monthFilter, yearFilter]);

  const summaryData = useMemo(() => {
    let totalEstimated = 0;
    let totalActual = 0;
    let projectsInLoss = 0;

    for (const p of filteredProjects) {
      totalEstimated += p.quotedProfit;
      totalActual += p.actualProfit;
      if (p.actualProfit < 0) projectsInLoss++;
    }

    return {
      totalProjects: filteredProjects.length,
      totalEstimated,
      totalActual,
      totalVariance: totalActual - totalEstimated,
      projectsInLoss
    };
  }, [filteredProjects]);

  const groupedData = useMemo(() => {
    const groups: Record<string, {
      key: string;
      projects: MergedProfitabilityProject[];
      totalEstimated: number;
      totalActual: number;
      totalInvoiced: number;
      hasLoss: boolean;
    }> = {};

    for (const project of filteredProjects) {
      let prefix = project.projectNumber;
      if (prefix.includes("-")) {
        prefix = prefix.split("-")[0];
      }

      if (!groups[prefix]) {
        groups[prefix] = {
          key: prefix,
          projects: [],
          totalEstimated: 0,
          totalActual: 0,
          totalInvoiced: 0,
          hasLoss: false,
        };
      }

      groups[prefix].projects.push(project);
      groups[prefix].totalEstimated += project.quotedProfit;
      groups[prefix].totalActual += project.actualProfit;
      groups[prefix].totalInvoiced += project.invoicedAmount;
      if (project.actualProfit < 0) {
        groups[prefix].hasLoss = true;
      }
    }
    
    const groupsArray = Object.values(groups);
    
    // Sort logic
    groupsArray.forEach(group => {
      group.projects.sort((a, b) => {
        let valA, valB;
        switch (sortKey) {
          case "project":
            valA = a.projectNumber;
            valB = b.projectNumber;
            return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
          case "client":
            valA = a.clientName || "";
            valB = b.clientName || "";
            return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
          case "schedule":
            valA = filterActive === "completed" ? (a.completionDate?.getTime() || 0) : (a.startDate?.getTime() || 0);
            valB = filterActive === "completed" ? (b.completionDate?.getTime() || 0) : (b.startDate?.getTime() || 0);
            return sortDir === "asc" ? valA - valB : valB - valA;
          case "status":
            valA = a.rawStatus || "";
            valB = b.rawStatus || "";
            return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
          case "profit":
            valA = getMarginPct(a.quotedProfit, a.actualProfit);
            valB = getMarginPct(b.quotedProfit, b.actualProfit);
            return sortDir === "asc" ? valA - valB : valB - valA;
          default:
            return 0;
        }
      });
    });

    groupsArray.sort((a, b) => {
      let valA, valB;
      switch (sortKey) {
        case "project":
          valA = a.key;
          valB = b.key;
          return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case "client":
          valA = a.projects[0]?.clientName || "";
          valB = b.projects[0]?.clientName || "";
          return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case "schedule":
          valA = filterActive === "completed" ? (a.projects[0]?.completionDate?.getTime() || 0) : (a.projects[0]?.startDate?.getTime() || 0);
          valB = filterActive === "completed" ? (b.projects[0]?.completionDate?.getTime() || 0) : (b.projects[0]?.startDate?.getTime() || 0);
          return sortDir === "asc" ? valA - valB : valB - valA;
        case "status":
          valA = a.projects[0]?.rawStatus || "";
          valB = b.projects[0]?.rawStatus || "";
          return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case "profit":
          valA = getMarginPct(a.totalEstimated, a.totalActual);
          valB = getMarginPct(b.totalEstimated, b.totalActual);
          return sortDir === "asc" ? valA - valB : valB - valA;
        default:
          return 0;
      }
    });

    return groupsArray;
  }, [filteredProjects, sortKey, sortDir, filterActive]);

  const toggleGroup = (key: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(key)) {
      newCollapsed.delete(key);
    } else {
      newCollapsed.add(key);
    }
    setCollapsedGroups(newCollapsed);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(val);
  };

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return <div className="w-3.5 inline-block opacity-0 group-hover:opacity-30 transition-opacity"><ArrowDown className="h-3.5 w-3.5 inline ml-1" /></div>;
    return sortDir === "asc" 
      ? <ArrowUp className="h-3.5 w-3.5 inline ml-1 text-brand" /> 
      : <ArrowDown className="h-3.5 w-3.5 inline ml-1 text-brand" />;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Briefcase className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Total Projects</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {summaryData.totalProjects}
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <FileText className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Total Estimated</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(summaryData.totalEstimated)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Receipt className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Total Actual</span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(summaryData.totalActual)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            {summaryData.totalVariance >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span className="text-xs font-semibold uppercase tracking-wider">Total Variance</span>
          </div>
          <div className={`text-2xl font-bold ${summaryData.totalVariance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {summaryData.totalVariance >= 0 ? '+' : ''}{formatCurrency(summaryData.totalVariance)}
          </div>
        </div>

        <div 
          onClick={() => setFilterLoss(!filterLoss)}
          className={cn(
            "rounded-xl p-4 shadow-sm flex flex-col justify-between cursor-pointer transition-all border",
            filterLoss 
              ? "bg-red-100 dark:bg-red-900/40 border-red-400 dark:border-red-600 ring-2 ring-red-400/20" 
              : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 hover:bg-red-100/50 dark:hover:bg-red-900/20"
          )}
        >
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Projects in Loss</span>
          </div>
          <div className="text-2xl font-bold text-red-700 dark:text-red-300">
            {summaryData.projectsInLoss}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
        <div className="flex flex-wrap gap-3 items-center w-full">
          {/* Active / Completed Toggle */}
          <div className="flex items-center rounded-lg border p-1 bg-slate-50 dark:bg-slate-800 h-10">
            <button
              onClick={() => setFilterActive("active")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all h-full ${filterActive === "active" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700"}`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterActive("completed")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all h-full ${filterActive === "completed" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700"}`}
            >
              Completed
            </button>
          </div>

          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block"></div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search projects..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-lg text-sm w-[200px] h-10 focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Dropdown Filters */}
          <FilterPopover 
            label="Status" 
            icon={Filter} 
            options={allStatuses} 
            selected={statusFilter} 
            onChange={setStatusFilter} 
          />
          <FilterPopover 
            label="Type" 
            icon={Layers} 
            options={allTypes} 
            selected={typeFilter} 
            onChange={setTypeFilter} 
          />

          {/* Month/Year Picker (only for completed) */}
          {filterActive === "completed" && (
            <div className="flex items-center gap-3 ml-auto bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-2 pr-1">Completion Date:</span>
              <FilterPopover 
                label="Months" 
                icon={Calendar} 
                options={MONTH_NAMES} 
                selected={monthFilter} 
                onChange={setMonthFilter} 
              />
              <FilterPopover 
                label="Years" 
                icon={Calendar} 
                options={availableYears} 
                selected={yearFilter} 
                onChange={setYearFilter} 
              />
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b text-slate-500 dark:text-slate-400 font-medium">
              <tr>
                <th className="px-4 py-3 font-semibold w-12"></th>
                <th 
                  className="px-4 py-3 font-semibold w-[20%] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group select-none"
                  onClick={() => toggleSort("project")}
                >
                  Project {renderSortIndicator("project")}
                </th>
                <th 
                  className="px-4 py-3 font-semibold w-[20%] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group select-none"
                  onClick={() => toggleSort("client")}
                >
                  Client & PM {renderSortIndicator("client")}
                </th>
                <th 
                  className="px-4 py-3 font-semibold min-w-[200px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group select-none"
                  onClick={() => toggleSort("schedule")}
                >
                  Schedule {renderSortIndicator("schedule")}
                </th>
                <th 
                  className="px-4 py-3 font-semibold w-[200px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group select-none"
                  onClick={() => toggleSort("status")}
                >
                  Status / Type {renderSortIndicator("status")}
                </th>
                <th 
                  className="px-4 py-3 font-semibold text-right min-w-[180px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group select-none"
                  onClick={() => toggleSort("profit")}
                >
                  Profit & Variance {renderSortIndicator("profit")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {groupedData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    No projects found matching the current filters.
                  </td>
                </tr>
              )}
              
              {groupedData.map((group) => {
                const isSingle = group.projects.length === 1;
                const isCollapsed = collapsedGroups.has(group.key);
                
                // Group aggregates
                const variance = group.totalActual - group.totalEstimated;
                const progressPct = group.totalEstimated > 0 ? Math.min(100, Math.max(0, (group.totalActual / group.totalEstimated) * 100)) : 0;
                
                const groupMargin = getMarginPct(group.totalEstimated, group.totalActual);

                return (
                  <React.Fragment key={group.key}>
                    {/* Parent Row (only if > 1 project) */}
                    {!isSingle && (
                      <tr 
                        className={`group hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${group.hasLoss ? "bg-red-50/30 dark:bg-red-900/10" : "bg-slate-50/50 dark:bg-slate-800/30"}`}
                        onClick={() => toggleGroup(group.key)}
                      >
                        <td className={`px-4 py-3 ${group.hasLoss ? "border-l-4 border-l-red-500" : ""}`}>
                          {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                            {group.key}
                            <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
                              {group.projects.length} project{group.projects.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <div className={`font-black text-lg ${getMarginColor(groupMargin)}`}>
                              Group Margin: {groupMargin > 0 ? '+' : ''}{groupMargin.toFixed(1)}%
                            </div>
                            <div className="text-sm text-slate-500">
                              Actual: <span className="font-medium text-slate-700 dark:text-slate-300 ml-1">{formatCurrency(group.totalActual)}</span>
                            </div>
                            <div className="text-sm text-slate-500">
                              Estimated: <span className="font-medium text-slate-700 dark:text-slate-300 ml-1">{formatCurrency(group.totalEstimated)}</span>
                            </div>
                            <div className="text-xs text-brand font-medium my-0.5">
                              Invoiced: {formatCurrency(group.totalInvoiced)}
                            </div>
                            <div className={`text-base font-bold mt-0.5 ${variance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              Variance: {variance >= 0 ? "+" : ""}{formatCurrency(variance)}
                            </div>
                            <div 
                              className="w-32 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1 opacity-70 cursor-help"
                              title="Actual profit as a percentage of estimated profit"
                            >
                              <div 
                                className={`h-full ${variance >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} 
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    
                    {/* Child Rows */}
                    {(!isCollapsed || isSingle) && group.projects.map((p) => {
                      const pVariance = p.actualProfit - p.quotedProfit;
                      const pProgressPct = p.quotedProfit > 0 ? Math.min(100, Math.max(0, (p.actualProfit / p.quotedProfit) * 100)) : 0;
                      
                      const pMargin = getMarginPct(p.quotedProfit, p.actualProfit);

                      const styleConfig = getStatusStyles(p.rawStatus);
                      const StatusIcon = styleConfig.icon;

                      return (
                        <tr key={p.projectNumber} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${!isSingle ? 'border-l-4 border-l-transparent' : ''}`}>
                          <td className="px-4 py-3"></td>
                          <td className={`px-4 py-3 ${!isSingle ? 'pl-8' : ''}`}>
                            {p.workguruId ? (
                              <a 
                                href={`https://app.workguru.io/App/Projects/Detail2/${p.workguruId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-bold text-brand hover:underline"
                              >
                                {p.projectNumber}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="font-bold text-slate-700 dark:text-slate-300">{p.projectNumber}</span>
                            )}
                            <div className="text-xs text-slate-500 mt-1 line-clamp-2" title={p.projectName}>
                              {p.projectName}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-700 dark:text-slate-300 line-clamp-1">{p.clientName || 'Unknown Client'}</div>
                            <div className="text-xs text-slate-400 mt-1">{p.projectManager || 'No PM'}</div>
                          </td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <div className="text-slate-700 dark:text-slate-300">
                                <span className="text-slate-400 font-medium mr-1">Start:</span>
                                {formatDate(p.startDate)}
                              </div>
                              <div className="text-slate-700 dark:text-slate-300">
                                <span className="text-slate-400 font-medium mr-1">Due:</span>
                                {formatDate(p.deliveryDate)}
                              </div>
                              {p.completionDate && (
                                <div className="text-slate-700 dark:text-slate-300">
                                  <span className="text-slate-400 font-medium mr-1">Completed:</span>
                                  {formatDate(p.completionDate)}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={getColorClasses(styleConfig.color)}>
                              <StatusIcon className="h-3 w-3" />
                              {p.rawStatus?.replace(/^[\d.]+ - /, '').trim() || 'Unknown'}
                            </span>
                            <div className="text-xs text-slate-500 mt-1">{p.projectType || 'Standard'}</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <div className={`font-black text-lg ${getMarginColor(pMargin)}`}>
                                {pMargin > 0 ? '+' : ''}{pMargin.toFixed(1)}%
                              </div>
                              <div className="text-sm text-slate-500">
                                Actual: <span className="font-medium text-slate-700 dark:text-slate-300 ml-1">{formatCurrency(p.actualProfit)}</span>
                              </div>
                              <div className="text-sm text-slate-500">
                                Estimated: <span className="font-medium text-slate-700 dark:text-slate-300 ml-1">{formatCurrency(p.quotedProfit)}</span>
                              </div>
                              <div className="text-xs text-brand font-medium my-0.5">
                                Invoiced: {formatCurrency(p.invoicedAmount)}
                              </div>
                              <div className={`text-base font-bold mt-0.5 ${pVariance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                Variance: {pVariance >= 0 ? "+" : ""}{formatCurrency(pVariance)}
                              </div>
                              <div 
                                className="w-24 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1.5 ml-auto opacity-70 cursor-help"
                                title="Actual profit as a percentage of estimated profit"
                              >
                                <div 
                                  className={`h-full ${pVariance >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} 
                                  style={{ width: `${pProgressPct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
