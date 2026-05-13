import { addDays, isBefore, startOfDay, differenceInDays, format } from "date-fns";

/**
 * Standardized Date Formatter for Procurement
 * Format: 11-May-2026
 */
export function formatProcurementDate(date: Date | null | undefined): string {
  if (!date) return '--';
  return format(new Date(date), 'dd-MMM-yyyy');
}

/**
 * Operational Action Types - Simplified for practical investigation.
 */
export type ProcurementActionType = 
  | 'ACTION_ESCALATE'      // Delivery Risk
  | 'ACTION_FOLLOW_UP'     // Supplier Delay
  | 'ACTION_CONFIRM_ETA'   // Missing ETA
  | 'ACTION_MONITOR'       // Delayed Materials (Partial)
  | 'ACTION_AWAITING'      // Awaiting Materials (On Track)
  | 'ACTION_NONE';         // Completed

export type ProcurementSeverity = 1 | 2 | 3 | 4;

export interface ProcurementActionMetadata {
  type: ProcurementActionType;
  severity: ProcurementSeverity;
  label: string;
  description: string;
  actionRequired: string;
  reason: string; // Explaining "Why"
  color: string;
  bgTint: string;
}

export interface POLineSummary {
  workguruId: string;
  poNumber: string;
  supplierName: string;
  name: string;
  quantity: number;
  receivedQuantity: number;
  unitPrice: number;
  expectedDate: Date | null;
  issueDate?: Date | null;
}

export interface ProjectProcurementContext {
  projectNumber: string;
  deliveryDate: Date | null;
  poLines: POLineSummary[];
}

export const ACTION_METADATA: Record<ProcurementActionType, ProcurementActionMetadata> = {
  ACTION_ESCALATE: {
    type: 'ACTION_ESCALATE',
    severity: 1,
    label: 'Delivery Risk',
    description: 'Material expected after project delivery date.',
    actionRequired: 'Escalate delay',
    reason: 'Supplier ETA exceeds project delivery date',
    color: '#b91c1c', // Dark Red
    bgTint: '#fef2f2'  // Soft Red Tint
  },
  ACTION_FOLLOW_UP: {
    type: 'ACTION_FOLLOW_UP',
    severity: 2,
    label: 'Supplier Delay',
    description: 'Expected delivery date has passed.',
    actionRequired: 'Follow up supplier',
    reason: 'Expected date has passed',
    color: '#b45309', // Dark Amber
    bgTint: '#fffbeb'  // Soft Amber Tint
  },
  ACTION_CONFIRM_ETA: {
    type: 'ACTION_CONFIRM_ETA',
    severity: 2,
    label: 'Missing ETA',
    description: 'No expected delivery date provided.',
    actionRequired: 'Request ETA',
    reason: 'Waiting on supplier confirmation',
    color: '#7e22ce', // Dark Purple
    bgTint: '#faf5ff'  // Soft Purple Tint
  },
  ACTION_MONITOR: {
    type: 'ACTION_MONITOR',
    severity: 3,
    label: 'Delayed Materials',
    description: 'Partially received but incomplete.',
    actionRequired: 'Monitor delivery',
    reason: 'Partially received from supplier',
    color: '#1d4ed8', // Dark Blue
    bgTint: '#eff6ff'  // Soft Blue Tint
  },
  ACTION_AWAITING: {
    type: 'ACTION_AWAITING',
    severity: 4,
    label: 'Awaiting Materials',
    description: 'On track for delivery.',
    actionRequired: 'On track',
    reason: 'Items ordered but not yet received',
    color: '#334155', // Dark Slate
    bgTint: '#f8fafc'  // Soft Slate Tint
  },
  ACTION_NONE: {
    type: 'ACTION_NONE',
    severity: 4,
    label: 'Completed',
    description: 'Fully received.',
    actionRequired: 'Received',
    reason: 'All materials successfully received',
    color: '#047857', // Dark Green
    bgTint: '#ecfdf5'  // Soft Green Tint
  }
};

/**
 * Calculates aging days for a procurement line.
 */
export function calculateAgingDays(date: Date | null | undefined): number {
  if (!date) return 0;
  const now = startOfDay(new Date());
  const target = startOfDay(new Date(date));
  
  if (isBefore(target, now)) {
    return differenceInDays(now, target);
  }
  return 0;
}

/**
 * Calculates the monetary cost for outstanding materials.
 */
export function calculateOutstandingValue(quantity: number, receivedQuantity: number, unitPrice: number): number {
  const outstandingQty = Math.max(0, quantity - receivedQuantity);
  return outstandingQty * unitPrice;
}

/**
 * Determines the Operational Action for a single material line.
 */
