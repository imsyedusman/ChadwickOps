import test from 'node:test';
import assert from 'node:assert/strict';

import { 
  DEFAULT_WORKING_PATTERN, 
  evaluateDayCapacity, 
  getNswPublicHolidays, 
  calculateMonthCapacity, 
  calculateWeekCapacity, 
  getSydneyTodayDateString,
  getEasterSunday,
  parseDateString,
  formatDateString
} from '../src/lib/risk-v2/calendar';

import { 
  DEFAULT_CAPACITY_SETTINGS_V2, 
  calculateForecastPeriods 
} from '../src/lib/risk-v2/capacity';

import { 
  calculateProjectDemandHours, 
  processRawProjectsV2, 
  distributeDemandAcrossPeriods,
  buildRiskV2DashboardData,
  RawProjectInput
} from '../src/lib/risk-v2/demand';

import { CapacitySettingsV2, PeriodCapacity } from '../src/lib/risk-v2/types';
import { 
  assessProjectReadiness, 
  calculateRequiredProductionStart,
  calculateEarliestMaterialFeasibleStart,
  buildSupplierIntelligenceSummary,
  inferDefaultMaterialRequirement,
  LinkedPurchaseOrder, 
  ProjectMaterialConfirmation,
  MaterialRequirementType
} from '../src/lib/risk-v2/readiness';


test('1. Monday-Thursday 38-hour working week', () => {
  assert.equal(DEFAULT_WORKING_PATTERN.mon, 10);
  assert.equal(DEFAULT_WORKING_PATTERN.tue, 10);
  assert.equal(DEFAULT_WORKING_PATTERN.wed, 10);
  assert.equal(DEFAULT_WORKING_PATTERN.thu, 8);
  const total = DEFAULT_WORKING_PATTERN.mon + 
                DEFAULT_WORKING_PATTERN.tue + 
                DEFAULT_WORKING_PATTERN.wed + 
                DEFAULT_WORKING_PATTERN.thu + 
                DEFAULT_WORKING_PATTERN.fri + 
                DEFAULT_WORKING_PATTERN.sat + 
                DEFAULT_WORKING_PATTERN.sun;
  assert.equal(total, 38);
});

test('2. Friday-Sunday excluded from standard capacity', () => {
  assert.equal(DEFAULT_WORKING_PATTERN.fri, 0);
  assert.equal(DEFAULT_WORKING_PATTERN.sat, 0);
  assert.equal(DEFAULT_WORKING_PATTERN.sun, 0);

  const testSettings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    headcount: 10,
    efficiency: 1.0,
    factoryClosures: [],
  };

  // Friday: 2026-10-23
  const fri = evaluateDayCapacity('2026-10-23', testSettings);
  assert.equal(fri.dayName, 'Friday');
  assert.equal(fri.effectiveWorkingHoursPerPerson, 0);
  assert.equal(fri.workshopGrossHours, 0);

  // Saturday: 2026-10-24
  const sat = evaluateDayCapacity('2026-10-24', testSettings);
  assert.equal(sat.dayName, 'Saturday');
  assert.equal(sat.effectiveWorkingHoursPerPerson, 0);

  // Sunday: 2026-10-25
  const sun = evaluateDayCapacity('2026-10-25', testSettings);
  assert.equal(sun.dayName, 'Sunday');
  assert.equal(sun.effectiveWorkingHoursPerPerson, 0);
});

test('3. Months with differing numbers of working days', () => {
  const testSettings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    headcount: 10,
    efficiency: 1.0,
    factoryClosures: [],
  };

  // February 2026: non-leap year (28 days).
  // Feb 2026 starts on Sunday (1st) and ends on Saturday (28th).
  // It has exactly 4 Mondays, 4 Tuesdays, 4 Wednesdays, 4 Thursdays.
  // Working days = 16. Total person hours = 4*10 + 4*10 + 4*10 + 4*8 = 152 hrs.
  // Headcount 10 => 1,520 gross hours.
  const feb2026 = calculateMonthCapacity('2026-02', testSettings, '2026-01-01');
  assert.equal(feb2026.workingDaysCount, 16);
  assert.equal(feb2026.grossHours, 1520);

  // July 2026: 31 days. Starts on Wednesday.
  // July 2026 has: 4 Mon, 4 Tue, 5 Wed, 5 Thu.
  // Working days = 18.
  // Total person hours = 4*10 + 4*10 + 5*10 + 5*8 = 40 + 40 + 50 + 40 = 170 hrs.
  // Headcount 10 => 1,700 gross hours.
  const jul2026 = calculateMonthCapacity('2026-07', testSettings, '2026-01-01');
  assert.equal(jul2026.workingDaysCount, 18);
  assert.equal(jul2026.grossHours, 1700);

  assert.notEqual(feb2026.grossHours, jul2026.grossHours);
});

test('4. Current-month remaining capacity using actual remaining shifts', () => {
  const testSettings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    headcount: 10,
    efficiency: 1.0,
    factoryClosures: [],
  };

  // If today is Monday 2026-10-19, in October 2026 (starts on Thursday, 31 days):
  // Days remaining from Oct 19 to Oct 31:
  // Mon 19 (10h), Tue 20 (10h), Wed 21 (10h), Thu 22 (8h)
  // Mon 26 (10h), Tue 27 (10h), Wed 28 (10h), Thu 29 (8h)
  // Remaining working shifts = 8 days. Remaining person hours = 76 hrs.
  // Headcount 10 => 760 hrs.
  const oct2026 = calculateMonthCapacity('2026-10', testSettings, '2026-10-19');
  assert.equal(oct2026.isCurrentPeriod, true);
  assert.equal(oct2026.remainingWorkingDaysCount, 8);
  assert.equal(oct2026.remainingNetCapacityHours, 760);

  // If today is Friday 2026-10-30:
  // Fri 30 is 0h, Sat 31 is 0h.
  // Remaining shifts = 0!
  const octEnd = calculateMonthCapacity('2026-10', testSettings, '2026-10-30');
  assert.equal(octEnd.remainingWorkingDaysCount, 0);
  assert.equal(octEnd.remainingNetCapacityHours, 0);
});

