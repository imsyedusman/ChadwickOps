import test from 'node:test';
import assert from 'node:assert/strict';

import { 
  getStandardShiftHours,
  calculateEmployeeAvailability,
  buildWorkforceDashboardData,
  DEFAULT_WORKSHOP_TEAMS,
  WorkshopEmployee,
  LeaveRequestV2,
  OvertimeShiftV2,
  WorkshopTeam,
  getEmployeeDailySchedulableSlots,
  WorkerAssignmentV2,
} from '../src/lib/risk-v2/workforce';

import { DEFAULT_CAPACITY_SETTINGS_V2 } from '../src/lib/risk-v2/capacity';
import { CapacitySettingsV2 } from '../src/lib/risk-v2/types';
import { 
  hasRole, 
  canManageWorkforce, 
  canApproveLeave, 
  canPlanOvertime,
  canManageTeams,
  canAssignStaff,
  canRecordLeave
} from '../src/lib/permissions';

test('1. Shift pattern: Mon-Wed 10h, Thu 8h, Fri-Sun 0h (38h standard week)', () => {
  // Day of week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  assert.equal(getStandardShiftHours(1), 10); // Mon
  assert.equal(getStandardShiftHours(2), 10); // Tue
  assert.equal(getStandardShiftHours(3), 10); // Wed
  assert.equal(getStandardShiftHours(4), 8);  // Thu
  assert.equal(getStandardShiftHours(5), 0);  // Fri (overtime only)
  assert.equal(getStandardShiftHours(6), 0);  // Sat (overtime only)
  assert.equal(getStandardShiftHours(0), 0);  // Sun (overtime only)

  const weeklyStandard = 
    getStandardShiftHours(1) + 
    getStandardShiftHours(2) + 
    getStandardShiftHours(3) + 
    getStandardShiftHours(4) + 
    getStandardShiftHours(5) + 
    getStandardShiftHours(6) + 
    getStandardShiftHours(0);
  assert.equal(weeklyStandard, 38);
});

test('2. Approved leave reduces available capacity; pending leave tracked as risk', () => {
  const settings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    factoryClosures: [],
  };

  const employee: WorkshopEmployee = {
    id: 1,
    workguruId: 1001,
    fullName: 'Test Worker',
    isApprentice: false,
    hourlyRate: 35,
    skills: { frameAssembly: 0.8, switchgearMount: 0.8, busbar: null, wiring: null, labels: null, testing: null, packagingFreight: null },
    isActive: true,
    isWorkshopStaff: true,
    teamId: 'team-alex',
    teamRole: 'member',
  };

  // Week of Mon 2026-10-19 to Sun 2026-10-25:
  // Mon 19 (10h), Tue 20 (10h), Wed 21 (10h), Thu 22 (8h) -> Standard = 38h.
  
  // Scenario A: Approved leave on Tuesday 2026-10-20 (10h)
  const approvedLeaves: LeaveRequestV2[] = [
    {
      id: 'leave-1',
      staffId: 1,
      staffName: 'Test Worker',
      startDate: '2026-10-20',
      endDate: '2026-10-20',
      workingDaysAffected: 1,
      isPartialDay: false,
      leaveType: 'annual',
      status: 'approved',
      submittedBy: 'Manager',
      submittedAt: '2026-10-15T00:00:00Z',
    }
  ];

  const resApproved = calculateEmployeeAvailability(employee, '2026-10-19', '2026-10-25', approvedLeaves, [], settings);
  assert.equal(resApproved.standardHours, 38);
  assert.equal(resApproved.approvedLeaveHours, 10);
  assert.equal(resApproved.pendingLeaveHours, 0);
  assert.equal(resApproved.netAvailableHours, 28); // 38 - 10 = 28h

  // Scenario B: Pending leave on Tuesday 2026-10-20 (10h)
  // Must NOT silently deduct from approved capacity, but is tracked as pendingLeaveHours
  const pendingLeaves: LeaveRequestV2[] = [
    {
      id: 'leave-2',
      staffId: 1,
      staffName: 'Test Worker',
      startDate: '2026-10-20',
      endDate: '2026-10-20',
      workingDaysAffected: 1,
      isPartialDay: false,
      leaveType: 'annual',
      status: 'pending',
      submittedBy: 'Manager',
      submittedAt: '2026-10-15T00:00:00Z',
    }
  ];

  const resPending = calculateEmployeeAvailability(employee, '2026-10-19', '2026-10-25', pendingLeaves, [], settings);
  assert.equal(resPending.standardHours, 38);
  assert.equal(resPending.approvedLeaveHours, 0);
  assert.equal(resPending.pendingLeaveHours, 10);
  assert.equal(resPending.netAvailableHours, 38); // Capacity not deducted until approved
});

