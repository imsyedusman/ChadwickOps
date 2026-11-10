import test from 'node:test';
import assert from 'node:assert';
import {
  parseWorkGuruUtcDate,
  parseWorkGuruWallClockDate,
  evaluateAttendanceFlags,
  extractEmployeeName,
  extractEmployeeId,
  getAttendancePeriodBounds,
  getAttendancePresetRange,
  formatSydneyDateTime,
  extractTimesheetTask,
  extractTimesheetCoordinates,
  evaluateTimingReview,
  SYDNEY_TZ,
} from './attendance-logic';
import { toZonedTime } from 'date-fns-tz';

test('parseWorkGuruUtcDate correctly treats missing offset as UTC', () => {
  const parsed = parseWorkGuruUtcDate('2026-11-10T06:30:00');
  assert.ok(parsed !== null);
  assert.strictEqual(parsed.toISOString(), '2026-11-10T06:30:00.000Z');

  // Verify that in Sydney (+11:00 in November AEDT), this corresponds to 17:30 (5:30 PM)
  const sydneyZoned = toZonedTime(parsed, SYDNEY_TZ);
  assert.strictEqual(sydneyZoned.getHours(), 17);
  assert.strictEqual(sydneyZoned.getMinutes(), 30);
});

test('parseWorkGuruWallClockDate interprets start/finish as local wall-clock despite +00:00', () => {
  // WorkGuru sends 7:30 AM local time with +00:00
  const rawWorkGuru = '2026-11-10T07:30:00+00:00';
  const parsed = parseWorkGuruWallClockDate(rawWorkGuru);
  assert.ok(parsed !== null);

  // When formatted back into Sydney time, it must be 07:30 AM
  const sydneyZoned = toZonedTime(parsed, SYDNEY_TZ);
  assert.strictEqual(sydneyZoned.getHours(), 7);
  assert.strictEqual(sydneyZoned.getMinutes(), 30);
  assert.strictEqual(sydneyZoned.getDate(), 10);
});

test('parseWorkGuruWallClockDate handles split date and time strings', () => {
  const parsed = parseWorkGuruWallClockDate('2026-11-10', '16:00:00');
  assert.ok(parsed !== null);

  const sydneyZoned = toZonedTime(parsed, SYDNEY_TZ);
  assert.strictEqual(sydneyZoned.getHours(), 16);
  assert.strictEqual(sydneyZoned.getMinutes(), 0);
});

test('evaluateAttendanceFlags flags MISSING_TIMES correctly', () => {
  const entries = [
    {
      workguruId: 'ts-1',
      employeeName: 'John Doe',
      date: new Date('2026-11-10T00:00:00.000Z'),
      startTime: null,
      finishTime: null,
      durationHours: 8,
      status: 'Draft',
      cost: 0,
      creationTime: null,
      lastModifiedTime: null,
    },
    {
      workguruId: 'ts-2',
      employeeName: 'Jane Smith',
      date: new Date('2026-11-10T00:00:00.000Z'),
      startTime: new Date('2026-11-09T20:30:00.000Z'), // 07:30 AEDT
      finishTime: null,
      durationHours: 4,
      status: 'Draft',
      cost: 0,
      creationTime: null,
      lastModifiedTime: null,
    },
  ];

  const flagsMap = evaluateAttendanceFlags(entries);
  const ts1Flags = flagsMap.get('ts-1');
  const ts2Flags = flagsMap.get('ts-2');

  assert.ok(ts1Flags && ts1Flags.some((f) => f.type === 'MISSING_TIMES' && f.message.includes('both')));
  assert.ok(ts2Flags && ts2Flags.some((f) => f.type === 'MISSING_TIMES' && f.message.includes('finish')));
});