test('5. NSW Public Holidays calculations', () => {
  // Easter 2026: Easter Sunday is April 5, 2026
  const easter2026 = getEasterSunday(2026);
  assert.equal(easter2026.month, 4);
  assert.equal(easter2026.day, 5);

  const holidays2026 = getNswPublicHolidays(2026);
  assert.equal(holidays2026.get('2026-01-01'), "New Year's Day");
  assert.equal(holidays2026.get('2026-01-26'), "Australia Day");
  assert.equal(holidays2026.get('2026-04-03'), "Good Friday");
  assert.equal(holidays2026.get('2026-04-06'), "Easter Monday");
  assert.equal(holidays2026.get('2026-04-25'), "Anzac Day");
  assert.equal(holidays2026.get('2026-06-08'), "King's Birthday"); // 2nd Monday of June
  assert.equal(holidays2026.get('2026-10-05'), "Labour Day"); // 1st Monday of October
  assert.equal(holidays2026.get('2026-12-25'), "Christmas Day");
  assert.equal(holidays2026.get('2026-12-28'), "Boxing Day (Additional Day)"); // 26 Dec is Sat -> Mon 28

  // On Easter Monday (2026-04-06), Monday standard 10h becomes 0h
  const easterMonCap = evaluateDayCapacity('2026-04-06', DEFAULT_CAPACITY_SETTINGS_V2);
  assert.equal(easterMonCap.isPublicHoliday, true);
  assert.equal(easterMonCap.holidayName, "Easter Monday");
  assert.equal(easterMonCap.effectiveWorkingHoursPerPerson, 0);
  assert.equal(easterMonCap.workshopGrossHours, 0);
});

test('6. Factory closure dates excluded from capacity', () => {
  const closureDate = '2026-10-20'; // Tuesday (normally 10h)
  const testSettings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    factoryClosures: [closureDate],
  };

  const dayCap = evaluateDayCapacity(closureDate, testSettings);
  assert.equal(dayCap.isFactoryClosure, true);
  assert.equal(dayCap.effectiveWorkingHoursPerPerson, 0);
  assert.equal(dayCap.workshopGrossHours, 0);
});

test('7. Overdue active jobs included in forward forecast, never disappearing', () => {
  const settings = DEFAULT_CAPACITY_SETTINGS_V2;
  const todayStr = '2026-10-19';

  const raw: RawProjectInput[] = [
    {
      id: 101,
      projectNumber: '12345',
      name: 'Overdue Switchboard',
      rawStatus: '2.2 - In Progress',
      budgetHours: 100,
      actualHours: 20,
      deliveryDate: '2026-10-01', // Delivery in past!
      total: 50000,
      projectManager: 'Raj',
    }
  ];

  const processed = processRawProjectsV2(raw, settings, todayStr);
  assert.equal(processed.length, 1);
  const proj = processed[0];

  assert.ok(proj.category === 'overdue_manufacturing' || proj.category === 'overdue');
  assert.equal(proj.isOverdue, true);
  assert.equal(proj.daysOverdue, 18);
  assert.equal(proj.deliveryDate, '2026-10-01'); // original date preserved!
  assert.equal(proj.allocationMethod, 'overdue_provisional');
  assert.equal(proj.windowStartDate, todayStr); // starts TODAY or forward
  assert.ok(proj.forecastRemainingHours > 0);

  // Distribute into periods
  const periods = calculateForecastPeriods('monthly', 3, settings, todayStr);
  const forecast = distributeDemandAcrossPeriods(processed, periods, settings, todayStr);

  const totalAllocated = forecast.reduce((acc, p) => acc + p.demandHours, 0);
  assert.equal(totalAllocated, proj.forecastRemainingHours);
});

test('8. Delivered, Completed, and Cancelled excluded from active demand', () => {
  const raw: RawProjectInput[] = [
    { id: 1, projectNumber: '1001', name: 'Delivered Job', rawStatus: '3.2 - Delivered', budgetHours: 100, actualHours: 50, deliveryDate: '2026-11-01' },
    { id: 2, projectNumber: '1002', name: 'Completed Job', rawStatus: 'Completed', budgetHours: 100, actualHours: 50, deliveryDate: '2026-11-01' },
    { id: 3, projectNumber: '1003', name: 'Cancelled Job', rawStatus: 'Cancelled', budgetHours: 100, actualHours: 50, deliveryDate: '2026-11-01' },
    { id: 4, projectNumber: '9901', name: 'Internal Leave', rawStatus: '2.2 - In Progress', budgetHours: 100, actualHours: 50, deliveryDate: '2026-11-01' },
  ];

  const processed = processRawProjectsV2(raw, DEFAULT_CAPACITY_SETTINGS_V2, '2026-10-19');
  assert.equal(processed.length, 0);
});

test('9. Stage 2.1 typo treated as active', () => {
  const raw: RawProjectInput[] = [
    { 
      id: 5, 
      projectNumber: '1005', 
      name: 'Typo Status Job', 
      rawStatus: '2.1 - Sheetmetal and switchgear ordrered', 
      budgetHours: 100, 
      actualHours: 10, 
      deliveryDate: '2026-11-15' 
    }
  ];

  const processed = processRawProjectsV2(raw, DEFAULT_CAPACITY_SETTINGS_V2, '2026-10-19');
  assert.equal(processed.length, 1);
  assert.equal(processed[0].normalizedStatus, 'Sheetmetal and Switchgear Ordered');
});

