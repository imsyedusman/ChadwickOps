import { 
  CapacitySettingsV2 
} from './types';
import { 
  isWorkingDay, 
  parseDateString, 
  formatDateString, 
  stepWorkingDays, 
  countWorkingDays 
} from './calendar';

export type MaterialRequirementType = 
  | 'both' 
  | 'sheetmetal_only' 
  | 'switchgear_only' 
  | 'neither' 
  | 'unknown';

export interface ProjectMaterialConfirmation {
  requirement: MaterialRequirementType;
  confirmedBy?: string;
  confirmedAt?: string; // ISO date string
  notes?: string;
}

export type DrawingReadiness = 'approved' | 'pending_approval' | 'missing';

export type MaterialItemStatus = 
  | 'delivered' 
  | 'ordered_with_eta' 
  | 'ordered_no_eta' 
  | 'not_ordered' 
  | 'not_required' 
  | 'unknown';

export type ManufacturingReadinessStatus = 
  | 'ready_for_production'      // Drawings approved + all required materials confirmed delivered
  | 'ready_for_framing_only'     // Drawings approved + sheetmetal delivered, switchgear still awaited
  | 'blocked_by_drawings'        // Drawings not approved
  | 'blocked_by_sheetmetal'      // Drawings approved, sheetmetal required but not delivered
  | 'blocked_by_switchgear'      // Drawings approved, sheetmetal ok/not required, switchgear required but not delivered
  | 'blocked_by_both'            // Drawings approved, both sheetmetal & switchgear required but neither delivered
  | 'outsourced_job'             // Out Sourced (OS) project - manufacturing done off-site
  | 'zero_remaining_review'      // 0 or negative remaining hours - work completed or awaiting PM review
  | 'readiness_unknown';         // Material requirements unconfirmed or dates missing

export interface LinkedPurchaseOrder {
  id: number;
  projectId: number;
  poNumber: string | null;
  supplierName: string | null;
  total: number;
  status: string; // 'Received', 'Approved', etc.
  issueDate: string | null; // ISO 'YYYY-MM-DD'
  expectedDate: string | null;
  receivedDate: string | null;
  isOverdueETA: boolean;
  varianceDays: number | null; // receivedDate - expectedDate (or today - expectedDate if in-flight)
  linesCount?: number;
}

export interface ProjectReadinessAssessment {
  projectId: number;
  projectNumber: string;
  name: string;
  clientName: string;
  projectManager: string;
  deliveryDate: string | null; // ISO 'YYYY-MM-DD'
  projectType: string | null;
  scheduledStart: string | null; // from productionSchedule
  forecastRemainingHours: number;
  
  // Material requirement configuration
  materialRequirement: MaterialRequirementType;
  isRequirementConfirmed: boolean;
  confirmationDetails?: ProjectMaterialConfirmation;

  // Granular component statuses
  drawingStatus: DrawingReadiness;
  drawingApprovalDate: string | null;
  expectedDrawingApprovalDate: string | null;

  sheetmetalStatus: MaterialItemStatus;
  sheetmetalOrderedDate: string | null;
  sheetmetalDeliveredDate: string | null;
  sheetmetalExpectedDate: string | null;

  switchgearStatus: MaterialItemStatus;
  switchgearOrderedDate: string | null;
  switchgearDeliveredDate: string | null;
  switchgearExpectedDate: string | null;

  // Manufacturing gate status
  manufacturingReadiness: ManufacturingReadinessStatus;
  blockingReasons: string[];
  
  // Stage readiness flags
  canStartFraming: boolean; // Drawings approved + Sheetmetal delivered (or not required)
  canStartMountingAndWiring: boolean; // Drawings approved + Switchgear delivered (or not required)

  // Distinct planning dates (Audited: Separated per Requirement C)
  latestRequiredManufacturingStartDate: string | null; // Provisional latest start needed to hit customer deadline
  earliestConfirmedMaterialStartDate: string | null;    // Strictly confirmed physical receipt
  earliestEstimatedMaterialStartDate: string | null;    // Estimated from supplier ETAs (provisional)
  approvedScheduledStartDate: string | null;            // Approved schedule from productionSchedule
  
  // Backward compatibility aliases
  requiredProductionStartDate: string | null;
  earliestMaterialFeasibleStartDate: string | null;

