import { 
  ProjectV2Demand, 
  CapacitySettingsV2, 
  PeriodCapacity, 
  PeriodForecast, 
  BacklogSummary, 
  RiskV2DashboardData,
  DataFreshnessInfo,
  ProjectV2Category
} from './types';
import { 
  evaluateDayCapacity, 
  getSydneyTodayDateString, 
  parseDateString, 
  formatDateString 
} from './calendar';
import { 
  assessProjectReadiness, 
  buildSupplierIntelligenceSummary, 
  LinkedPurchaseOrder, 
  ProjectMaterialConfirmation 
} from './readiness';
import { isActiveWorkStatus, isProductiveProject } from '@/lib/project-utils';

import { normalizeStatus } from '@/lib/constants';

export interface RawProjectInput {
  id: number;
  projectNumber: string | null;
  name: string;
  clientName?: string | null;
  projectManager?: string | null;
  rawStatus: string | null;
  budgetHours: number | null;
  actualHours: number | null;
  deliveryDate: Date | string | null;
  total?: number | null; // contract value
  isArchived?: boolean;
  scheduledStart?: Date | string | null; // from productionSchedule
  updatedAt?: Date | string | null;
  remoteUpdatedAt?: Date | string | null;
  projectType?: string | null;
  drawingApprovalDate?: Date | string | null;

  expectedDrawingApprovalDate?: Date | string | null;
  sheetmetalOrderedDate?: Date | string | null;
  sheetmetalDeliveredDate?: Date | string | null;
  switchgearOrderedDate?: Date | string | null;
  switchgearDeliveredDate?: Date | string | null;
}


/**
 * Normalizes a raw date input to 'YYYY-MM-DD' string in Sydney timezone.
 */
