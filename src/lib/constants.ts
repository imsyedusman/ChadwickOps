export const ACTIVE_PROJECT_STATUSES = [
  'Not Drawn',
  'Drawings Submitted',
  'Drawings Approved',
  'Sheetmetal and Switchgear Ordered',
  'In Progress',
  'Ready for Testing',
  'Tested Defective',
  'On Hold',
  'Waiting to Start',
  'Tested Passed',
  'Ready for Invoicing'
] as const;

export type ActiveProjectStatus = typeof ACTIVE_PROJECT_STATUSES[number];

/**
 * Canonical WorkGuru project statuses in standard workflow order.
 * - '2.1 - Sheetmetal and switchgear ordrered' preserves WorkGuru's actual spelling.
 * - '2.4 - Tested Defective' and '2.4 - Tested Passed' are distinct statuses sharing numeric prefix 2.4.
 * - Includes legacy / terminal statuses configured in WorkGuru.
 */
export const WORKGURU_PROJECT_STATUSES = [
  '1.1 - Not Drawn',
  '1.2 - Drawings Submitted',
  '1.3 - Drawings Approved',
  '2.1 - Sheetmetal and switchgear ordrered',
  '2.2 - In Progress',
  '2.3 - Ready for Testing',
  '2.4 - Tested Defective',
  '2.4 - Tested Passed',
  '2.6 - Ready for Invoicing',
  '3.1 - Invoiced',
  '3.2 - Delivered',
  'Waiting to Start',
  'On Hold',
  'Cancelled',
  'Completed',
] as const;

export type WorkGuruProjectStatus = typeof WORKGURU_PROJECT_STATUSES[number];

/**
 * Normalizes WorkGuru status strings by removing numeric prefixes and fixing typos.
 */
export function normalizeStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  
  // 1. Remove numeric prefix like "1.1 - " or "2.2.1 - "
  let normalized = status.replace(/^[\d.]+ - /, '').trim();
  
  // 2. Handle specific typos or inconsistent naming from WorkGuru
  const lower = normalized.toLowerCase();
  
  if (lower.includes('sheetmetal') && (lower.includes('ordrered') || lower.includes('ordered'))) {
    return 'Sheetmetal and Switchgear Ordered';
  }

  // 3. Title Case mapping for known variations to ensure they match ACTIVE_PROJECT_STATUSES
  if (lower === 'not drawn') return 'Not Drawn';
  if (lower === 'drawings submitted') return 'Drawings Submitted';
  if (lower === 'drawings approved') return 'Drawings Approved';
  if (lower === 'in progress') return 'In Progress';
  if (lower === 'ready for testing') return 'Ready for Testing';
  if (lower === 'tested defective') return 'Tested Defective';
  if (lower === 'on hold') return 'On Hold';
  if (lower === 'waiting to start') return 'Waiting to Start';
  if (lower === 'tested passed') return 'Tested Passed';
  if (lower === 'ready for invoicing') return 'Ready for Invoicing';
  
  return normalized;
}
