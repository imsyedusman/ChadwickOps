'use server';

import { db } from "@/db";
import { staffEfficiency, staffAbsences, workerAssignments, projects, systemConfig } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { validateSession } from "@/lib/auth-helpers";
import { 
  hasRole,
  canManageTeams,
  canAssignStaff,
  canPlanOvertime,
  canRecordLeave,
  canApproveLeave
} from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { 
  WorkshopEmployee, 
  WorkshopTeam, 
  LeaveRequestV2, 
  OvertimeShiftV2, 
  WorkerAssignmentV2,
  WorkforceDashboardData, 
  DEFAULT_WORKSHOP_TEAMS,
  buildWorkforceDashboardData,
  LeaveStatus,
  LeaveType,
  OvertimeStatus
} from "@/lib/risk-v2/workforce";
import { getCapacitySettingsV2 } from "@/lib/risk-v2/capacity";
import { getSydneyTodayDateString, addDaysToDateString } from "@/lib/risk-v2/calendar";

const WORKFORCE_CONFIG_KEY = 'v2_workforce_data';

export interface StoredWorkforceState {
  version: number;
  lastSavedAt?: string;
  teams: WorkshopTeam[];
  teamAssignments: Record<string, {
    teamId: string;
    role: 'leader' | 'member';
    isTemporaryLoan?: boolean;
    loanedToTeamId?: string | null;
    loanNotes?: string | null;
  }>;
  leaveRequests: LeaveRequestV2[];
  overtimeShifts: OvertimeShiftV2[];
}

export async function getStoredWorkforceState(): Promise<StoredWorkforceState> {
  const record = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, WORKFORCE_CONFIG_KEY),
  });

  if (!record || !record.value || typeof record.value !== 'object') {
    return {
      version: 1,
      lastSavedAt: new Date().toISOString(),
      teams: DEFAULT_WORKSHOP_TEAMS,
      teamAssignments: {
        '2': { teamId: 'team-alex', role: 'leader' },
        '26': { teamId: 'team-loc', role: 'leader' },
      },
      leaveRequests: [],
      overtimeShifts: [],
    };
  }

  const val = record.value as any;
  return {
    version: typeof val.version === 'number' ? val.version : 1,
    lastSavedAt: val.lastSavedAt || new Date().toISOString(),
    teams: Array.isArray(val.teams) && val.teams.length > 0 ? val.teams : DEFAULT_WORKSHOP_TEAMS,
    teamAssignments: val.teamAssignments || {
      '2': { teamId: 'team-alex', role: 'leader' },
      '26': { teamId: 'team-loc', role: 'leader' },
    },
    leaveRequests: Array.isArray(val.leaveRequests) ? val.leaveRequests : [],
    overtimeShifts: Array.isArray(val.overtimeShifts) ? val.overtimeShifts : [],
  };
}

/**
 * Executes an atomic, version-checked mutation of StoredWorkforceState inside a DB transaction.
 * Uses PostgreSQL row-locking transaction to guarantee serializability and prevent concurrent lost updates.
 */