test('10. Negative remaining hours clamped to zero', () => {
  // Budget = 50h, Actual = 100h, ActualsFactor = 0.70
  // Adjusted Actual = 70h
  // Calculated Remaining = 50 - 70 = -20h
  // Forecast Remaining = MAX(0, -20) = 0h
  const demand = calculateProjectDemandHours(50, 100, 0.70);
  assert.equal(demand.adjustedActualHours, 70);
  assert.equal(demand.calculatedRemainingHours, -20);
  assert.equal(demand.forecastRemainingHours, 0);
  assert.equal(demand.isOverBudget, true);
  assert.equal(demand.hasZeroRemaining, true);
});

test('11. Missing budgets and missing dates flagged', () => {
  const raw: RawProjectInput[] = [
    { id: 6, projectNumber: '1006', name: 'No Budget Job', rawStatus: '1.1 - Not Drawn', budgetHours: 0, actualHours: 0, deliveryDate: '2026-11-15' },
    { id: 7, projectNumber: '1007', name: 'No Date Job', rawStatus: '1.1 - Not Drawn', budgetHours: 50, actualHours: 0, deliveryDate: null },
  ];

  const processed = processRawProjectsV2(raw, DEFAULT_CAPACITY_SETTINGS_V2, '2026-10-19');
  assert.equal(processed.length, 2);

  const noBudget = processed.find(p => p.id === 6)!;
  assert.equal(noBudget.hasMissingBudget, true);
  assert.ok(noBudget.warnings.some(w => w.includes('Missing task budget')));

  const noDate = processed.find(p => p.id === 7)!;
  assert.equal(noDate.category, 'unscheduled_missing_date');
  assert.equal(noDate.allocationMethod, 'unscheduled');
  assert.ok(noDate.warnings.some(w => w.includes('No delivery date')));
});

test('12. December 2030 backlog excluded from regular capacity forecast', () => {
  const raw: RawProjectInput[] = [
    { 
      id: 8, 
      projectNumber: '1008', 
      name: 'Unscheduled 2030 Job', 
      rawStatus: 'Waiting to Start', 
      budgetHours: 200, 
      actualHours: 0, 
      deliveryDate: '2030-12-15',
      total: 120000,
      projectManager: 'Joe'
    }
  ];

  const processed = processRawProjectsV2(raw, DEFAULT_CAPACITY_SETTINGS_V2, '2026-10-19');
  assert.equal(processed.length, 1);
  const proj = processed[0];
  assert.equal(proj.category, 'unscheduled_2030');
  assert.equal(proj.allocationMethod, 'unscheduled');

  const periods = calculateForecastPeriods('monthly', 3, DEFAULT_CAPACITY_SETTINGS_V2, '2026-10-19');
  const forecast = distributeDemandAcrossPeriods(processed, periods, DEFAULT_CAPACITY_SETTINGS_V2, '2026-10-19');

  // Should have contributed 0 hours to regular periods!
  const totalAllocated = forecast.reduce((acc, p) => acc + p.demandHours, 0);
  assert.equal(totalAllocated, 0);
});

test('13. Demand distributed across multiple months with conservation of hours', () => {
  const settings = DEFAULT_CAPACITY_SETTINGS_V2;
  const todayStr = '2026-10-19';

  // Large project: 500 hours, delivery in January 2027 (3 months away)
  const raw: RawProjectInput[] = [
    {
      id: 9,
      projectNumber: '1009',
      name: 'Major Switchboard Build',
      rawStatus: '2.2 - In Progress',
      budgetHours: 500,
      actualHours: 0,
      deliveryDate: '2026-12-15',
      total: 250000,
      projectManager: 'Joe'
    }
  ];

  const processed = processRawProjectsV2(raw, settings, todayStr);
  const periods = calculateForecastPeriods('monthly', 3, settings, todayStr); // Oct 2026, Nov 2026, Dec 2026
  const forecast = distributeDemandAcrossPeriods(processed, periods, settings, todayStr);

  const proj = processed[0];
  assert.equal(proj.forecastRemainingHours, 500);

  // Check conservation of hours
  let sumAllocated = 0;
  for (const [key, hrs] of Object.entries(proj.allocatedHoursPerPeriod)) {
    sumAllocated += hrs;
  }
  assert.equal(Math.round(sumAllocated), 500);

  // Verify that it spans multiple periods
  const allocatedPeriods = Object.keys(proj.allocatedHoursPerPeriod);
  assert.ok(allocatedPeriods.length >= 2, `Expected project to span >= 2 periods, but spanned: ${allocatedPeriods.join(', ')}`);
});

test('14. No duplicate project demand', () => {
  const settings = DEFAULT_CAPACITY_SETTINGS_V2;
  const todayStr = '2026-10-19';

  const raw: RawProjectInput[] = [
    { id: 10, projectNumber: '1010', name: 'Job Alpha', rawStatus: 'In Progress', budgetHours: 80, actualHours: 0, deliveryDate: '2026-11-20' },
  ];

  const periods = calculateForecastPeriods('monthly', 3, settings, todayStr);
  const dashboard = buildRiskV2DashboardData(raw, settings, periods, null, 'monthly', 3, todayStr);

  const allAllocatedProjects = dashboard.periods.flatMap(p => p.contributingProjects);
  // Total hours across all periods for project 10 must equal exactly 80h
  const totalAllocatedFor10 = allAllocatedProjects
    .filter(p => p.projectId === 10)
    .reduce((sum, p) => sum + p.allocatedHours, 0);

  assert.equal(Math.round(totalAllocatedFor10), 80);
});