  // Conflict flags
  isStartDateOverdue: boolean;        // latestRequiredManufacturingStartDate < referenceDate
  isMaterialDelayConflict: boolean;   // earliestEstimatedMaterialStartDate > latestRequiredManufacturingStartDate
  isMaterialUnconfirmedRisk: boolean; // required start approaching but materials unconfirmed/missing
  isSupplierEtaOverdue: boolean;      // Any linked in-flight PO has expectedDate < referenceDate

  // Linked POs
  purchaseOrders: LinkedPurchaseOrder[];
  hasInFlightPOs: boolean;
  delayedPOCount: number;
}

export interface SupplierIntelligenceSummary {
  totalInFlightPOs: number;
  totalInFlightValue: number;
  inFlightMissingEtaCount: number; // POs where expected_date is NULL in WorkGuru
  overdueInFlightPOsCount: number;
  overdueInFlightValue: number;
  affectedProjectsCount: number;
  topSuppliers: {
    supplierName: string;
    inFlightCount: number;
    inFlightValue: number;
    overdueCount: number;
    missingEtaCount: number;
    avgVarianceDays: number | null;
  }[];
  recentDelayedPOs: {
    poId: number;
    poNumber: string | null;
    supplierName: string | null;
    projectNumber: string;
    projectName: string;
    expectedDate: string;
    daysOverdue: number;
    total: number;
  }[];
}

/**
 * Backward Planning: Calculate Provisional Latest Required Manufacturing Start Date.
 * Audited: testing/packaging labour is ALREADY included in forecastRemainingHours task budgets.
 * dispatchBufferWorkingDays defaults to 0 (or 1 for freight pickup), avoiding double-counting labour.
 */
export function calculateRequiredProductionStart(
  deliveryDateStr: string | null,
  forecastRemainingHours: number,
  settings: CapacitySettingsV2,
  dispatchBufferWorkingDays: number = 0
): string | null {
  if (!deliveryDateStr) return null;

  const dailyRate = Math.max(1, settings.provisionalDailyHoursPerProject || 25);
  const manufacturingDaysNeeded = Math.ceil(Math.max(0, forecastRemainingHours) / dailyRate);
  
  const totalDaysNeeded = Math.max(1, manufacturingDaysNeeded + Math.max(0, dispatchBufferWorkingDays));

  return stepWorkingDays(deliveryDateStr, -totalDaysNeeded, settings);
}

/**
 * Forward Planning: Earliest Confirmed Material-Ready Start.
 * Returns a date ONLY when drawing approval AND all required materials are CONFIRMED physically received.
 * Does not treat unconfirmed supplier ETAs as confirmed start dates.
 */
export function calculateConfirmedMaterialStart(
  drawingStatus: DrawingReadiness,
  drawingApprovalDate: string | null,
  materialRequirement: MaterialRequirementType,
  sheetmetalStatus: MaterialItemStatus,
  sheetmetalDeliveredDate: string | null,
  switchgearStatus: MaterialItemStatus,
  switchgearDeliveredDate: string | null,
  referenceDateStr: string
): string | null {
  if (drawingStatus !== 'approved' || !drawingApprovalDate) {
    return null;
  }

  const confirmedDates: string[] = [drawingApprovalDate];

  if (materialRequirement === 'both' || materialRequirement === 'sheetmetal_only') {
    if (sheetmetalStatus !== 'delivered' || !sheetmetalDeliveredDate) {
      return null;
    }
    confirmedDates.push(sheetmetalDeliveredDate);
  }

  if (materialRequirement === 'both' || materialRequirement === 'switchgear_only') {
    if (switchgearStatus !== 'delivered' || !switchgearDeliveredDate) {
      return null;
    }
    confirmedDates.push(switchgearDeliveredDate);
  }

  if (materialRequirement === 'unknown') {
    return null;
  }

  confirmedDates.sort();
  const latestDate = confirmedDates[confirmedDates.length - 1];
  return latestDate < referenceDateStr ? referenceDateStr : latestDate;
}

/**
 * Forward Planning: Earliest Estimated Material-Ready Start based on Supplier ETAs.
 * Distinct from confirmed start: clearly marked as provisional estimate based on unconfirmed delivery promises.
 */