async function mutateStoredWorkforceState<T>(
  mutator: (state: StoredWorkforceState) => { result: T; modified: boolean } | Promise<{ result: T; modified: boolean }>,
  expectedVersion?: number
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    return await db.transaction(async (tx) => {
      const record = await tx.query.systemConfig.findFirst({
        where: eq(systemConfig.key, WORKFORCE_CONFIG_KEY),
      });

      let current: StoredWorkforceState;
      if (!record || !record.value || typeof record.value !== 'object') {
        current = {
          version: 1,
          lastSavedAt: new Date().toISOString(),
          teams: DEFAULT_WORKSHOP_TEAMS,
          teamAssignments: {
            '2': { teamId: 'team-alex', role: 'leader' },
            '26': { teamId: 'team-loc', role: 'leader' },
          },
          leaveRequests: [],
          overtimeShifts: [],
        };
      } else {
        const val = record.value as any;
        current = {
          version: typeof val.version === 'number' ? val.version : 1,
          lastSavedAt: val.lastSavedAt || new Date().toISOString(),
          teams: Array.isArray(val.teams) && val.teams.length > 0 ? val.teams : DEFAULT_WORKSHOP_TEAMS,
          teamAssignments: val.teamAssignments || {
            '2': { teamId: 'team-alex', role: 'leader' },
            '26': { teamId: 'team-loc', role: 'leader' },
          },
          leaveRequests: Array.isArray(val.leaveRequests) ? val.leaveRequests : [],
          overtimeShifts: Array.isArray(val.overtimeShifts) ? val.overtimeShifts : [],
        };
      }

      // Optimistic concurrency check: If expectedVersion is supplied and does not match, reject update
      if (expectedVersion !== undefined && current.version !== expectedVersion) {
        return {
          success: false,
          error: `Concurrency conflict: Workforce data was modified by another user (current version: ${current.version}, expected: ${expectedVersion}). Please reload before submitting changes.`,
        };
      }

      const mutation = await mutator(current);
      if (!mutation.modified) {
        return { success: true, data: mutation.result };
      }

      current.version = current.version + 1;
      current.lastSavedAt = new Date().toISOString();

      if (record) {
        await tx.update(systemConfig)
          .set({
            value: current,
            updatedAt: new Date(),
          })
          .where(eq(systemConfig.key, WORKFORCE_CONFIG_KEY));
      } else {
        await tx.insert(systemConfig)
          .values({
            key: WORKFORCE_CONFIG_KEY,
            value: current,
            updatedAt: new Date(),
          });
      }

      return { success: true, data: mutation.result };
    });
  } catch (err: any) {
    console.error("[mutateStoredWorkforceState] Error:", err);
    return { success: false, error: err.message || "Failed to update workforce state." };
  }
}

/**
 * Loads workforce dashboard data for the requested date window.
 * Reuses existing staff_efficiency records, existing staff_absences, and Phase 2B workforce state.
 */
