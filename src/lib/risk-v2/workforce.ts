/**
 * Workforce Availability, Team Structures, Leave Administration & Real Capacity Calculations
 * Phase 2B for /risk-v2 Beta.
 * 
 * Business Rules:
 * - Workshop shifts: Mon-Wed 10h, Thu 8h (38h standard week).
 * - Fri-Sun: 0h standard (overtime only).
 * - Team Leaders: Alex Alvarado (ID 2) and Loc Lu (ID 26).
 * - Approved leave reduces capacity; pending leave is tracked as a risk.
 * - Proposed overtime is kept separate from approved capacity.
 * - Conservation of hours: A worker's hours cannot be double-counted across manufacturing stages.
 */

import { CapacitySettingsV2 } from './types';
import { getNswPublicHolidays, parseDateString, formatDateString } from './calendar';

export interface WorkshopSkillRatings {
  frameAssembly: number | null;
  switchgearMount: number | null;
  busbar: number | null;
  wiring: number | null;
  labels: number | null;
  testing: number | null;
  packagingFreight: number | null;
}

export interface WorkshopEmployee {
  id: number;
  workguruId: number | null;
  fullName: string;
  isApprentice: boolean;
  hourlyRate: number;
  skills: WorkshopSkillRatings;
  isActive: boolean;
  isWorkshopStaff: boolean;
  teamId: string | null;
  teamRole: 'leader' | 'member' | 'unassigned';
  isTemporaryLoan?: boolean;
  loanedToTeamId?: string | null;
  loanNotes?: string | null;
}

export interface WorkshopTeam {
  id: string;
  name: string;
  leaderStaffId: number | null;
  leaderName: string | null;
  color: string;
  isActive: boolean;
  description?: string;
}

