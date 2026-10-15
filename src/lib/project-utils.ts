import { normalizeStatus } from './constants';

/**
 * Logic for identifying unproductive/junk projects.
 * Any project number starting with "99" is considered Internal (Leave, Non-project work).
 */

export interface ProjectMinimal {
  projectNumber: string | null;
}

/**
 * Returns true if the project is considered productive (billable/client work).
 * Returns false if it's Internal/Leave (starts with "99") or missing a number.
 */
export function isProductiveProject(projectNumber: string | null): boolean {
  if (!projectNumber) return false;
  const projectNo = projectNumber.toString().trim();
  return !projectNo.startsWith('99');
}

/**
 * Categorizes a project for easier aggregation.
 */
export function getProjectCategory(projectNumber: string | null): 'Productive' | 'Internal' {
  return isProductiveProject(projectNumber) ? 'Productive' : 'Internal';
}

/**
 * Informational list of statuses representing active production work.
 * Used for UI display and help documentation.
 */
export const ACTIVE_STATUSES = [
  'Not Drawn',
  'Drawings Submitted',
  'Drawings Approved',
  'Ordered',
  'Sheetmetal and Switchgear Ordered',
  'In Progress',
  'Ready for Testing',
  'Tested Defective',
  'On Hold',
  'Waiting to Start',
  'Tested Passed',
  'Ready for Invoicing',
  'Invoiced'
];

/**
 * Explicit list of statuses to EXCLUDE from WIP Totals and Active views.
 * These represent finished, cancelled, or delivered work.
 */
export const EXCLUDED_WIP_STATUSES = [
  'Delivered',
  'Completed',
  'Cancelled'
];

/**
 * Returns true if the project status represents active production work (WIP).
 * Handles WorkGuru prefixes like "1.1 - Not Drawn" or "2.1 - Sheetmetal and switchgear ordrered"
 * by cleaning and normalizing the status string using shared normalization rules.
 * Normalizes case and trimming to ensure robust matching.
 */
export function isActiveWorkStatus(status: string | null): boolean {
  if (!status) return false;

  // Use shared normalization to strip numeric prefixes, handle typos like "ordrered", etc.
  const normalized = normalizeStatus(status).trim().toLowerCase();

  // Explicitly ensure finished/cancelled statuses are excluded
  if (EXCLUDED_WIP_STATUSES.some(s => s.toLowerCase() === normalized)) {
    return false;
  }

  // Check against active list (more precise than checking exclusions)
  return ACTIVE_STATUSES.some(s => s.toLowerCase() === normalized);
}


/**
 * Tooltip explaining what "Internal" means in the context of the dashboard.
 */
export const INTERNAL_WORK_DESCRIPTION = "Internal projects (starting with 99xxx) such as Leave, Training, or Non-project work. These are excluded from capacity and utilization metrics.";