export function determineLineAction(line: POLineSummary, projectDeliveryDate: Date | null): ProcurementActionMetadata {
  const outstandingQty = line.quantity - line.receivedQuantity;
  const now = startOfDay(new Date());

  if (outstandingQty <= 0) return ACTION_METADATA.ACTION_NONE;

  // 1. Delivery Risk (Priority 1)
  if (projectDeliveryDate && line.expectedDate && isBefore(startOfDay(projectDeliveryDate), startOfDay(line.expectedDate))) {
    return ACTION_METADATA.ACTION_ESCALATE;
  }

  // 2. Delayed (Priority 2)
  if (line.expectedDate && isBefore(startOfDay(line.expectedDate), now)) {
    return ACTION_METADATA.ACTION_FOLLOW_UP;
  }

  // 3. Missing ETA (Priority 2)
  if (!line.expectedDate) {
    return ACTION_METADATA.ACTION_CONFIRM_ETA;
  }

  // 4. Partial Receipt (Priority 3)
  if (line.receivedQuantity > 0) {
    return ACTION_METADATA.ACTION_MONITOR;
  }

  // 5. Default: Awaiting Delivery
  return ACTION_METADATA.ACTION_AWAITING;
}

/**
 * Aggregates risk for a project context.
 */
export function calculateProjectProcurementRisk(context: ProjectProcurementContext) {
  const { deliveryDate, poLines } = context;
  const actions = poLines.map(line => determineLineAction(line, deliveryDate));
  
  // Find highest severity action
  const topAction = actions.reduce((prev, curr) => {
    if (curr.severity < prev.severity) return curr;
    return prev;
  }, ACTION_METADATA.ACTION_NONE);

  return topAction;
}

export const PROCUREMENT_STATUSES = [
  'Awaiting Info',
  'On Track',
  'Issue Identified',
  'Escalated',
  'Delayed',
  'Completed'
] as const;

export const SUPPLIER_DELIVERY_STATUSES = [
  'Ordered',
  'Partially Delivered',
  'Delivered',
  'Delayed'
] as const;

export type ProcurementRisk = 'DELAYED' | 'AT_RISK' | 'ON_TRACK';

/**
 * Operational PO Statuses - Derived from delivery state, not ERP status.
 */
export type OperationalPOStatus = 
  | 'FULLY_RECEIVED'     // ✅ Fully Received
  | 'PARTIALLY_RECEIVED' // 🟠 Partially Received
  | 'AWAITING_MATERIALS' // 🔵 Awaiting Materials
  | 'DELIVERY_DELAYED';  // 🔴 Delivery Delayed

export interface OperationalPOStatusMetadata {
  status: OperationalPOStatus;
  label: string;
  color: string;
  bgTint: string;
}

export const OPERATIONAL_PO_METADATA: Record<OperationalPOStatus, OperationalPOStatusMetadata> = {
  FULLY_RECEIVED: {
    status: 'FULLY_RECEIVED',
    label: 'Fully Received',
    color: '#059669', // Emerald 600
    bgTint: '#ecfdf5'
  },
  PARTIALLY_RECEIVED: {
    status: 'PARTIALLY_RECEIVED',
    label: 'Partially Received',
    color: '#d97706', // Amber 600
    bgTint: '#fffbeb'
  },
  AWAITING_MATERIALS: {
    status: 'AWAITING_MATERIALS',
    label: 'Awaiting Materials',
    color: '#2563eb', // Blue 600
    bgTint: '#eff6ff'
  },
  DELIVERY_DELAYED: {
    status: 'DELIVERY_DELAYED',
    label: 'Supplier Delay',
    color: '#dc2626', // Red 600
    bgTint: '#fef2f2'
  }
};

/**
 * Determines the Operational truth for a PO based on line item state.
 */
export function determineOperationalPOStatus(lines: POLineSummary[]): OperationalPOStatusMetadata {
  if (lines.length === 0) return OPERATIONAL_PO_METADATA.AWAITING_MATERIALS;

  const totalOrdered = lines.reduce((acc, l) => acc + l.quantity, 0);
  const totalReceived = lines.reduce((acc, l) => acc + l.receivedQuantity, 0);
  const now = startOfDay(new Date());

  // 1. Fully Received (Truth: Everything is in hand)
  if (totalReceived >= totalOrdered && totalOrdered > 0) {
    return OPERATIONAL_PO_METADATA.FULLY_RECEIVED;
  }

  // 2. Delivery Delayed (Truth: Outstanding items exist and ETA has passed)
  const isOverdue = lines.some(l => 
    (l.quantity > l.receivedQuantity) && 
    l.expectedDate && 
    isBefore(startOfDay(new Date(l.expectedDate)), now)
  );
  if (isOverdue) {
    return OPERATIONAL_PO_METADATA.DELIVERY_DELAYED;
  }

  // 3. Partially Received (Truth: Something has arrived, but still waiting)
  if (totalReceived > 0) {
    return OPERATIONAL_PO_METADATA.PARTIALLY_RECEIVED;
  }

  // 4. Default: Awaiting Materials (Truth: Nothing has arrived yet)
  return OPERATIONAL_PO_METADATA.AWAITING_MATERIALS;
}

/**
 * Returns a human-readable summary of project suppliers.
 */
export function getSupplierSummary(suppliers: any[]): string {
    if (!suppliers || suppliers.length === 0) return "No Records";
    const delivered = suppliers.filter(s => s.deliveryStatus === 'Delivered').length;
    if (delivered === suppliers.length) return `All ${suppliers.length} Delivered`;
    return `${suppliers.length} Records (${delivered} Del)`;
}
