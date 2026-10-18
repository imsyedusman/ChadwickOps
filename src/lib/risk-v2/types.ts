export interface WorkingPattern {
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  fri: number;
  sat: number;
  sun: number;
}

export interface CapacitySettingsV2 {
  headcount: number;
  efficiency: number; // 0 to 1 (e.g. 0.80)
  workingPattern: WorkingPattern;
  riskThreshold: number; // % (e.g. 90) - Warning threshold (At Risk)
  actualsFactor: number; // e.g. 0.70
  provisionalDailyHoursPerProject: number; // e.g. 25 hrs/day concurrent rate
  factoryClosures: string[]; // 'YYYY-MM-DD'
  /**
   * Technical safety ceiling for maximum daily clock hours (e.g. 14h or 16h).
   * Advisory technical upper limit to prevent impossible entries (>24h).
   * Note: This is NOT a confirmed Chadwick employment policy or fatigue rule.
   */
  maxDailyHoursCeiling?: number;
  /**
   * Configurable supervisory allowance for team leaders (hours per standard shift off-tools).
   * Used to adjust leader capacity for administrative, QA and coordination duties.
   */
  teamLeaderSupervisoryAllowanceHours?: number;
  /**
   * Policy for unrated workers (where individual skill ratings are null).
   * 'warn': Treated as assessment pending with warning badge (default).
   * 'exclude': Excluded from qualified stage pools until assessed.
   * 'provisional': Allowed provisionally at 1.0 rating with explicit caution.
   */
  unratedWorkerPolicy?: 'warn' | 'exclude' | 'provisional';
}

export interface DayCapacity {
  date: string; // 'YYYY-MM-DD'
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
  dayName: string;
  standardHoursPerPerson: number;
  isPublicHoliday: boolean;
  holidayName?: string;
  isFactoryClosure: boolean;
  closureReason?: string;
  effectiveWorkingHoursPerPerson: number;
  workshopGrossHours: number;
  workshopNetHours: number;
}

export interface PeriodCapacity {
  periodKey: string; // 'YYYY-MM' or 'YYYY-Www'
  label: string;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  workingDaysCount: number;
  grossHours: number;
  netCapacityHours: number;
  isCurrentPeriod: boolean;
  remainingWorkingDaysCount: number;
  remainingNetCapacityHours: number;
}

export type ProjectAllocationMethod = 
  | 'scheduled' 
  | 'provisional_window' 
  | 'overdue_provisional' 
  | 'unscheduled';

export type ProjectV2Category =
  | 'regular'
  | 'overdue'
  | 'overdue_manufacturing'
  | 'overdue_zero_remaining'
  | 'administrative_closeout'
  | 'unscheduled_2030'
  | 'unscheduled_missing_date';

export interface ProjectV2Demand {
  id: number;
  projectNumber: string;
  name: string;
  clientName: string;
  projectManager: string;
  rawStatus: string;
  normalizedStatus: string;
  budgetHours: number;
  actualHours: number;
  adjustedActualHours: number;
  calculatedRemainingHours: number;
  forecastRemainingHours: number;
  isOverBudget: boolean;
  hasZeroRemaining: boolean;
  hasMissingBudget: boolean;
  contractValue: number;
  deliveryDate: string | null; // ISO 'YYYY-MM-DD'
  originalDeliveryDate: string | null;
  scheduledStart: string | null; // from productionSchedule
  category: ProjectV2Category;
  isOverdue: boolean;
  daysOverdue: number;
  allocationMethod: ProjectAllocationMethod;
  windowStartDate?: string;
  windowEndDate?: string;
  windowWorkingDays?: number;
  requiredDailyIntakeHours?: number;
  isCompressedWindow?: boolean;
  allocatedHoursPerPeriod: Record<string, number>; // periodKey -> hours allocated
  isFeasible: boolean;
  warnings: string[];
  updatedAt?: string | null;
  remoteUpdatedAt?: string | null;
}

export interface PeriodForecast {
  periodKey: string;
  label: string;
  startDate: string;
  endDate: string;
  standardGrossHours: number;
  netCapacityHours: number;
  demandHours: number;
  scheduledDemandHours: number;
  provisionalDemandHours: number;
  overdueDemandHours: number;
  feasibleAllocatedHours: number;
  unallocatedDemandHours: number;
  utilisationPercent: number;
  shortfallOrSurplusHours: number; // netCapacityHours - demandHours
  loadStatus: 'normal' | 'at_risk' | 'overloaded';
  isAtRisk: boolean; // utilisationPercent >= riskThreshold && utilisationPercent <= 100
  isOverloaded: boolean; // utilisationPercent > 100
  contributingProjects: {
    projectId: number;
    projectNumber: string;
    projectName: string;
    clientName: string;
    projectManager: string;
    allocatedHours: number;
    totalForecastRemaining: number;
    allocationMethod: ProjectAllocationMethod;
    deliveryDate: string | null;
    isOverdue: boolean;
    isCompressedWindow?: boolean;
  }[];
}

