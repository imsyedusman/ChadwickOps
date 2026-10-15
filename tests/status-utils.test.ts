import test from 'node:test';
import assert from 'node:assert/strict';
import { isActiveWorkStatus, ACTIVE_STATUSES, EXCLUDED_WIP_STATUSES } from '../src/lib/project-utils';
import { normalizeStatus } from '../src/lib/constants';

test('normalizeStatus handles Stage 2.1 typo and correct spelling', () => {
  // Historical WorkGuru typo
  assert.equal(
    normalizeStatus('2.1 - Sheetmetal and switchgear ordrered'),
    'Sheetmetal and Switchgear Ordered'
  );
  assert.equal(
    normalizeStatus('Sheetmetal and switchgear ordrered'),
    'Sheetmetal and Switchgear Ordered'
  );

  // Correctly spelled variation
  assert.equal(
    normalizeStatus('2.1 - Sheetmetal and switchgear ordered'),
    'Sheetmetal and Switchgear Ordered'
  );
  assert.equal(
    normalizeStatus('Sheetmetal and switchgear ordered'),
    'Sheetmetal and Switchgear Ordered'
  );

  // Case insensitivity & whitespace
  assert.equal(
    normalizeStatus('  2.1 - SHEETMETAL AND SWITCHGEAR ORDRERED  '),
    'Sheetmetal and Switchgear Ordered'
  );
});

test('isActiveWorkStatus recognizes Stage 2.1 (both typo and correct spelling)', () => {
  // With numeric prefix and typo (the exact string in WorkGuru)
  assert.equal(isActiveWorkStatus('2.1 - Sheetmetal and switchgear ordrered'), true);

  // With numeric prefix and correct spelling
  assert.equal(isActiveWorkStatus('2.1 - Sheetmetal and switchgear ordered'), true);

  // Without numeric prefix
  assert.equal(isActiveWorkStatus('Sheetmetal and switchgear ordrered'), true);
  assert.equal(isActiveWorkStatus('Sheetmetal and switchgear ordered'), true);
  assert.equal(isActiveWorkStatus('Ordered'), true);
});

test('isActiveWorkStatus preserves existing active statuses', () => {
  const activeCases = [
    '1.1 - Not Drawn',
    'Not Drawn',
    '1.2 - Drawings Submitted',
    'Drawings Submitted',
    '1.3 - Drawings Approved',
    'Drawings Approved',
    '2.2 - In Progress',
    'In Progress',
    'Ready for Testing',
    'Tested Defective',
    'On Hold',
    'Waiting to Start',
    'Tested Passed',
    '2.6 - Ready for Invoicing',
    'Ready for Invoicing',
    '3.1 - Invoiced',
    'Invoiced'
  ];

  for (const status of activeCases) {
    assert.equal(isActiveWorkStatus(status), true, `Expected "${status}" to be active`);
  }
});

test('isActiveWorkStatus excludes Delivered, Completed, and Cancelled', () => {
  const excludedCases = [
    'Delivered',
    '3.2 - Delivered',
    'Completed',
    '3.3 - Completed',
    'Cancelled',
    '4.1 - Cancelled',
    'cancelled',
    'COMPLETED',
    'delivered'
  ];

  for (const status of excludedCases) {
    assert.equal(isActiveWorkStatus(status), false, `Expected "${status}" to be excluded`);
  }
});

test('isActiveWorkStatus excludes invalid, empty, or non-production statuses', () => {
  assert.equal(isActiveWorkStatus(null), false);
  assert.equal(isActiveWorkStatus(''), false);
  assert.equal(isActiveWorkStatus('Quote'), false);
  assert.equal(isActiveWorkStatus('Lost'), false);
  assert.equal(isActiveWorkStatus('Random Unknown Status'), false);
});

test('WORKGURU_PROJECT_STATUSES maintains canonical workflow order and treats 2.4 statuses separately', () => {
  import('../src/lib/constants').then(({ WORKGURU_PROJECT_STATUSES }) => {
    // Stage 2.1 has WorkGuru typo
    assert.ok(WORKGURU_PROJECT_STATUSES.includes('2.1 - Sheetmetal and switchgear ordrered'));
    
    // Both 2.4 statuses exist and are distinct
    assert.ok(WORKGURU_PROJECT_STATUSES.includes('2.4 - Tested Defective'));
    assert.ok(WORKGURU_PROJECT_STATUSES.includes('2.4 - Tested Passed'));
    assert.notEqual('2.4 - Tested Defective', '2.4 - Tested Passed');

    const idxDefective = WORKGURU_PROJECT_STATUSES.indexOf('2.4 - Tested Defective');
    const idxPassed = WORKGURU_PROJECT_STATUSES.indexOf('2.4 - Tested Passed');
    assert.ok(idxDefective < idxPassed, 'Tested Defective should come before Tested Passed');

    // Sequential workflow order
    const expectedOrder = [
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
      'Completed'
    ];

    assert.deepEqual([...WORKGURU_PROJECT_STATUSES], expectedOrder);
  });
});

