"use client";

import React, { useState, useMemo, useRef, useEffect, useTransition } from "react";
import {
  ExternalLink,
  ArrowUpDown,
  Truck,
  SquarePen,
  X,
  Save,
  AlertCircle,
  Info,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";
import { formatSydneyDate } from "@/lib/project-logic";
import { useUserPreferences } from "@/components/providers/user-preferences-provider";
import { Checkbox } from "../ui/Checkbox";
import { updateProjectProcurement } from "@/app/actions/procurement";
import { PROCUREMENT_STATUSES, ProcurementRisk, getSupplierSummary } from "@/lib/procurement-logic";
import { ProcurementFilters } from "./procurement-filters";
import { SupplierModal } from "./supplier-modal";

import { DateRangePicker } from "../ui/DateRangePicker";

interface MasterSupplier {
  id: number;
  name: string;
}

interface Supplier {
  id: number;
  supplierName: string;
  masterSupplierId: number | null;
  materialType: string;
  orderDate: Date | string | null;
  expectedDeliveryDate: Date | string | null;
  deliveryStatus: string | null;
  notes: string | null;
}

interface Project {
  id: number;
  workguruId: string;
  projectNumber: string;
  name: string;
  rawStatus: string;
  bayLocation: string | null;
  projectType: string | null;
  startDate: Date | string | null;
  deliveryDate: Date | string | null;
  sheetmetalOrderedDate: Date | string | null;
  sheetmetalDeliveredDate: Date | string | null;
  switchgearOrderedDate: Date | string | null;
  switchgearDeliveredDate: Date | string | null;
  procurementStatus: string | null;
  procurementNotes: string | null;
  projectManager: string | null;
  client?: { name: string };
  suppliers: Supplier[];
  procurementRisk: ProcurementRisk;
  procurementRiskReason?: string;
}

type ProcurementTableProps = {
  projects: Project[];
  masterSuppliers: MasterSupplier[];
  lastUpdated?: string;
};

const RISK_CONFIG: Record<ProcurementRisk, { label: string; classes: string }> = {
  'DELAYED': { 
    label: 'DELAYED', 
    classes: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-900/30'
  },
  'AT_RISK': { 
    label: 'AT RISK', 
    classes: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-900/30'
  },
  'ON_TRACK': { 
    label: 'ON TRACK', 
    classes: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-900/30'
  }
};

const STATUS_COLORS: Record<string, string> = {
  'Not Started': 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  'Ordering': 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-900/30',
  'Partially Ordered': 'bg-blue-50 text-blue-500 border-blue-100 dark:bg-blue-500/10 dark:text-blue-500 dark:border-blue-900/30',
  'Partially Delivered': 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-900/30',
  'Delivered': 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-900/30',
  'Delayed': 'bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-900/30',
  'On Hold': 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-900/30',
};

export function ProcurementTable({ projects, masterSuppliers, lastUpdated }: ProcurementTableProps) {
  const { preferences, setPreference } = useUserPreferences();
  const { procurementColumnVisibility = {} } = preferences;
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'deliveryDate', direction: 'asc' });

  // Filters
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [wgStatusFilter, setWgStatusFilter] = useState<string[]>([]);
  const [riskFilter, setRiskFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [startDateRange, setStartDateRange] = useState({ start: '', end: '' });
  const [dueDateRange, setDueDateRange] = useState({ start: '', end: '' });

  // Modal State
  const [selectedProjectForModal, setSelectedProjectForModal] = useState<Project | null>(null);

  const ALL_COLUMNS = [
    { id: 'projectNumber', label: 'ID', minWidth: 100, locked: true },
    { id: 'projectName', label: 'Project / Client', minWidth: 320 },
    { id: 'procurementRisk', label: 'Risk', minWidth: 140 },
    { id: 'procurementStatus', label: 'Procurement Status', minWidth: 180 },
    { id: 'supplierSummary', label: 'Supplier Summary', minWidth: 200 },
    { id: 'procurementNotes', label: 'Procurement Notes', minWidth: 280 },
    { id: 'status', label: 'Project Status', minWidth: 160 },
    { id: 'projectType', label: 'Project Type', minWidth: 140 },
    { id: 'bayLocation', label: 'Bay Location', minWidth: 120 },
    { id: 'deliveryDate', label: 'Start / Due Dates', minWidth: 200 },
    { id: 'smDates', label: 'SM Dates', minWidth: 160 },
    { id: 'sgDates', label: 'SG Dates', minWidth: 160 },
  ];

  const handleToggleColumn = (columnId: string) => {
    const col = ALL_COLUMNS.find(c => c.id === columnId);
    if (col?.locked) return;

    const current = procurementColumnVisibility[columnId] ?? true;
    startTransition(() => {
      setPreference('procurementColumnVisibility', {
        ...procurementColumnVisibility,
        [columnId]: !current
      });
    });
  };

  const isColumnVisible = (columnId: string) => {
    const col = ALL_COLUMNS.find(c => c.id === columnId);
    if (col?.locked) return true;
    return procurementColumnVisibility[columnId] ?? true;
  };

  const filterOptions = useMemo(() => {
    const wgStatuses = new Set<string>();
    const types = new Set<string>();
    projects.forEach(p => {
      if (p.rawStatus) wgStatuses.add(p.rawStatus);
      if (p.projectType) types.add(p.projectType);
    });
    return {
      wgStatuses: Array.from(wgStatuses).sort(),
      types: Array.from(types).sort(),
    };
  }, [projects]);

  const filteredAndSortedProjects = useMemo(() => {
    let result = projects.filter(p => {
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        p.name?.toLowerCase().includes(searchLower) ||
        p.projectNumber?.toLowerCase().includes(searchLower) ||
        p.client?.name?.toLowerCase().includes(searchLower);
      
      const matchesStatus = statusFilter.length === 0 || (p.procurementStatus && statusFilter.includes(p.procurementStatus));
      const matchesWgStatus = wgStatusFilter.length === 0 || (p.rawStatus && wgStatusFilter.includes(p.rawStatus));
      const matchesRisk = riskFilter.length === 0 || riskFilter.some(filter => {
        if (filter === 'NOT_DELIVERED') {
          return p.procurementStatus !== 'Delivered';
        }
        return filter === p.procurementRisk;
      });
      const matchesType = typeFilter.length === 0 || (p.projectType && typeFilter.includes(p.projectType));

      const matchesStartDate = !startDateRange.start || !startDateRange.end || (
        p.startDate && 
        new Date(p.startDate) >= new Date(startDateRange.start) && 
        new Date(p.startDate) <= new Date(startDateRange.end)
      );

      const matchesDueDate = !dueDateRange.start || !dueDateRange.end || (
        p.deliveryDate && 
        new Date(p.deliveryDate) >= new Date(dueDateRange.start) && 
        new Date(p.deliveryDate) <= new Date(dueDateRange.end)
      );

      return matchesSearch && matchesStatus && matchesWgStatus && matchesRisk && matchesType && matchesStartDate && matchesDueDate;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        let aVal: any = (a as any)[sortConfig.key];
        let bVal: any = (b as any)[sortConfig.key];

        if (sortConfig.key === 'projectName') {
          aVal = a.name;
          bVal = b.name;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [projects, search, statusFilter, wgStatusFilter, riskFilter, typeFilter, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedProjects.length / pageSize);
  const currentProjects = filteredAndSortedProjects.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const columns = ALL_COLUMNS.filter(col => isColumnVisible(col.id));

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] space-y-4">
      {/* Filters & Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-4 shadow-sm flex items-center justify-between gap-4">
        <ProcurementFilters 
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          wgStatusFilter={wgStatusFilter}
          onWgStatusFilterChange={setWgStatusFilter}
          riskFilter={riskFilter}
          onRiskFilterChange={setRiskFilter}
          pmFilter={[]}
          onPmFilterChange={() => {}}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          options={{ ...filterOptions, pms: [] }}
          startDateRange={startDateRange}
          onStartDateRangeChange={(start, end) => setStartDateRange({ start, end })}
          dueDateRange={dueDateRange}
          onDueDateRangeChange={(start, end) => setDueDateRange({ start, end })}
        />
        
        <ColumnPicker 
          columns={ALL_COLUMNS} 
          visibleColumns={procurementColumnVisibility} 
          onToggle={handleToggleColumn} 
        />
      </div>

      {/* Table Area */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          <table className="w-full text-left border-separate border-spacing-0 min-w-max">
            <thead className="sticky top-0 z-50">
              <tr className="bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm">
                {ALL_COLUMNS.map(col => isColumnVisible(col.id) && (
                  <th 
                    key={col.id} 
                    className={cn(
                      "px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] whitespace-nowrap",
                      col.locked && "sticky left-0 z-20 bg-slate-50 dark:bg-slate-950 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                    )}
                    style={{ minWidth: col.minWidth }}
                  >
                    <button 
                      onClick={() => setSortConfig({ key: col.id, direction: sortConfig?.key === col.id && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                      className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      {col.label}
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </button>
                  </th>
                ))}
                <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 sticky right-0 z-[60] bg-inherit border-l-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {currentProjects.map((project) => (
                <tr key={project.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                  {columns.map((col) => {
                    const isLocked = col.locked;
                    const cellClasses = cn(
                      "px-6 py-5 whitespace-nowrap",
                      isLocked && "sticky left-0 z-30 bg-white dark:bg-slate-900 border-r-2 border-slate-100 dark:border-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                    );

                    if (col.id === 'projectNumber') {
                      return (
                        <td key={col.id} className={cellClasses}>
                          <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">{project.projectNumber}</span>
                        </td>
                      );
                    }

                    if (col.id === 'projectName') {
                      return (
                        <td key={col.id} className={cn(cellClasses, "max-w-[400px] whitespace-normal")}>
                          <div className="flex flex-col">
                            <a 
                              href={`https://app.workguru.io/Projects/Project/Details/${project.workguruId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[13px] font-bold text-slate-900 dark:text-white hover:text-brand hover:underline flex items-center gap-2 group/link leading-tight"
                            >
                              <span className="truncate">{project.name}</span>
                              <ExternalLink className="h-3 w-3 text-brand opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                            </a>
                            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-tight mt-1 truncate">{project.client?.name}</span>
                          </div>
                        </td>
                      );
                    }

                    if (col.id === 'procurementRisk') {
                      return (
                        <td key={col.id} className={cellClasses}>
                          <div className="flex items-center gap-2">
                            <RiskBadge risk={project.procurementRisk} />
                            {project.procurementRiskReason && (
                              <Tooltip content={project.procurementRiskReason}>
                                <Info className="h-3.5 w-3.5 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
                              </Tooltip>
                            )}
                          </div>
                        </td>
                      );
                    }

                    if (col.id === 'procurementStatus') {
                      return (
                        <td key={col.id} className={cellClasses}>
                          <span className={cn(
                            "inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-bold border whitespace-nowrap shadow-sm",
                            STATUS_COLORS[project.procurementStatus || ''] || "bg-slate-50 text-slate-500 border-slate-100"
                          )}>
                            {project.procurementStatus || "Not Started"}
                          </span>
                        </td>
                      );
                    }

                    if (col.id === 'supplierSummary') {
                      return (
                        <td key={col.id} className={cellClasses}>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 whitespace-nowrap">
                            <Truck className="h-4 w-4 text-brand/40" />
                            {getSupplierSummary(project.suppliers)}
                          </span>
                        </td>
                      );
                    }

                    if (col.id === 'procurementNotes') {
                      return (
                        <td key={col.id} className={cn(cellClasses, "max-w-[300px] whitespace-normal")}>
                          <Tooltip content={project.procurementNotes || "No notes available"}>
                            <span className="text-[13px] text-slate-500 line-clamp-1 italic font-medium cursor-help hover:text-slate-900 transition-colors">
                              {project.procurementNotes || "—"}
                            </span>
                          </Tooltip>
                        </td>
                      );
                    }

                    if (col.id === 'status') {
                      return (
                        <td key={col.id} className={cellClasses}>
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-tight whitespace-nowrap">{project.rawStatus}</span>
                        </td>
                      );
                    }

                    if (col.id === 'projectType') {
                      return (
                        <td key={col.id} className={cellClasses}>
                          <span className="text-xs font-medium text-slate-400 italic">{project.projectType || "—"}</span>
                        </td>
                      );
                    }

                    if (col.id === 'bayLocation') {
                      return (
                        <td key={col.id} className={cellClasses}>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tabular-nums">{project.bayLocation || "—"}</span>
                        </td>
                      );
                    }

                    if (col.id === 'deliveryDate') {
                      return (
                        <td key={col.id} className={cellClasses}>
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Start</span>
                              <span className="text-[11px] font-bold text-slate-600 tabular-nums uppercase">
                                {project.startDate ? formatSydneyDate(project.startDate, "dd MMM yy") : "N/A"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[9px] font-black text-brand uppercase tracking-widest">Due</span>
                              <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums uppercase">
                                {project.deliveryDate ? formatSydneyDate(project.deliveryDate, "dd MMM yy") : "No Date"}
                              </span>
                            </div>
                          </div>
                        </td>
                      );
                    }

                    if (col.id === 'smDates') {
                      return (
                        <td key={col.id} className={cellClasses}>
                          <MaterialDateRow 
                            label="SM"
                            ordered={project.sheetmetalOrderedDate} 
                            delivered={project.sheetmetalDeliveredDate}
                          />
                        </td>
                      );
                    }

                    if (col.id === 'sgDates') {
                      return (
                        <td key={col.id} className={cellClasses}>
                          <MaterialDateRow 
                            label="SG"
                            ordered={project.switchgearOrderedDate} 
                            delivered={project.switchgearDeliveredDate}
                          />
                        </td>
                      );
                    }

                    return <td key={col.id} className={cellClasses}>—</td>;
                  })}

                  <td className="px-6 py-5 sticky right-0 z-30 bg-white dark:bg-slate-900 border-l-2 border-slate-100 dark:border-slate-800 text-right group-hover:bg-slate-50 dark:group-hover:bg-slate-800/30 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center justify-end gap-3">
                      <Tooltip content="View / Manage Suppliers & Status">
                        <button 
                          onClick={() => setSelectedProjectForModal(project)}
                          className="p-2.5 bg-brand/5 text-brand rounded-xl hover:bg-brand/10 transition-all active:scale-95 flex items-center gap-2"
                        >
                          <SquarePen className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 flex items-center justify-between z-[60]">
          <div className="flex items-center gap-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {filteredAndSortedProjects.length} Projects found
            </p>
            <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Rows:</span>
              <select 
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-transparent text-[10px] font-bold outline-none cursor-pointer"
              >
                {[25, 50, 100, 250, 500].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-sm">
              <span className="text-xs font-bold tabular-nums">{currentPage}</span>
              <span className="text-xs font-medium text-slate-300">/</span>
              <span className="text-xs font-bold text-slate-400 tabular-nums">{totalPages || 1}</span>
            </div>
            <button 
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Supplier Modal */}
      {selectedProjectForModal && (
        <SupplierModal 
          isOpen={!!selectedProjectForModal}
          onClose={() => setSelectedProjectForModal(null)}
          project={selectedProjectForModal}
          masterSuppliers={masterSuppliers}
        />
      )}
    </div>
  );
}

function RiskBadge({ risk }: { risk: ProcurementRisk }) {
  const config = RISK_CONFIG[risk];
  return (
    <span className={cn(
      "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold border shadow-sm uppercase tracking-wider",
      config.classes
    )}>
      {config.label}
    </span>
  );
}

function MaterialDateRow({ label, ordered, delivered }: { label: string, ordered: any, delivered: any }) {
  if (!ordered && !delivered) return <span className="text-slate-300">—</span>;

  return (
    <div className="flex flex-col gap-1.5 py-1">
      {ordered && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest w-6">Ord</span>
          <span className="text-[11px] font-bold tabular-nums text-slate-600">
            {formatSydneyDate(ordered, "dd MMM yyyy")}
          </span>
        </div>
      )}
      {delivered && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest w-6">Del</span>
          <span className="text-[11px] font-bold tabular-nums text-emerald-600">
            {formatSydneyDate(delivered, "dd MMM yyyy")}
          </span>
        </div>
      )}
      {!delivered && ordered && (
         <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest w-6">Del</span>
          <span className="text-[11px] font-bold tabular-nums text-slate-300">—</span>
        </div>
      )}
    </div>
  );
}

function ColumnPicker({ columns, visibleColumns, onToggle }: { columns: any[], visibleColumns: Record<string, boolean>, onToggle: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:border-brand/30 hover:text-brand transition-all shadow-sm"
      >
        <Filter className="h-4 w-4" />
        Columns
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-3 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-[100] p-3 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="max-h-96 overflow-y-auto scrollbar-thin p-1 space-y-1">
            {columns.map(col => (
              <button
                key={col.id}
                disabled={col.locked}
                onClick={() => !col.locked && onToggle(col.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all",
                  col.locked ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                <Checkbox checked={visibleColumns[col.id] ?? true} onChange={() => !col.locked && onToggle(col.id)} />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{col.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