export async function fetchWorkforceV2Data(
  startDateStr?: string,
  endDateStr?: string
): Promise<WorkforceDashboardData> {
  const session = await validateSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const todayStr = getSydneyTodayDateString();
  const start = startDateStr || todayStr;
  const end = endDateStr || addDaysToDateString(start, 27); // 4-week window by default

  const settings = await getCapacitySettingsV2();

  // 1. Fetch raw staff records from staff_efficiency
  const rawStaffList = await db.select().from(staffEfficiency).orderBy(asc(staffEfficiency.fullName));
  const employees: WorkshopEmployee[] = rawStaffList.map(s => ({
    id: s.id,
    workguruId: s.workguruId,
    fullName: s.fullName,
    isApprentice: s.isApprentice,
    hourlyRate: Number(s.hourlyRate) || 0,
    skills: {
      frameAssembly: s.frameAssembly ? Number(s.frameAssembly) : null,
      switchgearMount: s.switchgearMount ? Number(s.switchgearMount) : null,
      busbar: s.busbar ? Number(s.busbar) : null,
      wiring: s.wiring ? Number(s.wiring) : null,
      labels: s.labels ? Number(s.labels) : null,
      testing: s.testing ? Number(s.testing) : null,
      packagingFreight: s.packagingFreight ? Number(s.packagingFreight) : null,
    },
    isActive: s.isActive,
    isWorkshopStaff: s.isWorkshopStaff,
    teamId: null,
    teamRole: 'unassigned',
  }));

  // 2. Fetch existing staff absences from DB
  const rawAbsences = await db.select().from(staffAbsences);
  const staffNameMap = new Map<number, string>(employees.map(e => [e.id, e.fullName]));

  const legacyLeaveRequests: LeaveRequestV2[] = rawAbsences.map(a => ({
    id: `legacy-${a.id}`,
    staffId: a.staffId,
    staffName: staffNameMap.get(a.staffId) || `Staff #${a.staffId}`,
    startDate: a.startDate,
    endDate: a.endDate,
    workingDaysAffected: 1,
    isPartialDay: false,
    leaveType: 'annual',
    status: 'approved', // Legacy recorded absences are treated as approved
    notes: a.reason || undefined,
    submittedBy: 'WorkGuru Staff Absence Import',
    submittedAt: a.createdAt ? new Date(a.createdAt).toISOString() : todayStr,
    reviewedBy: 'Authorized Manager',
    reviewedAt: a.createdAt ? new Date(a.createdAt).toISOString() : todayStr,
  }));

  // 3. Fetch active worker assignments from DB and link to projects
  const rawAssignments = await db.select({
    id: workerAssignments.id,
    projectId: workerAssignments.projectId,
    stage: workerAssignments.stage,
    staffId: workerAssignments.staffId,
    assignedHours: workerAssignments.assignedHours,
    projectedStart: workerAssignments.projectedStart,
    projectedEnd: workerAssignments.projectedEnd,
    status: workerAssignments.status,
    projectNumber: projects.projectNumber,
    projectName: projects.name,
  })
  .from(workerAssignments)
  .leftJoin(projects, eq(workerAssignments.projectId, projects.id))
  .where(eq(workerAssignments.status, 'active'));

  const activeAssignments: WorkerAssignmentV2[] = rawAssignments.map(a => ({
    id: a.id,
    staffId: a.staffId,
    projectId: a.projectId,
    projectNumber: a.projectNumber,
    projectName: a.projectName,
    stage: a.stage,
    assignedHours: Number(a.assignedHours) || 0,
    projectedStart: a.projectedStart,
    projectedEnd: a.projectedEnd,
    status: a.status,
  }));

  // 4. Load Phase 2B stored workforce configuration
  const stored = await getStoredWorkforceState();

  // Merge legacy DB absences with Phase 2B leave requests (preventing duplicate IDs)
  const allLeaveRequests: LeaveRequestV2[] = [...legacyLeaveRequests];
  for (const lr of stored.leaveRequests) {
    if (!allLeaveRequests.some(existing => existing.id === lr.id)) {
      allLeaveRequests.push(lr);
    }
  }

  // Enrich employee names on leave & overtime
  for (const lr of allLeaveRequests) {
    if (!lr.staffName && staffNameMap.has(lr.staffId)) {
      lr.staffName = staffNameMap.get(lr.staffId)!;
    }
  }
  for (const ot of stored.overtimeShifts) {
    if (!ot.staffName && staffNameMap.has(ot.staffId)) {
      ot.staffName = staffNameMap.get(ot.staffId)!;
    }
  }

  // 5. Build Workforce Dashboard data with live worker assignments
  return buildWorkforceDashboardData(
    employees,
    stored.teams,
    stored.teamAssignments,
    allLeaveRequests,
    stored.overtimeShifts,
    start,
    end,
    settings,
    activeAssignments
  );
}

/**
 * Saves a workshop team (create or update name, leader, color, description, isActive).
 * Protected by atomic transaction and optimistic version check.
 */
export async function saveWorkshopTeamAction(team: WorkshopTeam, expectedVersion?: number) {
  const session = await validateSession();
  if (!session || !canManageTeams(session)) {
    return { success: false, error: "Unauthorized: only schedulers and administrators can manage workshop teams." };
  }

  if (!team.name || !team.name.trim()) {
    return { success: false, error: "Team name is required." };
  }

  const result = await mutateStoredWorkforceState((stored) => {
    const existingIndex = stored.teams.findIndex(t => t.id === team.id);
    if (existingIndex >= 0) {
      stored.teams[existingIndex] = { ...team, name: team.name.trim() };
    } else {
      stored.teams.push({
        ...team,
        id: team.id || `team-${Date.now()}`,
        name: team.name.trim(),
        color: team.color || 'blue',
        isActive: team.isActive !== undefined ? team.isActive : true,
      });
    }
    return { result: true, modified: true };
  }, expectedVersion);

  if (result.success) {
    revalidatePath('/risk-v2');
  }
  return result;
}

