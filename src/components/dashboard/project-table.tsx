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
  MoreVertical
} from "lucide-react";
import { cn } from "@/lib/utils";

type ProjectTableProps = {
  projects: any[];
};

export function ProjectTable({ projects }: ProjectTableProps) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const filteredProjects = useMemo(() => {
    return projects.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.projectNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.client.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [projects, search]);

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const currentProjects = filteredProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
           <button className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-all">
             <Filter className="h-4 w-4" />
           </button>
           <div className="text-xs font-bold text-slate-500 tabular-nums px-2">
             {filteredProjects.length} records
           </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="overflow-x-auto relative no-scrollbar">
        <table className="w-full text-left border-collapse table-auto min-w-[1000px]">
          <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800/30 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="sticky left-0 z-30 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-sm px-6 py-3.5 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-r border-slate-200/40 dark:border-slate-700/40">
                # ID
              </th>
              <th className="px-6 py-3.5 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Project & Client
              </th>
              <th className="px-6 py-3.5 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
                Stage
              </th>
              <th className="px-6 py-3.5 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
                Labor Hours
              </th>
              <th className="px-6 py-3.5 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
                Progress
              </th>
              <th className="px-6 py-3.5 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
                Deadline
              </th>
              <th className="px-6 py-3.5 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
                Risk Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {currentProjects.length > 0 ? (
              currentProjects.map((project) => (
                <tr key={project.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all duration-150">
                  <td className="sticky left-0 z-10 bg-white/95 dark:bg-slate-900/95 px-6 py-4 font-black text-[13px] text-slate-400 group-hover:text-brand tabular-nums border-r border-slate-100/60 dark:border-slate-800/60 transition-colors">
                    {project.projectNumber}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{project.name}</span>
                        <ExternalLink className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-all cursor-pointer hover:text-brand" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-tight">{project.client.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                     {project.displayStage ? (
                       <span 
                         className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black border shadow-sm uppercase tracking-wider"
                         style={{ 
                           backgroundColor: project.displayStage.color + '10', 
                           color: project.displayStage.color,
                           borderColor: project.displayStage.color + '25'
                         }}
                       >
                         {project.displayStage.name}
                       </span>
                     ) : (
                       <span className="text-[11px] text-slate-400 italic tabular-nums font-medium">{project.rawStatus}</span>
                     )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                       <span className="text-sm font-black text-slate-700 dark:text-slate-300 tabular-nums">{project.budgetHours}h</span>
                       <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Limit</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5 min-w-[140px] max-w-[180px] mx-auto">
                       <div className="flex justify-between items-center text-[10px] font-black tracking-tight">
                          <span className="text-slate-500 dark:text-slate-400 tabular-nums">{project.actualHours}h / {project.budgetHours}h</span>
                          <span className={cn(
                            "tabular-nums",
                            project.progressPercent > 100 ? "text-red-500" : "text-brand"
                          )}>{Math.round(project.progressPercent)}%</span>
                       </div>
                       <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden shadow-inner border border-slate-200/50 dark:border-slate-700/50 p-[1px]">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-1000 ease-out",
                              project.progressPercent > 100 ? "bg-red-500" : "bg-brand shadow-[0_0_8px_rgba(43,149,255,0.4)]"
                            )}
                            style={{ width: `${Math.min(project.progressPercent, 100)}%` }}
                          />
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                       <span className="text-sm font-black text-slate-800 dark:text-slate-200 tabular-nums">
                        {project.deliveryDate ? format(new Date(project.deliveryDate), 'dd MMM yy') : '—'}
                       </span>
                       <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Deadline</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center">
                       <RiskBadge risk={project.risk} />
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-20 text-center">
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
          <div className="text-xs font-bold text-slate-400 tabular-nums">
            Page {currentPage} of {totalPages}
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
  const configs: any = {
    'HIGH_RISK': { label: 'CRITICAL', classes: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20' },
    'MEDIUM_RISK': { label: 'AT RISK', classes: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20' },
    'ON_TRACK': { label: 'HEALTHY', classes: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' },
    'DELAYED': { label: 'DELAYED', classes: 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-lg' },
  };
  const config = configs[risk] || { label: risk, classes: 'bg-slate-100 text-slate-600' };
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black tracking-[0.1em] border transition-all duration-300 shadow-sm uppercase shrink-0 whitespace-nowrap",
      config.classes
    )}>
       {config.label}
    </span>
  );
}
