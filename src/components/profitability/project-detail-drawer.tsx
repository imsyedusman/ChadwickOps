"use client";

import React, { useEffect, useState } from "react";
import { X, ExternalLink, Clock, FileText, CheckCircle2, TrendingUp, TrendingDown, Layers, Target, CheckSquare, DollarSign, Briefcase, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { MergedProfitabilityProject } from "./profitability-table";
import { getLiveProjectDetails } from "@/app/actions/profitability";
import { generateProjectNarrative } from "@/app/actions/ai-insights";
import { generateProjectInsights, ProjectInsight } from "@/lib/profitability-insights";
import { AlertTriangle } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";

interface ProjectDetailDrawerProps {
  project: MergedProfitabilityProject;
  isOpen: boolean;
  onClose: () => void;
  statusIcon: any;
  statusColor: string;
}

const renderProgressBar = (actual: number, estimated: number, isMargin: boolean = false, isRevenue: boolean = false) => {
  if (isMargin) {
    const pct = Math.max(0, Math.min(100, actual));
    return (
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full mt-1.5 overflow-hidden flex-shrink-0" style={{ height: '5px', minHeight: '5px' }}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", actual < 0 ? "bg-red-500" : actual <= 15 ? "bg-amber-500" : "bg-emerald-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  } else {
    if (!estimated || estimated === 0) return (
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full mt-1.5 overflow-hidden flex-shrink-0" style={{ height: '5px', minHeight: '5px' }}>
        <div className="h-full bg-slate-200 dark:bg-slate-700 rounded-full w-0" />
      </div>
    );
    const rawPct = (actual / estimated) * 100;
    const displayPct = Math.max(0, Math.min(100, rawPct));
    const barColor = isRevenue
      ? (rawPct >= 100 ? "bg-emerald-500" : "bg-brand")
      : (rawPct > 100 ? "bg-red-500" : "bg-brand");
    return (
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full mt-1.5 overflow-hidden flex-shrink-0" style={{ height: '5px', minHeight: '5px' }}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${displayPct}%` }}
        />
      </div>
    );
  }
};

export function ProjectDetailDrawer({ project, isOpen, onClose, statusIcon: StatusIcon, statusColor }: ProjectDetailDrawerProps) {
  const [liveData, setLiveData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [narrative, setNarrative] = useState<string | null>(null);
  const [isNarrativeLoading, setIsNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !project.workguruId) return;
    
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    getLiveProjectDetails(project.workguruId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setLiveData(res.data);
        } else {
          setError(res.error || "Failed to load project details");
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [isOpen, project.workguruId]);

  if (!isOpen) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(val);
  };

  const getGPMarginPct = (invoiced: number, cost: number) => {
    if (invoiced <= 0 && cost > 0) return -100;
    if (invoiced <= 0) return 0;
    return ((invoiced - cost) / invoiced) * 100;
  };
  
  // Local Synced Profitability Data
  const pInvoiced = project.invoicedAmount || 0;
  const pCost = project.totalCost || 0;
  const gp = pInvoiced - pCost;
  const wgEstimatedProfit = project.quotedProfit;
  const variance = gp - wgEstimatedProfit;
  const marginPct = getGPMarginPct(pInvoiced, pCost);

  const pMat = (project.materialsCost || 0) + (project.purchasesCost || 0);
  const pLab = project.labourCost || 0;
  const pEstMatRaw = project.estimatedMaterialsCost;
  const pEstMat = pEstMatRaw || 0;
  const pEstLab = project.estimatedLabourCost || 0;
  const pEstCost = project.estimatedTotalCost || 0;
  const pEstInvoiced = project.estimatedInvoicedAmount || 0;

  // Calculate insights
  const insights = React.useMemo(() => {
    return generateProjectInsights({
      gpActual: gp,
      gpEstimated: pEstInvoiced - pEstCost,
      invoicedActual: pInvoiced,
      invoicedEstimated: pEstInvoiced,
      materialsActual: pMat,
      materialsEstimated: pEstMat,
      labourActual: pLab,
      labourEstimated: pEstLab,
      hoursActual: liveData?.totalActualHours || 0,
      hoursBudget: liveData?.totalBudgetHours || 0,
      tasksCompleted: liveData?.completedTasks || 0,
      tasksTotal: liveData?.totalTasks || 0,
      isNearCompleteOverride: project.rawStatus?.includes("Completed") || project.rawStatus?.includes("Delivered"),
      hasBillableEstimateAnomaly: (project as any).hasBillableEstimateAnomaly || false
    });
  }, [gp, pInvoiced, pCost, pEstInvoiced, pEstCost, pMat, pEstMat, pLab, pEstLab, liveData, project.rawStatus, (project as any).hasBillableEstimateAnomaly]);

  const severityOrder = { critical: 3, warning: 2, positive: 1, info: 0 };
  const sortedInsights = [...insights].sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
  
  useEffect(() => {
    if (!isOpen || !project.workguruId || !liveData) return;

    let isMounted = true;
    setIsNarrativeLoading(true);
    setNarrativeError(null);

    const context = {
      projectNumber: project.projectNumber,
      projectName: project.projectName,
      status: project.rawStatus,
      gpActual: gp,
      gpEstimated: pEstInvoiced - pEstCost,
      variance,
      marginPct,
      invoicedActual: pInvoiced,
      invoicedEstimated: pEstInvoiced,
      materialsActual: pMat,
      materialsEstimated: pEstMat,
      labourActual: pLab,
      labourEstimated: pEstLab,
      hoursActual: liveData.totalActualHours,
      hoursBudget: liveData.totalBudgetHours,
      tasksCompleted: liveData.completedTasks,
      tasksTotal: liveData.totalTasks,
      triggeredInsights: insights.map(i => `${i.label} (${i.severity}): ${i.explanation}`)
    };

    generateProjectNarrative(context)
      .then(res => {
        if (!isMounted) return;
        if (res && res.success && res.data) {
          setNarrative(res.data.narrative);
        } else {
          setNarrativeError(res?.error || "AI summary unavailable");
        }
      })
      .catch(err => {
        if (isMounted) setNarrativeError("AI summary unavailable");
      })
      .finally(() => {
        if (isMounted) setIsNarrativeLoading(false);
      });

    return () => { isMounted = false; };
  }, [isOpen, project.workguruId, liveData, insights, gp, pEstInvoiced, pEstCost, variance, marginPct, pInvoiced, pMat, pEstMat, pLab, pEstLab, project.projectNumber, project.projectName, project.rawStatus]);
  


  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-[85vw] md:w-[600px] bg-slate-50 dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex-none p-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {project.workguruId ? (
                  <a 
                    href={`https://app.workguru.io/App/Projects/Detail2/${project.workguruId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-lg font-black text-brand hover:underline"
                  >
                    {project.projectNumber}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="text-lg font-black text-slate-900 dark:text-white">{project.projectNumber}</span>
                )}
                
                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider", statusColor)}>
                  <StatusIcon className="h-3 w-3" />
                  {project.rawStatus?.replace(/^[\d.]+ - /, '').trim() || 'Unknown'}
                </span>
              </div>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 line-clamp-2">
                {project.projectName}
              </h2>
            </div>
            
            <button 
              onClick={onClose} 
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="flex items-center justify-between text-xs mt-1">
            <div className="flex flex-col">
              <span className="text-slate-400 font-medium">Client</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{project.clientName || 'Unknown'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400 font-medium">Project Manager</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{project.projectManager || 'Unassigned'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-400 font-medium">Type</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{project.projectType || 'Standard'}</span>
            </div>
          </div>
        </div>

        {/* Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
          
          {/* Section 1: Financial Overview */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Financial Overview
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                  GP
                  <Tooltip content={
                    <div className="flex flex-col gap-1.5">
                      <span>Calculated locally as Invoiced minus Cost. Not pulled directly from WorkGuru.</span>
                      <span className="text-[10px] text-slate-400 opacity-80 border-t border-slate-700/50 pt-1.5">
                        Local Calculation: Invoiced - Cost
                      </span>
                    </div>
                  }>
                    <Info className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-help" />
                  </Tooltip>
                </span>
                <span className="text-lg font-bold text-slate-700 dark:text-slate-300">{formatCurrency(gp)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                  WG Estimated Profit
                  <Tooltip content={
                    <div className="flex flex-col gap-1.5">
                      <span>WorkGuru's own separate profit calculation (Quoted Profit) provided for comparison.</span>
                      <span className="text-[10px] text-slate-400 opacity-80 border-t border-slate-700/50 pt-1.5">
                        API: ProjectPivotReport | Field: ForecastDollarProfit
                      </span>
                    </div>
                  }>
                    <Info className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-help" />
                  </Tooltip>
                </span>
                <span className="text-lg font-bold text-slate-700 dark:text-slate-300">{formatCurrency(wgEstimatedProfit)}</span>
              </div>
              
              <div className="flex flex-col pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 font-medium">Variance (GP vs Est)</span>
                <span className={cn("text-lg font-black flex items-center gap-1", variance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {variance >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {variance >= 0 ? "+" : ""}{formatCurrency(variance)}
                </span>
              </div>
              
              <div className="flex flex-col pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 font-medium">Margin</span>
                <span className={cn("text-lg font-black", marginPct >= 15 ? "text-emerald-600 dark:text-emerald-400" : marginPct >= 0 ? "text-amber-500" : "text-red-600")}>
                  {marginPct > 0 ? "+" : ""}{marginPct.toFixed(1)}%
                </span>
                {renderProgressBar(marginPct, 100, true)}
              </div>
            </div>
          </div>

          {/* Section 2: Invoiced vs Cost (Local) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Invoiced vs Cost
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    Total Invoiced
                    <Tooltip content={
                      <div className="flex flex-col gap-1.5">
                        <span>The actual amount invoiced to date, sourced from WorkGuru. The estimated figure below is the total invoiceable amount expected for the project.</span>
                        <span className="text-[10px] text-slate-400 opacity-80 border-t border-slate-700/50 pt-1.5">
                          API: ProjectPivotReport | Fields: TotalInvoiced / Total (Actual), TotalForecastRevenue (Est)
                        </span>
                      </div>
                    }>
                      <Info className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-help" />
                    </Tooltip>
                  </span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(pEstInvoiced)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Estimated Invoiced</span>
                  <span>{formatCurrency(pInvoiced)}</span>
                </div>
                {renderProgressBar(pEstInvoiced, pInvoiced, false, true)}
              </div>
              
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    Total Cost To Date
                    <Tooltip content={
                      <div className="flex flex-col gap-1.5">
                        <span>Total actual cost to date from WorkGuru (labour plus materials plus purchases). The estimated figure below is WorkGuru's forecast total cost.</span>
                        <span className="text-[10px] text-slate-400 opacity-80 border-t border-slate-700/50 pt-1.5">
                          API: ProjectPivotReport | Fields: TotalCost (Actual), TotalForecastCost (Est)
                        </span>
                      </div>
                    }>
                      <Info className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-help" />
                    </Tooltip>
                  </span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(pCost)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Estimated Cost</span>
                  <span>{formatCurrency(pEstCost)}</span>
                </div>
                {renderProgressBar(pCost, pEstCost)}
              </div>
            </div>
          </div>

          {/* Section 3: Cost Split (Local) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4" /> Cost Split
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    Materials & Purchases
                    <Tooltip content={
                      <div className="flex flex-col gap-1.5">
                        <span>Combined figure of WorkGuru's Product cost and Purchase Order cost (actual and forecast). They are combined because raw materials and parts are typically purchased specifically for the build.</span>
                        <span className="text-[10px] text-slate-400 opacity-80 border-t border-slate-700/50 pt-1.5">
                          API: ProjectPivotReport | Fields: ProductCost + PurchaseCost, ProductForecastCost + PurchaseForecastCost
                        </span>
                      </div>
                    }>
                      <Info className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-help" />
                    </Tooltip>
                  </span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(pMat)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Estimated</span>
                  <span>{pEstMatRaw != null ? formatCurrency(pEstMatRaw) : '--'}</span>
                </div>
                {renderProgressBar(pMat, pEstMat)}
              </div>
              
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    Labour
                    <Tooltip content={
                      <div className="flex flex-col gap-1.5">
                        <span>This is WorkGuru's Task/Timesheet cost, showing both actual cost to date and the total forecast cost.</span>
                        <span className="text-[10px] text-slate-400 opacity-80 border-t border-slate-700/50 pt-1.5">
                          API: ProjectPivotReport | Fields: TaskCost (Actual), TaskForecastCost (Est)
                        </span>
                      </div>
                    }>
                      <Info className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-help" />
                    </Tooltip>
                  </span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(pLab)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Estimated</span>
                  <span>{formatCurrency(pEstLab)}</span>
                </div>
                {renderProgressBar(pLab, pEstLab)}
              </div>
            </div>
          </div>

          {/* Error State for Live Data */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
              <p className="font-bold flex items-center gap-2"><X className="h-4 w-4" /> Failed to load live data</p>
              <p className="mt-1 opacity-80">{error}</p>
            </div>
          )}

          {/* Loading Skeleton for Live Data */}
          {isLoading && !error && (
            <div className="space-y-5 animate-pulse">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 h-[120px]" />
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 h-[100px]" />
            </div>
          )}

          {/* Live Data Sections (Tasks, Hours, WIP) */}
          {!isLoading && !error && liveData && (
            <>
              {/* Section 4: Hours */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Hours Tracking
                  <Tooltip content={
                    <div className="flex flex-col gap-1.5">
                      <span>Actual hours are pulled from submitted WorkGuru timesheets for this project. Budgeted hours are from WorkGuru's task forecasts.</span>
                      <span className="text-[10px] text-slate-400 opacity-80 border-t border-slate-700/50 pt-1.5">
                        API: ProjectDetail | Fields: totalTime (Actual), forecastTime (Est)
                      </span>
                    </div>
                  }>
                    <Info className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-help" />
                  </Tooltip>
                </h3>
                
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      Actual: {liveData.totalActualHours.toFixed(1)}h
                    </span>
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      Budget: {liveData.totalBudgetHours.toFixed(1)}h
                    </span>
                  </div>
                  
                  {(() => {
                    const pct = liveData.totalBudgetHours > 0 
                      ? Math.min(100, (liveData.totalActualHours / liveData.totalBudgetHours) * 100) 
                      : 0;
                    const isOver = liveData.totalActualHours > liveData.totalBudgetHours;
                    const isWarning = pct > 85;
                    
                    return (
                      <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1 relative">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500", 
                            isOver ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                          )} 
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    );
                  })()}
                  
                  <div className="text-xs text-slate-400 text-right mt-1">
                    {liveData.totalBudgetHours > 0 
                      ? `${((liveData.totalActualHours / liveData.totalBudgetHours) * 100).toFixed(0)}% consumed` 
                      : 'No budget set'}
                  </div>
                </div>
              </div>

              {/* Section 5: Tasks & WIP (Row) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <CheckSquare className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Tasks</span>
                    <Tooltip content={
                      <div className="flex flex-col gap-1.5">
                        <span>Shows the number of individual tasks marked as 'Completed' in WorkGuru versus the total number of tasks on the project.</span>
                        <span className="text-[10px] text-slate-400 opacity-80 border-t border-slate-700/50 pt-1.5">
                          API: ProjectTasks | Fields: Status / status === 'Completed'
                        </span>
                      </div>
                    }>
                      <Info className="h-3.5 w-3.5 hover:text-slate-600 dark:hover:text-slate-300 cursor-help" />
                    </Tooltip>
                  </div>
                  <div className="flex items-end gap-1.5">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{liveData.completedTasks}</span>
                    <span className="text-sm font-medium text-slate-500 mb-1">/ {liveData.totalTasks}</span>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Layers className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">WIP Value</span>
                    <Tooltip content={
                      <div className="flex flex-col gap-1.5">
                        <span>Work In Progress value from WorkGuru representing un-invoiced actual costs. Shows '--' when no live data is available.</span>
                        <span className="text-[10px] text-slate-400 opacity-80 border-t border-slate-700/50 pt-1.5">
                          API: ProjectDetail | Field: wipByActual
                        </span>
                      </div>
                    }>
                      <Info className="h-3.5 w-3.5 hover:text-slate-600 dark:hover:text-slate-300 cursor-help" />
                    </Tooltip>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {liveData.wipValue > 0 ? formatCurrency(liveData.wipValue) : '--'}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Section 6: Insights Section */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm mt-8">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Target className="h-4 w-4" /> Project Insights
            </h3>
            
            <div className="flex flex-col gap-3">
              {sortedInsights.length === 0 ? (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-100 dark:border-slate-700 flex items-start gap-3">
                  <div className="mt-0.5 text-emerald-500">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Tracking Normal</h4>
                    <p className="text-xs text-slate-500 mt-1">Project metrics are within normal expectations. No notable flags to report.</p>
                  </div>
                </div>
              ) : (
                sortedInsights.map((insight, idx) => {
                  let Icon = CheckCircle2;
                  let bgClass = "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700";
                  let iconColor = "text-slate-400";
                  
                  if (insight.severity === 'critical') {
                    Icon = AlertTriangle;
                    bgClass = "bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30";
                    iconColor = "text-red-500";
                  } else if (insight.severity === 'warning') {
                    Icon = AlertTriangle;
                    bgClass = "bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30";
                    iconColor = "text-amber-500";
                  } else if (insight.severity === 'positive') {
                    Icon = CheckCircle2;
                    bgClass = "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30";
                    iconColor = "text-emerald-500";
                  }

                  return (
                    <div key={idx} className={cn("rounded-lg p-4 border flex items-start gap-3", bgClass)}>
                      <div className={cn("mt-0.5", iconColor)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">{insight.label}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{insight.explanation}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Narrative AI Section */}
            <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">AI Narrative</h4>
              
              {isNarrativeLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-11/12"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-4/6"></div>
                </div>
              ) : narrativeError ? (
                <p className="text-sm text-slate-400 italic py-1">{narrativeError}</p>
              ) : narrative ? (
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {narrative}
                </p>
              ) : null}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
