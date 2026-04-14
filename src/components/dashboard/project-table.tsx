"use client";

import React, { useState, useMemo, useRef, useEffect, useTransition } from "react";
import { format } from "date-fns";
import { 
  ExternalLink, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarDays,
  User,
  Activity,
  Briefcase,
  AlertTriangle,
  History
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";
import { formatDistanceToNow } from "date-fns";
import { isProductiveProject, INTERNAL_WORK_DESCRIPTION } from "@/lib/project-utils";
import { useUserPreferences } from "@/components/providers/user-preferences-provider";
import { Checkbox } from "../ui/Checkbox";

type ProjectTableProps = {
  projects: any[];
  initialFilter?: string;
};

export function ProjectTable({ projects, initialFilter = "" }: ProjectTableProps) {
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(event.target as Node)) {
        setIsColumnPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [search, setSearch] = useState(initialFilter);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'deliveryDate', direction: 'asc' });
  
  // Advanced filters
  const [pmFilter, setPmFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  const { preferences, setPreference } = useUserPreferences();
  const { columnVisibility } = preferences;

  const [isScrolled, setIsScrolled] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const fakeScrollRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const [contentWidth, setContentWidth] = useState(0);
  const [containerRect, setContainerRect] = useState({ left: 0, width: 0 });
  const [showFakeScroll, setShowFakeScroll] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setIsScrolled(target.scrollLeft > 0);
    
    // Prevent sync loops and unnecessary updates
    if (syncingRef.current) return;
    
    if (fakeScrollRef.current) {
      if (Math.abs(fakeScrollRef.current.scrollLeft - target.scrollLeft) < 0.5) return;
      
      syncingRef.current = true;
      requestAnimationFrame(() => {
        if (fakeScrollRef.current) {
          fakeScrollRef.current.scrollLeft = target.scrollLeft;
        }
        // Small delay to ensure the other scroll handler's events are ignored
        setTimeout(() => { syncingRef.current = false; }, 20);
      });
    }
  };

  const handleFakeScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (syncingRef.current) return;
    
    if (tableContainerRef.current) {
      if (Math.abs(tableContainerRef.current.scrollLeft - target.scrollLeft) < 0.5) return;

      syncingRef.current = true;
      requestAnimationFrame(() => {
        if (tableContainerRef.current) {
          tableContainerRef.current.scrollLeft = target.scrollLeft;
        }
        setTimeout(() => { syncingRef.current = false; }, 20);
      });
    }
  };

  // Target widths for sticky columns to ensure consistent layout
  const STICKY_WIDTHS = {
    projectNumber: 120,
    projectName: 300,
    itemName: 220,
  };

  const getStickyOffset = (columnId: 'projectNumber' | 'projectName' | 'itemName') => {
    let offset = 0;
    if (columnId === 'projectNumber') return offset;
    
    if (columnVisibility.projectNumber) offset += STICKY_WIDTHS.projectNumber;
    if (columnId === 'projectName') return offset;
    
    if (columnVisibility.projectName) offset += STICKY_WIDTHS.projectName;
    return offset;
  };

  // Extract unique values for filters
  const filterOptions = useMemo(() => {
    const pms = new Set<string>();
    const statuses = new Set<string>();
    const clients = new Set<string>();
    const months = new Set<string>();

    projects.forEach(p => {
      if (p.projectManager) pms.add(p.projectManager);
      if (p.rawStatus) statuses.add(p.rawStatus);
      if (p.client?.name) clients.add(p.client.name);
      if (p.deliveryDate) {
        months.add(format(new Date(p.deliveryDate), 'MMM yyyy'));
      }
    });

    return {
      pms: Array.from(pms).sort(),
      statuses: Array.from(statuses).sort(),
      clients: Array.from(clients).sort(),
      months: Array.from(months).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()),
    };
  }, [projects]);

  const filteredAndSortedProjects = useMemo(() => {
    let result = projects.filter(p => {
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        p.name?.toLowerCase().includes(searchLower) ||
        p.projectNumber?.toLowerCase().includes(searchLower) ||
        p.client?.name?.toLowerCase().includes(searchLower);
      
      const matchesPm = !pmFilter || p.projectManager === pmFilter;
      const matchesStatus = !statusFilter || p.rawStatus === statusFilter;
      const matchesClient = !clientFilter || p.client?.name === clientFilter;
      const matchesMonth = !monthFilter || (p.deliveryDate && format(new Date(p.deliveryDate), 'yyyy-MM') === monthFilter);

      return matchesSearch && matchesPm && matchesStatus && matchesClient && matchesMonth;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        let aVal: any, bVal: any;

        switch (sortConfig.key) {
          case 'deliveryDate':
            aVal = a.deliveryDate ? new Date(a.deliveryDate).getTime() : 0;
            bVal = b.deliveryDate ? new Date(b.deliveryDate).getTime() : 0;
            break;
          case 'drawingApprovalDate':
            aVal = a.drawingApprovalDate ? new Date(a.drawingApprovalDate).getTime() : 0;
            bVal = b.drawingApprovalDate ? new Date(b.drawingApprovalDate).getTime() : 0;
            break;
          case 'drawingSubmittedDate':
            aVal = a.drawingSubmittedDate ? new Date(a.drawingSubmittedDate).getTime() : 0;
            bVal = b.drawingSubmittedDate ? new Date(b.drawingSubmittedDate).getTime() : 0;
            break;
          case 'projectNumber':
            const parseId = (num: string) => {
              const parts = num.split('-');
              if (parts.length < 2) return { prefix: num, suffix: 99999999 }; // IDs without hyphen go after same-prefix ones
              const suffix = parseInt(parts[parts.length - 1], 10);
              return { 
                prefix: parts.slice(0, -1).join('-'), 
                suffix: isNaN(suffix) ? 99999999 : suffix 
              };
            };
            const aParsed = parseId(a.projectNumber || "");
            const bParsed = parseId(b.projectNumber || "");
            if (aParsed.prefix !== bParsed.prefix) {
              aVal = aParsed.prefix;
              bVal = bParsed.prefix;
            } else {
              aVal = aParsed.suffix;
              bVal = bParsed.suffix;
            }
            break;
          case 'name':
            aVal = a.name || "";
            bVal = b.name || "";
            break;
          case 'budgetHours':
            aVal = Number(a.budgetHours) || 0;
            bVal = Number(b.budgetHours) || 0;
            break;
          case 'remainingHours':
            aVal = Number(a.remainingHours) || 0;
            bVal = Number(b.remainingHours) || 0;
            break;
          case 'actualHours':
            aVal = Number(a.actualHours) || 0;
            bVal = Number(b.actualHours) || 0;
            break;
          case 'progressPercent':
            aVal = Number(a.progressPercent) || 0;
            bVal = Number(b.progressPercent) || 0;
            break;
          case 'status':
            aVal = a.rawStatus || "";
            bVal = b.rawStatus || "";
            break;
          case 'bayLocation':
            aVal = a.bayLocation || "";
            bVal = b.bayLocation || "";
            break;
          case 'projectManager':
            aVal = a.projectManager || "";
            bVal = b.projectManager || "";
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [projects, search, pmFilter, statusFilter, clientFilter, monthFilter, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedProjects.length / pageSize);
  const currentProjects = filteredAndSortedProjects.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => {
    const tableEl = tableContainerRef.current;
    if (!tableEl) return;

    // Track width, overflow, and position
    const updateDimensions = () => {
      if (!tableEl) return;
      const rect = tableEl.getBoundingClientRect();
      const overflow = tableEl.scrollWidth > tableEl.clientWidth;
      
      setHasOverflow(overflow);
      setContentWidth(tableEl.scrollWidth);
      setContainerRect({ left: rect.left, width: rect.width });
      
      // DIAGNOSTICS: Confirm exact alignment
      if (overflow && fakeScrollRef.current) {
        console.log(`[ScrollSync] 
          Table: scrollWidth=${tableEl.scrollWidth}px, clientWidth=${tableEl.clientWidth}px, max=${tableEl.scrollWidth - tableEl.clientWidth}px
          Fake: scrollWidth=${fakeScrollRef.current.scrollWidth}px, clientWidth=${fakeScrollRef.current.clientWidth}px, max=${fakeScrollRef.current.scrollWidth - fakeScrollRef.current.clientWidth}px
        `);
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);

    // Track intersection for visibility rules
    const intersectionObserver = new IntersectionObserver((entries) => {
      for (let entry of entries) {
        setShowFakeScroll(entry.isIntersecting);
      }
    }, { threshold: 0 });

    resizeObserver.observe(tableEl);
    intersectionObserver.observe(tableEl);

    // Visibility logic (Excel-Style: Fixed to viewport bottom while table is active)
    const handleViewportScroll = () => {
      if (!tableEl) return;
      const rect = tableEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // Update rect position in case layout moved without resize
      setContainerRect({ left: rect.left, width: rect.width });
      
      const isActiveInView = rect.top < viewportHeight && rect.bottom > 0;
      setShowFakeScroll(isActiveInView);
    };

    const scrollParent = document.querySelector('main') || window;
    scrollParent.addEventListener('scroll', handleViewportScroll);
    window.addEventListener('resize', handleViewportScroll);
    
    // Initial call
    updateDimensions();
    handleViewportScroll();

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      scrollParent.removeEventListener('scroll', handleViewportScroll);
      window.removeEventListener('resize', handleViewportScroll);
    };
  }, [currentProjects.length, columnVisibility, pageSize]);

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-20" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 text-brand" /> : <ArrowDown className="h-3 w-3 ml-1 text-brand" />;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Table Toolbar */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Filter projects..." 
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-4 focus:ring-brand/5 focus:border-brand/30 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1">
             <User className="h-3.5 w-3.5 text-slate-400" />
             <select 
               value={pmFilter}
               onChange={(e) => setPmFilter(e.target.value)}
               className="bg-transparent text-[11px] font-bold outline-none border-none pr-6 focus:ring-0"
             >
               <option value="">All PMs</option>
               {filterOptions.pms.map(pm => <option key={pm} value={pm}>{pm}</option>)}
             </select>
           </div>

           <div className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1">
             <Activity className="h-3.5 w-3.5 text-slate-400" />
             <select 
               value={statusFilter}
               onChange={(e) => setStatusFilter(e.target.value)}
               className="bg-transparent text-[11px] font-bold outline-none border-none pr-6 focus:ring-0"
             >
               <option value="">All Statuses</option>
               {filterOptions.statuses.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
           </div>

           <div className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1">
             <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
             <input 
               type="month"
               value={monthFilter}
               onChange={(e) => setMonthFilter(e.target.value)}
               className="bg-transparent text-[11px] font-bold outline-none border-none pr-2 focus:ring-0 text-slate-600 dark:text-slate-300 h-[22px]"
             />
           </div>

           <div className="text-[11px] font-bold text-slate-400 tabular-nums px-2 border-l border-slate-200 dark:border-slate-800 ml-2">
             {filteredAndSortedProjects.length} records
           </div>

           <div className="relative" ref={columnPickerRef}>
             <button 
               onClick={() => setIsColumnPickerOpen(!isColumnPickerOpen)}
               className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
             >
               <Filter className="h-3.5 w-3.5 text-slate-400" />
               Columns
             </button>
             
             {isColumnPickerOpen && (
               <div className="absolute right-0 mt-2 w-56 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                 <div className="space-y-2">
                   <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-1">Visible Columns</h4>
                   <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                     {Object.keys(columnVisibility).map((key) => {
                       const labels: Record<string, string> = {
                         projectNumber: "Project ID",
                         itemName: "Item",
                         projectName: "Project Name",
                         client: "Client",
                         projectManager: "Manager",
                         status: "Status",
                         bayLocation: "Bay Location",
                         deliveryDate: "Due Date",
                         drawingApprovalDate: "Drawing Approval",
                         drawingSubmittedDate: "Drawing Submitted",
                         budgetHours: "Budget",
                         actualHours: "Actual",
                         remainingHours: "Remaining",
                         progressPercent: "Progress %"
                       };
                       return (
                          <div key={key} className="flex items-center gap-2 px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer group" onClick={() => {
                            const updated = { ...columnVisibility, [key]: !columnVisibility[key] };
                            startTransition(() => {
                              setPreference('columnVisibility', updated);
                            });
                          }}>
                            <Checkbox checked={columnVisibility[key]} onChange={() => {
                              const updated = { ...columnVisibility, [key]: !columnVisibility[key] };
                              startTransition(() => {
                                setPreference('columnVisibility', updated);
                              });
                            }} />
                            <span className={cn(
                              "text-[11px] font-medium transition-colors",
                              columnVisibility[key] ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-600",
                              isPending && "opacity-70"
                            )}>
                              {labels[key] || key}
                            </span>
                          </div>
                       );
                     })}
                   </div>
                 </div>
               </div>
             )}
           </div>
        </div>
      </div>

      {/* Table Area */}
      <div 
        ref={tableContainerRef}
        onScroll={handleTableScroll}
        className="overflow-x-auto relative scrollbar-hide border-b border-slate-100 dark:border-slate-800"
      >
        <table className="w-full text-left border-collapse table-auto min-w-[max-content]">
          <thead className="sticky top-0 z-40 bg-slate-50 dark:bg-slate-800 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800">
            <tr className="divide-x divide-slate-100/50 dark:divide-slate-800/50">
              {columnVisibility.projectNumber && (
                <th 
                  style={{ 
                    left: getStickyOffset('projectNumber'),
                    width: STICKY_WIDTHS.projectNumber,
                    minWidth: STICKY_WIDTHS.projectNumber 
                  }}
                  className="sticky z-50 bg-slate-50 dark:bg-slate-800 px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-r border-slate-200/40 dark:border-slate-700/40 cursor-pointer hover:bg-slate-100/50 transition-colors"
                  onClick={() => handleSort('projectNumber')}
                >
                  <div className="flex items-center"># ID <SortIcon column="projectNumber" /></div>
                </th>
              )}
              {columnVisibility.projectName && (
                <th 
                  style={{ 
                    left: getStickyOffset('projectName'),
                    width: STICKY_WIDTHS.projectName,
                    minWidth: STICKY_WIDTHS.projectName 
                  }}
                  className="sticky z-50 bg-slate-50 dark:bg-slate-800 px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-r border-slate-200/40 dark:border-slate-700/40 cursor-pointer hover:bg-slate-100/50 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">Project Name / Client <SortIcon column="name" /></div>
                </th>
              )}
              {columnVisibility.itemName && (
                <th 
                  style={{ 
                    left: getStickyOffset('itemName'),
                    width: STICKY_WIDTHS.itemName,
                    minWidth: STICKY_WIDTHS.itemName 
                  }}
                  className={cn(
                    "sticky z-50 bg-slate-50 dark:bg-slate-800 px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-r border-slate-200/40 dark:border-slate-700/40 transition-all",
                    isScrolled && "shadow-[6px_0_10px_-4px_rgba(0,0,0,0.1)] dark:shadow-[6px_0_10px_-4px_rgba(0,0,0,0.3)]"
                  )}
                >
                  Item
                </th>
              )}
              {columnVisibility.projectManager && (
                <th 
                  className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors min-w-[140px]"
                  onClick={() => handleSort('projectManager')}
                >
                  <div className="flex items-center">PM <SortIcon column="projectManager" /></div>
                </th>
              )}
              {columnVisibility.status && (
                <th 
                  className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors text-center min-w-[100px]"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center justify-center">Status <SortIcon column="status" /></div>
                </th>
              )}
              {columnVisibility.bayLocation && (
                <th 
                  className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors text-center min-w-[120px]"
                  onClick={() => handleSort('bayLocation')}
                >
                  <div className="flex items-center justify-center">Bay Location <SortIcon column="bayLocation" /></div>
                </th>
              )}
              {columnVisibility.deliveryDate && (
                <th 
                  className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors text-center min-w-[110px]"
                  onClick={() => handleSort('deliveryDate')}
                >
                  <div className="flex items-center justify-center">Due Date <SortIcon column="deliveryDate" /></div>
                </th>
              )}
              {columnVisibility.drawingApprovalDate && (
                <th 
                  className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors text-center min-w-[150px]"
                  onClick={() => handleSort('drawingApprovalDate')}
                >
                  <div className="flex items-center justify-center">Drawing Approval <SortIcon column="drawingApprovalDate" /></div>
                </th>
              )}
              {columnVisibility.drawingSubmittedDate && (
                <th 
                  className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors text-center min-w-[150px]"
                  onClick={() => handleSort('drawingSubmittedDate')}
                >
                  <div className="flex items-center justify-center">Drawing Submitted <SortIcon column="drawingSubmittedDate" /></div>
                </th>
              )}
              {columnVisibility.budgetHours && (
                <th 
                  className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center cursor-help cursor-pointer hover:bg-slate-100/50 transition-colors min-w-[90px]"
                  onClick={() => handleSort('budgetHours')}
                >
                  <Tooltip content="Calculated from total Task quantity across project">
                    <div className="flex items-center justify-center">Budget <SortIcon column="budgetHours" /></div>
                  </Tooltip>
                </th>
              )}
              {columnVisibility.actualHours && (
                <th 
                  className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center cursor-help cursor-pointer hover:bg-slate-100/50 transition-colors min-w-[90px]"
                  onClick={() => handleSort('actualHours')}
                >
                  <Tooltip content="Aggregated from ALL logged timesheets (Draft, Submitted, Approved)">
                    <div className="flex items-center justify-center">Actual <SortIcon column="actualHours" /></div>
                  </Tooltip>
                </th>
              )}
              {columnVisibility.remainingHours && (
                <th 
                  className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors text-center cursor-help min-w-[90px]"
                  onClick={() => handleSort('remainingHours')}
                >
                  <Tooltip content="Budget - Actual Hours">
                    <div className="flex items-center justify-center">REM <SortIcon column="remainingHours" /></div>
                  </Tooltip>
                </th>
              )}
              {columnVisibility.progressPercent && (
                <th 
                  className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors text-center min-w-[100px]"
                  onClick={() => handleSort('progressPercent')}
                >
                  <div className="flex items-center justify-center">% <SortIcon column="progressPercent" /></div>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {currentProjects.length > 0 ? (
              currentProjects.map((project) => (
                <tr 
                  key={project.id} 
                  className={cn(
                    "group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all duration-150 border-b border-slate-50 dark:border-slate-800",
                    !isProductiveProject(project.projectNumber) && "opacity-60 grayscale-[0.3]"
                  )}
                >
                  {columnVisibility.projectNumber && (
                    <td 
                      style={{ 
                        left: getStickyOffset('projectNumber'),
                        width: STICKY_WIDTHS.projectNumber,
                        minWidth: STICKY_WIDTHS.projectNumber 
                      }}
                      className="sticky z-10 bg-white dark:bg-slate-900 px-4 py-3 font-bold text-[12px] text-slate-400 group-hover:text-brand tabular-nums border-r border-slate-100/60 dark:border-slate-800/60 transition-colors whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                      {project.projectNumber}
                    </td>
                  )}
                  {columnVisibility.projectName && (
                    <td 
                       style={{ 
                         left: getStickyOffset('projectName'),
                         width: STICKY_WIDTHS.projectName,
                         minWidth: STICKY_WIDTHS.projectName 
                       }}
                       className="sticky z-10 bg-white dark:bg-slate-900 px-4 py-3 border-r border-slate-100/60 dark:border-slate-800/60"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col gap-0.5 max-w-full">
                            <div className="flex items-center gap-2">
                              <a 
                                href={`https://app.workguru.io/App/Projects/Detail2/${project.workguruId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[13px] font-bold text-slate-900 dark:text-slate-100 line-clamp-1 hover:text-brand hover:underline flex items-center gap-1.5"
                              >
                                {project.name}
                                <ExternalLink className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                              </a>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-tight line-clamp-1">{project.client?.name}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  )}
                  {columnVisibility.itemName && (
                    <td 
                      style={{ 
                        left: getStickyOffset('itemName'),
                        width: STICKY_WIDTHS.itemName,
                        minWidth: STICKY_WIDTHS.itemName 
                      }}
                      className={cn(
                       "sticky z-10 bg-white dark:bg-slate-900 px-4 py-3 text-[12px] font-medium text-slate-600 dark:text-slate-400 border-r border-slate-100/60 dark:border-slate-800/60 transition-all",
                       isScrolled && "shadow-[6px_0_10px_-4px_rgba(0,0,0,0.1)] dark:shadow-[6px_0_10px_-4px_rgba(0,0,0,0.3)]"
                      )}
                    >
                      <div className="line-clamp-2 leading-relaxed">
                        {project.description || '—'}
                      </div>
                    </td>
                  )}

                  {columnVisibility.projectManager && (
                    <td className="px-4 py-3 text-[12px] font-medium text-slate-600 dark:text-slate-400">
                      {project.projectManager || 'Unassigned'}
                    </td>
                  )}
                  {columnVisibility.status && (
                    <td className="px-4 py-3 text-center">
                       <span className={cn(
                         "inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold border shadow-sm uppercase tracking-wider",
                         project.rawStatus === 'Active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-600 border-slate-100"
                       )}>
                         {project.rawStatus}
                       </span>
                    </td>
                  )}
                  {columnVisibility.bayLocation && (
                    <td className="px-4 py-3 text-center text-[12px] font-bold text-slate-700 dark:text-slate-300">
                      {project.bayLocation || '—'}
                    </td>
                  )}
                  {columnVisibility.deliveryDate && (
                    <td className="px-4 py-3 text-center">
                       <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                        {project.deliveryDate ? format(new Date(project.deliveryDate), 'dd MMM yy') : '—'}
                       </span>
                    </td>
                  )}
                  {columnVisibility.drawingApprovalDate && (
                    <td className="px-4 py-3 text-center">
                       <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                        {project.drawingApprovalDate ? format(new Date(project.drawingApprovalDate), 'dd MMM yy') : '—'}
                       </span>
                    </td>
                  )}
                  {columnVisibility.drawingSubmittedDate && (
                    <td className="px-4 py-3 text-center">
                       <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                        {project.drawingSubmittedDate ? format(new Date(project.drawingSubmittedDate), 'dd MMM yy') : '—'}
                       </span>
                    </td>
                  )}
                  {columnVisibility.budgetHours && (
                    <td className="px-4 py-3 text-center">
                      <span className="text-[12px] font-bold text-slate-700 dark:text-slate-300 tabular-nums">{project.budgetHours}h</span>
                    </td>
                  )}
                  {columnVisibility.actualHours && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-[12px] font-bold text-slate-700 dark:text-slate-300 tabular-nums">{project.actualHours}h</span>
                      </div>
                    </td>
                  )}
                  {columnVisibility.remainingHours && (
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "text-[12px] font-bold tabular-nums",
                        project.remainingHours < 0 ? "text-red-500" : "text-slate-700 dark:text-slate-300"
                      )}>
                        {project.remainingHours}h
                      </span>
                    </td>
                  )}
                  {columnVisibility.progressPercent && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-2 justify-center min-w-[80px]">
                        <span className={cn(
                          "text-[10px] font-bold tabular-nums",
                          project.progressPercent >= 100 ? "text-red-500" : 
                          project.progressPercent >= 80 ? "text-orange-500" : "text-brand"
                        )}>{Math.round(project.progressPercent)}%</span>
                        <div className="w-12 bg-slate-100 dark:bg-slate-800 rounded-full h-1 overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-1000",
                              project.progressPercent >= 100 ? "bg-red-500" : 
                              project.progressPercent >= 80 ? "bg-orange-500" : "bg-brand"
                            )}
                            style={{ width: `${Math.min(project.progressPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                 <td colSpan={9} className="px-6 py-20 text-center">
                   <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-800">
                         <Search className="h-5 w-5 text-slate-300" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">No projects found</p>
                        <p className="text-xs text-slate-400 font-medium">Try adjusting your filters or search terms</p>
                      </div>
                   </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Viewport Sticky Scrollbar (Excel-Style Navigation) */}
      {showFakeScroll && hasOverflow && (
        <div 
          ref={fakeScrollRef}
          onScroll={handleFakeScroll}
          style={{ 
            left: `${containerRect.left}px`,
            width: `${containerRect.width}px`,
            // High visibility styling
            boxShadow: '0 -10px 15px -3px rgba(0,0,0,0.1), 0 -4px 6px -2px rgba(0,0,0,0.05)'
          }}
          className="fixed bottom-0 z-[60] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 h-[14px] overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 hover:h-[18px] transition-all"
        >
          <div style={{ width: contentWidth, height: '1px' }} />
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-900/30">
          <div className="flex items-center gap-4">
            <div className="text-[11px] font-bold text-slate-400 tabular-nums">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Show</span>
              <select 
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-bold outline-none px-2 py-1"
              >
                {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