/**
 * Assigns an employee to a team or moves them between teams (e.g. Alex's team vs Loc's team).
 * Supports permanent transfer or temporary loan to another team.
 * Synchronizes team leader references when leaders are assigned.
 * Protected by atomic transaction and optimistic version check.
 */
export async function assignEmployeeToTeamAction(
  staffId: number,
  teamId: string | null,
  role: 'leader' | 'member' = 'member',
  isTemporaryLoan: boolean = false,
  loanedToTeamId?: string | null,
  loanNotes?: string | null,
  expectedVersion?: number
) {
  const session = await validateSession();
  if (!session || !canAssignStaff(session)) {
    return { success: false, error: "Unauthorized: only schedulers and administrators can assign staff." };
  }

  if (!staffId || staffId <= 0) {
    return { success: false, error: "Invalid staff ID." };
  }

  const staff = await db.query.staffEfficiency.findFirst({
    where: eq(staffEfficiency.id, staffId),
    columns: { id: true, fullName: true }
  });

  if (!staff) {
    return { success: false, error: "Staff member not found." };
  }

  const result = await mutateStoredWorkforceState((stored) => {
    if (teamId === null) {
      // Removing employee from assigned teams
      delete stored.teamAssignments[String(staffId)];
      // If employee was leader of any team, clear the leader pointer
      for (const t of stored.teams) {
        if (t.leaderStaffId === staffId) {
          t.leaderStaffId = null;
          t.leaderName = null;
        }
      }
    } else {
      const targetTeam = stored.teams.find(t => t.id === teamId);
      if (!targetTeam) {
        throw new Error("Target team does not exist.");
      }

      // If assigning as leader, synchronize target team leader
      if (role === 'leader') {
        for (const [sId, assign] of Object.entries(stored.teamAssignments)) {
          if (assign.teamId === teamId && assign.role === 'leader' && Number(sId) !== staffId) {
            assign.role = 'member';
          }
        }
        targetTeam.leaderStaffId = staffId;
        targetTeam.leaderName = staff.fullName;
      } else {
        if (targetTeam.leaderStaffId === staffId) {
          targetTeam.leaderStaffId = null;
          targetTeam.leaderName = null;
        }
      }

      // If moving from another team where they were leader, clear former team's leader
      for (const t of stored.teams) {
        if (t.id !== teamId && t.leaderStaffId === staffId) {
          t.leaderStaffId = null;
          t.leaderName = null;
        }
      }

      stored.teamAssignments[String(staffId)] = {
        teamId,
        role,
        isTemporaryLoan: !!isTemporaryLoan,
        loanedToTeamId: loanedToTeamId || null,
        loanNotes: loanNotes ? loanNotes.trim() : null,
      };
    }
    return { result: true, modified: true };
  }, expectedVersion);

  if (result.success) {
    revalidatePath('/risk-v2');
  }
  return result;
}

/**
 * Records an employee leave request received via Paper/PDF.
 * Managed by Joe and Farina (accessible to Finance, Scheduler, and Admin).
 * Protected by atomic transaction and optimistic version check.
 */