test('evaluateAttendanceFlags flags INVALID_DURATION correctly', () => {
  const entries = [
    {
      workguruId: 'ts-zero',
      employeeName: 'Bob Builder',
      date: new Date('2026-11-10T00:00:00.000Z'),
      startTime: new Date('2026-11-09T20:30:00.000Z'),
      finishTime: new Date('2026-11-10T05:00:00.000Z'),
      durationHours: 0, // Invalid!
      status: 'Draft',
      cost: 0,
      creationTime: null,
      lastModifiedTime: null,
    },
    {
      workguruId: 'ts-reversed',
      employeeName: 'Bob Builder',
      date: new Date('2026-11-10T00:00:00.000Z'),
      startTime: new Date('2026-11-10T05:00:00.000Z'), // 16:00
      finishTime: new Date('2026-11-09T20:30:00.000Z'), // 07:30 (reversed!)
      durationHours: 8,
      status: 'Draft',
      cost: 0,
      creationTime: null,
      lastModifiedTime: null,
    },
  ];

  const flagsMap = evaluateAttendanceFlags(entries);
  assert.ok(flagsMap.get('ts-zero')?.some((f) => f.type === 'INVALID_DURATION'));
  assert.ok(flagsMap.get('ts-reversed')?.some((f) => f.type === 'INVALID_DURATION'));
});

test('evaluateAttendanceFlags flags LONG_SHIFT (>12h) correctly', () => {
  const entries = [
    {
      workguruId: 'ts-long',
      employeeName: 'Alice Springs',
      date: new Date('2026-11-10T00:00:00.000Z'),
      startTime: new Date('2026-11-09T19:00:00.000Z'), // 06:00 AEDT
      finishTime: new Date('2026-11-10T09:30:00.000Z'), // 20:30 AEDT (14.5 hrs)
      durationHours: 14.5,
      status: 'Approved',
      cost: 0,
      creationTime: null,
      lastModifiedTime: null,
    },
  ];

  const flagsMap = evaluateAttendanceFlags(entries);
  assert.ok(flagsMap.get('ts-long')?.some((f) => f.type === 'LONG_SHIFT'));
});

test('evaluateAttendanceFlags flags OVERLAPPING shifts for same employee without using creation time', () => {
  // Employee logs two overlapping jobs on same day:
  // Job 1: 07:00 - 11:30
  // Job 2: 10:30 - 15:00 (overlaps with Job 1 between 10:30 and 11:30)
  // Creation time for Job 1 is 18:00 (logged at end of day)
  // Creation time for Job 2 is 18:05 (logged at end of day)
  const entries = [
    {
      workguruId: 'job-1',
      employeeName: 'Dave Operator',
      projectNumber: '11800-01',
      date: new Date('2026-11-10T00:00:00.000Z'),
      startTime: parseWorkGuruWallClockDate('2026-11-10', '07:00:00'),
      finishTime: parseWorkGuruWallClockDate('2026-11-10', '11:30:00'),
      durationHours: 4.5,
      status: 'Draft',
      cost: 0,
      creationTime: parseWorkGuruUtcDate('2026-11-10T07:00:00'), // creation is not clock-in
      lastModifiedTime: null,
    },
    {
      workguruId: 'job-2',
      employeeName: 'Dave Operator',
      projectNumber: '11807-01',
      date: new Date('2026-11-10T00:00:00.000Z'),
      startTime: parseWorkGuruWallClockDate('2026-11-10', '10:30:00'),
      finishTime: parseWorkGuruWallClockDate('2026-11-10', '15:00:00'),
      durationHours: 4.5,
      status: 'Draft',
      cost: 0,
      creationTime: parseWorkGuruUtcDate('2026-11-10T07:05:00'),
      lastModifiedTime: null,
    },
    // Another employee on the same time slot does NOT trigger overlap
    {
      workguruId: 'job-other-emp',
      employeeName: 'Frank Technician',
      projectNumber: '11874-01',
      date: new Date('2026-11-10T00:00:00.000Z'),
      startTime: parseWorkGuruWallClockDate('2026-11-10', '08:00:00'),
      finishTime: parseWorkGuruWallClockDate('2026-11-10', '12:00:00'),
      durationHours: 4.0,
      status: 'Draft',
      cost: 0,
      creationTime: null,
      lastModifiedTime: null,
    },
  ];

  const flagsMap = evaluateAttendanceFlags(entries);
  const job1Flags = flagsMap.get('job-1');
  const job2Flags = flagsMap.get('job-2');
  const frankFlags = flagsMap.get('job-other-emp');

  assert.ok(job1Flags && job1Flags.some((f) => f.type === 'OVERLAPPING' && f.message.includes('job-2')));
  assert.ok(job2Flags && job2Flags.some((f) => f.type === 'OVERLAPPING' && f.message.includes('job-1')));
  assert.ok(frankFlags && !frankFlags.some((f) => f.type === 'OVERLAPPING'));
});

