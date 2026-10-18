"use client";

import React, { useState, useMemo } from "react";
import { 
  ProjectReadinessAssessment, 
  SupplierIntelligenceSummary, 
  MaterialRequirementType 
} from "@/lib/risk-v2/readiness";
import { ReadinessDetailModal } from "./ReadinessDetailModal";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ShieldAlert, 
  Layers, 
  Truck, 
  Search, 
  Filter, 
  ArrowRight,
  Info,
  Calendar,
  Building,
  Package,
  ExternalLink,
  ChevronRight,
  AlertCircle
} from "lucide-react";

interface ProductionReadinessPanelProps {
  projects: ProjectReadinessAssessment[];
  supplierIntelligence: SupplierIntelligenceSummary;
  summary: {
    readyForManufacturingCount: number;
    readyForFramingOnlyCount: number;
    blockedByDrawingsCount: number;
    blockedBySheetmetalCount: number;
    blockedBySwitchgearCount: number;
    blockedByBothCount: number;
    readinessUnknownCount: number;
    startDateOverdueCount: number;
    materialDelayConflictCount: number;
    supplierEtaOverdueCount: number;
  };
  onRefresh?: () => void;
}

type FilterCategory = 
  | 'all' 
  | 'ready' 
  | 'framing_only' 
  | 'awaiting_sheetmetal' 
  | 'awaiting_switchgear' 
  | 'awaiting_drawings' 
  | 'conflicts' 
  | 'unconfirmed';