export type LeaveType = 'annual' | 'sick' | 'unpaid' | 'other';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequestV2 {
  id: string;
  staffId: number;
  staffName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  workingDaysAffected: number;
  isPartialDay: boolean;
  partialHours?: number;
  leaveType: LeaveType;
  status: LeaveStatus;
  notes?: string;
  submittedBy: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export type OvertimeStatus = 'proposed' | 'approved' | 'cancelled';

export interface OvertimeShiftV2 {
  id: string;
  staffId: number;
  staffName: string;
  date: string; // YYYY-MM-DD
  hours: number;
  status: OvertimeStatus;
  associatedProjectId?: number | null;
  associatedProjectNumber?: string | null;
  associatedTeamId?: string | null;
  notes?: string;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface WorkerAssignmentV2 {
  id: number;
  staffId: number;
  projectId: number;
  projectNumber?: string | null;
  projectName?: string | null;
  stage: string;
  assignedHours: number;
  projectedStart: string | null; // YYYY-MM-DD
  projectedEnd: string | null;   // YYYY-MM-DD
  status: string;
}

export interface DayAssignmentItem {
  assignmentId: number;
  projectId: number;
  projectNumber?: string;
  projectName?: string;
  stage: string;
  dailyAssignedHours: number;
}

export interface DayAvailability {
  date: string;
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  dayName: string;
  isStandardWorkDay: boolean;
  standardShiftHours: number;
  isPublicHoliday: boolean;
  holidayName?: string;
  isFactoryClosure: boolean;
  approvedLeaveHours: number;
  pendingLeaveHours: number;
  approvedOvertimeHours: number;
  proposedOvertimeHours: number;
  netAvailableHours: number;
  supervisoryAllowanceHours: number;
  effectiveOnToolsHours: number;
  assignedHours: number;
  remainingSchedulableHours: number;
  isDoubleBooked: boolean;
  assignments: DayAssignmentItem[];
  status: 'available' | 'on_leave' | 'partial_leave' | 'pending_leave' | 'overtime' | 'holiday' | 'off' | 'inactive';
}

export interface EmployeePeriodAvailability {
  employee: WorkshopEmployee;
  days: DayAvailability[];
  standardHours: number;
  approvedLeaveHours: number;
  pendingLeaveHours: number;
  approvedOvertimeHours: number;
  proposedOvertimeHours: number;
  netAvailableHours: number;
  totalAssignedHours: number;
  totalRemainingSchedulableHours: number;
  totalSupervisoryAllowanceHours: number;
  isDoubleBooked: boolean;
}

export interface StageSkillCoverage {
  stageKey: keyof WorkshopSkillRatings;
  stageName: string;
  qualifiedStaffCount: number;
  qualifiedStaff: { staffId: number; fullName: string; rating: number }[];
  potentialQualifiedHours: number; // Sum of qualified workers' total available hours if dedicated to this stage
  unratedStaffCount: number;
  unratedStaff: { staffId: number; fullName: string }[];
  explicitlyUnqualifiedCount: number;
}

export interface TeamCapacitySummary {
  teamId: string;
  teamName: string;
  leaderStaffId: number | null;
  leaderName: string | null;
  memberCount: number;
  standardHours: number;
  approvedLeaveHours: number;
  pendingLeaveHours: number;
  approvedOvertimeHours: number;
  proposedOvertimeHours: number;
  netAvailableHours: number;
}

export interface UpcomingStaffingShortage {
  date: string;
  dayName: string;
  targetHeadcount: number;
  availableHeadcount: number;
  absentHeadcount: number;
  shortageCount: number;
  reasons: string[];
}

export interface WorkforceDashboardData {
  teams: WorkshopTeam[];
  employees: WorkshopEmployee[];
  employeeAvailabilities: EmployeePeriodAvailability[];
  leaveRequests: LeaveRequestV2[];
  overtimeShifts: OvertimeShiftV2[];
  
  // High-Level Capacity Comparison
  manualHeadcountTarget: number; // Default 22
  manualHeadcountCapacityHours: number;
  actualActiveRosterCount: number;
  rosterStandardCapacityHours: number;
  rosterApprovedLeaveImpactHours: number;
  rosterPendingLeaveRiskHours: number;
  rosterApprovedOvertimeHours: number;
  rosterProposedOvertimeHours: number;
  rosterNetAvailableHours: number;
  rosterTotalAssignedHours: number;
  rosterTotalRemainingSchedulableHours: number;
  rosterDoubleBookedCount: number;
  
  teamSummaries: TeamCapacitySummary[];
  stageSkillCoverage: StageSkillCoverage[];
  upcomingShortages: UpcomingStaffingShortage[];
  
  dateRange: {
    startDate: string;
    endDate: string;
    totalDays: number;
    workingDaysCount: number;
  };
}

/**
 * Standard weekly shift hours by day of week (0=Sun, 1=Mon, ..., 6=Sat)
 * Mon-Wed: 10h, Thu: 8h, Fri-Sun: 0h (overtime only)
 */
export function getStandardShiftHours(dayOfWeek: number): number {
  switch (dayOfWeek) {
    case 1: // Monday
    case 2: // Tuesday
    case 3: // Wednesday
      return 10;
    case 4: // Thursday
      return 8;
    case 5: // Friday
    case 6: // Saturday
    case 0: // Sunday
    default:
      return 0;
  }
}

/**
 * Default team structure: Alex's Team and Loc's Team
 */
export const DEFAULT_WORKSHOP_TEAMS: WorkshopTeam[] = [
  {
    id: 'team-alex',
    name: "Alex's Team",
    leaderStaffId: 2, // Alex Alvarado (ID 2 in staff_efficiency)
    leaderName: "Alex Alvarado",
    color: 'emerald',
    isActive: true,
    description: "Workshop assembly team led by Alex Alvarado",
  },
  {
    id: 'team-loc',
    name: "Loc's Team",
    leaderStaffId: 26, // Loc Lu (ID 26 in staff_efficiency)
    leaderName: "Loc Lu",
    color: 'blue',
    isActive: true,
    description: "Workshop assembly team led by Loc Lu",
  },
];

const STAGE_METADATA: { key: keyof WorkshopSkillRatings; name: string }[] = [
  { key: 'frameAssembly', name: 'Stage 04: Frame Assembly' },
  { key: 'switchgearMount', name: 'Stage 05: Switchgear Mount' },
  { key: 'busbar', name: 'Stage 06: Busbar' },
  { key: 'wiring', name: 'Stage 07: Wiring' },
  { key: 'labels', name: 'Stage 08: Labels & Escutcheons' },
  { key: 'testing', name: 'Stage 09: Inspection & Testing' },
  { key: 'packagingFreight', name: 'Stage 10: Packaging & Freight' },
];

/**
 * Calculates daily availability for a single employee over a date range.
 * Considers standard shifts, public holidays, factory closures, approved/pending leave,
 * approved/proposed overtime, team leader supervisory allowances, and existing project worker assignments.
 */
export function calculateEmployeeAvailability(
  employee: WorkshopEmployee,
  startDateStr: string,
  endDateStr: string,
  leaveRequests: LeaveRequestV2[],
  overtimeShifts: OvertimeShiftV2[],
  settings: CapacitySettingsV2,
  workerAssignments: WorkerAssignmentV2[] = []
): EmployeePeriodAvailability {
  const start = parseDateString(startDateStr);
  const end = parseDateString(endDateStr);
  const days: DayAvailability[] = [];

  let totalStandard = 0;
  let totalApprovedLeave = 0;
  let totalPendingLeave = 0;
  let totalApprovedOvertime = 0;
  let totalProposedOvertime = 0;
  let totalNetAvailable = 0;
  let totalAssignedHours = 0;
  let totalRemainingSchedulableHours = 0;
  let totalSupervisoryAllowanceHours = 0;
  let hasAnyDoubleBooking = false;

  // Filter leave and overtime for this employee
  const empLeaves = leaveRequests.filter(l => l.staffId === employee.id && l.status !== 'cancelled' && l.status !== 'rejected');
  const empOvertimes = overtimeShifts.filter(o => o.staffId === employee.id && o.status !== 'cancelled');
  const empAssignments = workerAssignments.filter(a => a.staffId === employee.id && (a.status.toLowerCase() === 'active' || a.status.toLowerCase() === 'in progress'));

  const cursor = new Date(start);
  while (cursor <= end) {
    const dateStr = formatDateString(cursor);
    const dayOfWeek = cursor.getUTCDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek];

    const standardShift = employee.isActive ? getStandardShiftHours(dayOfWeek) : 0;
    const isStandardWorkDay = standardShift > 0;

    // Check NSW Public Holidays
    const holidays = getNswPublicHolidays(cursor.getUTCFullYear());
    const isPublicHoliday = holidays.has(dateStr);
    const holidayName = holidays.get(dateStr);

    // Check Factory Closure
    const isFactoryClosure = settings.factoryClosures.includes(dateStr);

    // Determine Base Available Hours before leave & overtime
    let baseHours = standardShift;
    if (isPublicHoliday || isFactoryClosure || !employee.isActive) {
      baseHours = 0;
    }

    // Leave for this date
    const leavesOnDay = empLeaves.filter(l => l.startDate <= dateStr && l.endDate >= dateStr);
    const approvedLeaves = leavesOnDay.filter(l => l.status === 'approved');
    const pendingLeaves = leavesOnDay.filter(l => l.status === 'pending');

    let approvedLeaveHours = 0;
    let pendingLeaveHours = 0;

    if (baseHours > 0 && approvedLeaves.length > 0) {
      // If any approved leave is full-day, the entire shift is consumed
      const hasFullDayApproved = approvedLeaves.some(l => !l.isPartialDay);
      if (hasFullDayApproved) {
        approvedLeaveHours = baseHours;
      } else {
        // Multi-record partial day stacking capped at baseHours
        const sumPartialApproved = approvedLeaves.reduce((acc, l) => acc + (l.partialHours || 0), 0);
        approvedLeaveHours = Math.min(baseHours, sumPartialApproved);
      }
    }

    // Remaining capacity available to be impacted by pending leave risk
    const remainingBaseHoursAfterApproved = Math.max(0, baseHours - approvedLeaveHours);

    if (remainingBaseHoursAfterApproved > 0 && pendingLeaves.length > 0) {
      const hasFullDayPending = pendingLeaves.some(l => !l.isPartialDay);
      if (hasFullDayPending) {
        pendingLeaveHours = remainingBaseHoursAfterApproved;
      } else {
        const sumPartialPending = pendingLeaves.reduce((acc, l) => acc + (l.partialHours || 0), 0);
        pendingLeaveHours = Math.min(remainingBaseHoursAfterApproved, sumPartialPending);
      }
    }

    // Overtime on this date
    const overtimesOnDay = empOvertimes.filter(o => o.date === dateStr);
    let approvedOT = overtimesOnDay.filter(o => o.status === 'approved').reduce((sum, o) => sum + o.hours, 0);
    const proposedOT = overtimesOnDay.filter(o => o.status === 'proposed').reduce((sum, o) => sum + o.hours, 0);

    // Operational conflict protection: An employee on approved full-day leave cannot simultaneously contribute overtime
    const isFullDayApprovedLeave = approvedLeaveHours >= baseHours && baseHours > 0;
    if (isFullDayApprovedLeave && approvedOT > 0) {
      approvedOT = 0; // Exclude overtime from capacity when employee is completely absent on leave
    }

    // Net Available Hours: Base hours - Approved leave + Approved overtime
    // Configurable technical safety limit (default 16h) prevents invalid data entry (>24h),
    // clearly distinguished from employment rules or guaranteed overtime availability.
    const technicalCeiling = settings.maxDailyHoursCeiling || 16;
    const netAvailableHours = Math.min(technicalCeiling, Math.max(0, baseHours - approvedLeaveHours) + approvedOT);

    // Team Leader supervisory allowance: configurable hours off tools per standard shift for coordination/QA
    const isTeamLeader = employee.teamRole === 'leader';
    const supervisoryAllowanceHours = (isTeamLeader && isStandardWorkDay && employee.isActive && !isPublicHoliday && !isFactoryClosure)
      ? Math.min(netAvailableHours, (settings.teamLeaderSupervisoryAllowanceHours || 0))
      : 0;

    // Effective production on-tools capacity
    const effectiveOnToolsHours = Math.max(0, netAvailableHours - supervisoryAllowanceHours);

    // Existing project assignments covering this date
    const dayAssignments: DayAssignmentItem[] = [];
    let assignedHoursOnDay = 0;

    for (const a of empAssignments) {
      if (!a.projectedStart || !a.projectedEnd) continue;
      if (a.projectedStart <= dateStr && a.projectedEnd >= dateStr) {
        // Calculate working days in assignment window
        const aStart = parseDateString(a.projectedStart);
        const aEnd = parseDateString(a.projectedEnd);
        let workingDaysInSpan = 0;
        const cur = new Date(aStart);
        while (cur <= aEnd) {
          const dow = cur.getUTCDay();
          if (dow >= 1 && dow <= 4) workingDaysInSpan++;
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
        const effectiveWorkingDays = Math.max(1, workingDaysInSpan);
        const isEligibleDay = (dayOfWeek >= 1 && dayOfWeek <= 4) || (a.projectedStart === a.projectedEnd);
        if (isEligibleDay) {
          const dailyHours = Math.round((a.assignedHours / effectiveWorkingDays) * 100) / 100;
          assignedHoursOnDay += dailyHours;
          dayAssignments.push({
            assignmentId: a.id,
            projectId: a.projectId,
            projectNumber: a.projectNumber || undefined,
            projectName: a.projectName || undefined,
            stage: a.stage,
            dailyAssignedHours: dailyHours,
          });
        }
      }
    }

    assignedHoursOnDay = Math.round(assignedHoursOnDay * 100) / 100;

    // Remaining schedulable hours after existing assignments
    const remainingSchedulableHours = Math.max(0, Math.round((effectiveOnToolsHours - assignedHoursOnDay) * 100) / 100);

    // Double-booking detection (assigned hours exceed available on-tools capacity)
    const isDoubleBooked = assignedHoursOnDay > effectiveOnToolsHours;
    if (isDoubleBooked) hasAnyDoubleBooking = true;

    // Determine Day Status
    let status: DayAvailability['status'] = 'available';
    if (!employee.isActive) {
      status = 'inactive';
    } else if (isPublicHoliday || isFactoryClosure) {
      status = 'holiday';
    } else if (approvedLeaveHours >= standardShift && standardShift > 0) {
      status = 'on_leave';
    } else if (approvedLeaveHours > 0) {
      status = 'partial_leave';
    } else if (pendingLeaveHours > 0) {
      status = 'pending_leave';
    } else if (approvedOT > 0 || proposedOT > 0) {
      status = 'overtime';
    } else if (standardShift === 0) {
      status = 'off';
    }

    days.push({
      date: dateStr,
      dayOfWeek,
      dayName,
      isStandardWorkDay,
      standardShiftHours: standardShift,
      isPublicHoliday,
      holidayName,
      isFactoryClosure,
      approvedLeaveHours,
      pendingLeaveHours,
      approvedOvertimeHours: approvedOT,
      proposedOvertimeHours: proposedOT,
      netAvailableHours,
      supervisoryAllowanceHours,
      effectiveOnToolsHours,
      assignedHours: assignedHoursOnDay,
      remainingSchedulableHours,
      isDoubleBooked,
      assignments: dayAssignments,
      status,
    });

    totalStandard += standardShift;
    totalApprovedLeave += approvedLeaveHours;
    totalPendingLeave += pendingLeaveHours;
    totalApprovedOvertime += approvedOT;
    totalProposedOvertime += proposedOT;
    totalNetAvailable += netAvailableHours;
    totalAssignedHours += assignedHoursOnDay;
    totalRemainingSchedulableHours += remainingSchedulableHours;
    totalSupervisoryAllowanceHours += supervisoryAllowanceHours;

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    employee,
    days,
    standardHours: totalStandard,
    approvedLeaveHours: totalApprovedLeave,
    pendingLeaveHours: totalPendingLeave,
    approvedOvertimeHours: totalApprovedOvertime,
    proposedOvertimeHours: totalProposedOvertime,
    netAvailableHours: totalNetAvailable,
    totalAssignedHours: Math.round(totalAssignedHours * 10) / 10,
    totalRemainingSchedulableHours: Math.round(totalRemainingSchedulableHours * 10) / 10,
    totalSupervisoryAllowanceHours: Math.round(totalSupervisoryAllowanceHours * 10) / 10,
    isDoubleBooked: hasAnyDoubleBooking,
  };
}

/**
 * Builds the complete Phase 2B Workforce and Availability Dashboard data.
 */
/**
 * Builds the complete Phase 2B Workforce and Availability Dashboard data.
 * Reconciles individual employee shifts, leave, overtime, supervisory allowances, and project assignments.
 */
export function buildWorkforceDashboardData(
  rawEmployees: WorkshopEmployee[],
  teams: WorkshopTeam[],
  teamAssignments: Record<string, { teamId: string; role: 'leader' | 'member'; isTemporaryLoan?: boolean; loanedToTeamId?: string | null }>,
  leaveRequests: LeaveRequestV2[],
  overtimeShifts: OvertimeShiftV2[],
  startDateStr: string,
  endDateStr: string,
  settings: CapacitySettingsV2,
  workerAssignments: WorkerAssignmentV2[] = []
): WorkforceDashboardData {
  // 1. Enrich employees with team membership
  const employees: WorkshopEmployee[] = rawEmployees.map(emp => {
    const assignment = teamAssignments[String(emp.id)];
    if (assignment) {
      return {
        ...emp,
        teamId: assignment.teamId,
        teamRole: assignment.role,
        isTemporaryLoan: !!assignment.isTemporaryLoan,
        loanedToTeamId: assignment.loanedToTeamId || null,
      };
    }
    // Check if employee is default leader of any team
    const ledTeam = teams.find(t => t.leaderStaffId === emp.id);
    if (ledTeam) {
      return {
        ...emp,
        teamId: ledTeam.id,
        teamRole: 'leader',
      };
    }
    return {
      ...emp,
      teamId: null,
      teamRole: 'unassigned',
    };
  });

  // 2. Calculate daily and period availability for each active workshop employee
  const activeWorkshopStaff = employees.filter(e => e.isActive && e.isWorkshopStaff);
  const employeeAvailabilities = activeWorkshopStaff.map(emp => 
    calculateEmployeeAvailability(emp, startDateStr, endDateStr, leaveRequests, overtimeShifts, settings, workerAssignments)
  );

  // 3. Team Summaries
  const teamSummaries: TeamCapacitySummary[] = teams.map(team => {
    const teamEmps = employeeAvailabilities.filter(ea => {
      // If loaned out, does not count towards home team capacity
      if (ea.employee.isTemporaryLoan && ea.employee.loanedToTeamId) {
        return ea.employee.loanedToTeamId === team.id;
      }
      return ea.employee.teamId === team.id;
    });

    const standardHours = teamEmps.reduce((sum, e) => sum + e.standardHours, 0);
    const approvedLeaveHours = teamEmps.reduce((sum, e) => sum + e.approvedLeaveHours, 0);
    const pendingLeaveHours = teamEmps.reduce((sum, e) => sum + e.pendingLeaveHours, 0);
    const approvedOvertimeHours = teamEmps.reduce((sum, e) => sum + e.approvedOvertimeHours, 0);
    const proposedOvertimeHours = teamEmps.reduce((sum, e) => sum + e.proposedOvertimeHours, 0);
    const netAvailableHours = teamEmps.reduce((sum, e) => sum + e.netAvailableHours, 0);

    return {
      teamId: team.id,
      teamName: team.name,
      leaderStaffId: team.leaderStaffId,
      leaderName: team.leaderName,
      memberCount: teamEmps.length,
      standardHours,
      approvedLeaveHours,
      pendingLeaveHours,
      approvedOvertimeHours,
      proposedOvertimeHours,
      netAvailableHours,
    };
  });

  // Also include unassigned team summary if there are unassigned staff
  const unassignedEmps = employeeAvailabilities.filter(ea => !ea.employee.teamId);
  if (unassignedEmps.length > 0) {
    teamSummaries.push({
      teamId: 'unassigned',
      teamName: 'Unassigned / Floating Pool',
      leaderStaffId: null,
      leaderName: null,
      memberCount: unassignedEmps.length,
      standardHours: unassignedEmps.reduce((sum, e) => sum + e.standardHours, 0),
      approvedLeaveHours: unassignedEmps.reduce((sum, e) => sum + e.approvedLeaveHours, 0),
      pendingLeaveHours: unassignedEmps.reduce((sum, e) => sum + e.pendingLeaveHours, 0),
      approvedOvertimeHours: unassignedEmps.reduce((sum, e) => sum + e.approvedOvertimeHours, 0),
      proposedOvertimeHours: unassignedEmps.reduce((sum, e) => sum + e.proposedOvertimeHours, 0),
      netAvailableHours: unassignedEmps.reduce((sum, e) => sum + e.netAvailableHours, 0),
    });
  }

  // 4. Stage-Specific Skill Coverage
  // Distinguishes qualified bench from unrated staff (assessment pending) and explicitly disqualified staff (rating 0.00).
  // CRITICAL REQUIREMENT: Stage potential capacities show bench depth (how many qualified hours exist if dedicated to that stage)
  // They must NEVER be summed as if multi-skilled workers work in multiple stages simultaneously!
  const stageSkillCoverage: StageSkillCoverage[] = STAGE_METADATA.map(stage => {
    const qualifiedStaff: { staffId: number; fullName: string; rating: number }[] = [];
    const unratedStaff: { staffId: number; fullName: string }[] = [];
    let explicitlyUnqualifiedCount = 0;
    let potentialQualifiedHours = 0;

    for (const ea of employeeAvailabilities) {
      const rating = ea.employee.skills[stage.key];
      if (rating !== null && rating !== undefined && rating > 0) {
        qualifiedStaff.push({
          staffId: ea.employee.id,
          fullName: ea.employee.fullName,
          rating: Number(rating),
        });
        potentialQualifiedHours += ea.netAvailableHours;
      } else if (rating === 0) {
        explicitlyUnqualifiedCount++;
      } else {
        // rating === null: Unrated / Assessment pending
        unratedStaff.push({
          staffId: ea.employee.id,
          fullName: ea.employee.fullName,
        });
      }
    }

    return {
      stageKey: stage.key,
      stageName: stage.name,
      qualifiedStaffCount: qualifiedStaff.length,
      qualifiedStaff,
      potentialQualifiedHours,
      unratedStaffCount: unratedStaff.length,
      unratedStaff,
      explicitlyUnqualifiedCount,
    };
  });

  // 5. Total Workforce Aggregates
  const actualActiveRosterCount = activeWorkshopStaff.length;
  const rosterStandardCapacityHours = employeeAvailabilities.reduce((sum, e) => sum + e.standardHours, 0);
  const rosterApprovedLeaveImpactHours = employeeAvailabilities.reduce((sum, e) => sum + e.approvedLeaveHours, 0);
  const rosterPendingLeaveRiskHours = employeeAvailabilities.reduce((sum, e) => sum + e.pendingLeaveHours, 0);
  const rosterApprovedOvertimeHours = employeeAvailabilities.reduce((sum, e) => sum + e.approvedOvertimeHours, 0);
  const rosterProposedOvertimeHours = employeeAvailabilities.reduce((sum, e) => sum + e.proposedOvertimeHours, 0);
  const rosterNetAvailableHours = employeeAvailabilities.reduce((sum, e) => sum + e.netAvailableHours, 0);
  const rosterTotalAssignedHours = Math.round(employeeAvailabilities.reduce((sum, e) => sum + e.totalAssignedHours, 0) * 10) / 10;
  const rosterTotalRemainingSchedulableHours = Math.round(employeeAvailabilities.reduce((sum, e) => sum + e.totalRemainingSchedulableHours, 0) * 10) / 10;
  const rosterDoubleBookedCount = employeeAvailabilities.filter(e => e.isDoubleBooked).length;

  // Manual headcount baseline (22 headcount * standard shifts in date range)
  const start = parseDateString(startDateStr);
  const end = parseDateString(endDateStr);
  let standardWorkingDaysCount = 0;
  let standardPersonHoursInPeriod = 0;
  const c = new Date(start);
  while (c <= end) {
    const shift = getStandardShiftHours(c.getUTCDay());
    const holidays = getNswPublicHolidays(c.getUTCFullYear());
    const dateStr = formatDateString(c);
    const isClosed = holidays.has(dateStr) || settings.factoryClosures.includes(dateStr);
    if (shift > 0 && !isClosed) {
      standardWorkingDaysCount++;
      standardPersonHoursInPeriod += shift;
    }
    c.setUTCDate(c.getUTCDate() + 1);
  }

  const manualHeadcountTarget = settings.headcount || 22;
  const manualHeadcountCapacityHours = manualHeadcountTarget * standardPersonHoursInPeriod * settings.efficiency;

  // 6. Upcoming Staffing Shortages
  const upcomingShortages: UpcomingStaffingShortage[] = [];
  const dayMap = new Map<string, { totalAvailable: number; onLeave: number; dayName: string; isWorkDay: boolean }>();

  for (const ea of employeeAvailabilities) {
    for (const d of ea.days) {
      if (!d.isStandardWorkDay || d.isPublicHoliday || d.isFactoryClosure) continue;
      if (!dayMap.has(d.date)) {
        dayMap.set(d.date, { totalAvailable: 0, onLeave: 0, dayName: d.dayName, isWorkDay: true });
      }
      const entry = dayMap.get(d.date)!;
      if (d.netAvailableHours > 0) {
        entry.totalAvailable++;
      }
      if (d.approvedLeaveHours > 0) {
        entry.onLeave++;
      }
    }
  }

  for (const [date, info] of Array.from(dayMap.entries()).sort()) {
    const shortageCount = Math.max(0, manualHeadcountTarget - info.totalAvailable);
    if (shortageCount > 0 || info.onLeave >= 2) {
      const reasons: string[] = [];
      if (info.onLeave > 0) reasons.push(`${info.onLeave} employee(s) on approved leave`);
      if (info.totalAvailable < manualHeadcountTarget) {
        reasons.push(`${manualHeadcountTarget - info.totalAvailable} below 22-person target`);
      }
      upcomingShortages.push({
        date,
        dayName: info.dayName,
        targetHeadcount: manualHeadcountTarget,
        availableHeadcount: info.totalAvailable,
        absentHeadcount: info.onLeave,
        shortageCount,
        reasons,
      });
    }
  }

  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return {
    teams,
    employees,
    employeeAvailabilities,
    leaveRequests,
    overtimeShifts,
    manualHeadcountTarget,
    manualHeadcountCapacityHours: Math.round(manualHeadcountCapacityHours * 10) / 10,
    actualActiveRosterCount,
    rosterStandardCapacityHours: Math.round(rosterStandardCapacityHours * 10) / 10,
    rosterApprovedLeaveImpactHours: Math.round(rosterApprovedLeaveImpactHours * 10) / 10,
    rosterPendingLeaveRiskHours: Math.round(rosterPendingLeaveRiskHours * 10) / 10,
    rosterApprovedOvertimeHours: Math.round(rosterApprovedOvertimeHours * 10) / 10,
    rosterProposedOvertimeHours: Math.round(rosterProposedOvertimeHours * 10) / 10,
    rosterNetAvailableHours: Math.round(rosterNetAvailableHours * 10) / 10,
    rosterTotalAssignedHours,
    rosterTotalRemainingSchedulableHours,
    rosterDoubleBookedCount,
    teamSummaries,
    stageSkillCoverage,
    upcomingShortages,
    dateRange: {
      startDate: startDateStr,
      endDate: endDateStr,
      totalDays,
      workingDaysCount: standardWorkingDaysCount,
    },
  };
}

/**
 * Phase 3 Schedulable Availability Slot interface.
 * Consumed by future finite-capacity production scheduler without mutating workforce state.
 * Fully accounts for standard shifts, leave, overtime, supervisory allowances, and cross-project reservations.
 */
export interface EmployeeDailySchedulableSlot {
  staffId: number;
  staffName: string;
  date: string;
  dayOfWeek: number;
  standardShiftHours: number;
  approvedLeaveHours: number;
  pendingLeaveHours: number;
  approvedOvertimeHours: number;
  netAvailableHours: number;
  supervisoryAllowanceHours: number;
  effectiveOnToolsHours: number;
  assignedHours: number;
  remainingSchedulableHours: number;
  isDoubleBooked: boolean;
  assignments: DayAssignmentItem[];
  skills: WorkshopSkillRatings;
  teamId: string | null;
  teamRole: string;
  isAvailableForScheduling: boolean;
  unavailabilityReason?: string;
}

/**
 * Transforms an EmployeePeriodAvailability record into discrete daily schedulable slots
 * ready for dispatching project stages in Phase 3.
 */
export function getEmployeeDailySchedulableSlots(
  employeeAvailability: EmployeePeriodAvailability
): EmployeeDailySchedulableSlot[] {
  return employeeAvailability.days.map(d => {
    const isAvailable = d.remainingSchedulableHours > 0 && employeeAvailability.employee.isActive;
    let unavailabilityReason: string | undefined;

    if (!employeeAvailability.employee.isActive) {
      unavailabilityReason = 'Inactive employee';
    } else if (d.isPublicHoliday) {
      unavailabilityReason = `Public Holiday (${d.holidayName || 'NSW Holiday'})`;
    } else if (d.isFactoryClosure) {
      unavailabilityReason = 'Factory closure';
    } else if (d.status === 'on_leave') {
      unavailabilityReason = 'Approved full-day leave';
    } else if (d.isDoubleBooked) {
      unavailabilityReason = `Double-booked: ${d.assignedHours}h assigned vs ${d.effectiveOnToolsHours}h available`;
    } else if (d.effectiveOnToolsHours > 0 && d.remainingSchedulableHours === 0) {
      unavailabilityReason = 'Fully booked with existing project assignments';
    } else if (d.effectiveOnToolsHours === 0 && d.supervisoryAllowanceHours > 0) {
      unavailabilityReason = '100% supervisory duty (off tools)';
    } else if (d.standardShiftHours === 0 && d.approvedOvertimeHours === 0) {
      unavailabilityReason = 'Rostered day off (Weekend)';
    }

    return {
      staffId: employeeAvailability.employee.id,
      staffName: employeeAvailability.employee.fullName,
      date: d.date,
      dayOfWeek: d.dayOfWeek,
      standardShiftHours: d.standardShiftHours,
      approvedLeaveHours: d.approvedLeaveHours,
      pendingLeaveHours: d.pendingLeaveHours,
      approvedOvertimeHours: d.approvedOvertimeHours,
      netAvailableHours: d.netAvailableHours,
      supervisoryAllowanceHours: d.supervisoryAllowanceHours,
      effectiveOnToolsHours: d.effectiveOnToolsHours,
      assignedHours: d.assignedHours,
      remainingSchedulableHours: d.remainingSchedulableHours,
      isDoubleBooked: d.isDoubleBooked,
      assignments: d.assignments,
      skills: employeeAvailability.employee.skills,
      teamId: employeeAvailability.employee.teamId,
      teamRole: employeeAvailability.employee.teamRole,
      isAvailableForScheduling: isAvailable,
      unavailabilityReason,
    };
  });
}