export interface BacklogSummary {
  projectCount: number;
  totalContractValue: number;
  totalBudgetHours: number;
  totalForecastRemainingHours: number;
  pmBreakdown: Record<string, { count: number; hours: number; value: number }>;
  projects: ProjectV2Demand[];
}

export interface DataFreshnessInfo {
  calculatedAt: string; // ISO timestamp
  lastBulkSyncAt: string | null;
  lastLocalProjectUpdateAt: string | null;
  latestRemoteUpdateAt: string | null;
  totalActiveProjects: number;
  updatedWithin7DaysCount: number;
  updatedWithin7DaysPercent: number;
  updatedWithin30DaysCount: number;
  updatedWithin30DaysPercent: number;
  staleOver30DaysCount: number;
  staleOver30DaysPercent: number;
  coverageStatus: 'fresh' | 'stale_warning' | 'outdated';
}

export interface RiskV2DashboardData {
  settings: CapacitySettingsV2;
  lastSyncTimestamp: string | null;
  referenceDate: string; // 'YYYY-MM-DD'
  viewMode: 'monthly' | 'weekly';
  horizon: number; // e.g. 3, 6, 12 months
  periods: PeriodForecast[];
  summary: {
    // Near-term headline KPIs:
    currentPeriod: {
      periodKey: string;
      label: string;
      demandHours: number;
      netCapacityHours: number;
      utilisationPercent: number;
      shortfallHours: number;
      isOverloaded: boolean;
      isAtRisk: boolean;
      loadStatus: 'normal' | 'at_risk' | 'overloaded';
    };
    next30Days: {
      startDate: string;
      endDate: string;
      workingDaysCount: number;
      netCapacityHours: number;
      demandHours: number;
      utilisationPercent: number;
      shortfallHours: number;
      isOverloaded: boolean;
      isAtRisk: boolean;
      loadStatus: 'normal' | 'at_risk' | 'overloaded';
    };
    peakPeriod: {
      periodKey: string;
      label: string;
      demandHours: number;
      netCapacityHours: number;
      utilisationPercent: number;
      shortfallHours: number;
      loadStatus: 'normal' | 'at_risk' | 'overloaded';
    };
    sixMonthPipeline: {
      totalDemandHours: number;
      totalNetCapacityHours: number;
      utilisationPercent: number;
      overallShortfallOrSurplusHours: number;
      isFrontLoaded: boolean;
      characterization: string;
    };

    // Separated Overdue & Review Metrics:
    overdueManufacturing: {
      count: number;
      hours: number;
      contractValue: number;
    };
    overdueZeroRemaining: {
      count: number;
      hours: number;
      contractValue: number;
    };
    administrativeCloseout: {
      count: number;
      hours: number;
      contractValue: number;
    };

    // Legacy summary fields preserved
    totalForecastDemand: number;
    totalNetAvailableCapacity: number;
    overallUtilisationPercent: number;
    overloadedPeriodsCount: number; // > 100%
    atRiskPeriodsCount: number; // >= riskThreshold && <= 100%
    overdueActiveCount: number;
    overdueActiveHours: number;
    overdueActiveValue: number;
    unscheduled2030Count: number;
    unscheduled2030Hours: number;
    unscheduled2030Value: number;
    unscheduledMissingCount: number;
    unscheduledMissingHours: number;
    unscheduledMissingValue: number;
    overBudgetCount: number;
    zeroRemainingActiveCount: number;
    missingBudgetCount: number;
    compressedWindowCount: number;
  };
  overdueProjects: ProjectV2Demand[];
  overdueManufacturingProjects: ProjectV2Demand[];
  overdueZeroRemainingProjects: ProjectV2Demand[];
  administrativeCloseoutProjects: ProjectV2Demand[];
  unscheduled2030Backlog: BacklogSummary;
  unscheduledMissingDateBacklog: BacklogSummary;
  allActiveProjects: ProjectV2Demand[];
  dataFreshness: DataFreshnessInfo;
  productionReadiness: {
    projects: import('./readiness').ProjectReadinessAssessment[];
    supplierIntelligence: import('./readiness').SupplierIntelligenceSummary;
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
  };
}