test('3. Partial-day absence: 4 hours leave on a 10h shift leaves 6h net availability', () => {
  const settings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    factoryClosures: [],
  };

  const employee: WorkshopEmployee = {
    id: 1,
    workguruId: 1001,
    fullName: 'Test Worker',
    isApprentice: false,
    hourlyRate: 35,
    skills: { frameAssembly: 0.8, switchgearMount: null, busbar: null, wiring: null, labels: null, testing: null, packagingFreight: null },
    isActive: true,
    isWorkshopStaff: true,
    teamId: 'team-alex',
    teamRole: 'member',
  };

  // Half-day leave (4.0 hours) on Wednesday 2026-10-21 (standard 10h)
  const partialLeaves: LeaveRequestV2[] = [
    {
      id: 'leave-partial',
      staffId: 1,
      staffName: 'Test Worker',
      startDate: '2026-10-21',
      endDate: '2026-10-21',
      workingDaysAffected: 1,
      isPartialDay: true,
      partialHours: 4.0,
      leaveType: 'sick',
      status: 'approved',
      submittedBy: 'Joe',
      submittedAt: '2026-10-15T00:00:00Z',
    }
  ];

  const res = calculateEmployeeAvailability(employee, '2026-10-19', '2026-10-25', partialLeaves, [], settings);
  assert.equal(res.approvedLeaveHours, 4.0);
  assert.equal(res.netAvailableHours, 34.0); // 38 - 4 = 34h

  const wedDay = res.days.find(d => d.date === '2026-10-21')!;
  assert.equal(wedDay.standardShiftHours, 10);
  assert.equal(wedDay.approvedLeaveHours, 4.0);
  assert.equal(wedDay.netAvailableHours, 6.0); // 10 - 4 = 6h
  assert.equal(wedDay.status, 'partial_leave');
});

test('4. Overtime shifts: Approved overtime adds to capacity; proposed overtime kept separate', () => {
  const settings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    factoryClosures: [],
  };

  const employee: WorkshopEmployee = {
    id: 1,
    workguruId: 1001,
    fullName: 'Test Worker',
    isApprentice: false,
    hourlyRate: 35,
    skills: { frameAssembly: 0.8, switchgearMount: null, busbar: null, wiring: null, labels: null, testing: null, packagingFreight: null },
    isActive: true,
    isWorkshopStaff: true,
    teamId: 'team-alex',
    teamRole: 'member',
  };

  // Overtime on Friday 2026-10-23 (normally 0h)
  const overtimeShifts: OvertimeShiftV2[] = [
    {
      id: 'ot-1',
      staffId: 1,
      staffName: 'Test Worker',
      date: '2026-10-23', // Friday
      hours: 8.0,
      status: 'approved',
      createdBy: 'Joe',
      createdAt: '2026-10-15T00:00:00Z',
    },
    {
      id: 'ot-2',
      staffId: 1,
      staffName: 'Test Worker',
      date: '2026-10-24', // Saturday
      hours: 6.0,
      status: 'proposed',
      createdBy: 'Joe',
      createdAt: '2026-10-15T00:00:00Z',
    }
  ];

  const res = calculateEmployeeAvailability(employee, '2026-10-19', '2026-10-25', [], overtimeShifts, settings);
  assert.equal(res.standardHours, 38);
  assert.equal(res.approvedOvertimeHours, 8.0);
  assert.equal(res.proposedOvertimeHours, 6.0);
  // Net available capacity includes approved overtime (38 + 8 = 46h), but NOT unapproved proposed overtime
  assert.equal(res.netAvailableHours, 46.0);

  const friDay = res.days.find(d => d.date === '2026-10-23')!;
  assert.equal(friDay.standardShiftHours, 0);
  assert.equal(friDay.approvedOvertimeHours, 8.0);
  assert.equal(friDay.netAvailableHours, 8.0);
  assert.equal(friDay.status, 'overtime');

  const satDay = res.days.find(d => d.date === '2026-10-24')!;
  assert.equal(satDay.standardShiftHours, 0);
  assert.equal(satDay.proposedOvertimeHours, 6.0);
  assert.equal(satDay.netAvailableHours, 0); // Proposed does not increase approved capacity
});

