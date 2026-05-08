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
