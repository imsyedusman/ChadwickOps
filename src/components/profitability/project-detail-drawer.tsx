"use client";

import React, { useEffect, useState } from "react";
import { X, ExternalLink, Clock, FileText, CheckCircle2, TrendingUp, TrendingDown, Layers, Target, CheckSquare, DollarSign, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { MergedProfitabilityProject } from "./profitability-table";
import { getLiveProjectDetails } from "@/app/actions/profitability";

interface ProjectDetailDrawerProps {
  project: MergedProfitabilityProject;
  isOpen: boolean;
  onClose: () => void;
  statusIcon: any;
  statusColor: string;
}

export function ProjectDetailDrawer({ project, isOpen, onClose, statusIcon: StatusIcon, statusColor }: ProjectDetailDrawerProps) {
  const [liveData, setLiveData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const getMarginPct = (est: number, act: number) => {
    return est > 0 ? (act - est) / Math.abs(est) * 100 : 0;
  };
  
  const marginPct = getMarginPct(project.quotedProfit, project.actualProfit);
  const variance = project.actualProfit - project.quotedProfit;

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
          
          {/* Section 1: Financial Overview (Instant from props) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Financial Overview
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 font-medium">Estimated Profit</span>
                <span className="text-lg font-bold text-slate-700 dark:text-slate-300">{formatCurrency(project.quotedProfit)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 font-medium">Actual Profit</span>
                <span className="text-lg font-bold text-slate-700 dark:text-slate-300">{formatCurrency(project.actualProfit)}</span>
              </div>
              
              <div className="flex flex-col pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 font-medium">Variance</span>
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
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
              <p className="font-bold flex items-center gap-2"><X className="h-4 w-4" /> Failed to load live data</p>
              <p className="mt-1 opacity-80">{error}</p>
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading && !error && (
            <div className="space-y-5 animate-pulse">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 h-[200px]" />
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 h-[120px]" />
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 h-[100px]" />
            </div>
          )}

          {/* Live Data Sections */}
          {!isLoading && !error && liveData && (
            <>
              {/* Section 2: Invoiced vs Cost */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Invoiced vs Cost
                </h3>
                
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-sm font-semibold text-brand">Total Invoiced</span>
                    <span className="text-base font-black text-brand">{formatCurrency(liveData.totalInvoiced)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center pb-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total Cost To Date</span>
                    <span className="text-base font-bold text-slate-900 dark:text-white">{formatCurrency(liveData.totalCost)}</span>
                  </div>
                  
                  <div className="pl-4 border-l-2 border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Time</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(liveData.costTime)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Materials</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(liveData.costMaterials)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Purchases</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(liveData.costPurchases)}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Gross Total</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(liveData.grossTotal)}</span>
                  </div>
                  {/* Supplier Credits (Placeholder) */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Supplier Credits</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {liveData.supplierCredits > 0 ? `-${formatCurrency(liveData.supplierCredits)}` : '$0'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Hours */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Hours Tracking
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

              {/* Section 4 & 5: Tasks & WIP (Row) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <CheckSquare className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Tasks</span>
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
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {liveData.wipValue > 0 ? formatCurrency(liveData.wipValue) : '--'}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Section 6: Insights Placeholder */}
          <div className="bg-slate-100/50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-center mt-8">
            <Target className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-3" />
            <span className="text-sm font-bold text-slate-400 dark:text-slate-500">Insights coming soon</span>
            <span className="text-xs text-slate-400 mt-1 max-w-[250px]">
              AI-driven financial insights and anomaly detection for this project will be added in Phase 5.
            </span>
          </div>

        </div>
      </div>
    </>
  );
}