test('5. Inactive staff contribute 0 hours to workshop capacity', () => {
  const settings = DEFAULT_CAPACITY_SETTINGS_V2;

  const inactiveEmployee: WorkshopEmployee = {
    id: 99,
    workguruId: 9999,
    fullName: 'Former Worker',
    isApprentice: false,
    hourlyRate: 35,
    skills: { frameAssembly: 0.8, switchgearMount: null, busbar: null, wiring: null, labels: null, testing: null, packagingFreight: null },
    isActive: false, // Inactive!
    isWorkshopStaff: true,
    teamId: 'team-alex',
    teamRole: 'member',
  };

  const res = calculateEmployeeAvailability(inactiveEmployee, '2026-10-19', '2026-10-25', [], [], settings);
  assert.equal(res.standardHours, 0);
  assert.equal(res.netAvailableHours, 0);
});

test('6. Team membership & temporary loans: loaned worker capacity is attributed to borrower team', () => {
  const settings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    factoryClosures: [],
  };

  const teams: WorkshopTeam[] = [
    { id: 'team-alex', name: "Alex's Team", leaderStaffId: 2, leaderName: 'Alex Alvarado', color: 'emerald', isActive: true },
    { id: 'team-loc', name: "Loc's Team", leaderStaffId: 26, leaderName: 'Loc Lu', color: 'blue', isActive: true },
  ];

  const employees: WorkshopEmployee[] = [
    // Alex
    { id: 2, workguruId: 18454, fullName: 'Alex Alvarado', isApprentice: false, hourlyRate: 48, skills: { frameAssembly: 0, switchgearMount: 0.85, busbar: 0.85, wiring: 0, labels: 0, testing: 0, packagingFreight: 0 }, isActive: true, isWorkshopStaff: true, teamId: 'team-alex', teamRole: 'leader' },
    // Loc
    { id: 26, workguruId: 18457, fullName: 'Loc Lu', isApprentice: false, hourlyRate: 59, skills: { frameAssembly: 0.95, switchgearMount: 0.95, busbar: 0.95, wiring: 0.6, labels: 0, testing: 0, packagingFreight: 0 }, isActive: true, isWorkshopStaff: true, teamId: 'team-loc', teamRole: 'leader' },
    // Helper loaned from Alex to Loc
    { id: 14, workguruId: 18453, fullName: 'Gleidson Cavalcante', isApprentice: false, hourlyRate: 46, skills: { frameAssembly: 0, switchgearMount: 0.85, busbar: 0.85, wiring: 0.85, labels: 0, testing: 0.9, packagingFreight: 0 }, isActive: true, isWorkshopStaff: true, teamId: 'team-alex', teamRole: 'member' },
  ];

  const teamAssignments = {
    '2': { teamId: 'team-alex', role: 'leader' as const },
    '26': { teamId: 'team-loc', role: 'leader' as const },
    '14': { teamId: 'team-alex', role: 'member' as const, isTemporaryLoan: true, loanedToTeamId: 'team-loc' }, // Loaned to Loc!
  };

  const dashboard = buildWorkforceDashboardData(
    employees,
    teams,
    teamAssignments,
    [],
    [],
    '2026-10-19',
    '2026-10-25',
    settings
  );

  const alexSummary = dashboard.teamSummaries.find(t => t.teamId === 'team-alex')!;
  const locSummary = dashboard.teamSummaries.find(t => t.teamId === 'team-loc')!;

  // Alex's team has only Alex (1 member = 38h) because Gleidson is loaned to Loc
  assert.equal(alexSummary.memberCount, 1);
  assert.equal(alexSummary.netAvailableHours, 38);

  // Loc's team has Loc + Gleidson (2 members = 76h)
  assert.equal(locSummary.memberCount, 2);
  assert.equal(locSummary.netAvailableHours, 76);
});