export function calculateEstimatedMaterialStart(
  drawingStatus: DrawingReadiness,
  drawingApprovalDate: string | null,
  materialRequirement: MaterialRequirementType,
  sheetmetalStatus: MaterialItemStatus,
  sheetmetalDeliveredDate: string | null,
  sheetmetalExpectedDate: string | null,
  switchgearStatus: MaterialItemStatus,
  switchgearDeliveredDate: string | null,
  switchgearExpectedDate: string | null,
  referenceDateStr: string
): string | null {
  if (drawingStatus === 'missing') {
    return null;
  }

  const candidateDates: string[] = [];
  if (drawingApprovalDate) {
    candidateDates.push(drawingApprovalDate);
  }

  if (materialRequirement === 'both' || materialRequirement === 'sheetmetal_only') {
    if (sheetmetalStatus === 'delivered' && sheetmetalDeliveredDate) {
      candidateDates.push(sheetmetalDeliveredDate);
    } else if (sheetmetalStatus === 'ordered_with_eta' && sheetmetalExpectedDate) {
      candidateDates.push(sheetmetalExpectedDate);
    } else {
      return null;
    }
  }

  if (materialRequirement === 'both' || materialRequirement === 'switchgear_only') {
    if (switchgearStatus === 'delivered' && switchgearDeliveredDate) {
      candidateDates.push(switchgearDeliveredDate);
    } else if (switchgearStatus === 'ordered_with_eta' && switchgearExpectedDate) {
      candidateDates.push(switchgearExpectedDate);
    } else {
      return null;
    }
  }

  if (materialRequirement === 'unknown' || candidateDates.length === 0) {
    return null;
  }

  candidateDates.sort();
  const latestDate = candidateDates[candidateDates.length - 1];
  return latestDate < referenceDateStr ? referenceDateStr : latestDate;
}

/**
 * Backward compatibility alias for calculateEstimatedMaterialStart
 */
export const calculateEarliestMaterialFeasibleStart = calculateEstimatedMaterialStart;


/**
 * Infers default material requirement if not explicitly confirmed by a planner.
 */
export function inferDefaultMaterialRequirement(
  hasSheetmetalActivity: boolean,
  hasSwitchgearActivity: boolean,
  projectType?: string | null
): MaterialRequirementType {
  if (projectType === 'Out Sourced (OS)') {
    return 'neither';
  }
  if (hasSheetmetalActivity && hasSwitchgearActivity) {
    return 'both';
  }
  return 'unknown';
}

/**
 * Assesses complete production readiness and planning dates for a project.
 */
