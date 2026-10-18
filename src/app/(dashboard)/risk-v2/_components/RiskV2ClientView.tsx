"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiskV2DashboardData, ProjectV2Demand, CapacitySettingsV2 } from "@/lib/risk-v2/types";
import { SummaryCards } from "./SummaryCards";
import { ForecastChart } from "./ForecastChart";
import { PeriodBreakdownTable } from "./PeriodBreakdownTable";
import { RisksWarningsPanel } from "./RisksWarningsPanel";
import { UnscheduledBacklogPanel } from "./UnscheduledBacklogPanel";
import { CapacitySettingsModal } from "./CapacitySettingsModal";
import { ProjectDetailModal } from "./ProjectDetailModal";
import { ProductionReadinessPanel } from "./ProductionReadinessPanel";
import { WorkforceOverviewPanel } from "./workforce/WorkforceOverviewPanel";
import { WorkforceDashboardData } from "@/lib/risk-v2/workforce";
import { fetchWorkforceV2Data } from "@/actions/workforce-v2";
import { 
  SlidersHorizontal, 
  CalendarDays, 
  Layers, 
  AlertTriangle, 
  CalendarClock, 
  RefreshCw, 
  Clock, 
  Info,
  Sparkles,
  Database,
  ShieldCheck,
  CheckCircle2,
  Truck,
  Users
} from "lucide-react";


interface RiskV2ClientViewProps {
  initialData: RiskV2DashboardData;
}