test('7. Conservation of hours: Stage-specific potential pools must NEVER be summed to inflate total capacity', () => {
  const settings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    factoryClosures: [],
  };

  // Multi-skilled worker: highly rated across Frame Assembly, Switchgear Mount, Busbar, and Wiring
  const multiSkilledWorker: WorkshopEmployee = {
    id: 10,
    workguruId: 1010,
    fullName: 'Master Switchboard Builder',
    isApprentice: false,
    hourlyRate: 50,
    skills: {
      frameAssembly: 0.95,
      switchgearMount: 0.95,
      busbar: 0.95,
      wiring: 0.95,
      labels: null,
      testing: null,
      packagingFreight: null,
    },
    isActive: true,
    isWorkshopStaff: true,
    teamId: 'team-alex',
    teamRole: 'member',
  };

  const dashboard = buildWorkforceDashboardData(
    [multiSkilledWorker],
    DEFAULT_WORKSHOP_TEAMS,
    {},
    [],
    [],
    '2026-10-19',
    '2026-10-25',
    settings
  );

  // Total shop capacity is strictly 38 hours (1 worker * 38h)
  assert.equal(dashboard.rosterStandardCapacityHours, 38);
  assert.equal(dashboard.rosterNetAvailableHours, 38);

  // But in stage skill coverage, they qualify for 4 different stages!
  const faStage = dashboard.stageSkillCoverage.find(s => s.stageKey === 'frameAssembly')!;
  const smStage = dashboard.stageSkillCoverage.find(s => s.stageKey === 'switchgearMount')!;
  const bbStage = dashboard.stageSkillCoverage.find(s => s.stageKey === 'busbar')!;
  const wrStage = dashboard.stageSkillCoverage.find(s => s.stageKey === 'wiring')!;

  assert.equal(faStage.potentialQualifiedHours, 38);
  assert.equal(smStage.potentialQualifiedHours, 38);
  assert.equal(bbStage.potentialQualifiedHours, 38);
  assert.equal(wrStage.potentialQualifiedHours, 38);

  // The sum of stage potentials is 38 * 4 = 152 hours.
  // The system must maintain that actual total capacity is 38h, proving potential is NOT summed as capacity!
  const sumOfStagePotentials = faStage.potentialQualifiedHours + smStage.potentialQualifiedHours + bbStage.potentialQualifiedHours + wrStage.potentialQualifiedHours;
  assert.equal(sumOfStagePotentials, 152);
  assert.notEqual(dashboard.rosterNetAvailableHours, sumOfStagePotentials);
  assert.equal(dashboard.rosterNetAvailableHours, 38);
});

test('8. Manual 22-headcount capacity remains independent baseline', () => {
  const settings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    headcount: 22,
    efficiency: 1.0,
    factoryClosures: [],
  };

  // 1 week (38h per person).
  // 22 headcount * 38h = 836 hours.
  const dashboard = buildWorkforceDashboardData(
    [], // No named employees loaded
    DEFAULT_WORKSHOP_TEAMS,
    {},
    [],
    [],
    '2026-10-19',
    '2026-10-25',
    settings
  );

  assert.equal(dashboard.manualHeadcountTarget, 22);
  assert.equal(dashboard.manualHeadcountCapacityHours, 836);
  assert.equal(dashboard.rosterNetAvailableHours, 0); // No named employees
});

test('9. Multi-leave stacking: Multiple partial-day leaves on same day sum up and cap at shift hours', () => {
  const settings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    factoryClosures: [],
  };

  const employee: WorkshopEmployee = {
    id: 1,
    workguruId: 1001,
    fullName: 'Test Worker',
    isApprentice: false,
    hourlyRate: 35,
    skills: { frameAssembly: 0.8, switchgearMount: null, busbar: null, wiring: null, labels: null, testing: null, packagingFreight: null },
    isActive: true,
    isWorkshopStaff: true,
    teamId: 'team-alex',
    teamRole: 'member',
  };

  // Two approved partial-day absences on Monday 2026-10-19 (10h shift):
  // 1st appointment: 3.5h
  // 2nd appointment: 4.0h
  // Total leave = 7.5h. Net available = 10 - 7.5 = 2.5h.
  const leaves: LeaveRequestV2[] = [
    {
      id: 'leave-part-1',
      staffId: 1,
      staffName: 'Test Worker',
      startDate: '2026-10-19',
      endDate: '2026-10-19',
      workingDaysAffected: 1,
      isPartialDay: true,
      partialHours: 3.5,
      leaveType: 'sick',
      status: 'approved',
      submittedBy: 'Farina',
      submittedAt: '2026-10-15T00:00:00Z',
    },
    {
      id: 'leave-part-2',
      staffId: 1,
      staffName: 'Test Worker',
      startDate: '2026-10-19',
      endDate: '2026-10-19',
      workingDaysAffected: 1,
      isPartialDay: true,
      partialHours: 4.0,
      leaveType: 'other',
      status: 'approved',
      submittedBy: 'Farina',
      submittedAt: '2026-10-15T00:00:00Z',
    }
  ];

  const res = calculateEmployeeAvailability(employee, '2026-10-19', '2026-10-25', leaves, [], settings);
  assert.equal(res.approvedLeaveHours, 7.5);
  assert.equal(res.netAvailableHours, 30.5); // 38 - 7.5 = 30.5h

  const mon = res.days.find(d => d.date === '2026-10-19')!;
  assert.equal(mon.approvedLeaveHours, 7.5);
  assert.equal(mon.netAvailableHours, 2.5);
  assert.equal(mon.status, 'partial_leave');
});

