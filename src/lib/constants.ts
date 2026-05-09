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
 * Normalizes WorkGuru status strings by removing numeric prefixes and fixing typos.
 */
export function normalizeStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  
  // 1. Remove numeric prefix like "1.1 - " or "2.2.1 - "
  let normalized = status.replace(/^[\d.]+ - /, '').trim();
  
  // 2. Handle specific typos or inconsistent naming from WorkGuru
  const lower = normalized.toLowerCase();
  
  if (lower.includes('sheetmetal') && lower.includes('ordrered')) {
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
