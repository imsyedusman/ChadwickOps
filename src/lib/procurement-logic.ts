import { addDays, isBefore, startOfDay } from "date-fns";

export type ProcurementRiskLevel = 
  | 'DELIVERY_RISK'       // ETA > Project Delivery Date
  | 'AT_RISK'             // ETA within 7 days of Project Delivery Date or general concern
  | 'DELAYED_PROCUREMENT' // ETA < Today
  | 'MISSING_ETA'         // Outstanding Qty but no ETA
  | 'ON_TRACK';           // No concerns detected

export interface ProcurementRiskResult {
  level: ProcurementRiskLevel;
  reason: string;
  isActionable: boolean;
}

export interface POLineSummary {
  workguruId: string;
  poNumber: string;
  supplierName: string;
  name: string;
  quantity: number;
  receivedQuantity: number;
  expectedDate: Date | null;
}

export interface ProjectProcurementContext {
  projectNumber: string;
  deliveryDate: Date | null;
  poLines: POLineSummary[];
}

/**
 * Calculates procurement risk based on the refined Phase 2 model.
 * Focuses on operational timing conflicts without using "BLOCKED" terminology.
 */
export function calculateProjectProcurementRisk(context: ProjectProcurementContext): ProcurementRiskResult {
  const { deliveryDate, poLines } = context;
  const now = startOfDay(new Date());
  const atRiskThresholdDays = 7;

  // Filter for lines with outstanding quantities
  const outstandingLines = poLines.filter(line => (line.quantity - line.receivedQuantity) > 0);

  if (outstandingLines.length === 0) {
    return { level: 'ON_TRACK', reason: 'All materials fully received', isActionable: false };
  }

  // 1. Check for DELAYED_PROCUREMENT (ETA in the past)
  const delayedLines = outstandingLines.filter(line => line.expectedDate && isBefore(startOfDay(line.expectedDate), now));
  if (delayedLines.length > 0) {
    return { 
      level: 'DELAYED_PROCUREMENT', 
      reason: `${delayedLines.length} line item(s) are past their expected delivery date.`,
      isActionable: true 
    };
  }

  // 2. Check for DELIVERY_RISK (ETA > Project Delivery Date)
  if (deliveryDate) {
    const projectDelivery = startOfDay(deliveryDate);
    const timingConflictLines = outstandingLines.filter(line => line.expectedDate && isBefore(projectDelivery, startOfDay(line.expectedDate)));
    
    if (timingConflictLines.length > 0) {
      return {
        level: 'DELIVERY_RISK',
        reason: 'Material ETA is currently later than the project delivery target.',
        isActionable: true
      };
    }

    // 3. Check for AT_RISK (ETA within threshold of Project Delivery)
    const thresholdDate = addDays(projectDelivery, -atRiskThresholdDays);
    const nearingDeadlineLines = outstandingLines.filter(line => line.expectedDate && !isBefore(startOfDay(line.expectedDate), thresholdDate));
    
    if (nearingDeadlineLines.length > 0) {
      return {
        level: 'AT_RISK',
        reason: `Materials due within ${atRiskThresholdDays} days of project delivery.`,
        isActionable: true
      };
    }
  }

  // 4. Check for MISSING_ETA
  const missingEtaLines = outstandingLines.filter(line => !line.expectedDate);
  if (missingEtaLines.length > 0) {
    return {
      level: 'MISSING_ETA',
      reason: `${missingEtaLines.length} line item(s) are missing supplier ETAs.`,
      isActionable: true
    };
  }

  return { level: 'ON_TRACK', reason: 'All procurement on schedule', isActionable: false };
}

/**
 * Returns a human-readable definition for each risk level for UI help tooltips.
 */
export function getRiskLevelDefinition(level: ProcurementRiskLevel): string {
  switch (level) {
    case 'DELIVERY_RISK':
      return "Delivery Risk means outstanding materials currently have ETAs later than the project delivery target.";
    case 'AT_RISK':
      return "At Risk means materials are due very close to the project delivery date or there is general timing concern.";
    case 'DELAYED_PROCUREMENT':
      return "Delayed Procurement means the supplier's expected delivery date has already passed.";
    case 'MISSING_ETA':
      return "Missing ETA means the purchase order is active but no expected delivery date has been provided by the supplier.";
    case 'ON_TRACK':
      return "All tracked materials are currently scheduled to arrive before the project delivery date.";
    default:
      return "";
  }
}