test('10. Leave-Overtime Conflict: Full-day approved leave blocks overtime from adding phantom capacity', () => {
  const settings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    factoryClosures: [],
  };

  const employee: WorkshopEmployee = {
    id: 1,
    workguruId: 1001,
    fullName: 'Test Worker',
    isApprentice: false,
    hourlyRate: 35,
    skills: { frameAssembly: 0.8, switchgearMount: null, busbar: null, wiring: null, labels: null, testing: null, packagingFreight: null },
    isActive: true,
    isWorkshopStaff: true,
    teamId: 'team-alex',
    teamRole: 'member',
  };

  // Full-day approved leave on Monday 2026-10-19
  const leaves: LeaveRequestV2[] = [
    {
      id: 'leave-full',
      staffId: 1,
      staffName: 'Test Worker',
      startDate: '2026-10-19',
      endDate: '2026-10-19',
      workingDaysAffected: 1,
      isPartialDay: false,
      leaveType: 'annual',
      status: 'approved',
      submittedBy: 'Joe',
      submittedAt: '2026-10-15T00:00:00Z',
    }
  ];

  // Conflicting approved overtime on that same Monday
  const overtimes: OvertimeShiftV2[] = [
    {
      id: 'ot-conflict',
      staffId: 1,
      staffName: 'Test Worker',
      date: '2026-10-19',
      hours: 4.0,
      status: 'approved',
      createdBy: 'Joe',
      createdAt: '2026-10-15T00:00:00Z',
    }
  ];

  const res = calculateEmployeeAvailability(employee, '2026-10-19', '2026-10-25', leaves, overtimes, settings);
  const mon = res.days.find(d => d.date === '2026-10-19')!;
  // Overtime must not add phantom capacity to a full-day leave
  assert.equal(mon.approvedLeaveHours, 10);
  assert.equal(mon.netAvailableHours, 0);
  assert.equal(mon.status, 'on_leave');
});

test('11. Safe daily fatigue ceiling: Net available hours capped at 16h per calendar day', () => {
  const settings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    factoryClosures: [],
  };

  const employee: WorkshopEmployee = {
    id: 1,
    workguruId: 1001,
    fullName: 'Test Worker',
    isApprentice: false,
    hourlyRate: 35,
    skills: { frameAssembly: 0.8, switchgearMount: null, busbar: null, wiring: null, labels: null, testing: null, packagingFreight: null },
    isActive: true,
    isWorkshopStaff: true,
    teamId: 'team-alex',
    teamRole: 'member',
  };

  // Monday standard shift is 10h. If someone approved 10h overtime (total 20h):
  const overtimes: OvertimeShiftV2[] = [
    {
      id: 'ot-huge',
      staffId: 1,
      staffName: 'Test Worker',
      date: '2026-10-19',
      hours: 10.0,
      status: 'approved',
      createdBy: 'Joe',
      createdAt: '2026-10-15T00:00:00Z',
    }
  ];

  const res = calculateEmployeeAvailability(employee, '2026-10-19', '2026-10-25', [], overtimes, settings);
  const mon = res.days.find(d => d.date === '2026-10-19')!;
  // 10h standard + 10h overtime = 20h -> must be capped at 16h daily ceiling
  assert.equal(mon.netAvailableHours, 16);
});

