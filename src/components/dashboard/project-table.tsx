"use client";

import React, { useState, useMemo } from "react";
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

type ProjectTableProps = {
  projects: any[];
  initialFilter?: string;
};

export function ProjectTable({ projects, initialFilter = "" }: ProjectTableProps) {
  const [search, setSearch] = useState(initialFilter);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'deliveryDate', direction: 'asc' });
  
  // Advanced filters
  const [pmFilter, setPmFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

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
        <div className="flex items-center gap-3">
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
        </div>
      </div>

      {/* Table Area */}
      <div className="overflow-x-auto relative no-scrollbar">
        <table className="w-full text-left border-collapse table-auto min-w-[1000px]">
          <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="sticky left-0 z-30 bg-slate-50/95 dark:bg-slate-800/95 px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-r border-slate-200/40 dark:border-slate-700/40">
                # ID
              </th>
              <th 
                className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">Project Name / Client <SortIcon column="name" /></div>
              </th>
              <th 
                className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors"
                onClick={() => handleSort('projectManager')}
              >
                <div className="flex items-center">PM <SortIcon column="projectManager" /></div>
              </th>
              <th 
                className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors text-center"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center justify-center">Status <SortIcon column="status" /></div>
              </th>
              <th 
                className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors text-center"
                onClick={() => handleSort('deliveryDate')}
              >
                <div className="flex items-center justify-center">Due Date <SortIcon column="deliveryDate" /></div>
              </th>
              <th 
                className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center cursor-help cursor-pointer hover:bg-slate-100/50 transition-colors"
                onClick={() => handleSort('budgetHours')}
              >
                <Tooltip content="Calculated from total Task quantity across project">
                  <div className="flex items-center justify-center">Budget <SortIcon column="budgetHours" /></div>
                </Tooltip>
              </th>
              <th 
                className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center cursor-help cursor-pointer hover:bg-slate-100/50 transition-colors"
                onClick={() => handleSort('actualHours')}
              >
                <Tooltip content="Aggregated from ALL logged timesheets (Draft, Submitted, Approved)">
                  <div className="flex items-center justify-center">Actual <SortIcon column="actualHours" /></div>
                </Tooltip>
              </th>
              <th 
                className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors text-center cursor-help"
                onClick={() => handleSort('remainingHours')}
              >
                <Tooltip content="Budget - Actual Hours">
                  <div className="flex items-center justify-center">REM <SortIcon column="remainingHours" /></div>
                </Tooltip>
              </th>
              <th 
                className="px-4 py-3.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors text-center"
                onClick={() => handleSort('progressPercent')}
              >
                <div className="flex items-center justify-center">% <SortIcon column="progressPercent" /></div>
              </th>
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
                  <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-4 py-3 font-bold text-[12px] text-slate-400 group-hover:text-brand tabular-nums border-r border-slate-100/60 dark:border-slate-800/60 transition-colors">
                    {project.projectNumber}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <a 
                              href={`https://app.workguru.io/App/Projects/Detail2/${project.workguruId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1 hover:text-brand hover:underline flex items-center gap-1.5"
                            >
                              {project.name}
                              <ExternalLink className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                            </a>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-tight">{project.client?.name}</span>
                            
                            {/* Operational Flags */}
                            {(() => {
                              const budget = Number(project.budgetHours) || 0;
                              const actual = Number(project.actualHours) || 0;
                              const progress = Number(project.progressPercent) || 0;
                              const hasUnapproved = project.hasUnapprovedHours === 1;
                              
                              let primaryFlag = null;
                              if (!isProductiveProject(project.projectNumber)) {
                                primaryFlag = (
                                  <Tooltip content={INTERNAL_WORK_DESCRIPTION}>
                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 uppercase tracking-tighter shrink-0 cursor-help">
                                      Internal
                                    </span>
                                  </Tooltip>
                                );
                              } else if (actual > budget && budget > 0) {
                                primaryFlag = <span className="text-[9px] font-bold text-red-600 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-500/20 uppercase tracking-tighter shrink-0">Over Budget</span>;
                              } else if (progress >= 80 && actual <= budget && budget > 0) {
                                primaryFlag = <span className="text-[9px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-100 dark:border-orange-500/20 uppercase tracking-tighter shrink-0">High Usage</span>;
                              } else if (actual === 0 && budget > 0) {
                                primaryFlag = <span className="text-[9px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-500/10 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-500/20 uppercase tracking-tighter shrink-0">Not Started</span>;
                              }

                              return (
                                <div className="flex items-center gap-1.5">
                                  {primaryFlag}
                                  {hasUnapproved && (
                                    <Tooltip content={`Includes unapproved timesheets (${project.approvedHours}h approved)`}>
                                      <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-100/40 uppercase tracking-tighter shrink-0 flex items-center gap-1">
                                        <AlertTriangle className="h-2 w-2" />
                                        Unapproved
                                      </span>
                                    </Tooltip>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        
                        {/* Stale Data Indicator */}
                        {(() => {
                           const now = new Date();
                           const sixHoursAgo = new Date(now.getTime() - (6 * 60 * 60 * 1000));
                           const isStale = !project.lastDeepSyncAt || new Date(project.lastDeepSyncAt) < sixHoursAgo;
                           
                           if (!isStale) return null;

                           const lastSyncedText = project.lastDeepSyncAt 
                             ? new Date(project.lastDeepSyncAt).toLocaleString('en-AU', {
                                 timeZone: 'Australia/Sydney',
                                 day: 'numeric',
                                 month: 'short',
                                 hour: 'numeric',
                                 minute: '2-digit',
                                 hour12: true,
                               })
                             : "Never";

                           return (
                             <Tooltip content={`Last synced: ${lastSyncedText} (Sydney)`}>
                               <span className="text-[9px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-500/20 uppercase tracking-tighter">Stale</span>
                             </Tooltip>
                           );
                        })()}
                      </div>
                      
                      {/* Freshness indicator */}
                      <div className="flex items-center gap-1.5 mt-1">
                        <History className="h-2.5 w-2.5 text-slate-300" />
                        <span className="text-[9px] font-medium text-slate-400">
                          {project.lastDeepSyncAt 
                            ? `Refreshed ${formatDistanceToNow(new Date(project.lastDeepSyncAt), { addSuffix: true })}` 
                            : 'Priority: Pending deep sync'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] font-medium text-slate-600 dark:text-slate-400">
                    {project.projectManager || 'Unassigned'}
                  </td>
                  <td className="px-4 py-3 text-center">
                     <span className={cn(
                       "inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold border shadow-sm uppercase tracking-wider",
                       project.rawStatus === 'Active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-600 border-slate-100"
                     )}>
                       {project.rawStatus}
                     </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                     <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                      {project.deliveryDate ? format(new Date(project.deliveryDate), 'dd MMM yy') : '—'}
                     </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-[12px] font-bold text-slate-700 dark:text-slate-300 tabular-nums">{project.budgetHours}h</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-[12px] font-bold text-slate-700 dark:text-slate-300 tabular-nums">{project.actualHours}h</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "text-[12px] font-bold tabular-nums",
                      project.remainingHours < 0 ? "text-red-500" : "text-slate-700 dark:text-slate-300"
                    )}>
                      {project.remainingHours}h
                    </span>
                  </td>
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

function RiskBadge({ risk }: { risk: string }) {
  const configs: Record<string, { label: string; classes: string }> = {
    'OVER_CAPACITY': { label: 'OVER CAPACITY', classes: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30' },
    'AT_RISK': { label: 'AT RISK', classes: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20' },
    'ON_TRACK': { label: 'ON TRACK', classes: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' },
  };
  const config = configs[risk] || { label: risk, classes: 'bg-slate-100 text-slate-600' };
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-[0.1em] border transition-all duration-300 shadow-sm uppercase shrink-0 whitespace-nowrap",
      config.classes
    )}>
       {config.label}
    </span>
  );
}