export async function submitLeaveRequestAction(data: {
  staffId: number;
  startDate: string;
  endDate: string;
  isPartialDay?: boolean;
  partialHours?: number;
  leaveType: LeaveType;
  notes?: string;
  initialStatus?: LeaveStatus;
  expectedVersion?: number;
}) {
  const session = await validateSession();
  if (!session || !canRecordLeave(session)) {
    return { success: false, error: "Unauthorized: only authorized managers can record employee leave." };
  }

  if (!data.staffId || data.staffId <= 0) {
    return { success: false, error: "Staff member must be selected." };
  }
  if (!data.startDate || !data.endDate) {
    return { success: false, error: "Start and end dates are required." };
  }
  if (data.startDate > data.endDate) {
    return { success: false, error: "Start date cannot be after end date." };
  }

  // If attempting direct approval on creation, verify user has leave approval permissions
  const wantsDirectApproval = data.initialStatus === 'approved';
  if (wantsDirectApproval && !canApproveLeave(session)) {
    return { success: false, error: "Unauthorized: you do not have permission to directly approve leave." };
  }

  const staff = await db.query.staffEfficiency.findFirst({
    where: eq(staffEfficiency.id, data.staffId),
    columns: { id: true, fullName: true }
  });

  const isDirectApproval = wantsDirectApproval;
  const newLeave: LeaveRequestV2 = {
    id: `leave-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    staffId: data.staffId,
    staffName: staff?.fullName || `Staff #${data.staffId}`,
    startDate: data.startDate,
    endDate: data.endDate,
    workingDaysAffected: 1, // Dynamically computed per date range
    isPartialDay: !!data.isPartialDay,
    partialHours: data.isPartialDay ? (Number(data.partialHours) || 4) : undefined,
    leaveType: data.leaveType || 'annual',
    status: isDirectApproval ? 'approved' : 'pending',
    notes: data.notes ? data.notes.trim().slice(0, 500) : undefined,
    submittedBy: session.user.name || session.user.email || 'Manager',
    submittedAt: new Date().toISOString(),
    reviewedBy: isDirectApproval ? (session.user.name || session.user.email || 'Authorized Manager') : undefined,
    reviewedAt: isDirectApproval ? new Date().toISOString() : undefined,
  };

  const result = await mutateStoredWorkforceState((stored) => {
    stored.leaveRequests.unshift(newLeave);
    return { result: { leaveId: newLeave.id }, modified: true };
  }, data.expectedVersion);

  if (result.success) {
    revalidatePath('/risk-v2');
    return { success: true, leaveId: newLeave.id };
  }
  return result;
}

/**
 * Updates leave request status (Approve, Reject, Cancel) by authorized reviewer (Joe / Farina).
 * Accessible to Finance, Scheduler, and Admin.
 * Protected by atomic transaction and optimistic version check.
 */
export async function updateLeaveStatusAction(
  leaveId: string,
  newStatus: LeaveStatus,
  rejectionReason?: string,
  expectedVersion?: number
) {
  const session = await validateSession();
  if (!session || !canApproveLeave(session)) {
    return { success: false, error: "Unauthorized: only Joe, Farina, and authorized managers can approve or reject leave." };
  }

  const result = await mutateStoredWorkforceState((stored) => {
    const target = stored.leaveRequests.find(l => l.id === leaveId);
    if (!target) {
      throw new Error("Leave request not found.");
    }

    target.status = newStatus;
    target.reviewedBy = session.user.name || session.user.email || 'Authorized Manager';
    target.reviewedAt = new Date().toISOString();
    if (newStatus === 'rejected' && rejectionReason) {
      target.rejectionReason = rejectionReason.trim().slice(0, 500);
    }
    return { result: true, modified: true };
  }, expectedVersion);

  if (result.success) {
    revalidatePath('/risk-v2');
  }
  return result;
}

/**
 * Creates or updates a proposed or approved overtime shift.
 * Validates against duplicate shifts on the same date and conflicts with approved full-day leave.
 * Restricted to Schedulers and Admins (Finance cannot plan overtime).
 * Protected by atomic transaction and optimistic version check.
 */