test('15. Date and timezone boundary cases', () => {
  const sydneyToday = getSydneyTodayDateString();
  assert.match(sydneyToday, /^\d{4}-\d{2}-\d{2}$/);

  // UTC midnight conversion consistency
  const dateStr = '2026-12-31';
  const parsed = parseDateString(dateStr);
  assert.equal(parsed.getUTCFullYear(), 2026);
  assert.equal(parsed.getUTCMonth(), 11);
  assert.equal(parsed.getUTCDate(), 31);
  assert.equal(formatDateString(parsed), dateStr);
});

test('16. Configurable provisional daily hours rate per project', () => {
  const todayStr = '2026-10-19';
  const raw: RawProjectInput[] = [
    { id: 20, projectNumber: '1020', name: 'Flexible Pace Build', rawStatus: 'In Progress', budgetHours: 100, actualHours: 0, deliveryDate: '2026-12-01' }
  ];

  // Rate = 25 hrs/day: estimated days = 100 / 25 = 4 days -> min clamped to 5 days
  const settings25: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    provisionalDailyHoursPerProject: 25,
  };
  const proj25 = processRawProjectsV2(raw, settings25, todayStr)[0];

  // Rate = 10 hrs/day: estimated days = 100 / 10 = 10 days
  const settings10: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    provisionalDailyHoursPerProject: 10,
  };
  const proj10 = processRawProjectsV2(raw, settings10, todayStr)[0];

  // The 10h/day setting starts earlier because it needs more working shifts
  assert.ok(proj10.windowStartDate! < proj25.windowStartDate!);
});

test('17. Distinguishes At Risk (90-100%) from Overloaded (>100%)', () => {
  const settings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    headcount: 10,
    efficiency: 1.0,
    riskThreshold: 90,
  };
  // 1 week of standard Mon-Thu = 38h per person * 10 people = 380 hrs capacity

  // Scenario A: Demand = 350 hrs -> 350 / 380 = 92% -> At Risk (not overloaded)
  const periodsA: PeriodCapacity[] = [
    {
      periodKey: '2026-W43',
      label: 'W43',
      startDate: '2026-10-19',
      endDate: '2026-10-25',
      workingDaysCount: 4,
      grossHours: 380,
      netCapacityHours: 380,
      isCurrentPeriod: false,
      remainingWorkingDaysCount: 4,
      remainingNetCapacityHours: 380,
    }
  ];

  const rawAtRisk: RawProjectInput[] = [
    { id: 31, projectNumber: '1031', name: 'At Risk Job', rawStatus: 'In Progress', budgetHours: 350, actualHours: 0, deliveryDate: '2026-10-22' }
  ];
  const forecastA = distributeDemandAcrossPeriods(processRawProjectsV2(rawAtRisk, settings, '2026-10-19'), periodsA, settings, '2026-10-19');
  assert.equal(forecastA[0].utilisationPercent, 92);
  assert.equal(forecastA[0].isAtRisk, true);
  assert.equal(forecastA[0].isOverloaded, false);
  assert.equal(forecastA[0].loadStatus, 'at_risk');

  // Scenario B: Demand = 420 hrs -> 420 / 380 = 111% -> Overloaded (> 100%)
  const rawOverloaded: RawProjectInput[] = [
    { id: 32, projectNumber: '1032', name: 'Overloaded Job', rawStatus: 'In Progress', budgetHours: 420, actualHours: 0, deliveryDate: '2026-10-22' }
  ];
  const forecastB = distributeDemandAcrossPeriods(processRawProjectsV2(rawOverloaded, settings, '2026-10-19'), periodsA, settings, '2026-10-19');
  assert.equal(forecastB[0].utilisationPercent, 111);
  assert.equal(forecastB[0].isAtRisk, false);
  assert.equal(forecastB[0].isOverloaded, true);
  assert.equal(forecastB[0].loadStatus, 'overloaded');
});

test('18. Identifies compressed delivery windows and strained pace', () => {
  const settings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    headcount: 5,
    efficiency: 0.8, // daily capacity = 5 * 10 * 0.8 = 40h/day max
    provisionalDailyHoursPerProject: 20,
  };

  // Job with 80 hours remaining due in 2 days: required rate = 40h/day (2x the 20h/day benchmark)
  const raw: RawProjectInput[] = [
    {
      id: 41,
      projectNumber: '1041',
      name: 'Rush Job',
      rawStatus: 'In Progress',
      budgetHours: 80,
      actualHours: 0,
      deliveryDate: '2026-10-20', // Tomorrow
      scheduledStart: '2026-10-19',
    }
  ];

  const processed = processRawProjectsV2(raw, settings, '2026-10-19');
  const proj = processed[0];

  assert.equal(proj.isCompressedWindow, true);
  assert.ok(proj.warnings.some(w => w.includes('Compressed window')));
});