export function ProductionReadinessPanel({
  projects,
  supplierIntelligence,
  summary,
  onRefresh,
}: ProductionReadinessPanelProps) {
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reqFilter, setReqFilter] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<ProjectReadinessAssessment | null>(null);
  const [activeView, setActiveView] = useState<'projects' | 'suppliers'>('projects');

  // Filter projects based on category, requirement, and search
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // 1. Category Filter
      if (filterCategory === 'ready' && p.manufacturingReadiness !== 'ready_for_production') return false;
      if (filterCategory === 'framing_only' && p.manufacturingReadiness !== 'ready_for_framing_only') return false;
      if (filterCategory === 'awaiting_sheetmetal' && 
          p.manufacturingReadiness !== 'blocked_by_sheetmetal' && 
          p.manufacturingReadiness !== 'blocked_by_both') return false;
      if (filterCategory === 'awaiting_switchgear' && 
          p.manufacturingReadiness !== 'blocked_by_switchgear') return false;
      if (filterCategory === 'awaiting_drawings' && p.manufacturingReadiness !== 'blocked_by_drawings') return false;
      if (filterCategory === 'conflicts' && !p.isMaterialDelayConflict) return false;
      if (filterCategory === 'unconfirmed' && p.materialRequirement !== 'unknown') return false;

      // 2. Material Requirement Filter
      if (reqFilter !== 'all' && p.materialRequirement !== reqFilter) return false;

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNumber = p.projectNumber.toLowerCase().includes(q);
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesClient = p.clientName?.toLowerCase().includes(q);
        const matchesPM = p.projectManager?.toLowerCase().includes(q);
        if (!matchesNumber && !matchesName && !matchesClient && !matchesPM) return false;
      }

      return true;
    });
  }, [projects, filterCategory, reqFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* View Toggle Bar (Readiness vs Supplier Intelligence) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 self-start">
          <button
            onClick={() => setActiveView('projects')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeView === 'projects'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            <span>Project Material Readiness ({projects.length})</span>
          </button>

          <button
            onClick={() => setActiveView('suppliers')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeView === 'suppliers'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-indigo-500" />
            <span>Supplier Intelligence</span>
            {supplierIntelligence.overdueInFlightPOsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                {supplierIntelligence.overdueInFlightPOsCount}
              </span>
            )}
          </button>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">
          Showing <strong className="text-slate-900 dark:text-white">{filteredProjects.length}</strong> of {projects.length} active projects
        </div>
      </div>

      {activeView === 'projects' ? (
        <>
          {/* Headline Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Ready for Production */}
            <div 
              onClick={() => setFilterCategory('ready')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                filterCategory === 'ready' 
                  ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs' 
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Ready for Prod</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {summary.readyForManufacturingCount}
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                Drawings & all materials confirmed
              </div>
            </div>

            {/* Ready for Framing Only */}
            <div 
              onClick={() => setFilterCategory('framing_only')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                filterCategory === 'framing_only' 
                  ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs' 
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Framing Only</span>
                <Layers className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {summary.readyForFramingOnlyCount}
              </div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-1">
                Sheetmetal in, awaiting switchgear
              </div>
            </div>

            {/* Awaiting Sheetmetal */}
            <div 
              onClick={() => setFilterCategory('awaiting_sheetmetal')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                filterCategory === 'awaiting_sheetmetal' 
                  ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs' 
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Awaiting Sheetmetal</span>
                <Package className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {summary.blockedBySheetmetalCount + summary.blockedByBothCount}
              </div>
              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                Frame assembly blocked
              </div>
            </div>

            {/* Awaiting Switchgear */}
            <div 
              onClick={() => setFilterCategory('awaiting_switchgear')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                filterCategory === 'awaiting_switchgear' 
                  ? 'border-purple-500 bg-purple-50/40 dark:bg-purple-950/20 shadow-xs' 
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Awaiting Switchgear</span>
                <Truck className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {summary.blockedBySwitchgearCount}
              </div>
              <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-1">
                Mounting & wiring gated
              </div>
            </div>

            {/* Awaiting Drawings */}
            <div 
              onClick={() => setFilterCategory('awaiting_drawings')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                filterCategory === 'awaiting_drawings' 
                  ? 'border-orange-500 bg-orange-50/40 dark:bg-orange-950/20 shadow-xs' 
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Awaiting Drawings</span>
                <Clock className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {summary.blockedByDrawingsCount}
              </div>
              <div className="text-[10px] text-orange-600 dark:text-orange-400 font-medium mt-1">
                Drafting approval gating start
              </div>
            </div>

            {/* Material Delay Conflicts */}
            <div 
              onClick={() => setFilterCategory('conflicts')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                filterCategory === 'conflicts' 
                  ? 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 shadow-xs' 
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Material Conflicts</span>
                <ShieldAlert className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {summary.materialDelayConflictCount}
              </div>
              <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium mt-1">
                Required start before ETA
              </div>
            </div>
          </div>

          {/* Interactive Filter Strip & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'All Projects', count: projects.length },
                { id: 'ready', label: 'Ready for Prod', count: summary.readyForManufacturingCount },
                { id: 'framing_only', label: 'Framing Only', count: summary.readyForFramingOnlyCount },
                { id: 'awaiting_sheetmetal', label: 'Awaiting Sheetmetal', count: summary.blockedBySheetmetalCount + summary.blockedByBothCount },
                { id: 'awaiting_switchgear', label: 'Awaiting Switchgear', count: summary.blockedBySwitchgearCount },
                { id: 'awaiting_drawings', label: 'Awaiting Drawings', count: summary.blockedByDrawingsCount },
                { id: 'conflicts', label: 'Delay Conflicts', count: summary.materialDelayConflictCount },
                { id: 'unconfirmed', label: 'Unconfirmed Req', count: summary.readinessUnknownCount },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setFilterCategory(pill.id as FilterCategory)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterCategory === pill.id
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {pill.label} ({pill.count})
                </button>
              ))}
            </div>

            {/* Search & Requirement Filter Dropdown */}
            <div className="flex items-center gap-2">
              <select
                value={reqFilter}
                onChange={(e) => setReqFilter(e.target.value)}
                className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">All Requirements</option>
                <option value="both">Both (SM + SG)</option>
                <option value="sheetmetal_only">Sheetmetal Only</option>
                <option value="switchgear_only">Switchgear Only</option>
                <option value="neither">Neither Required</option>
                <option value="unknown">Unconfirmed</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search project, client, PM..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48 sm:w-60"
                />
              </div>
            </div>
          </div>

          {/* Project Readiness Table */}
          <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800 font-semibold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-3">Client / PM</th>
                    <th className="py-3 px-3">Required Material</th>
                    <th className="py-3 px-3">Drawings</th>
                    <th className="py-3 px-3">Sheetmetal</th>
                    <th className="py-3 px-3">Switchgear</th>
                    <th className="py-3 px-3">Readiness Gate</th>
                    <th className="py-3 px-3">Latest Req Start</th>
                    <th className="py-3 px-3">Material Confirmed / ETA</th>
                    <th className="py-3 px-3">Linked POs</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        No projects match the selected readiness filters.
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((p) => (
                      <tr 
                        key={p.projectId}
                        onClick={() => setSelectedProject(p)}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      >
                        {/* Project Info */}
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-900 dark:text-white">
                            {p.projectNumber}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                            {p.name}
                          </div>
                        </td>

                        {/* Client & PM */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                            {p.clientName || 'N/A'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {p.projectManager || 'Unassigned'}
                          </div>
                        </td>

                        {/* Material Requirement */}
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.materialRequirement === 'both'
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              : p.materialRequirement === 'sheetmetal_only'
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50'
                              : p.materialRequirement === 'switchgear_only'
                              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50'
                              : p.materialRequirement === 'neither'
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50'
                          }`}>
                            {p.materialRequirement === 'both' ? 'Both (SM+SG)' :
                             p.materialRequirement === 'sheetmetal_only' ? 'SM Only' :
                             p.materialRequirement === 'switchgear_only' ? 'SG Only' :
                             p.materialRequirement === 'neither' ? 'Neither' : 'Unconfirmed'}
                          </span>
                        </td>

                        {/* Drawings */}
                        <td className="py-3 px-3">
                          {p.drawingStatus === 'approved' ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              Approved
                            </span>
                          ) : p.drawingStatus === 'pending_approval' ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              Pending
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1 text-[11px]">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              Missing
                            </span>
                          )}
                        </td>

                        {/* Sheetmetal */}
                        <td className="py-3 px-3">
                          {p.sheetmetalStatus === 'not_required' ? (
                            <span className="text-slate-400 text-[11px]">N/A</span>
                          ) : p.sheetmetalStatus === 'delivered' ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                              Delivered
                            </span>
                          ) : p.sheetmetalStatus === 'ordered_with_eta' ? (
                            <div className="text-[11px]">
                              <span className="text-blue-600 dark:text-blue-400 font-medium">ETA</span>{' '}
                              <span className="text-slate-500">{p.sheetmetalExpectedDate}</span>
                            </div>
                          ) : p.sheetmetalStatus === 'ordered_no_eta' ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                              Ordered (No ETA)
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 font-medium text-[11px]">
                              Awaiting
                            </span>
                          )}
                        </td>

                        {/* Switchgear */}
                        <td className="py-3 px-3">
                          {p.switchgearStatus === 'not_required' ? (
                            <span className="text-slate-400 text-[11px]">N/A</span>
                          ) : p.switchgearStatus === 'delivered' ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                              Delivered
                            </span>
                          ) : p.switchgearStatus === 'ordered_with_eta' ? (
                            <div className="text-[11px]">
                              <span className="text-blue-600 dark:text-blue-400 font-medium">ETA</span>{' '}
                              <span className="text-slate-500">{p.switchgearExpectedDate}</span>
                            </div>
                          ) : p.switchgearStatus === 'ordered_no_eta' ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                              Ordered (No ETA)
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 font-medium text-[11px]">
                              Awaiting
                            </span>
                          )}
                        </td>

                        {/* Readiness Gate */}
                        <td className="py-3 px-3">
                          {p.manufacturingReadiness === 'ready_for_production' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                              Ready for Prod
                            </span>
                          ) : p.manufacturingReadiness === 'ready_for_framing_only' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                              Framing Only
                            </span>
                          ) : p.manufacturingReadiness === 'blocked_by_drawings' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400">
                              Blocked Drawings
                            </span>
                          ) : p.isMaterialDelayConflict ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                              Delay Conflict
                            </span>
                          ) : p.manufacturingReadiness === 'blocked_by_sheetmetal' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                              Blocked SM
                            </span>
                          ) : p.manufacturingReadiness === 'blocked_by_switchgear' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400">
                              Blocked SG
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              Unconfirmed
                            </span>
                          )}
                        </td>

                        {/* Provisional Latest Required Start */}
                        <td className="py-3 px-3">
                          <div className={`font-mono text-[11px] font-semibold ${
                            p.isStartDateOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {p.latestRequiredManufacturingStartDate || '—'}
                          </div>
                          {p.isStartDateOverdue && (
                            <div className="text-[10px] text-rose-500 font-medium">Overdue start</div>
                          )}
                        </td>

                        {/* Material Confirmed vs Estimated Start */}
                        <td className="py-3 px-3">
                          {p.earliestConfirmedMaterialStartDate ? (
                            <div className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              {p.earliestConfirmedMaterialStartDate}
                            </div>
                          ) : p.earliestEstimatedMaterialStartDate ? (
                            <div className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                              {p.earliestEstimatedMaterialStartDate} <span className="text-[10px] text-slate-400">(Est ETA)</span>
                            </div>
                          ) : (
                            <div className="font-mono text-[11px] text-slate-400">
                              TBD / No ETA
                            </div>
                          )}
                          {p.isMaterialDelayConflict && (
                            <div className="text-[10px] text-rose-500 font-medium">Conflicts delivery</div>
                          )}
                        </td>

                        {/* Linked POs */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px]">{p.purchaseOrders.length}</span>
                            {p.delayedPOCount > 0 && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                                {p.delayedPOCount} delayed
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProject(p);
                            }}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Supplier Delivery Intelligence View */
        <div className="space-y-6">
          {/* Top Level Supplier Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="text-xs font-semibold text-slate-500">In-Flight Pipeline POs</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {supplierIntelligence.totalInFlightPOs}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                ${supplierIntelligence.totalInFlightValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} on active jobs
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="text-xs font-semibold text-slate-500">Overdue Supplier ETAs</div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                {supplierIntelligence.overdueInFlightPOsCount}
              </div>
              <div className="text-[11px] text-rose-500 mt-1 font-mono">
                ${supplierIntelligence.overdueInFlightValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} pending arrival
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="text-xs font-semibold text-slate-500">Missing Supplier ETAs</div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {supplierIntelligence.inFlightMissingEtaCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                In-flight POs lacking delivery dates
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="text-xs font-semibold text-slate-500">Projects Affected</div>
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                {supplierIntelligence.affectedProjectsCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Active projects awaiting delayed POs
              </div>
            </div>
          </div>

          {/* Supplier History Audit Trail Notice */}
          <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/60 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 dark:text-blue-300 space-y-1">
              <div className="font-bold">Supplier Data & ETA Audit Findings:</div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                <li><strong>Active Pipeline Isolation:</strong> PO commitments are strictly filtered to active manufacturing projects. 136 approved POs ($387k) belonging to Completed, Delivered, or Invoiced jobs have been excluded to prevent financial distortion.</li>
                <li><strong>Supplier ETAs:</strong> Approved POs in WorkGuru currently lack recorded expected delivery dates (100% missing ETAs in active pipeline). Dates shown represent custom project field dates or planner inputs.</li>
                <li><strong>Revision History:</strong> WorkGuru updates delivery dates in-place without preserving audit trails. A proposed schema (<code>drizzle/proposed/0002_project_material_requirements.sql</code>) has been prepared to track revision timestamps and reasons without altering existing tables.</li>
              </ul>
            </div>
          </div>

          {/* Top Suppliers Table */}
          <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Top Suppliers by In-Flight Commitment Value
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Aggregated from all active purchase orders and expected delivery tracking
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Supplier Name</th>
                    <th className="py-2.5 px-3">In-Flight POs</th>
                    <th className="py-2.5 px-3">Overdue POs</th>
                    <th className="py-2.5 px-3">Avg Historical Variance</th>
                    <th className="py-2.5 px-4 text-right">In-Flight Value ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {supplierIntelligence.topSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No supplier data found.
                      </td>
                    </tr>
                  ) : (
                    supplierIntelligence.topSuppliers.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                          {s.supplierName}
                        </td>
                        <td className="py-2.5 px-3 font-semibold">
                          {s.inFlightCount}
                        </td>
                        <td className="py-2.5 px-3">
                          {s.overdueCount > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                              {s.overdueCount} overdue
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {s.avgVarianceDays !== null ? (
                            <span className={s.avgVarianceDays > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-emerald-600 dark:text-emerald-400'}>
                              {s.avgVarianceDays > 0 ? `+${s.avgVarianceDays}d average` : `${s.avgVarianceDays}d`}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          ${s.inFlightValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Delayed POs Table */}
          <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Delayed In-Flight Purchase Orders ({supplierIntelligence.recentDelayedPOs.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Purchase orders whose expected delivery date has passed without confirmation of receipt
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-4">PO Number</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3">Affected Project</th>
                    <th className="py-2.5 px-3">Expected Date</th>
                    <th className="py-2.5 px-3">Days Past ETA</th>
                    <th className="py-2.5 px-4 text-right">Amount ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {supplierIntelligence.recentDelayedPOs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No delayed purchase orders found.
                      </td>
                    </tr>
                  ) : (
                    supplierIntelligence.recentDelayedPOs.map((po) => (
                      <tr key={po.poId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {po.poNumber || `PO #${po.poId}`}
                        </td>
                        <td className="py-2.5 px-3 font-medium">
                          {po.supplierName || 'Unspecified'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{po.projectNumber}</span>{' '}
                          <span className="text-slate-500 dark:text-slate-400 truncate max-w-[150px] inline-block align-bottom">{po.projectName}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {po.expectedDate}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                            +{po.daysOverdue} days
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold">
                          ${po.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Detail & Material Confirmation Modal */}
      {selectedProject && (
        <ReadinessDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onSaved={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