export function normalizeDateToSydneyString(dateInput: Date | string | null | undefined): string | null {
  if (!dateInput) return null;
  if (typeof dateInput === 'string') {
    // If it's already YYYY-MM-DD
    const match = dateInput.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const dt = new Date(dateInput);
  if (isNaN(dt.getTime())) return null;
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(dt);
}

/**
 * Checks if a date string is in December 2030 (WorkGuru unscheduled placeholder).
 */
export function isDecember2030Placeholder(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr.startsWith('2030-12');
}

/**
 * Computes remaining labour demand for an active project:
 * Adjusted Actual = Actual Hours * Actuals Factor
 * Calculated Remaining = Budget Hours - Adjusted Actual
 * Forecast Remaining = MAX(0, Calculated Remaining)
 */
export function calculateProjectDemandHours(
  budgetHours: number,
  actualHours: number,
  actualsFactor: number
): {
  adjustedActualHours: number;
  calculatedRemainingHours: number;
  forecastRemainingHours: number;
  isOverBudget: boolean;
  hasZeroRemaining: boolean;
  hasMissingBudget: boolean;
} {
  const safeBudget = Math.max(0, budgetHours || 0);
  const safeActual = Math.max(0, actualHours || 0);
  const safeFactor = actualsFactor >= 0 ? actualsFactor : 0.70;

  const adjustedActualHours = Math.round(safeActual * safeFactor * 10) / 10;
  const calculatedRemainingHours = Math.round((safeBudget - adjustedActualHours) * 10) / 10;
  const forecastRemainingHours = Math.max(0, calculatedRemainingHours);

  const isOverBudget = safeActual > safeBudget;
  const hasZeroRemaining = forecastRemainingHours === 0 && safeBudget > 0;
  const hasMissingBudget = safeBudget === 0;

  return {
    adjustedActualHours,
    calculatedRemainingHours,
    forecastRemainingHours,
    isOverBudget,
    hasZeroRemaining,
    hasMissingBudget,
  };
}

/**
 * Steps forward or backward in working days from a starting date string.
 */
export function stepWorkingDays(
  startDateStr: string,
  workingDays: number,
  settings: CapacitySettingsV2
): string {
  if (workingDays === 0) return startDateStr;
  let remainingSteps = Math.abs(workingDays);
  const step = workingDays > 0 ? 1 : -1;
  const cur = parseDateString(startDateStr);

  while (remainingSteps > 0) {
    cur.setUTCDate(cur.getUTCDate() + step);
    const dateStr = formatDateString(cur);
    const dayCap = evaluateDayCapacity(dateStr, settings);
    if (dayCap.effectiveWorkingHoursPerPerson > 0) {
      remainingSteps--;
    }
  }

  return formatDateString(cur);
}

/**
 * Counts the number of working days between two date strings (inclusive).
 */
export function countWorkingDaysBetween(
  startDateStr: string,
  endDateStr: string,
  settings: CapacitySettingsV2
): number {
  if (startDateStr > endDateStr) return 0;
  let count = 0;
  let cur = parseDateString(startDateStr);
  const end = parseDateString(endDateStr);

  while (cur <= end) {
    const dateStr = formatDateString(cur);
    const dayCap = evaluateDayCapacity(dateStr, settings);
    if (dayCap.effectiveWorkingHoursPerPerson > 0) {
      count++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return count;
}

/**
 * Processes and categorizes all raw project inputs into V2 demand items.
 * Implements refined 3-way separation for overdue / review work:
 * 1. overdue_manufacturing: Past delivery date with > 0h remaining (urgent shop-floor demand).
 * 2. overdue_zero_remaining: Past delivery date with 0h remaining (operational review required).
 * 3. administrative_closeout: Invoiced in WorkGuru but unarchived (commercial closeout, zero shop-floor demand).
 */
export function processRawProjectsV2(
  rawProjects: RawProjectInput[],
  settings: CapacitySettingsV2,
  referenceDateStr: string = getSydneyTodayDateString()
): ProjectV2Demand[] {
  const processed: ProjectV2Demand[] = [];

  for (const raw of rawProjects) {
    if (raw.isArchived) continue;
    if (!isProductiveProject(raw.projectNumber)) continue;
    if (!isActiveWorkStatus(raw.rawStatus)) continue;

    const budgetHours = Number(raw.budgetHours) || 0;
    const actualHours = Number(raw.actualHours) || 0;
    const {
      adjustedActualHours,
      calculatedRemainingHours,
      forecastRemainingHours,
      isOverBudget,
      hasZeroRemaining,
      hasMissingBudget,
    } = calculateProjectDemandHours(budgetHours, actualHours, settings.actualsFactor);

    const deliveryDateStr = normalizeDateToSydneyString(raw.deliveryDate);
    const scheduledStartStr = normalizeDateToSydneyString(raw.scheduledStart);

    const warnings: string[] = [];
    if (isOverBudget) {
      warnings.push(`Actual hours (${actualHours}h) exceed budget (${budgetHours}h).`);
    }
    if (hasMissingBudget) {
      warnings.push(`Missing task budget (0h recorded).`);
    }
    if (hasZeroRemaining && !hasMissingBudget) {
      warnings.push(`Zero calculated remaining hours, but project remains active.`);
    }

    // Determine category and allocation method
    let category: ProjectV2Category = 'regular';
    let daysOverdue = 0;
    let allocationMethod: ProjectV2Demand['allocationMethod'] = 'provisional_window';

    const rawStatusLower = (raw.rawStatus || '').toLowerCase();
    const isInvoiced = rawStatusLower.includes('3.1 - invoiced') || 
                       rawStatusLower.includes('invoiced') || 
                       normalizeStatus(raw.rawStatus) === 'Invoiced';

    if (isInvoiced) {
      category = 'administrative_closeout';
      allocationMethod = 'unscheduled';
      warnings.push('Invoiced in WorkGuru but unarchived. Commercial review candidate; zero shop-floor demand assumed.');
    } else if (!deliveryDateStr) {
      category = 'unscheduled_missing_date';
      allocationMethod = 'unscheduled';
      warnings.push('No delivery date set in WorkGuru.');
    } else if (isDecember2030Placeholder(deliveryDateStr)) {
      category = 'unscheduled_2030';
      allocationMethod = 'unscheduled';
      warnings.push('Unscheduled backlog (December 2030 WorkGuru placeholder).');
    } else if (deliveryDateStr < referenceDateStr) {
      const diffMs = parseDateString(referenceDateStr).getTime() - parseDateString(deliveryDateStr).getTime();
      daysOverdue = Math.max(1, Math.round(diffMs / 86400000));

      if (forecastRemainingHours > 0) {
        category = 'overdue_manufacturing';
        allocationMethod = 'overdue_provisional';
        warnings.push(`Overdue manufacturing demand (${daysOverdue} days past delivery ${deliveryDateStr}). Outstanding: ${forecastRemainingHours}h.`);
      } else {
        category = 'overdue_zero_remaining';
        allocationMethod = 'unscheduled';
        warnings.push(`Past delivery date (${deliveryDateStr}) with 0h calculated remaining. Operational review required.`);
      }
    } else {
      category = 'regular';
      if (scheduledStartStr && scheduledStartStr <= deliveryDateStr) {
        allocationMethod = 'scheduled';
      } else {
        allocationMethod = 'provisional_window';
      }
    }

    const isOverdue = !!(deliveryDateStr && deliveryDateStr < referenceDateStr);

    // Determine planning window and intake rate
    let windowStartDate: string | undefined;
    let windowEndDate: string | undefined;
    const provisionalDailyRate = settings.provisionalDailyHoursPerProject > 0 
      ? settings.provisionalDailyHoursPerProject 
      : 25;

    if (category === 'regular') {
      if (allocationMethod === 'scheduled' && scheduledStartStr) {
        windowStartDate = scheduledStartStr < referenceDateStr ? referenceDateStr : scheduledStartStr;
        windowEndDate = deliveryDateStr!;
      } else {
        const estimatedDaysNeeded = Math.max(5, Math.min(60, Math.ceil(forecastRemainingHours / provisionalDailyRate)));
        const calculatedStart = stepWorkingDays(deliveryDateStr!, -estimatedDaysNeeded, settings);
        windowStartDate = calculatedStart < referenceDateStr ? referenceDateStr : calculatedStart;
        windowEndDate = deliveryDateStr!;
      }
    } else if (category === 'overdue_manufacturing' || (category as string) === 'overdue') {
      // Overdue manufacturing work starts TODAY and spans forward based on remaining hours
      windowStartDate = referenceDateStr;
      const estimatedDaysNeeded = Math.max(5, Math.min(60, Math.ceil(forecastRemainingHours / provisionalDailyRate)));
      windowEndDate = stepWorkingDays(referenceDateStr, estimatedDaysNeeded, settings);
    } else if (category === 'overdue_zero_remaining') {
      windowStartDate = referenceDateStr;
      windowEndDate = referenceDateStr;
    }

    // Evaluate window metrics and check for compressed/strained schedules
    const windowWorkingDays = (windowStartDate && windowEndDate) 
      ? countWorkingDaysBetween(windowStartDate, windowEndDate, settings) 
      : 0;

    const requiredDailyIntakeHours = windowWorkingDays > 0 
      ? Math.round((forecastRemainingHours / windowWorkingDays) * 10) / 10 
      : forecastRemainingHours;

    // Detect compressed delivery window
    const isCompressedWindow = (category === 'regular' || category === 'overdue_manufacturing' || (category as string) === 'overdue') &&
      windowWorkingDays > 0 &&
      forecastRemainingHours > 20 &&
      requiredDailyIntakeHours > (provisionalDailyRate * 1.5);

    if (isCompressedWindow) {
      warnings.push(`Compressed window: Requires ${requiredDailyIntakeHours}h/day intake pace (benchmark is ${provisionalDailyRate}h/day).`);
    }

    // Feasibility check against total factory net capacity
    const maxFactoryDailyCapacity = settings.headcount * 10 * settings.efficiency;
    const isFeasible = (windowWorkingDays > 0 || forecastRemainingHours === 0) &&
      (requiredDailyIntakeHours <= maxFactoryDailyCapacity);

    if (!isFeasible && category === 'regular') {
      warnings.push(`Infeasible window: required daily pace (${requiredDailyIntakeHours}h/day) exceeds total workshop capacity (${Math.round(maxFactoryDailyCapacity)}h/day).`);
    }

    processed.push({
      id: raw.id,
      projectNumber: raw.projectNumber || 'Unknown',
      name: raw.name || 'Untitled Project',
      clientName: raw.clientName || 'Standard Client',
      projectManager: raw.projectManager || 'Unassigned',
      rawStatus: raw.rawStatus || 'Unknown',
      normalizedStatus: normalizeStatus(raw.rawStatus),
      budgetHours,
      actualHours,
      adjustedActualHours,
      calculatedRemainingHours,
      forecastRemainingHours,
      isOverBudget,
      hasZeroRemaining,
      hasMissingBudget,
      contractValue: Number(raw.total) || 0,
      deliveryDate: deliveryDateStr,
      originalDeliveryDate: deliveryDateStr,
      scheduledStart: scheduledStartStr,
      category,
      isOverdue,
      daysOverdue,
      allocationMethod,
      windowStartDate,
      windowEndDate,
      windowWorkingDays,
      requiredDailyIntakeHours,
      isCompressedWindow,
      allocatedHoursPerPeriod: {},
      isFeasible,
      warnings,
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : null,
      remoteUpdatedAt: raw.remoteUpdatedAt ? new Date(raw.remoteUpdatedAt).toISOString() : null,
    });
  }

  return processed;
}

/**
 * Distributes demand for active projects across forecast periods.
 * Strictly adheres to:
 * - Conservation of demand hours.
 * - Respects shared workshop capacity.
 * - Does not allocate unscheduled backlog or zero-remaining review jobs to regular periods.
 * - Categorizes demand into scheduled vs provisional vs overdue.
 * - Separates feasible absorbed capacity from unallocated overload.
 */
export function distributeDemandAcrossPeriods(
  projects: ProjectV2Demand[],
  periods: PeriodCapacity[],
  settings: CapacitySettingsV2,
  referenceDateStr: string = getSydneyTodayDateString()
): PeriodForecast[] {
  // Initialize forecasts
  const periodForecasts: PeriodForecast[] = periods.map(p => ({
    periodKey: p.periodKey,
    label: p.label,
    startDate: p.startDate,
    endDate: p.endDate,
    standardGrossHours: p.grossHours,
    netCapacityHours: p.remainingNetCapacityHours, // effective available capacity in period
    demandHours: 0,
    scheduledDemandHours: 0,
    provisionalDemandHours: 0,
    overdueDemandHours: 0,
    feasibleAllocatedHours: 0,
    unallocatedDemandHours: 0,
    utilisationPercent: 0,
    shortfallOrSurplusHours: p.remainingNetCapacityHours,
    loadStatus: 'normal',
    isAtRisk: false,
    isOverloaded: false,
    contributingProjects: [],
  }));

  const periodMap = new Map<string, PeriodForecast>();
  periodForecasts.forEach(pf => periodMap.set(pf.periodKey, pf));

  for (const proj of projects) {
    // Only regular and overdue manufacturing jobs with remaining hours demand shop-floor labour
    const isDemandEligible = (proj.category === 'regular' || proj.category === 'overdue_manufacturing' || (proj.category as string) === 'overdue') &&
      proj.forecastRemainingHours > 0;

    if (!isDemandEligible) {
      continue;
    }

    const winStart = proj.windowStartDate || referenceDateStr;
    const winEnd = proj.windowEndDate || proj.deliveryDate || winStart;

    // Count eligible working days for this project across all forecast periods
    const periodOverlaps: { periodKey: string; workingDays: number }[] = [];
    let totalEligibleWorkingDays = 0;

    for (const period of periods) {
      const overlapStart = winStart > period.startDate ? winStart : period.startDate;
      const overlapEnd = winEnd < period.endDate ? winEnd : period.endDate;

      if (overlapStart <= overlapEnd) {
        const effectiveStart = period.isCurrentPeriod && referenceDateStr > overlapStart 
          ? referenceDateStr 
          : overlapStart;

        if (effectiveStart <= overlapEnd) {
          const days = countWorkingDaysBetween(effectiveStart, overlapEnd, settings);
          if (days > 0) {
            periodOverlaps.push({ periodKey: period.periodKey, workingDays: days });
            totalEligibleWorkingDays += days;
          }
        }
      }
    }

    // Distribute remaining demand
    if (totalEligibleWorkingDays > 0) {
      let allocatedTotal = 0;
      for (let i = 0; i < periodOverlaps.length; i++) {
        const item = periodOverlaps[i];
        let periodHours: number;
        if (i === periodOverlaps.length - 1) {
          periodHours = Math.round((proj.forecastRemainingHours - allocatedTotal) * 10) / 10;
        } else {
          periodHours = Math.round((proj.forecastRemainingHours * (item.workingDays / totalEligibleWorkingDays)) * 10) / 10;
          allocatedTotal += periodHours;
        }

        proj.allocatedHoursPerPeriod[item.periodKey] = periodHours;

        const pf = periodMap.get(item.periodKey);
        if (pf) {
          pf.demandHours = Math.round((pf.demandHours + periodHours) * 10) / 10;
          if (proj.allocationMethod === 'scheduled') {
            pf.scheduledDemandHours = Math.round((pf.scheduledDemandHours + periodHours) * 10) / 10;
          } else if (proj.allocationMethod === 'overdue_provisional') {
            pf.overdueDemandHours = Math.round((pf.overdueDemandHours + periodHours) * 10) / 10;
          } else {
            pf.provisionalDemandHours = Math.round((pf.provisionalDemandHours + periodHours) * 10) / 10;
          }

          pf.contributingProjects.push({
            projectId: proj.id,
            projectNumber: proj.projectNumber,
            projectName: proj.name,
            clientName: proj.clientName,
            projectManager: proj.projectManager,
            allocatedHours: periodHours,
            totalForecastRemaining: proj.forecastRemainingHours,
            allocationMethod: proj.allocationMethod,
            deliveryDate: proj.deliveryDate,
            isOverdue: proj.isOverdue,
            isCompressedWindow: proj.isCompressedWindow,
          });
        }
      }
    } else {
      // If the project window falls entirely within the first period or past it, allocate to first period
      const firstPeriod = periodForecasts[0];
      if (firstPeriod) {
        proj.allocatedHoursPerPeriod[firstPeriod.periodKey] = proj.forecastRemainingHours;
        firstPeriod.demandHours = Math.round((firstPeriod.demandHours + proj.forecastRemainingHours) * 10) / 10;
        if (proj.allocationMethod === 'scheduled') {
          firstPeriod.scheduledDemandHours = Math.round((firstPeriod.scheduledDemandHours + proj.forecastRemainingHours) * 10) / 10;
        } else if (proj.allocationMethod === 'overdue_provisional') {
          firstPeriod.overdueDemandHours = Math.round((firstPeriod.overdueDemandHours + proj.forecastRemainingHours) * 10) / 10;
        } else {
          firstPeriod.provisionalDemandHours = Math.round((firstPeriod.provisionalDemandHours + proj.forecastRemainingHours) * 10) / 10;
        }

        firstPeriod.contributingProjects.push({
          projectId: proj.id,
          projectNumber: proj.projectNumber,
          projectName: proj.name,
          clientName: proj.clientName,
          projectManager: proj.projectManager,
          allocatedHours: proj.forecastRemainingHours,
          totalForecastRemaining: proj.forecastRemainingHours,
          allocationMethod: proj.allocationMethod,
          deliveryDate: proj.deliveryDate,
          isOverdue: proj.isOverdue,
          isCompressedWindow: proj.isCompressedWindow,
        });
      }
    }
  }

  // Calculate final utilisation, shortfalls, feasible vs unallocated workload
  for (const pf of periodForecasts) {
    if (pf.netCapacityHours > 0) {
      pf.utilisationPercent = Math.round((pf.demandHours / pf.netCapacityHours) * 100);
    } else {
      pf.utilisationPercent = pf.demandHours > 0 ? 999 : 0;
    }
    pf.shortfallOrSurplusHours = Math.round((pf.netCapacityHours - pf.demandHours) * 10) / 10;
    pf.feasibleAllocatedHours = Math.min(pf.demandHours, pf.netCapacityHours);
    pf.unallocatedDemandHours = Math.max(0, Math.round((pf.demandHours - pf.netCapacityHours) * 10) / 10);

    pf.isOverloaded = pf.utilisationPercent > 100;
    pf.isAtRisk = pf.utilisationPercent >= settings.riskThreshold && pf.utilisationPercent <= 100;
    pf.loadStatus = pf.isOverloaded ? 'overloaded' : (pf.isAtRisk ? 'at_risk' : 'normal');

    // Sort contributing projects by allocated hours descending
    pf.contributingProjects.sort((a, b) => b.allocatedHours - a.allocatedHours);
  }

  return periodForecasts;
}

/**
 * Calculates rolling 30-day capacity and demand metrics.
 */
export function calculateRolling30DaysMetrics(
  projects: ProjectV2Demand[],
  settings: CapacitySettingsV2,
  referenceDateStr: string = getSydneyTodayDateString()
): {
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
} {
  const refDate = parseDateString(referenceDateStr);
  const endDateObj = new Date(refDate);
  endDateObj.setUTCDate(endDateObj.getUTCDate() + 30);
  const endDateStr = formatDateString(endDateObj);

  let workingDaysCount = 0;
  let netCapacityHours = 0;
  const cur = new Date(refDate);

  while (cur <= endDateObj) {
    const dStr = formatDateString(cur);
    const dayCap = evaluateDayCapacity(dStr, settings);
    if (dayCap.effectiveWorkingHoursPerPerson > 0) {
      workingDaysCount++;
      netCapacityHours += dayCap.workshopNetHours;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  netCapacityHours = Math.round(netCapacityHours * 10) / 10;

  // Calculate demand falling into [referenceDateStr, endDateStr]
  let demandHours = 0;
  for (const proj of projects) {
    if (proj.forecastRemainingHours <= 0) continue;
    const isEligible = proj.category === 'regular' || proj.category === 'overdue_manufacturing' || (proj.category as string) === 'overdue';
    if (!isEligible) continue;

    const winStart = proj.windowStartDate || referenceDateStr;
    const winEnd = proj.windowEndDate || proj.deliveryDate || winStart;

    const overlapStart = winStart > referenceDateStr ? winStart : referenceDateStr;
    const overlapEnd = winEnd < endDateStr ? winEnd : endDateStr;

    if (overlapStart <= overlapEnd) {
      const overlapDays = countWorkingDaysBetween(overlapStart, overlapEnd, settings);
      const totalDays = countWorkingDaysBetween(winStart > referenceDateStr ? winStart : referenceDateStr, winEnd, settings);
      if (totalDays > 0) {
        demandHours += proj.forecastRemainingHours * (overlapDays / totalDays);
      } else {
        demandHours += proj.forecastRemainingHours;
      }
    }
  }
  demandHours = Math.round(demandHours * 10) / 10;

  const utilisationPercent = netCapacityHours > 0 
    ? Math.round((demandHours / netCapacityHours) * 100) 
    : (demandHours > 0 ? 999 : 0);
  const shortfallHours = Math.round((netCapacityHours - demandHours) * 10) / 10;
  const isOverloaded = utilisationPercent > 100;
  const isAtRisk = utilisationPercent >= settings.riskThreshold && utilisationPercent <= 100;
  const loadStatus: 'normal' | 'at_risk' | 'overloaded' = isOverloaded ? 'overloaded' : (isAtRisk ? 'at_risk' : 'normal');

  return {
    startDate: referenceDateStr,
    endDate: endDateStr,
    workingDaysCount,
    netCapacityHours,
    demandHours,
    utilisationPercent,
    shortfallHours,
    isOverloaded,
    isAtRisk,
    loadStatus,
  };
}

/**
 * Calculates data freshness and currency audit from raw project inputs.
 */
export function calculateDataFreshness(
  projects: RawProjectInput[],
  lastBulkSyncAt: string | null,
  referenceDateStr: string = getSydneyTodayDateString()
): DataFreshnessInfo {
  const calculatedAt = new Date().toISOString();
  let maxLocalUpdate: Date | null = null;
  let maxRemoteUpdate: Date | null = null;
  let updatedWithin7Days = 0;
  let updatedWithin30Days = 0;
  let staleOver30Days = 0;

  const nowMs = parseDateString(referenceDateStr).getTime();
  const ms7Days = 7 * 86400000;
  const ms30Days = 30 * 86400000;

  const activeProjects = projects.filter(p => !p.isArchived);

  for (const p of activeProjects) {
    if (p.updatedAt) {
      const dt = new Date(p.updatedAt);
      if (!isNaN(dt.getTime())) {
        if (!maxLocalUpdate || dt > maxLocalUpdate) maxLocalUpdate = dt;
        const ageMs = Math.max(0, nowMs - dt.getTime());
        if (ageMs <= ms7Days) {
          updatedWithin7Days++;
        }
        if (ageMs <= ms30Days) {
          updatedWithin30Days++;
        } else {
          staleOver30Days++;
        }
      }
    }
    if (p.remoteUpdatedAt) {
      const dt = new Date(p.remoteUpdatedAt);
      if (!isNaN(dt.getTime())) {
        if (!maxRemoteUpdate || dt > maxRemoteUpdate) maxRemoteUpdate = dt;
      }
    }
  }

  const total = activeProjects.length || 1;
  const updatedWithin7DaysPercent = Math.round((updatedWithin7Days / total) * 100);
  const updatedWithin30DaysPercent = Math.round((updatedWithin30Days / total) * 100);
  const staleOver30DaysPercent = Math.round((staleOver30Days / total) * 100);

  let coverageStatus: 'fresh' | 'stale_warning' | 'outdated' = 'fresh';
  if (staleOver30DaysPercent > 20) {
    coverageStatus = 'outdated';
  } else if (staleOver30DaysPercent > 5) {
    coverageStatus = 'stale_warning';
  }

  const formatAU = (d: Date | null) => d ? d.toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) : null;

  return {
    calculatedAt,
    lastBulkSyncAt,
    lastLocalProjectUpdateAt: formatAU(maxLocalUpdate),
    latestRemoteUpdateAt: formatAU(maxRemoteUpdate),
    totalActiveProjects: activeProjects.length,
    updatedWithin7DaysCount: updatedWithin7Days,
    updatedWithin7DaysPercent,
    updatedWithin30DaysCount: updatedWithin30Days,
    updatedWithin30DaysPercent,
    staleOver30DaysCount: staleOver30Days,
    staleOver30DaysPercent,
    coverageStatus,
  };
}

/**
 * Builds backlog summary statistics for unscheduled projects.
 */
export function buildBacklogSummary(projects: ProjectV2Demand[]): BacklogSummary {
  let totalContractValue = 0;
  let totalBudgetHours = 0;
  let totalForecastRemainingHours = 0;
  const pmBreakdown: Record<string, { count: number; hours: number; value: number }> = {};

  for (const p of projects) {
    totalContractValue += p.contractValue;
    totalBudgetHours += p.budgetHours;
    totalForecastRemainingHours += p.forecastRemainingHours;

    const pm = p.projectManager || 'Unassigned';
    if (!pmBreakdown[pm]) {
      pmBreakdown[pm] = { count: 0, hours: 0, value: 0 };
    }
    pmBreakdown[pm].count++;
    pmBreakdown[pm].hours = Math.round((pmBreakdown[pm].hours + p.forecastRemainingHours) * 10) / 10;
    pmBreakdown[pm].value = Math.round((pmBreakdown[pm].value + p.contractValue) * 100) / 100;
  }

  return {
    projectCount: projects.length,
    totalContractValue: Math.round(totalContractValue * 100) / 100,
    totalBudgetHours: Math.round(totalBudgetHours * 10) / 10,
    totalForecastRemainingHours: Math.round(totalForecastRemainingHours * 10) / 10,
    pmBreakdown,
    projects,
  };
}

/**
 * Builds complete Risk V2 dashboard data structure.
 */
export function buildRiskV2DashboardData(
  rawProjects: RawProjectInput[],
  settings: CapacitySettingsV2,
  periods: PeriodCapacity[],
  lastSyncTimestamp: string | null,
  viewMode: 'monthly' | 'weekly',
  horizon: number,
  referenceDateStr: string = getSydneyTodayDateString(),
  readinessInput?: {
    plannerConfirmations?: Record<string, ProjectMaterialConfirmation>;
    purchaseOrders?: LinkedPurchaseOrder[];
  }
): RiskV2DashboardData {

  const processedProjects = processRawProjectsV2(rawProjects, settings, referenceDateStr);

  const forecastPeriods = distributeDemandAcrossPeriods(
    processedProjects,
    periods,
    settings,
    referenceDateStr
  );

  // Segment overdue and review projects
  const overdueManufacturingProjects = processedProjects.filter(
    p => p.category === 'overdue_manufacturing' || (p.category === 'overdue' && p.forecastRemainingHours > 0)
  );
  const overdueZeroRemainingProjects = processedProjects.filter(
    p => p.category === 'overdue_zero_remaining' || (p.category === 'overdue' && p.forecastRemainingHours === 0)
  );
  const administrativeCloseoutProjects = processedProjects.filter(
    p => p.category === 'administrative_closeout'
  );
  const overdueProjects = [...overdueManufacturingProjects, ...overdueZeroRemainingProjects];

  const unscheduled2030Projects = processedProjects.filter(p => p.category === 'unscheduled_2030');
  const unscheduledMissingProjects = processedProjects.filter(p => p.category === 'unscheduled_missing_date');

  const unscheduled2030Backlog = buildBacklogSummary(unscheduled2030Projects);
  const unscheduledMissingDateBacklog = buildBacklogSummary(unscheduledMissingProjects);

  // Near-term headline KPIs
  const currentPeriodForecast = forecastPeriods[0] || {
    periodKey: 'N/A',
    label: 'Current',
    demandHours: 0,
    netCapacityHours: 0,
    utilisationPercent: 0,
    shortfallOrSurplusHours: 0,
    isOverloaded: false,
    isAtRisk: false,
    loadStatus: 'normal' as const,
  };

  const currentPeriod = {
    periodKey: currentPeriodForecast.periodKey,
    label: currentPeriodForecast.label,
    demandHours: currentPeriodForecast.demandHours,
    netCapacityHours: currentPeriodForecast.netCapacityHours,
    utilisationPercent: currentPeriodForecast.utilisationPercent,
    shortfallHours: currentPeriodForecast.shortfallOrSurplusHours,
    isOverloaded: currentPeriodForecast.isOverloaded,
    isAtRisk: currentPeriodForecast.isAtRisk,
    loadStatus: currentPeriodForecast.loadStatus,
  };

  const next30Days = calculateRolling30DaysMetrics(processedProjects, settings, referenceDateStr);

  // Peak period
  let peakPeriodForecast = forecastPeriods[0];
  for (const pf of forecastPeriods) {
    if (pf.utilisationPercent > (peakPeriodForecast?.utilisationPercent || 0)) {
      peakPeriodForecast = pf;
    }
  }

  const peakPeriod = peakPeriodForecast ? {
    periodKey: peakPeriodForecast.periodKey,
    label: peakPeriodForecast.label,
    demandHours: peakPeriodForecast.demandHours,
    netCapacityHours: peakPeriodForecast.netCapacityHours,
    utilisationPercent: peakPeriodForecast.utilisationPercent,
    shortfallHours: peakPeriodForecast.shortfallOrSurplusHours,
    loadStatus: peakPeriodForecast.loadStatus,
  } : {
    periodKey: 'N/A',
    label: 'None',
    demandHours: 0,
    netCapacityHours: 0,
    utilisationPercent: 0,
    shortfallHours: 0,
    loadStatus: 'normal' as const,
  };

  // 6-Month pipeline aggregate
  const totalForecastDemand = Math.round(forecastPeriods.reduce((acc, p) => acc + p.demandHours, 0) * 10) / 10;
  const totalNetAvailableCapacity = Math.round(forecastPeriods.reduce((acc, p) => acc + p.netCapacityHours, 0) * 10) / 10;
  const overallUtilisationPercent = totalNetAvailableCapacity > 0 
    ? Math.round((totalForecastDemand / totalNetAvailableCapacity) * 100) 
    : 0;
  const overallShortfallOrSurplusHours = Math.round((totalNetAvailableCapacity - totalForecastDemand) * 10) / 10;

  const nearTermOverloaded = forecastPeriods.slice(0, 2).some(p => p.isOverloaded || p.isAtRisk);
  const forwardSpare = forecastPeriods.slice(2).some(p => p.utilisationPercent < 70);
  const isFrontLoaded = nearTermOverloaded && forwardSpare;

  const sixMonthPipeline = {
    totalDemandHours: totalForecastDemand,
    totalNetCapacityHours: totalNetAvailableCapacity,
    utilisationPercent: overallUtilisationPercent,
    overallShortfallOrSurplusHours,
    isFrontLoaded,
    characterization: isFrontLoaded 
      ? 'Front-Loaded: Factory facing acute near-term overload despite open forward capacity' 
      : (overallUtilisationPercent > 100 
        ? 'Sustained Overload: Factory overloaded across multiple periods' 
        : 'Within Capacity: Workshop demand aligns with available capacity'),
  };

  // Separated overdue categories summary
  const overdueManufacturing = {
    count: overdueManufacturingProjects.length,
    hours: Math.round(overdueManufacturingProjects.reduce((acc, p) => acc + p.forecastRemainingHours, 0) * 10) / 10,
    contractValue: Math.round(overdueManufacturingProjects.reduce((acc, p) => acc + p.contractValue, 0) * 100) / 100,
  };

  const overdueZeroRemaining = {
    count: overdueZeroRemainingProjects.length,
    hours: 0,
    contractValue: Math.round(overdueZeroRemainingProjects.reduce((acc, p) => acc + p.contractValue, 0) * 100) / 100,
  };

  const administrativeCloseout = {
    count: administrativeCloseoutProjects.length,
    hours: 0,
    contractValue: Math.round(administrativeCloseoutProjects.reduce((acc, p) => acc + p.contractValue, 0) * 100) / 100,
  };

  const overloadedPeriodsCount = forecastPeriods.filter(p => p.isOverloaded).length;
  const atRiskPeriodsCount = forecastPeriods.filter(p => p.isAtRisk).length;

  const overBudgetCount = processedProjects.filter(p => p.isOverBudget).length;
  const zeroRemainingActiveCount = processedProjects.filter(p => p.hasZeroRemaining).length;
  const missingBudgetCount = processedProjects.filter(p => p.hasMissingBudget).length;
  const compressedWindowCount = processedProjects.filter(p => p.isCompressedWindow).length;

  const dataFreshness = calculateDataFreshness(rawProjects, lastSyncTimestamp, referenceDateStr);

  // Build production readiness assessment for all active projects
  const rawMap = new Map<number, RawProjectInput>();
  for (const rp of rawProjects) {
    rawMap.set(rp.id, rp);
  }

  const plannerConfirmations = readinessInput?.plannerConfirmations || {};
  const allPOs = readinessInput?.purchaseOrders || [];

  const projectPOMap = new Map<number, LinkedPurchaseOrder[]>();
  for (const po of allPOs) {
    const list = projectPOMap.get(po.projectId) || [];
    list.push(po);
    projectPOMap.set(po.projectId, list);
  }

  const readinessProjects = processedProjects.map(p => {
    const raw = rawMap.get(p.id);
    const pPOs = projectPOMap.get(p.id) || [];
    return assessProjectReadiness(
      {
        id: p.id,
        projectNumber: p.projectNumber,
        name: p.name,
        clientName: p.clientName,
        projectManager: p.projectManager,
        deliveryDate: p.deliveryDate,
        projectType: raw?.projectType || null,
        scheduledStart: p.scheduledStart,
        forecastRemainingHours: p.forecastRemainingHours,

        drawingApprovalDate: normalizeDateToSydneyString(raw?.drawingApprovalDate),
        expectedDrawingApprovalDate: normalizeDateToSydneyString(raw?.expectedDrawingApprovalDate),
        sheetmetalOrderedDate: normalizeDateToSydneyString(raw?.sheetmetalOrderedDate),
        sheetmetalDeliveredDate: normalizeDateToSydneyString(raw?.sheetmetalDeliveredDate),
        switchgearOrderedDate: normalizeDateToSydneyString(raw?.switchgearOrderedDate),
        switchgearDeliveredDate: normalizeDateToSydneyString(raw?.switchgearDeliveredDate),
      },
      plannerConfirmations,
      pPOs,
      settings,
      referenceDateStr
    );
  });

  const readyForManufacturingCount = readinessProjects.filter(p => p.manufacturingReadiness === 'ready_for_production').length;
  const readyForFramingOnlyCount = readinessProjects.filter(p => p.manufacturingReadiness === 'ready_for_framing_only').length;
  const blockedByDrawingsCount = readinessProjects.filter(p => p.manufacturingReadiness === 'blocked_by_drawings').length;
  const blockedBySheetmetalCount = readinessProjects.filter(p => p.manufacturingReadiness === 'blocked_by_sheetmetal').length;
  const blockedBySwitchgearCount = readinessProjects.filter(p => p.manufacturingReadiness === 'blocked_by_switchgear').length;
  const blockedByBothCount = readinessProjects.filter(p => p.manufacturingReadiness === 'blocked_by_both').length;
  const readinessUnknownCount = readinessProjects.filter(p => p.manufacturingReadiness === 'readiness_unknown').length;
  const startDateOverdueCount = readinessProjects.filter(p => p.isStartDateOverdue).length;
  const materialDelayConflictCount = readinessProjects.filter(p => p.isMaterialDelayConflict).length;
  const supplierEtaOverdueCount = readinessProjects.filter(p => p.isSupplierEtaOverdue).length;

  const projectMetaMap = new Map<number, { projectNumber: string; name: string }>();
  for (const p of processedProjects) {
    projectMetaMap.set(p.id, { projectNumber: p.projectNumber, name: p.name });
  }

  const supplierIntelligence = buildSupplierIntelligenceSummary(allPOs, projectMetaMap, referenceDateStr);

  const productionReadiness = {
    projects: readinessProjects,
    supplierIntelligence,
    summary: {
      readyForManufacturingCount,
      readyForFramingOnlyCount,
      blockedByDrawingsCount,
      blockedBySheetmetalCount,
      blockedBySwitchgearCount,
      blockedByBothCount,
      readinessUnknownCount,
      startDateOverdueCount,
      materialDelayConflictCount,
      supplierEtaOverdueCount,
    },
  };

  return {
    settings,
    lastSyncTimestamp,
    referenceDate: referenceDateStr,
    viewMode,
    horizon,
    periods: forecastPeriods,
    summary: {
      currentPeriod,
      next30Days,
      peakPeriod,
      sixMonthPipeline,
      overdueManufacturing,
      overdueZeroRemaining,
      administrativeCloseout,
      totalForecastDemand,
      totalNetAvailableCapacity,
      overallUtilisationPercent,
      overloadedPeriodsCount,
      atRiskPeriodsCount,
      overdueActiveCount: overdueProjects.length,
      overdueActiveHours: overdueManufacturing.hours,
      overdueActiveValue: Math.round((overdueManufacturing.contractValue + overdueZeroRemaining.contractValue) * 100) / 100,
      unscheduled2030Count: unscheduled2030Backlog.projectCount,
      unscheduled2030Hours: unscheduled2030Backlog.totalForecastRemainingHours,
      unscheduled2030Value: unscheduled2030Backlog.totalContractValue,
      unscheduledMissingCount: unscheduledMissingDateBacklog.projectCount,
      unscheduledMissingHours: unscheduledMissingDateBacklog.totalForecastRemainingHours,
      unscheduledMissingValue: unscheduledMissingDateBacklog.totalContractValue,
      overBudgetCount,
      zeroRemainingActiveCount,
      missingBudgetCount,
      compressedWindowCount,
    },
    overdueProjects,
    overdueManufacturingProjects,
    overdueZeroRemainingProjects,
    administrativeCloseoutProjects,
    unscheduled2030Backlog,
    unscheduledMissingDateBacklog,
    allActiveProjects: processedProjects,
    dataFreshness,
    productionReadiness,
  };
}