test('19. Separates overdue manufacturing demand from operational review and closeout', () => {
  const settings = DEFAULT_CAPACITY_SETTINGS_V2;
  const todayStr = '2026-10-19';

  const raw: RawProjectInput[] = [
    // 1. Overdue with positive remaining hours -> overdue_manufacturing
    {
      id: 51,
      projectNumber: '1051',
      name: 'Physical Board Waiting',
      rawStatus: '2.2 - In Progress',
      budgetHours: 100,
      actualHours: 20,
      deliveryDate: '2026-10-01',
      total: 60000,
    },
    // 2. Overdue with 0 remaining hours -> overdue_zero_remaining
    {
      id: 52,
      projectNumber: '1052',
      name: 'Zero Remaining Workload Job',
      rawStatus: '1.3 - Drawings Approved',
      budgetHours: 0,
      actualHours: 0,
      deliveryDate: '2026-10-01',
      total: 20000,
    },
    // 3. Invoiced in WorkGuru but unarchived -> administrative_closeout
    {
      id: 53,
      projectNumber: '1053',
      name: 'Invoiced Job Waiting Archive',
      rawStatus: '3.1 - Invoiced',
      budgetHours: 50,
      actualHours: 50,
      deliveryDate: '2026-09-15',
      total: 45000,
      isArchived: false,
    },
  ];

  const processed = processRawProjectsV2(raw, settings, todayStr);
  const p1 = processed.find(p => p.id === 51)!;
  const p2 = processed.find(p => p.id === 52)!;
  const p3 = processed.find(p => p.id === 53)!;

  assert.equal(p1.category, 'overdue_manufacturing');
  assert.equal(p1.allocationMethod, 'overdue_provisional');
  assert.ok(p1.forecastRemainingHours > 0);

  assert.equal(p2.category, 'overdue_zero_remaining');
  assert.equal(p2.allocationMethod, 'unscheduled');
  assert.equal(p2.forecastRemainingHours, 0);

  assert.equal(p3.category, 'administrative_closeout');
  assert.equal(p3.allocationMethod, 'unscheduled');
  assert.ok(p3.warnings.some(w => w.includes('Invoiced in WorkGuru')));

  const periods = calculateForecastPeriods('monthly', 3, settings, todayStr);
  const dashboard = buildRiskV2DashboardData(raw, settings, periods, null, 'monthly', 3, todayStr);

  assert.equal(dashboard.summary.overdueManufacturing.count, 1);
  assert.equal(dashboard.summary.overdueZeroRemaining.count, 1);
  assert.equal(dashboard.summary.administrativeCloseout.count, 1);
  assert.equal(dashboard.summary.overdueManufacturing.contractValue, 60000);
  assert.equal(dashboard.summary.overdueZeroRemaining.contractValue, 20000);
  assert.equal(dashboard.summary.administrativeCloseout.contractValue, 45000);
});

test('20. Near-term headline KPIs, rolling 30 days, peak period, and unallocated demand', () => {
  const settings: CapacitySettingsV2 = {
    ...DEFAULT_CAPACITY_SETTINGS_V2,
    headcount: 10,
    efficiency: 1.0, // 38h/wk * 10 = 380h/wk
    riskThreshold: 90,
  };
  const todayStr = '2026-10-19';

  // Create an overload in the current period
  const raw: RawProjectInput[] = [
    {
      id: 61,
      projectNumber: '1061',
      name: 'Overloaded Job',
      rawStatus: '2.2 - In Progress',
      budgetHours: 2500,
      actualHours: 0,
      deliveryDate: '2026-10-25',
    }
  ];

  const periods = calculateForecastPeriods('monthly', 6, settings, todayStr);
  const dashboard = buildRiskV2DashboardData(raw, settings, periods, null, 'monthly', 6, todayStr);

  // Current period should report overload and shortfall
  const current = dashboard.summary.currentPeriod;
  assert.equal(current.isOverloaded, true);
  assert.ok(current.shortfallHours < 0);
  assert.ok(current.demandHours > current.netCapacityHours);

  // First period should distinguish feasible vs unallocated demand
  const p0 = dashboard.periods[0];
  assert.equal(p0.feasibleAllocatedHours, p0.netCapacityHours);
  assert.ok(p0.unallocatedDemandHours > 0);
  assert.equal(p0.feasibleAllocatedHours + p0.unallocatedDemandHours, p0.demandHours);

  // Rolling 30 days
  const r30 = dashboard.summary.next30Days;
  assert.equal(r30.startDate, todayStr);
  assert.ok(r30.workingDaysCount > 0);
  assert.ok(r30.netCapacityHours > 0);

  // Peak period
  assert.equal(dashboard.summary.peakPeriod.periodKey, p0.periodKey);

  // Secondary 6-month aggregate characterization flags front-loading
  assert.equal(dashboard.summary.sixMonthPipeline.isFrontLoaded, true);
  assert.ok(dashboard.summary.sixMonthPipeline.characterization.includes('Front-Loaded'));
});

test('21. Data freshness calculation and stale record coverage', () => {
  const todayStr = '2026-10-19';
  const raw: RawProjectInput[] = [
    {
      id: 71,
      projectNumber: '1071',
      name: 'Fresh Job',
      rawStatus: 'In Progress',
      budgetHours: 50,
      actualHours: 0,
      deliveryDate: '2026-11-01',
      updatedAt: '2026-10-18T10:00:00Z',
      remoteUpdatedAt: '2026-10-17T15:00:00Z',
    },
    {
      id: 72,
      projectNumber: '1072',
      name: 'Stale Job',
      rawStatus: 'In Progress',
      budgetHours: 50,
      actualHours: 0,
      deliveryDate: '2026-11-01',
      updatedAt: '2026-08-01T10:00:00Z', // > 30 days old
      remoteUpdatedAt: '2026-08-01T09:00:00Z',
    }
  ];

  const periods = calculateForecastPeriods('monthly', 3, DEFAULT_CAPACITY_SETTINGS_V2, todayStr);
  const dashboard = buildRiskV2DashboardData(raw, DEFAULT_CAPACITY_SETTINGS_V2, periods, '2026-07-24T09:29:47Z', 'monthly', 3, todayStr);

  const df = dashboard.dataFreshness;
  assert.equal(df.totalActiveProjects, 2);
  assert.equal(df.updatedWithin7DaysCount, 1);
  assert.equal(df.staleOver30DaysCount, 1);
  assert.equal(df.updatedWithin7DaysPercent, 50);
  assert.equal(df.staleOver30DaysPercent, 50);
  assert.equal(df.coverageStatus, 'outdated'); // > 20% stale
  assert.ok(df.lastLocalProjectUpdateAt !== null);
  assert.ok(df.latestRemoteUpdateAt !== null);
});