test('12. Phase 3 Schedulable Slots: Produces unambiguous discrete daily availability for finite-capacity scheduler', () => {
  const settings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    factoryClosures: [],
  };

  const employee: WorkshopEmployee = {
    id: 2,
    workguruId: 18454,
    fullName: 'Alex Alvarado',
    isApprentice: false,
    hourlyRate: 48,
    skills: { frameAssembly: 0, switchgearMount: 0.85, busbar: 0.85, wiring: 0, labels: 0, testing: 0, packagingFreight: 0 },
    isActive: true,
    isWorkshopStaff: true,
    teamId: 'team-alex',
    teamRole: 'leader',
  };

  const availability = calculateEmployeeAvailability(employee, '2026-10-19', '2026-10-25', [], [], settings);
  const slots = getEmployeeDailySchedulableSlots(availability);

  assert.equal(slots.length, 7);
  // Monday: 10h available
  assert.equal(slots[0].date, '2026-10-19');
  assert.equal(slots[0].netAvailableHours, 10);
  assert.equal(slots[0].isAvailableForScheduling, true);
  assert.equal(slots[0].skills.switchgearMount, 0.85);

  // Friday: 0h standard (weekend/RDO)
  assert.equal(slots[4].date, '2026-10-23');
  assert.equal(slots[4].netAvailableHours, 0);
  assert.equal(slots[4].isAvailableForScheduling, false);
  assert.equal(slots[4].unavailabilityReason, 'Rostered day off (Weekend)');
});

test('13. Authorization and RBAC: hasRole checks both session.user.role and session.user.roles', () => {
  // Test case A: Joe (Scheduler role)
  const joeSession = {
    user: { id: '1', name: 'Joe Scheduler', email: 'joe@chadwickswitchboards.com.au', role: 'scheduler' },
    expires: '2026-12-31'
  } as any;
  assert.equal(hasRole(joeSession, 'scheduler'), true);
  assert.equal(hasRole(joeSession, 'admin'), false);
  assert.equal(canManageWorkforce(joeSession), true);
  assert.equal(canApproveLeave(joeSession), true);
  assert.equal(canPlanOvertime(joeSession), true);

  // Test case B: Farina (Finance role, approves leave)
  const farinaSession = {
    user: { id: '2', name: 'Farina Hasan', email: 'farina@chadwickswitchboards.com.au', role: 'finance' },
    expires: '2026-12-31'
  } as any;
  assert.equal(hasRole(farinaSession, 'finance'), true);
  assert.equal(hasRole(farinaSession, 'admin'), false);
  assert.equal(canApproveLeave(farinaSession), true); // Farina can approve leave!
  assert.equal(canManageWorkforce(farinaSession), false); // Workforce team editing restricted to scheduler/admin

  // Test case C: Viewer user (read-only)
  const sessionViewer = {
    user: { id: '3', name: 'Guest Viewer', email: 'viewer@chadwickswitchboards.com.au', role: 'viewer', roles: ['viewer'] },
    expires: '2026-12-31'
  } as any;
  assert.equal(hasRole(sessionViewer, 'viewer'), true);
  assert.equal(hasRole(sessionViewer, 'scheduler'), false);
  assert.equal(hasRole(sessionViewer, 'admin'), false);
  assert.equal(canManageWorkforce(sessionViewer), false);
  assert.equal(canApproveLeave(sessionViewer), false);
  assert.equal(canPlanOvertime(sessionViewer), false);
});

test('14. Per-employee scheduling: worker assignments load into daily availability and detect double-booking', () => {
  const settings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    factoryClosures: [],
  };

  const employee: WorkshopEmployee = {
    id: 10,
    workguruId: 1010,
    fullName: 'Jane Wireperson',
    isApprentice: false,
    hourlyRate: 42,
    skills: { frameAssembly: null, switchgearMount: null, busbar: null, wiring: 0.9, labels: null, testing: null, packagingFreight: null },
    isActive: true,
    isWorkshopStaff: true,
    teamId: 'team-alex',
    teamRole: 'member',
  };

  // Scenario 1: Normal single assignment on Monday 2026-10-19 (10h shift)
  const singleAssignment: WorkerAssignmentV2[] = [
    {
      id: 101,
      staffId: 10,
      projectId: 501,
      projectNumber: 'PRJ-501',
      projectName: 'Main Switchboard Alpha',
      stage: 'wiring',
      assignedHours: 6.0,
      projectedStart: '2026-10-19',
      projectedEnd: '2026-10-19',
      status: 'active',
    }
  ];

  const res1 = calculateEmployeeAvailability(employee, '2026-10-19', '2026-10-25', [], [], settings, singleAssignment);
  const mon1 = res1.days.find(d => d.date === '2026-10-19')!;
  assert.equal(mon1.assignedHours, 6.0);
  assert.equal(mon1.remainingSchedulableHours, 4.0); // 10h - 6h = 4h
  assert.equal(mon1.isDoubleBooked, false);
  assert.equal(mon1.assignments.length, 1);
  assert.equal(mon1.assignments[0].projectNumber, 'PRJ-501');

  // Scenario 2: Double-booking across projects on Monday (6h + 5h = 11h > 10h available)
  const doubleAssignments: WorkerAssignmentV2[] = [
    {
      id: 101,
      staffId: 10,
      projectId: 501,
      projectNumber: 'PRJ-501',
      projectName: 'Main Switchboard Alpha',
      stage: 'wiring',
      assignedHours: 6.0,
      projectedStart: '2026-10-19',
      projectedEnd: '2026-10-19',
      status: 'active',
    },
    {
      id: 102,
      staffId: 10,
      projectId: 502,
      projectNumber: 'PRJ-502',
      projectName: 'Distribution Board Beta',
      stage: 'wiring',
      assignedHours: 5.0,
      projectedStart: '2026-10-19',
      projectedEnd: '2026-10-19',
      status: 'active',
    }
  ];

  const res2 = calculateEmployeeAvailability(employee, '2026-10-19', '2026-10-25', [], [], settings, doubleAssignments);
  const mon2 = res2.days.find(d => d.date === '2026-10-19')!;
  assert.equal(mon2.assignedHours, 11.0);
  assert.equal(mon2.remainingSchedulableHours, 0); // Cannot be negative
  assert.equal(mon2.isDoubleBooked, true); // Flagged double-booked!
  assert.equal(res2.isDoubleBooked, true);
  assert.equal(mon2.assignments.length, 2);
});