test('extractEmployeeName safely handles object payload (ALEX ALVARADO)', () => {
  const remote = {
    userId: 18454,
    user: {
      tenantId: 2309,
      name: 'ALEX',
      surname: 'ALVARADO',
      fullName: 'ALEX ALVARADO',
      userName: 'alexalvapsn@hotmail.com',
    },
  };

  const name = extractEmployeeName(remote);
  const id = extractEmployeeId(remote);

  assert.strictEqual(name, 'ALEX ALVARADO');
  assert.strictEqual(id, '18454');
});

test('extractEmployeeName safely handles string and fallback shapes', () => {
  assert.strictEqual(extractEmployeeName({ user: 'John Smith' }), 'John Smith');
  assert.strictEqual(extractEmployeeName({ userName: 'jane.doe@example.com' }), 'jane.doe@example.com');
  assert.strictEqual(extractEmployeeName({ staffName: 'Bob Builder' }), 'Bob Builder');
  assert.strictEqual(extractEmployeeName({ user: { name: 'Peter', surname: 'Hong' } }), 'Peter Hong');
  assert.strictEqual(extractEmployeeName(null), 'Unassigned Staff');
  assert.strictEqual(extractEmployeeName({}), 'Unassigned Staff');
});

test('getAttendancePeriodBounds defaults to This Week (Mon-Sun in Sydney)', () => {
  // Reference date: Wednesday 11 Nov 2026, 09:00:00 AEDT (= 2026-11-10T22:00:00.000Z)
  const ref = new Date('2026-11-10T22:00:00.000Z');
  const bounds = getAttendancePeriodBounds(undefined, null, null, ref);

  assert.strictEqual(bounds.period, 'this-week');
  assert.strictEqual(bounds.isDefault, true);
  assert.ok(bounds.dateFrom !== null);
  assert.ok(bounds.dateTo !== null);

  // In Sydney (AEDT UTC+11):
  // Monday 9 Nov 00:00:00 AEDT = 2026-11-08T13:00:00.000Z
  assert.strictEqual(bounds.dateFrom.toISOString(), '2026-11-08T13:00:00.000Z');
  // Sunday 15 Nov 23:59:59.999 AEDT = 2026-11-15T12:59:59.999Z
  assert.strictEqual(bounds.dateTo.toISOString(), '2026-11-15T12:59:59.999Z');
  assert.ok(bounds.label.includes('9 Nov'));
  assert.ok(bounds.label.includes('15 Nov'));
});

test('getAttendancePeriodBounds calculates Last Week accurately', () => {
  const ref = new Date('2026-11-10T22:00:00.000Z'); // Wed 11 Nov
  const bounds = getAttendancePeriodBounds('last-week', null, null, ref);

  assert.strictEqual(bounds.period, 'last-week');
  // Previous Monday 2 Nov 00:00:00 AEDT = 2026-11-01T13:00:00.000Z
  assert.strictEqual(bounds.dateFrom?.toISOString(), '2026-11-01T13:00:00.000Z');
  // Previous Sunday 8 Nov 23:59:59.999 AEDT = 2026-11-08T12:59:59.999Z
  assert.strictEqual(bounds.dateTo?.toISOString(), '2026-11-08T12:59:59.999Z');
});

test('formatSydneyDateTime displays Sydney time correctly without double offset', () => {
  // Sync log timestamp from DB: 10 Nov 2026 8:12 PM AEDT (= 2026-11-10T09:12:02.913Z)
  const syncUtc = new Date('2026-11-10T09:12:02.913Z');
  const formatted = formatSydneyDateTime(syncUtc);
  assert.strictEqual(formatted, '10 Nov 2026, 8:12 PM');
});