// ==========================================
// PHASE 2A: PRODUCTION READINESS & SUPPLIER INTELLIGENCE TESTS
// ==========================================

test('22. Project-specific material requirements: sheetmetal_only, switchgear_only, both, neither, unknown', () => {
  const settings = DEFAULT_CAPACITY_SETTINGS_V2;
  const refDate = '2026-10-19';

  const baseProj = {
    id: 101,
    projectNumber: 'PRJ-101',
    name: 'Test Project',
    clientName: 'Client A',
    projectManager: 'Joe',
    deliveryDate: '2026-11-20',
    scheduledStart: null,
    forecastRemainingHours: 50,
    drawingApprovalDate: '2026-10-15',
    expectedDrawingApprovalDate: null,
    sheetmetalOrderedDate: null,
    sheetmetalDeliveredDate: null,
    switchgearOrderedDate: null,
    switchgearDeliveredDate: null,
  };

  // Test 1: Neither required
  const resNeither = assessProjectReadiness(
    baseProj,
    { '101': { requirement: 'neither' } },
    [],
    settings,
    refDate
  );
  assert.equal(resNeither.materialRequirement, 'neither');
  assert.equal(resNeither.sheetmetalStatus, 'not_required');
  assert.equal(resNeither.switchgearStatus, 'not_required');
  assert.equal(resNeither.manufacturingReadiness, 'ready_for_production');
  assert.equal(resNeither.canStartFraming, true);
  assert.equal(resNeither.canStartMountingAndWiring, true);

  // Test 2: Sheetmetal only - not yet delivered
  const resSMOnly = assessProjectReadiness(
    baseProj,
    { '101': { requirement: 'sheetmetal_only' } },
    [],
    settings,
    refDate
  );
  assert.equal(resSMOnly.materialRequirement, 'sheetmetal_only');
  assert.equal(resSMOnly.switchgearStatus, 'not_required');
  assert.equal(resSMOnly.manufacturingReadiness, 'blocked_by_sheetmetal');
  assert.equal(resSMOnly.canStartFraming, false);

  // Test 3: Switchgear only - not yet delivered
  const resSGOnly = assessProjectReadiness(
    baseProj,
    { '101': { requirement: 'switchgear_only' } },
    [],
    settings,
    refDate
  );
  assert.equal(resSGOnly.materialRequirement, 'switchgear_only');
  assert.equal(resSGOnly.sheetmetalStatus, 'not_required');
  assert.equal(resSGOnly.manufacturingReadiness, 'blocked_by_switchgear');
  assert.equal(resSGOnly.canStartFraming, true); // Sheetmetal is not required, so framing is not blocked!
  assert.equal(resSGOnly.canStartMountingAndWiring, false);

  // Test 4: Both required - both delivered
  const resBothDelivered = assessProjectReadiness(
    {
      ...baseProj,
      sheetmetalDeliveredDate: '2026-10-18',
      switchgearDeliveredDate: '2026-10-19',
    },
    { '101': { requirement: 'both' } },
    [],
    settings,
    refDate
  );
  assert.equal(resBothDelivered.materialRequirement, 'both');
  assert.equal(resBothDelivered.sheetmetalStatus, 'delivered');
  assert.equal(resBothDelivered.switchgearStatus, 'delivered');
  assert.equal(resBothDelivered.manufacturingReadiness, 'ready_for_production');
  assert.equal(resBothDelivered.canStartFraming, true);
  assert.equal(resBothDelivered.canStartMountingAndWiring, true);

  // Test 5: Unknown requirement
  const resUnknown = assessProjectReadiness(
    baseProj,
    {}, // Unconfirmed
    [],
    settings,
    refDate
  );
  assert.equal(resUnknown.materialRequirement, 'unknown');
  assert.equal(resUnknown.manufacturingReadiness, 'readiness_unknown');
});

test('23. Missing dates vs confirmed not required: empty dates do not imply ready', () => {
  const settings = DEFAULT_CAPACITY_SETTINGS_V2;
  const refDate = '2026-10-19';

  // Empty dates with NO confirmation -> must be unknown, NOT ready
  const projEmpty = {
    id: 102,
    projectNumber: 'PRJ-102',
    name: 'Empty Dates Job',
    clientName: 'Client B',
    projectManager: 'Joe',
    deliveryDate: '2026-11-20',
    scheduledStart: null,
    forecastRemainingHours: 30,
    drawingApprovalDate: null,
    expectedDrawingApprovalDate: null,
    sheetmetalOrderedDate: null,
    sheetmetalDeliveredDate: null,
    switchgearOrderedDate: null,
    switchgearDeliveredDate: null,
  };

  const res = assessProjectReadiness(projEmpty, {}, [], settings, refDate);
  assert.notEqual(res.manufacturingReadiness, 'ready_for_production');
  assert.equal(res.materialRequirement, 'unknown');
  assert.equal(res.drawingStatus, 'missing');
  assert.equal(res.canStartFraming, false);
});