test('15. Team leader supervisory allowance adjusts available on-tools production hours', () => {
  const settings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    teamLeaderSupervisoryAllowanceHours: 2.5, // 2.5 hours per shift for supervision
    factoryClosures: [],
  };

  const leader: WorkshopEmployee = {
    id: 2,
    workguruId: 18454,
    fullName: 'Alex Alvarado',
    isApprentice: false,
    hourlyRate: 48,
    skills: { frameAssembly: 0.8, switchgearMount: 0.85, busbar: 0.85, wiring: 0, labels: 0, testing: 0, packagingFreight: 0 },
    isActive: true,
    isWorkshopStaff: true,
    teamId: 'team-alex',
    teamRole: 'leader',
  };

  const member: WorkshopEmployee = {
    id: 5,
    workguruId: 18457,
    fullName: 'Regular Member',
    isApprentice: false,
    hourlyRate: 35,
    skills: { frameAssembly: 0.8, switchgearMount: 0.85, busbar: 0.85, wiring: 0, labels: 0, testing: 0, packagingFreight: 0 },
    isActive: true,
    isWorkshopStaff: true,
    teamId: 'team-alex',
    teamRole: 'member',
  };

  const leaderRes = calculateEmployeeAvailability(leader, '2026-10-19', '2026-10-25', [], [], settings);
  const leaderMon = leaderRes.days.find(d => d.date === '2026-10-19')!;
  assert.equal(leaderMon.standardShiftHours, 10);
  assert.equal(leaderMon.supervisoryAllowanceHours, 2.5);
  assert.equal(leaderMon.effectiveOnToolsHours, 7.5);
  assert.equal(leaderMon.remainingSchedulableHours, 7.5);
  assert.equal(leaderRes.totalSupervisoryAllowanceHours, 10.0); // 4 days * 2.5h = 10h

  const memberRes = calculateEmployeeAvailability(member, '2026-10-19', '2026-10-25', [], [], settings);
  const memberMon = memberRes.days.find(d => d.date === '2026-10-19')!;
  assert.equal(memberMon.supervisoryAllowanceHours, 0);
  assert.equal(memberMon.effectiveOnToolsHours, 10);
  assert.equal(memberMon.remainingSchedulableHours, 10);
  assert.equal(memberRes.totalSupervisoryAllowanceHours, 0);
});

