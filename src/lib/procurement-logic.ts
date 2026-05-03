import { addDays, isBefore, startOfDay } from "date-fns";

export const PROCUREMENT_STATUSES = [
  'Not Started',
  'Ordering',
  'Partially Ordered',
  'Fully Ordered',
  'Partially Delivered',
  'Delivered',
  'Delayed',
  'On Hold'
] as const;

export type ProcurementStatus = typeof PROCUREMENT_STATUSES[number];

export const SUPPLIER_DELIVERY_STATUSES = [
  'Ordered',
  'Partially Delivered',
  'Delivered',
  'Delayed'
] as const;

export type SupplierDeliveryStatus = typeof SUPPLIER_DELIVERY_STATUSES[number];

export type ProcurementRisk = 'ON_TRACK' | 'AT_RISK' | 'DELAYED';

export interface Supplier {
  expectedDeliveryDate?: Date | string | null;
  deliveryStatus?: string | null;
}

export interface ProjectForProcurement {
  procurementStatus: string | null;
  suppliers?: Supplier[];
}

/**
 * Calculates procurement risk based on supplier-level data.
 * Returns both the risk level and a human-readable reason.
 */
export function calculateProcurementRisk(project: ProjectForProcurement): { risk: ProcurementRisk; reason: string } {
  const { procurementStatus, suppliers = [] } = project;
  const now = startOfDay(new Date());
  const riskThresholdDays = 3;

  if (procurementStatus === 'Delayed') {
    return { risk: 'DELAYED', reason: 'Project status set to Delayed' };
  }

  let hasAtRisk = false;
  let riskReason = 'All deliveries on schedule';

  for (const supplier of suppliers) {
    if (!supplier.expectedDeliveryDate) continue;

    const expectedDate = startOfDay(new Date(supplier.expectedDeliveryDate));
    const isDelivered = supplier.deliveryStatus === 'Delivered';

    // Delayed: Overdue and not delivered
    if (!isDelivered && isBefore(expectedDate, now)) {
      return { risk: 'DELAYED', reason: 'One or more suppliers overdue' };
    }

    // At Risk: Partially Delivered or nearing expected date
    if (!isDelivered) {
      if (supplier.deliveryStatus === 'Partially Delivered') {
        hasAtRisk = true;
        riskReason = 'Supplier partially delivered';
      }

      const thresholdDate = addDays(now, riskThresholdDays);
      if (isBefore(expectedDate, thresholdDate)) {
        hasAtRisk = true;
        riskReason = 'Supplier due within 3 days';
      }
    }
  }

  // Also check project-level status for "Partially" states
  if (procurementStatus === 'Partially Ordered' || procurementStatus === 'Partially Delivered') {
    hasAtRisk = true;
    riskReason = `Project is ${procurementStatus.toLowerCase()}`;
  }

  if (suppliers.length === 0) {
    return { risk: 'ON_TRACK', reason: 'No suppliers tracked' };
  }

  return { risk: hasAtRisk ? 'AT_RISK' : 'ON_TRACK', reason: hasAtRisk ? riskReason : 'All deliveries on schedule' };
}

/**
 * Generates a human-readable summary of project suppliers for the main table view.
 */
export function getSupplierSummary(suppliers: Supplier[]): string {
  if (!suppliers || suppliers.length === 0) return "No suppliers tracked";

  const total = suppliers.length;
  const delivered = suppliers.filter(s => s.deliveryStatus === 'Delivered').length;
  const delayed = suppliers.filter(s => s.deliveryStatus === 'Delayed').length;
  const partial = suppliers.filter(s => s.deliveryStatus === 'Partially Delivered').length;

  if (delivered === total) return "All delivered";
  
  const parts = [];
  parts.push(`${total} supplier${total > 1 ? 's' : ''}`);
  
  if (delayed > 0) parts.push(`${delayed} delayed`);
  else if (partial > 0) parts.push(`${partial} partial`);
  else if (delivered > 0) parts.push(`${delivered} delivered`);
  
  return parts.join(' · ');
}