test('24. Partial material receipt: Stage 04 Frame Assembly unblocked when Sheetmetal delivered alone', () => {
  const settings = DEFAULT_CAPACITY_SETTINGS_V2;
  const refDate = '2026-10-19';

  const proj = {
    id: 103,
    projectNumber: 'PRJ-103',
    name: 'Frame Ready Job',
    clientName: 'Client C',
    projectManager: 'Joe',
    deliveryDate: '2026-12-01',
    scheduledStart: null,
    forecastRemainingHours: 40,
    drawingApprovalDate: '2026-10-10',
    expectedDrawingApprovalDate: null,
    sheetmetalOrderedDate: '2026-10-01',
    sheetmetalDeliveredDate: '2026-10-18', // Delivered!
    switchgearOrderedDate: '2026-10-01',
    switchgearDeliveredDate: null, // Still pending
  };

  const res = assessProjectReadiness(
    proj,
    { '103': { requirement: 'both' } },
    [],
    settings,
    refDate
  );

  // Stage 04 framing can start!
  assert.equal(res.canStartFraming, true);
  // Stage 05+ mounting & wiring cannot start yet
  assert.equal(res.canStartMountingAndWiring, false);
  assert.equal(res.manufacturingReadiness, 'ready_for_framing_only');
});

test('25. Expected vs actual delivery variance calculation', () => {
  const refDate = '2026-10-19';

  const pos: LinkedPurchaseOrder[] = [
    {
      id: 1,
      projectId: 201,
      poNumber: 'PO-001',
      supplierName: 'Supplier A',
      total: 5000,
      status: 'Received',
      issueDate: '2026-09-01',
      expectedDate: '2026-09-15',
      receivedDate: '2026-09-20', // 5 days late
      isOverdueETA: false,
      varianceDays: 5,
    },
    {
      id: 2,
      projectId: 202,
      poNumber: 'PO-002',
      supplierName: 'Supplier A',
      total: 3000,
      status: 'Received',
      issueDate: '2026-09-01',
      expectedDate: '2026-09-15',
      receivedDate: '2026-09-10', // 5 days early (-5)
      isOverdueETA: false,
      varianceDays: -5,
    },
    {
      id: 3,
      projectId: 203,
      poNumber: 'PO-003',
      supplierName: 'Supplier B',
      total: 10000,
      status: 'Approved',
      issueDate: '2026-10-01',
      expectedDate: '2026-10-10', // 9 days overdue relative to refDate
      receivedDate: null,
      isOverdueETA: true,
      varianceDays: 9,
    }
  ];

  const projectMap = new Map([
    [201, { projectNumber: 'P-201', name: 'Job 1' }],
    [202, { projectNumber: 'P-202', name: 'Job 2' }],
    [203, { projectNumber: 'P-203', name: 'Job 3' }],
  ]);

  const intel = buildSupplierIntelligenceSummary(pos, projectMap, refDate);
  assert.equal(intel.totalInFlightPOs, 1);
  assert.equal(intel.overdueInFlightPOsCount, 1);
  assert.equal(intel.overdueInFlightValue, 10000);
  assert.equal(intel.affectedProjectsCount, 1);

  // Supplier A historical variance should average 0 ((5 + -5) / 2)
  const suppA = intel.topSuppliers.find(s => s.supplierName === 'Supplier A');
  assert.ok(suppA);
  assert.equal(suppA.avgVarianceDays, 0);

  // Recent delayed POs should list PO-003
  assert.equal(intel.recentDelayedPOs.length, 1);
  assert.equal(intel.recentDelayedPOs[0].poNumber, 'PO-003');
  assert.equal(intel.recentDelayedPOs[0].daysOverdue, 9);
});

test('26. Backward planning: Required start date & conflict detection (no double-counted QA buffer)', () => {
  const settings = DEFAULT_CAPACITY_SETTINGS_V2; // 25h/day
  const refDate = '2026-10-19';

  // Customer delivery date: 2026-10-29 (Thu)
  // Remaining hours: 50h -> 2 working days
  // QA/Testing labour is already included in WorkGuru task budgets, so default buffer = 0 to prevent double-counting.
  // Stepping back 2 working days from 2026-10-29:
  // Thu 29 (day 0) -> Wed 28 (-1) -> Tue 27 (-2)
  const reqStart = calculateRequiredProductionStart('2026-10-29', 50, settings, 0);
  assert.equal(reqStart, '2026-10-27');

  // Conflict test: Supplier ETA is 2026-10-28, which is AFTER required start 2026-10-27!
  const proj = {
    id: 104,
    projectNumber: 'PRJ-104',
    name: 'Conflict Job',
    clientName: 'Client D',
    projectManager: 'Joe',
    deliveryDate: '2026-10-29',
    scheduledStart: null,
    forecastRemainingHours: 50,
    drawingApprovalDate: '2026-10-15',
    expectedDrawingApprovalDate: null,
    sheetmetalOrderedDate: '2026-10-01',
    sheetmetalDeliveredDate: null,
    switchgearOrderedDate: '2026-10-01',
    switchgearDeliveredDate: null,
  };

  const pos: LinkedPurchaseOrder[] = [
    {
      id: 11,
      projectId: 104,
      poNumber: 'PO-SM',
      supplierName: 'Hi Switch Sheetmetal',
      total: 2000,
      status: 'Approved',
      issueDate: '2026-10-01',
      expectedDate: '2026-10-28', // Arrives after 2026-10-27
      receivedDate: null,
      isOverdueETA: false,
      varianceDays: null,
    }
  ];

  const res = assessProjectReadiness(
    proj,
    { '104': { requirement: 'sheetmetal_only' } },
    pos,
    settings,
    refDate
  );

  assert.equal(res.latestRequiredManufacturingStartDate, '2026-10-27');
  assert.equal(res.earliestEstimatedMaterialStartDate, '2026-10-28');
  assert.equal(res.earliestConfirmedMaterialStartDate, null); // Not confirmed delivered yet
  assert.equal(res.isMaterialDelayConflict, true);
});