export function assessProjectReadiness(
  project: {
    id: number;
    projectNumber: string;
    name: string;
    clientName: string;
    projectManager: string;
    deliveryDate: string | null;
    projectType?: string | null;
    scheduledStart: string | null;
    forecastRemainingHours: number;
    drawingApprovalDate: string | null;
    expectedDrawingApprovalDate?: string | null;
    sheetmetalOrderedDate: string | null;
    sheetmetalDeliveredDate: string | null;
    switchgearOrderedDate: string | null;
    switchgearDeliveredDate: string | null;
  },
  plannerConfirmations: Record<string, ProjectMaterialConfirmation>,
  projectPOs: LinkedPurchaseOrder[],
  settings: CapacitySettingsV2,
  referenceDateStr: string
): ProjectReadinessAssessment {
  const isOutSourced = project.projectType ? (
    project.projectType === 'Out Sourced (OS)' || 
    project.projectType.toLowerCase().includes('outsourced') || 
    project.projectType.toLowerCase().includes('out sourced')
  ) : false;
  const isZeroRemaining = project.forecastRemainingHours <= 0;

  // 1. Determine material requirement
  const confirmation = plannerConfirmations[String(project.id)];
  const isRequirementConfirmed = !!confirmation && confirmation.requirement !== undefined;
  
  const hasSmActivity = !!project.sheetmetalOrderedDate || !!project.sheetmetalDeliveredDate || 
    projectPOs.some(po => (po.supplierName?.toLowerCase().includes('sheet') || po.supplierName?.toLowerCase().includes('metal') || po.supplierName?.toLowerCase().includes('hi switch')));
  const hasSgActivity = !!project.switchgearOrderedDate || !!project.switchgearDeliveredDate || 
    projectPOs.some(po => (po.supplierName?.toLowerCase().includes('schneider') || po.supplierName?.toLowerCase().includes('nhp') || po.supplierName?.toLowerCase().includes('switchgear')));

  const materialRequirement: MaterialRequirementType = isRequirementConfirmed
    ? confirmation.requirement
    : inferDefaultMaterialRequirement(hasSmActivity, hasSgActivity, project.projectType);

  // 2. Assess Drawing Status
  let drawingStatus: DrawingReadiness = 'missing';
  if (project.drawingApprovalDate) {
    drawingStatus = 'approved';
  } else if (project.expectedDrawingApprovalDate) {
    drawingStatus = 'pending_approval';
  }

  // 3. Derive Sheetmetal Status & ETA
  let sheetmetalStatus: MaterialItemStatus = 'unknown';
  let sheetmetalExpectedDate: string | null = null;

  if (materialRequirement === 'switchgear_only' || materialRequirement === 'neither' || isOutSourced) {
    sheetmetalStatus = 'not_required';
  } else if (project.sheetmetalDeliveredDate) {
    sheetmetalStatus = 'delivered';
  } else {
    const smPOs = projectPOs.filter(po => 
      po.supplierName?.toLowerCase().includes('sheet') || 
      po.supplierName?.toLowerCase().includes('metal') ||
      po.supplierName?.toLowerCase().includes('hi switch')
    );
    const allSmReceived = smPOs.length > 0 && smPOs.every(po => po.status.toLowerCase() === 'received');
    
    if (allSmReceived) {
      sheetmetalStatus = 'delivered';
    } else if (project.sheetmetalOrderedDate || smPOs.length > 0) {
      const expectedDates = smPOs
        .map(po => po.expectedDate)
        .filter((d): d is string => !!d)
        .sort();
      sheetmetalExpectedDate = expectedDates.length > 0 ? expectedDates[expectedDates.length - 1] : null;
      sheetmetalStatus = sheetmetalExpectedDate ? 'ordered_with_eta' : 'ordered_no_eta';
    } else {
      sheetmetalStatus = materialRequirement === 'unknown' ? 'unknown' : 'not_ordered';
    }
  }

  // 4. Derive Switchgear Status & ETA
  let switchgearStatus: MaterialItemStatus = 'unknown';
  let switchgearExpectedDate: string | null = null;

  if (materialRequirement === 'sheetmetal_only' || materialRequirement === 'neither' || isOutSourced) {
    switchgearStatus = 'not_required';
  } else if (project.switchgearDeliveredDate) {
    switchgearStatus = 'delivered';
  } else {
    const sgPOs = projectPOs.filter(po => 
      po.supplierName?.toLowerCase().includes('schneider') || 
      po.supplierName?.toLowerCase().includes('nhp') ||
      po.supplierName?.toLowerCase().includes('switchgear') ||
      po.supplierName?.toLowerCase().includes('abb')
    );
    const allSgReceived = sgPOs.length > 0 && sgPOs.every(po => po.status.toLowerCase() === 'received');

    if (allSgReceived) {
      switchgearStatus = 'delivered';
    } else if (project.switchgearOrderedDate || sgPOs.length > 0) {
      const expectedDates = sgPOs
        .map(po => po.expectedDate)
        .filter((d): d is string => !!d)
        .sort();
      switchgearExpectedDate = expectedDates.length > 0 ? expectedDates[expectedDates.length - 1] : null;
      switchgearStatus = switchgearExpectedDate ? 'ordered_with_eta' : 'ordered_no_eta';
    } else {
      switchgearStatus = materialRequirement === 'unknown' ? 'unknown' : 'not_ordered';
    }
  }

  // 5. Stage-Specific Readiness Flags
  const isSmSatisfied = sheetmetalStatus === 'delivered' || sheetmetalStatus === 'not_required';
  const isSgSatisfied = switchgearStatus === 'delivered' || switchgearStatus === 'not_required';
  const isDrawingsApproved = drawingStatus === 'approved';

  const canStartFraming = isDrawingsApproved && isSmSatisfied;
  const canStartMountingAndWiring = isDrawingsApproved && isSmSatisfied && isSgSatisfied;

  // 6. Overall Manufacturing Readiness & Blocking Reasons
  const blockingReasons: string[] = [];
  let manufacturingReadiness: ManufacturingReadinessStatus = 'readiness_unknown';

  if (isOutSourced) {
    manufacturingReadiness = 'outsourced_job';
    blockingReasons.push('Out Sourced project - manufactured externally');
  } else if (isZeroRemaining) {
    manufacturingReadiness = 'zero_remaining_review';
    blockingReasons.push('0 or negative remaining hours - completed or awaiting PM closeout');
  } else if (!isDrawingsApproved) {
    blockingReasons.push(drawingStatus === 'pending_approval' ? 'Drawings awaiting approval' : 'Drawings missing or not submitted');
    manufacturingReadiness = 'blocked_by_drawings';
  } else if (materialRequirement === 'unknown') {
    blockingReasons.push('Material requirements unconfirmed by planner');
    manufacturingReadiness = 'readiness_unknown';
  } else if (!isSmSatisfied && !isSgSatisfied) {
    blockingReasons.push('Sheetmetal awaiting delivery');
    blockingReasons.push('Switchgear awaiting delivery');
    manufacturingReadiness = 'blocked_by_both';
  } else if (!isSmSatisfied) {
    blockingReasons.push('Sheetmetal awaiting delivery');
    manufacturingReadiness = 'blocked_by_sheetmetal';
  } else if (!isSgSatisfied) {
    blockingReasons.push('Switchgear awaiting delivery');
    manufacturingReadiness = (materialRequirement === 'both' && canStartFraming)
      ? 'ready_for_framing_only'
      : 'blocked_by_switchgear';
  } else {
    manufacturingReadiness = 'ready_for_production';
  }

  // 7. Backward Planning & Distinct Forward Dates (Audited Requirement C)
  const latestRequiredManufacturingStartDate = calculateRequiredProductionStart(
    project.deliveryDate,
    project.forecastRemainingHours,
    settings,
    0 // Audited: testing/packaging labour already in task hours
  );

  const earliestConfirmedMaterialStartDate = calculateConfirmedMaterialStart(
    drawingStatus,
    project.drawingApprovalDate,
    materialRequirement,
    sheetmetalStatus,
    project.sheetmetalDeliveredDate,
    switchgearStatus,
    project.switchgearDeliveredDate,
    referenceDateStr
  );

  const earliestEstimatedMaterialStartDate = calculateEstimatedMaterialStart(
    drawingStatus,
    project.drawingApprovalDate,
    materialRequirement,
    sheetmetalStatus,
    project.sheetmetalDeliveredDate,
    sheetmetalExpectedDate,
    switchgearStatus,
    project.switchgearDeliveredDate,
    switchgearExpectedDate,
    referenceDateStr
  );

  const approvedScheduledStartDate = project.scheduledStart;

  // 8. Conflicts
  const isStartDateOverdue = !!latestRequiredManufacturingStartDate && latestRequiredManufacturingStartDate < referenceDateStr;
  
  const isMaterialDelayConflict = !!latestRequiredManufacturingStartDate && 
    !!earliestEstimatedMaterialStartDate && 
    earliestEstimatedMaterialStartDate > latestRequiredManufacturingStartDate;

  const isMaterialUnconfirmedRisk = !!latestRequiredManufacturingStartDate &&
    latestRequiredManufacturingStartDate >= referenceDateStr &&
    earliestConfirmedMaterialStartDate === null &&
    (sheetmetalStatus === 'ordered_no_eta' || switchgearStatus === 'ordered_no_eta' || materialRequirement === 'unknown');

  const overduePOs = projectPOs.filter(po => po.isOverdueETA);
  const inFlightPOs = projectPOs.filter(po => po.status.toLowerCase() !== 'received');

  return {
    projectId: project.id,
    projectNumber: project.projectNumber,
    name: project.name,
    clientName: project.clientName,
    projectManager: project.projectManager,
    deliveryDate: project.deliveryDate,
    projectType: project.projectType || null,
    scheduledStart: project.scheduledStart,
    forecastRemainingHours: project.forecastRemainingHours,

    materialRequirement,
    isRequirementConfirmed,
    confirmationDetails: confirmation,

    drawingStatus,
    drawingApprovalDate: project.drawingApprovalDate,
    expectedDrawingApprovalDate: project.expectedDrawingApprovalDate ?? null,

    sheetmetalStatus,
    sheetmetalOrderedDate: project.sheetmetalOrderedDate,
    sheetmetalDeliveredDate: project.sheetmetalDeliveredDate,
    sheetmetalExpectedDate,

    switchgearStatus,
    switchgearOrderedDate: project.switchgearOrderedDate,
    switchgearDeliveredDate: project.switchgearDeliveredDate,
    switchgearExpectedDate,

    manufacturingReadiness,
    blockingReasons,

    canStartFraming,
    canStartMountingAndWiring,

    latestRequiredManufacturingStartDate,
    earliestConfirmedMaterialStartDate,
    earliestEstimatedMaterialStartDate,
    approvedScheduledStartDate,

    requiredProductionStartDate: latestRequiredManufacturingStartDate,
    earliestMaterialFeasibleStartDate: earliestConfirmedMaterialStartDate || earliestEstimatedMaterialStartDate,

    isStartDateOverdue,
    isMaterialDelayConflict,
    isMaterialUnconfirmedRisk,
    isSupplierEtaOverdue: overduePOs.length > 0,

    purchaseOrders: projectPOs,
    hasInFlightPOs: inFlightPOs.length > 0,
    delayedPOCount: overduePOs.length,
  };
}