export async function saveOvertimeShiftAction(data: {
  id?: string;
  staffId: number;
  date: string;
  hours: number;
  status: OvertimeStatus;
  associatedProjectId?: number | null;
  associatedProjectNumber?: string | null;
  associatedTeamId?: string | null;
  notes?: string;
  expectedVersion?: number;
}) {
  const session = await validateSession();
  if (!session || !canPlanOvertime(session)) {
    return { success: false, error: "Unauthorized: only schedulers and administrators can plan overtime." };
  }

  if (!data.staffId || data.staffId <= 0) {
    return { success: false, error: "Employee must be selected." };
  }
  if (!data.date) {
    return { success: false, error: "Date is required." };
  }
  if (!data.hours || data.hours <= 0 || data.hours > 12) {
    return { success: false, error: "Valid overtime hours between 0.5 and 12 required." };
  }

  const staff = await db.query.staffEfficiency.findFirst({
    where: eq(staffEfficiency.id, data.staffId),
    columns: { id: true, fullName: true }
  });

  const result = await mutateStoredWorkforceState((stored) => {
    // Check for duplicate active shift on the same date for the same staff member
    const duplicate = stored.overtimeShifts.find(
      o => o.staffId === data.staffId && o.date === data.date && o.id !== data.id && o.status !== 'cancelled'
    );
    if (duplicate) {
      throw new Error(`An overtime shift is already scheduled for ${staff?.fullName || 'this worker'} on ${data.date}. Please edit or cancel the existing shift rather than creating a duplicate.`);
    }

    // Check for conflict with approved full-day leave on that date
    const hasFullLeave = stored.leaveRequests.some(
      l => l.staffId === data.staffId && l.startDate <= data.date && l.endDate >= data.date && l.status === 'approved' && !l.isPartialDay
    );
    if (hasFullLeave) {
      throw new Error(`Cannot schedule overtime: ${staff?.fullName || 'Employee'} is on approved full-day leave on ${data.date}.`);
    }

    const isApproved = data.status === 'approved';
    const existingIndex = data.id ? stored.overtimeShifts.findIndex(o => o.id === data.id) : -1;

    const shiftData: OvertimeShiftV2 = {
      id: data.id || `ot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      staffId: data.staffId,
      staffName: staff?.fullName || `Staff #${data.staffId}`,
      date: data.date,
      hours: Number(data.hours),
      status: data.status || 'proposed',
      associatedProjectId: data.associatedProjectId || null,
      associatedProjectNumber: data.associatedProjectNumber || null,
      associatedTeamId: data.associatedTeamId || null,
      notes: data.notes ? data.notes.trim().slice(0, 500) : undefined,
      createdBy: session.user.name || session.user.email || 'Manager',
      createdAt: new Date().toISOString(),
      approvedBy: isApproved ? (session.user.name || session.user.email || 'Authorized Manager') : undefined,
      approvedAt: isApproved ? new Date().toISOString() : undefined,
    };

    if (existingIndex >= 0) {
      stored.overtimeShifts[existingIndex] = shiftData;
    } else {
      stored.overtimeShifts.unshift(shiftData);
    }
    return { result: { shiftId: shiftData.id }, modified: true };
  }, data.expectedVersion);

  if (result.success) {
    revalidatePath('/risk-v2');
    return { success: true, shiftId: (result as any).data?.shiftId };
  }
  return result;
}

/**
 * Updates overtime shift status (Approve, Cancel).
 * Restricted to Schedulers and Admins (Finance cannot approve overtime).
 * Protected by atomic transaction and optimistic version check.
 */
export async function updateOvertimeStatusAction(
  shiftId: string, 
  newStatus: OvertimeStatus,
  expectedVersion?: number
) {
  const session = await validateSession();
  if (!session || !canPlanOvertime(session)) {
    return { success: false, error: "Unauthorized: only schedulers and administrators can approve or cancel overtime." };
  }

  const result = await mutateStoredWorkforceState((stored) => {
    const target = stored.overtimeShifts.find(o => o.id === shiftId);
    if (!target) {
      throw new Error("Overtime shift not found.");
    }

    target.status = newStatus;
    if (newStatus === 'approved') {
      target.approvedBy = session.user.name || session.user.email || 'Authorized Manager';
      target.approvedAt = new Date().toISOString();
    }
    return { result: true, modified: true };
  }, expectedVersion);

  if (result.success) {
    revalidatePath('/risk-v2');
  }
  return result;
}