test('27. No materials dependency when confirmed neither: immediately ready if drawings approved', () => {
  const settings = DEFAULT_CAPACITY_SETTINGS_V2;
  const refDate = '2026-10-19';

  const proj = {
    id: 105,
    projectNumber: 'PRJ-105',
    name: 'Software Upgrade / Engineering',
    clientName: 'Client E',
    projectManager: 'Joe',
    deliveryDate: '2026-11-15',
    scheduledStart: null,
    forecastRemainingHours: 20,
    drawingApprovalDate: '2026-10-10',
    expectedDrawingApprovalDate: null,
    sheetmetalOrderedDate: null,
    sheetmetalDeliveredDate: null,
    switchgearOrderedDate: null,
    switchgearDeliveredDate: null,
  };

  const res = assessProjectReadiness(
    proj,
    { '105': { requirement: 'neither' } },
    [],
    settings,
    refDate
  );

  assert.equal(res.materialRequirement, 'neither');
  assert.equal(res.manufacturingReadiness, 'ready_for_production');
  assert.equal(res.canStartFraming, true);
  assert.equal(res.canStartMountingAndWiring, true);
  assert.equal(res.isMaterialDelayConflict, false);
});

test('28. Full dashboard integration: productionReadiness summary and backward compatibility', () => {
  const todayStr = '2026-10-19';
  const raw: RawProjectInput[] = [
    {
      id: 1,
      projectNumber: '1001',
      name: 'Ready Job',
      rawStatus: 'In Progress',
      budgetHours: 50,
      actualHours: 0,
      deliveryDate: '2026-11-15',
      drawingApprovalDate: '2026-10-10',
      sheetmetalDeliveredDate: '2026-10-15',
      switchgearDeliveredDate: '2026-10-16',
    },
    {
      id: 2,
      projectNumber: '1002',
      name: 'Framing Only Job',
      rawStatus: 'In Progress',
      budgetHours: 50,
      actualHours: 0,
      deliveryDate: '2026-11-15',
      drawingApprovalDate: '2026-10-10',
      sheetmetalDeliveredDate: '2026-10-15',
      switchgearDeliveredDate: null,
    },
    {
      id: 3,
      projectNumber: '1003',
      name: 'Missing Drawings Job',
      rawStatus: 'In Progress',
      budgetHours: 50,
      actualHours: 0,
      deliveryDate: '2026-11-15',
      drawingApprovalDate: null,
    }
  ];

  const periods = calculateForecastPeriods('monthly', 3, DEFAULT_CAPACITY_SETTINGS_V2, todayStr);
  const dashboard = buildRiskV2DashboardData(
    raw,
    DEFAULT_CAPACITY_SETTINGS_V2,
    periods,
    '2026-10-17T15:00:00Z',
    'monthly',
    3,
    todayStr,
    {
      plannerConfirmations: {
        '1': { requirement: 'both' },
        '2': { requirement: 'both' },
        '3': { requirement: 'both' },
      },
      purchaseOrders: [],
    }
  );

  assert.ok(dashboard.productionReadiness);
  assert.equal(dashboard.productionReadiness.projects.length, 3);
  assert.equal(dashboard.productionReadiness.summary.readyForManufacturingCount, 1);
  assert.equal(dashboard.productionReadiness.summary.readyForFramingOnlyCount, 1);
  assert.equal(dashboard.productionReadiness.summary.blockedByDrawingsCount, 1);
});

test('29. Stage dependency & readiness: Outsourced jobs and zero-remaining review jobs are not reported as workshop material blocked', () => {
  const settings = DEFAULT_CAPACITY_SETTINGS_V2;
  const refDate = '2026-10-19';

  // Scenario A: Outsourced job (projectType: "Outsourced" or "Supply Only")
  const outsourcedProj = {
    id: 110,
    projectNumber: 'PRJ-110',
    name: 'Third Party Switchboard Build',
    clientName: 'Client OS',
    projectManager: 'Joe',
    projectType: 'Outsourced',
    deliveryDate: '2026-11-20',
    scheduledStart: null,
    forecastRemainingHours: 0,
    drawingApprovalDate: null,
    sheetmetalOrderedDate: null,
    sheetmetalDeliveredDate: null,
    switchgearOrderedDate: null,
    switchgearDeliveredDate: null,
  };

  const resOS = assessProjectReadiness(outsourcedProj, {}, [], settings, refDate);
  assert.equal(resOS.manufacturingReadiness, 'outsourced_job');
  assert.equal(resOS.canStartFraming, false);
  assert.equal(resOS.canStartMountingAndWiring, false);

  // Scenario B: Zero remaining hours on an active in-progress project (physically complete, pending closeout)
  const zeroRemainingProj = {
    id: 111,
    projectNumber: 'PRJ-111',
    name: 'Completed Physical Build Pending Closeout',
    clientName: 'Client Z',
    projectManager: 'Joe',
    deliveryDate: '2026-11-20',
    scheduledStart: null,
    forecastRemainingHours: 0,
    drawingApprovalDate: '2026-10-01',
    sheetmetalOrderedDate: null,
    sheetmetalDeliveredDate: null,
    switchgearOrderedDate: null,
    switchgearDeliveredDate: null,
  };

  const resZero = assessProjectReadiness(zeroRemainingProj, {}, [], settings, refDate);
  assert.equal(resZero.manufacturingReadiness, 'zero_remaining_review');
});