/**
 * Aggregates supplier delivery intelligence metrics across active purchase orders.
 */
export function buildSupplierIntelligenceSummary(
  allPOs: LinkedPurchaseOrder[],
  projectMap: Map<number, { projectNumber: string; name: string }>,
  referenceDateStr: string
): SupplierIntelligenceSummary {
  const inFlightPOs = allPOs.filter(po => po.status.toLowerCase() !== 'received');
  const overdueInFlightPOs = inFlightPOs.filter(po => po.isOverdueETA);
  const inFlightMissingEta = inFlightPOs.filter(po => !po.expectedDate);

  const totalInFlightValue = inFlightPOs.reduce((acc, po) => acc + (po.total || 0), 0);
  const overdueInFlightValue = overdueInFlightPOs.reduce((acc, po) => acc + (po.total || 0), 0);

  // Group by supplier
  const supplierGroups = new Map<string, {
    inFlightCount: number;
    inFlightValue: number;
    overdueCount: number;
    missingEtaCount: number;
    varianceList: number[];
  }>();

  for (const po of allPOs) {
    const sName = po.supplierName?.trim() || 'Unspecified Supplier';
    const existing = supplierGroups.get(sName) || {
      inFlightCount: 0,
      inFlightValue: 0,
      overdueCount: 0,
      missingEtaCount: 0,
      varianceList: [],
    };

    if (po.status.toLowerCase() !== 'received') {
      existing.inFlightCount++;
      existing.inFlightValue += (po.total || 0);
      if (po.isOverdueETA) {
        existing.overdueCount++;
      }
      if (!po.expectedDate) {
        existing.missingEtaCount++;
      }
    }

    if (po.varianceDays !== null) {
      existing.varianceList.push(po.varianceDays);
    }

    supplierGroups.set(sName, existing);
  }

  const topSuppliers = Array.from(supplierGroups.entries())
    .map(([supplierName, data]) => {
      const avgVariance = data.varianceList.length > 0
        ? Math.round(data.varianceList.reduce((a, b) => a + b, 0) / data.varianceList.length)
        : null;

      return {
        supplierName,
        inFlightCount: data.inFlightCount,
        inFlightValue: Math.round(data.inFlightValue * 100) / 100,
        overdueCount: data.overdueCount,
        missingEtaCount: data.missingEtaCount,
        avgVarianceDays: avgVariance,
      };
    })
    .filter(s => s.inFlightCount > 0 || s.avgVarianceDays !== null)
    .sort((a, b) => b.inFlightValue - a.inFlightValue)
    .slice(0, 10);

  const recentDelayedPOs = overdueInFlightPOs
    .filter(po => po.expectedDate)
    .map(po => {
      const proj = projectMap.get(po.projectId);
      const daysOverdue = po.varianceDays ? Math.max(1, po.varianceDays) : 1;

      return {
        poId: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        projectNumber: proj?.projectNumber || 'N/A',
        projectName: proj?.name || 'N/A',
        expectedDate: po.expectedDate!,
        daysOverdue,
        total: po.total || 0,
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 15);

  const affectedProjectIds = new Set(overdueInFlightPOs.map(po => po.projectId));

  return {
    totalInFlightPOs: inFlightPOs.length,
    totalInFlightValue: Math.round(totalInFlightValue * 100) / 100,
    inFlightMissingEtaCount: inFlightMissingEta.length,
    overdueInFlightPOsCount: overdueInFlightPOs.length,
    overdueInFlightValue: Math.round(overdueInFlightValue * 100) / 100,
    affectedProjectsCount: affectedProjectIds.size,
    topSuppliers,
    recentDelayedPOs,
  };
}