test('extractTimesheetTask reads the WorkGuru taskLineItem shape', () => {
  assert.deepStrictEqual(
    extractTimesheetTask({ taskLineItemId: 5604586, taskLineItem: { id: 5604586, name: '07 - Wiring' } }),
    { workguruTaskId: '5604586', taskName: '07 - Wiring' }
  );
  assert.deepStrictEqual(
    extractTimesheetTask({ taskId: 42, task: { id: 42, name: 'Install' } }),
    { workguruTaskId: '42', taskName: 'Install' }
  );
  assert.deepStrictEqual(
    extractTimesheetTask({ task: 'Site work' }),
    { workguruTaskId: null, taskName: 'Site work' }
  );
  assert.deepStrictEqual(extractTimesheetTask({}), { workguruTaskId: null, taskName: null });
});

test('extractTimesheetCoordinates reads only explicit API coordinates', () => {
  assert.deepStrictEqual(
    extractTimesheetCoordinates({ latitude: -33.8688, longitude: 151.2093 }),
    { latitude: -33.8688, longitude: 151.2093 }
  );
  assert.deepStrictEqual(
    extractTimesheetCoordinates({ location: { latitude: 1, longitude: 2 } }),
    { latitude: 1, longitude: 2 }
  );
  assert.deepStrictEqual(
    extractTimesheetCoordinates({ coordinates: { lat: -33.8, lon: 151.2 } }),
    { latitude: -33.8, longitude: 151.2 }
  );
  assert.strictEqual(extractTimesheetCoordinates({ latitude: null, longitude: null }), null);
  assert.strictEqual(extractTimesheetCoordinates({ creationTime: '2026-11-10T06:30:00' }), null);
  assert.strictEqual(extractTimesheetCoordinates({ latitude: 100, longitude: 2 }), null);
  assert.strictEqual(extractTimesheetCoordinates({ latitude: 0, longitude: 0 }), null);
});

test('evaluateTimingReview classifies advance, during and after without treating creation as clock-in', () => {
  const start = parseWorkGuruWallClockDate('2026-11-10', '07:00:00')!;
  const finish = parseWorkGuruWallClockDate('2026-11-10', '15:00:00')!;
  const at = (offsetMinutes: number) => new Date(start.getTime() + offsetMinutes * 60000);

  const before = evaluateTimingReview(
    { startTime: start, finishTime: finish, creationTime: at(-45) },
    30
  );
  assert.strictEqual(before.status, 'in-advance');
  assert.strictEqual(before.differenceMinutes, 45);
  assert.strictEqual(before.needsReview, true);

  const during = evaluateTimingReview(
    { startTime: start, finishTime: finish, creationTime: at(60) },
    30
  );
  assert.strictEqual(during.status, 'during');
  assert.strictEqual(during.needsReview, false);

  const afterSoon = evaluateTimingReview(
    { startTime: start, finishTime: finish, creationTime: at(8 * 60 + 10) },
    30
  );
  assert.strictEqual(afterSoon.status, 'after');
  assert.strictEqual(afterSoon.differenceMinutes, 10);
  assert.strictEqual(afterSoon.needsReview, false);

  const afterLate = evaluateTimingReview(
    { startTime: start, finishTime: finish, creationTime: at(8 * 60 + 90) },
    30
  );
  assert.strictEqual(afterLate.status, 'after');
  assert.strictEqual(afterLate.needsReview, true);

  const unknown = evaluateTimingReview(
    { startTime: start, finishTime: finish, creationTime: null },
    30
  );
  assert.strictEqual(unknown.status, 'unknown');

  // A missing finish time can still be compared against the start.
  const advanceNoFinish = evaluateTimingReview(
    { startTime: start, finishTime: null, creationTime: at(-90) },
    30
  );
  assert.strictEqual(advanceNoFinish.status, 'in-advance');
  assert.strictEqual(advanceNoFinish.needsReview, true);

  const noTimes = evaluateTimingReview(
    { startTime: null, finishTime: null, creationTime: at(0) },
    30
  );
  assert.strictEqual(noTimes.status, 'unknown');
});

test('getAttendancePresetRange returns the Sydney Monday-Sunday week', () => {
  const ref = new Date('2026-11-10T22:00:00.000Z');
  assert.deepStrictEqual(getAttendancePresetRange('this-week', ref), {
    from: '2026-11-09',
    to: '2026-11-15',
  });
});
