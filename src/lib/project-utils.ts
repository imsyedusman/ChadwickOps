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
  return !projectNumber.trim().startsWith('99');
}

/**
 * Categorizes a project for easier aggregation.
 */
export function getProjectCategory(projectNumber: string | null): 'Productive' | 'Internal' {
  return isProductiveProject(projectNumber) ? 'Productive' : 'Internal';
}

/**
 * Tooltip explaining what "Internal" means in the context of the dashboard.
 */
export const INTERNAL_WORK_DESCRIPTION = "Internal projects (starting with 99xxx) such as Leave, Training, or Non-project work. These are excluded from capacity and utilization metrics.";