export default function RiskV2ClientView({ initialData }: RiskV2ClientViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState<RiskV2DashboardData>(initialData);
  const [activeTab, setActiveTab] = useState<'overview' | 'readiness' | 'risks' | 'backlog' | 'workforce'>('overview');
  const [workforceData, setWorkforceData] = useState<WorkforceDashboardData | null>(null);
  const [loadingWorkforce, setLoadingWorkforce] = useState<boolean>(false);

  const loadWorkforce = async () => {
    setLoadingWorkforce(true);
    try {
      const res = await fetchWorkforceV2Data();
      setWorkforceData(res);
    } catch (e) {
      console.error("Failed to load workforce data:", e);
    } finally {
      setLoadingWorkforce(false);
    }
  };

  const handleSelectTab = (tab: 'overview' | 'readiness' | 'risks' | 'backlog' | 'workforce') => {
    setActiveTab(tab);
    if (tab === 'workforce' && !workforceData) {
      loadWorkforce();
    }
  };
  const [activeSubtab, setActiveSubtab] = useState<string>('manufacturing');
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectV2Demand | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showFreshnessDetails, setShowFreshnessDetails] = useState(false);

  // Horizon and view mode
  const currentViewMode = data.viewMode;
  const currentHorizon = data.horizon;

  const handleViewModeChange = (mode: 'monthly' | 'weekly') => {
    startTransition(() => {
      router.push(`/risk-v2?view=${mode}&horizon=${currentHorizon}`);
    });
  };

  const handleHorizonChange = (h: number) => {
    startTransition(() => {
      router.push(`/risk-v2?view=${currentViewMode}&horizon=${h}`);
    });
  };

  const handleSettingsUpdated = (newSettings: CapacitySettingsV2) => {
    setData(prev => ({
      ...prev,
      settings: newSettings,
    }));
    startTransition(() => {
      router.refresh();
    });
  };

  const handleCardTabClick = (tab: string, subtab?: string) => {
    if (tab === 'readiness') {
      setActiveTab('readiness');
    } else if (tab === 'risks') {
      setActiveTab('risks');
      if (subtab) setActiveSubtab(subtab);
    } else if (tab === 'backlog') {
      setActiveTab('backlog');
    } else {
      setActiveTab('overview');
    }
  };

  const df = data.dataFreshness;

  return (
    <div className="space-y-6" suppressHydrationWarning>
      {/* Top Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 self-start">
          <button
            onClick={() => handleSelectTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'overview'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Overview & Forecast</span>
          </button>

          <button
            onClick={() => handleSelectTab('readiness')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'readiness'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-blue-500" />
            <span>Production Readiness</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              {data.productionReadiness.summary.readyForManufacturingCount} ready
            </span>
            {data.productionReadiness.summary.materialDelayConflictCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => handleSelectTab('workforce')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'workforce'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-500" />
            <span>Workforce & Teams</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
              Phase 2B
            </span>
          </button>

          <button
            onClick={() => handleSelectTab('risks')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'risks'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Risks & Warnings</span>
            {(data.summary.overloadedPeriodsCount > 0 || data.summary.overdueActiveCount > 0) && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => handleSelectTab('backlog')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'backlog'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5 text-purple-500" />
            <span>Unscheduled Backlog</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
              {data.summary.unscheduled2030Count}
            </span>
          </button>
        </div>


        {/* View Controls & Configuration */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle (Monthly vs Weekly) */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
            <button
              onClick={() => handleViewModeChange('monthly')}
              className={`px-3 py-1 rounded-lg transition-all ${
                currentViewMode === 'monthly'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => handleViewModeChange('weekly')}
              className={`px-3 py-1 rounded-lg transition-all ${
                currentViewMode === 'weekly'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Weekly
            </button>
          </div>

          {/* Horizon Selector (3, 6, 12 Months) */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
            {[3, 6, 12].map((m) => (
              <button
                key={m}
                onClick={() => handleHorizonChange(m)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  currentHorizon === m
                    ? 'bg-brand text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {m}M
              </button>
            ))}
          </div>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-brand" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Freshness & Data Currency Audit Strip */}
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 px-4 shadow-xs" suppressHydrationWarning>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
              <Database className="w-3.5 h-3.5 text-brand" />
              <span>Source Currency:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {df.latestRemoteUpdateAt || df.lastLocalProjectUpdateAt || 'Recent'}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span>Local Sync:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {df.lastLocalProjectUpdateAt || 'Up to date'}
              </span>
            </div>

            <div className="hidden lg:flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span>Bulk Sync Record:</span>
              <span className="font-mono text-[11px]">
                {df.lastBulkSyncAt || data.lastSyncTimestamp || 'N/A'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {df.updatedWithin7DaysPercent}% Fresh (≤7d)
              </span>
              {df.staleOver30DaysCount > 0 && (
                <span className="text-[11px] text-slate-400">
                  ({df.staleOver30DaysCount} active jobs &gt;30d)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto text-[11px] text-slate-400">
            <span>Forecast ref date: <strong className="text-slate-600 dark:text-slate-300 font-mono">{data.referenceDate}</strong></span>
          </div>
        </div>
      </div>

      {/* Main KPI Summary Cards */}
      <SummaryCards 
        data={data} 
        onSelectTab={handleCardTabClick} 
      />

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <ForecastChart
            periods={data.periods}
            riskThreshold={data.settings.riskThreshold}
            selectedPeriodKey={selectedPeriodKey}
            onSelectPeriod={setSelectedPeriodKey}
          />

          <PeriodBreakdownTable
            periods={data.periods}
            selectedPeriodKey={selectedPeriodKey}
            allProjects={data.allActiveProjects}
            onSelectProject={setSelectedProject}
          />
        </div>
      )}

      {activeTab === 'readiness' && (
        <ProductionReadinessPanel
          projects={data.productionReadiness.projects}
          supplierIntelligence={data.productionReadiness.supplierIntelligence}
          summary={data.productionReadiness.summary}
          onRefresh={() => {
            startTransition(() => {
              router.refresh();
            });
          }}
        />
      )}

      {activeTab === 'workforce' && (
        loadingWorkforce ? (
          <div className="py-24 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
            <span>Loading workshop teams & workforce availability...</span>
          </div>
        ) : workforceData ? (
          <WorkforceOverviewPanel
            data={workforceData}
            onRefresh={loadWorkforce}
          />
        ) : (
          <div className="py-16 text-center text-slate-400 text-xs">
            Failed to load workforce availability data.
            <button
              onClick={loadWorkforce}
              className="mt-2 text-blue-600 font-semibold block mx-auto hover:underline"
            >
              Try Again
            </button>
          </div>
        )
      )}

      {activeTab === 'risks' && (

        <RisksWarningsPanel
          periods={data.periods}
          allProjects={data.allActiveProjects}
          onSelectProject={setSelectedProject}
          initialSubtab={activeSubtab}
        />
      )}

      {activeTab === 'backlog' && (
        <UnscheduledBacklogPanel
          unscheduled2030={data.unscheduled2030Backlog}
          unscheduledMissingDate={data.unscheduledMissingDateBacklog}
          onSelectProject={setSelectedProject}
        />
      )}

      {/* Modals */}
      <CapacitySettingsModal
        settings={data.settings}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsUpdated={handleSettingsUpdated}
      />

      <ProjectDetailModal
        project={selectedProject}
        actualsFactor={data.settings.actualsFactor}
        isOpen={Boolean(selectedProject)}
        onClose={() => setSelectedProject(null)}
      />
    </div>
  );
}