test('16. Granular RBAC: Finance can record and approve leave, but CANNOT plan overtime or manage teams', () => {
  const farinaSession = {
    user: { id: '2', name: 'Farina Hasan', email: 'farina@chadwickswitchboards.com.au', role: 'finance' },
    expires: '2026-12-31'
  } as any;

  // Farina permissions
  assert.equal(canRecordLeave(farinaSession), true, 'Finance must be able to record paper leave');
  assert.equal(canApproveLeave(farinaSession), true, 'Finance must be able to approve leave');
  assert.equal(canPlanOvertime(farinaSession), false, 'Finance must NOT be able to plan overtime');
  assert.equal(canManageTeams(farinaSession), false, 'Finance must NOT be able to manage teams');
  assert.equal(canAssignStaff(farinaSession), false, 'Finance must NOT be able to assign staff');

  const joeSession = {
    user: { id: '1', name: 'Joe Scheduler', email: 'joe@chadwickswitchboards.com.au', role: 'scheduler' },
    expires: '2026-12-31'
  } as any;

  // Joe permissions
  assert.equal(canRecordLeave(joeSession), true, 'Scheduler can record leave');
  assert.equal(canApproveLeave(joeSession), true, 'Scheduler can approve leave');
  assert.equal(canPlanOvertime(joeSession), true, 'Scheduler can plan overtime');
  assert.equal(canManageTeams(joeSession), true, 'Scheduler can manage teams');
  assert.equal(canAssignStaff(joeSession), true, 'Scheduler can assign staff');
});

test('17. Skill rating semantics: unrated workers tracked as assessment pending without assuming competence or incompetence', () => {
  const settings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    factoryClosures: [],
  };

  const employees: WorkshopEmployee[] = [
    {
      id: 1,
      workguruId: 101,
      fullName: 'Qualified Assembler',
      isApprentice: false,
      hourlyRate: 40,
      skills: { frameAssembly: 0.85, switchgearMount: null, busbar: null, wiring: null, labels: null, testing: null, packagingFreight: null },
      isActive: true,
      isWorkshopStaff: true,
      teamId: 'team-alex',
      teamRole: 'member',
    },
    {
      id: 2,
      workguruId: 102,
      fullName: 'Disqualified Assembler',
      isApprentice: false,
      hourlyRate: 35,
      skills: { frameAssembly: 0.0, switchgearMount: null, busbar: null, wiring: null, labels: null, testing: null, packagingFreight: null },
      isActive: true,
      isWorkshopStaff: true,
      teamId: 'team-alex',
      teamRole: 'member',
    },
    {
      id: 3,
      workguruId: 103,
      fullName: 'Tony Chu (Unrated)',
      isApprentice: false,
      hourlyRate: 0,
      skills: { frameAssembly: null, switchgearMount: null, busbar: null, wiring: null, labels: null, testing: null, packagingFreight: null },
      isActive: true,
      isWorkshopStaff: true,
      teamId: 'team-alex',
      teamRole: 'member',
    }
  ];

  const dashboard = buildWorkforceDashboardData(
    employees,
    DEFAULT_WORKSHOP_TEAMS,
    {},
    [],
    [],
    '2026-10-19',
    '2026-10-25',
    settings
  );

  const frameCoverage = dashboard.stageSkillCoverage.find(s => s.stageKey === 'frameAssembly')!;
  assert.equal(frameCoverage.qualifiedStaffCount, 1);
  assert.equal(frameCoverage.qualifiedStaff[0].fullName, 'Qualified Assembler');
  assert.equal(frameCoverage.explicitlyUnqualifiedCount, 1);
  assert.equal(frameCoverage.unratedStaffCount, 1);
  assert.equal(frameCoverage.unratedStaff[0].fullName, 'Tony Chu (Unrated)');
});

test('18. Concurrency & Optimistic Versioning: Rejects state modifications when expectedVersion differs', () => {
  // Simulating optimistic concurrency control logic:
  function applyOptimisticUpdate(
    currentState: { version: number; data: string },
    expectedVersion: number | undefined,
    newData: string
  ): { success: boolean; version: number; error?: string } {
    if (expectedVersion !== undefined && currentState.version !== expectedVersion) {
      return {
        success: false,
        version: currentState.version,
        error: `CONFLICT: Workforce data was modified by another session (expected version ${expectedVersion}, current version ${currentState.version}). Please refresh and retry.`
      };
    }
    return {
      success: true,
      version: currentState.version + 1
    };
  }

  const storedRecord = { version: 5, data: 'State A' };

  // Attempt 1: Correct version matches
  const update1 = applyOptimisticUpdate(storedRecord, 5, 'State B');
  assert.equal(update1.success, true);
  assert.equal(update1.version, 6);

  // Attempt 2: Stale concurrent write with old version 4
  const update2 = applyOptimisticUpdate(storedRecord, 4, 'State C');
  assert.equal(update2.success, false);
  assert.match(update2.error!, /CONFLICT/);
  assert.match(update2.error!, /expected version 4/);
});

