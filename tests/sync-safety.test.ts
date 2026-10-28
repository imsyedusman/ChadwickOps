import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessCollection,
  canRunLegacyCleanup,
  findVerifiedLegacyDuplicates,
  heartbeatIntervalFor,
  planOrphanCleanup,
  withSyncLock,
  SYNC_LOCK_TTL_MS,
  type SyncLockStore,
} from '../src/lib/sync-safety';

/**
 * These tests exercise the sync safety rules only. Nothing here touches a real
 * database, WorkGuru or the network: every collaborator is a plain object double.
 */

// ---------------------------------------------------------------------------
// Response assessment
// ---------------------------------------------------------------------------

test('assessCollection accepts a successful, complete response (items array)', () => {
  const result = assessCollection<{ id: number }>(
    { result: { items: [{ id: 1 }, { id: 2 }], totalCount: 2 } },
    'PurchaseOrder'
  );
  assert.equal(result.complete, true);
  assert.equal(result.items.length, 2);
  assert.equal(result.issue, undefined);
});

test('assessCollection accepts a bare array result', () => {
  const result = assessCollection<{ id: number }>({ result: [{ id: 1 }] }, 'TimeSheet');
  assert.equal(result.complete, true);
  assert.equal(result.items.length, 1);
});

test('assessCollection accepts top-level items', () => {
  const result = assessCollection<{ id: number }>({ items: [{ id: 1 }] }, 'Invoice');
  assert.equal(result.complete, true);
});

test('assessCollection treats a genuinely empty but complete result as complete', () => {
  const result = assessCollection({ result: { items: [], totalCount: 0 } }, 'Invoice');
  assert.equal(result.complete, true);
  assert.deepEqual(result.items, []);
});

test('assessCollection rejects malformed payloads', () => {
  const cases: unknown[] = [
    null,
    undefined,
    'not-an-object',
    42,
    {},
    { result: { totalCount: 5 } },
    { result: { items: 'nope' } },
  ];

  for (const payload of cases) {
    const result = assessCollection(payload, 'PurchaseOrder');
    assert.equal(result.complete, false, `expected ${JSON.stringify(payload)} to be incomplete`);
    assert.equal(result.issue, 'malformed-response');
  }
});

test('assessCollection rejects a payload that reports success=false', () => {
  const result = assessCollection({ success: false, result: { items: [], totalCount: 0 } }, 'Invoice');
  assert.equal(result.complete, false);
  assert.equal(result.issue, 'api-reported-failure');
});

test('assessCollection detects incomplete pagination via totalCount', () => {
  const result = assessCollection(
    { result: { items: [{ id: 1 }, { id: 2 }], totalCount: 250 } },
    'TimeSheet'
  );
  assert.equal(result.complete, false);
  assert.equal(result.issue, 'incomplete-pagination');
});

test('assessCollection detects silent truncation at the requested page limit', () => {
  const items = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
  const result = assessCollection({ result: { items } }, 'TimeSheet', { requestedLimit: 1000 });
  assert.equal(result.complete, false);
  assert.equal(result.issue, 'incomplete-pagination');

  const belowLimit = assessCollection({ result: { items: items.slice(0, 999) } }, 'TimeSheet', {
    requestedLimit: 1000,
  });
  assert.equal(belowLimit.complete, true);
});

// ---------------------------------------------------------------------------
// Orphan cleanup
// ---------------------------------------------------------------------------

const localRows = [
  { id: 1, workguruId: 'a' },
  { id: 2, workguruId: 'b' },
  { id: 3, workguruId: 'c' },
];

test('orphan cleanup deletes only rows missing from a verified complete snapshot', () => {
  const plan = planOrphanCleanup({
    local: localRows,
    verified: true,
    keepIds: new Set(['a', 'c']),
    getWorkguruId: (row) => row.workguruId,
  });

  assert.equal(plan.skipped, false);
  assert.deepEqual(plan.delete.map((r) => r.id), [2]);
});

test('orphan cleanup of a verified empty snapshot removes every local row', () => {
  const plan = planOrphanCleanup({
    local: localRows,
    verified: true,
    keepIds: new Set<string>(),
    getWorkguruId: (row) => row.workguruId,
  });

  assert.equal(plan.skipped, false);
  assert.deepEqual(plan.delete.map((r) => r.id), [1, 2, 3]);
});

test('orphan cleanup preserves everything when the fetch was not verified', () => {
  const plan = planOrphanCleanup({
    local: localRows,
    verified: false,
    keepIds: new Set<string>(),
    getWorkguruId: (row) => row.workguruId,
    reason: 'request failed',
  });

  assert.equal(plan.skipped, true);
  assert.deepEqual(plan.delete, []);
  assert.equal(plan.reason, 'request failed');
});

test('orphan cleanup ignores rows without a WorkGuru id', () => {
  const plan = planOrphanCleanup({
    local: [{ id: 9, workguruId: null }],
    verified: true,
    keepIds: new Set<string>(),
    getWorkguruId: (row) => row.workguruId,
  });

  assert.deepEqual(plan.delete, []);
});

test('failed fetch never authorises deletion (end-to-end assessment + plan)', () => {
  const assessment = assessCollection({ result: undefined }, 'PurchaseOrder');
  const plan = planOrphanCleanup({
    local: localRows,
    verified: assessment.complete,
    keepIds: new Set<string>(),
    getWorkguruId: (row) => row.workguruId,
  });

  assert.equal(assessment.complete, false);
  assert.deepEqual(plan.delete, []);
});

test('incomplete pagination never authorises deletion (end-to-end)', () => {
  const assessment = assessCollection(
    { result: { items: [{ id: 1, workguruId: 'a' }], totalCount: 10 } },
    'TimeSheet'
  );
  const plan = planOrphanCleanup({
    local: localRows,
    verified: assessment.complete,
    keepIds: new Set(['a']),
    getWorkguruId: (row) => row.workguruId,
  });

  assert.equal(assessment.complete, false);
  assert.deepEqual(plan.delete, []);
});

// ---------------------------------------------------------------------------
// Legacy slash-containing project IDs
// ---------------------------------------------------------------------------

test('slash project is deleted only when a numeric sibling is confirmed by WorkGuru', () => {
  const plan = findVerifiedLegacyDuplicates(
    [
      { id: 1, workguruId: '500/PRJ-100', projectNumber: 'PRJ-100' },
      { id: 2, workguruId: '500', projectNumber: 'PRJ-100' },
    ],
    new Set(['500'])
  );

  assert.deepEqual(plan.deleteIds, [1]);
  assert.deepEqual(plan.kept, []);
});

test('slash project is kept when no numeric sibling exists', () => {
  const plan = findVerifiedLegacyDuplicates(
    [{ id: 1, workguruId: '500/PRJ-100', projectNumber: 'PRJ-100' }],
    new Set(['999'])
  );

  assert.deepEqual(plan.deleteIds, []);
  assert.equal(plan.kept.length, 1);
});

test('slash project is kept when the numeric sibling is not in the current WorkGuru list', () => {
  const plan = findVerifiedLegacyDuplicates(
    [
      { id: 1, workguruId: '500/PRJ-100', projectNumber: 'PRJ-100' },
      { id: 2, workguruId: '500', projectNumber: 'PRJ-100' },
    ],
    new Set(['777'])
  );

  assert.deepEqual(plan.deleteIds, []);
  assert.equal(plan.kept.length, 1);
});

test('slash project is kept when WorkGuru still references that exact id', () => {
  const plan = findVerifiedLegacyDuplicates(
    [
      { id: 1, workguruId: '500/PRJ-100', projectNumber: 'PRJ-100' },
      { id: 2, workguruId: '500', projectNumber: 'PRJ-100' },
    ],
    new Set(['500', '500/PRJ-100'])
  );

  assert.deepEqual(plan.deleteIds, []);
  assert.equal(plan.kept.length, 1);
});

test('slash project is kept when the run has no verified WorkGuru ids at all', () => {
  const plan = findVerifiedLegacyDuplicates(
    [{ id: 1, workguruId: '500/PRJ-100', projectNumber: 'PRJ-100' }],
    new Set()
  );

  assert.deepEqual(plan.deleteIds, []);
  assert.equal(plan.kept.length, 1);
});

test('canonical numeric project is never proposed for deletion', () => {
  const plan = findVerifiedLegacyDuplicates(
    [{ id: 2, workguruId: '500', projectNumber: 'PRJ-100' }],
    new Set(['500'])
  );

  assert.deepEqual(plan.deleteIds, []);
});

// ---------------------------------------------------------------------------
// Project list completeness gate
// ---------------------------------------------------------------------------

test('legacy cleanup is blocked when the project list was not verified complete', () => {
  const permission = canRunLegacyCleanup({
    remoteListComplete: false,
    remoteProjectIds: new Set(['500']),
  });

  assert.equal(permission.allowed, false);
  assert.match(permission.reason ?? '', /not verified complete/);
});

test('legacy cleanup is blocked when no remote project IDs were verified', () => {
  const permission = canRunLegacyCleanup({
    remoteListComplete: true,
    remoteProjectIds: new Set<string>(),
  });

  assert.equal(permission.allowed, false);
});

test('legacy cleanup is allowed only with a complete list and verified IDs', () => {
  const permission = canRunLegacyCleanup({
    remoteListComplete: true,
    remoteProjectIds: new Set(['500']),
  });

  assert.equal(permission.allowed, true);
});

test('a truncated project list is reported incomplete, so cleanup is blocked end-to-end', () => {
  const truncated = assessCollection(
    { result: { items: [{ id: 500 }], totalCount: 9000 } },
    'Project',
    { requestedLimit: 5000 }
  );

  assert.equal(truncated.complete, false);
  assert.equal(
    canRunLegacyCleanup({
      remoteListComplete: truncated.complete,
      remoteProjectIds: new Set(truncated.items.map((p: any) => String(p.id))),
    }).allowed,
    false
  );
});

test('a project list at the 5000 page limit with unknown total is treated as incomplete', () => {
  const items = Array.from({ length: 5000 }, (_, i) => ({ id: i }));
  const assessment = assessCollection({ result: { items } }, 'Project', { requestedLimit: 5000 });

  assert.equal(assessment.complete, false);
  assert.equal(assessment.issue, 'incomplete-pagination');
});

// ---------------------------------------------------------------------------
// Concurrent execution
// ---------------------------------------------------------------------------

function createFakeLockStore(initiallyFree = true) {
  const state = {
    held: initiallyFree ? null : 'someone-else',
    acquires: 0,
    releases: 0,
    heartbeats: 0,
    verifies: 0,
    heartbeatMode: 'ok' as 'ok' | 'lost' | 'throw',
  };

  const store: SyncLockStore = {
    async acquire(ownerId) {
      state.acquires += 1;
      if (state.held !== null) return false;
      state.held = ownerId;
      return true;
    },
    async heartbeat() {
      state.heartbeats += 1;
      if (state.heartbeatMode === 'throw') throw new Error('database unavailable');
      if (state.heartbeatMode === 'lost') {
        state.held = 'other-owner';
        return false;
      }
      return true;
    },
    async verify(ownerId) {
      state.verifies += 1;
      return state.held === ownerId;
    },
    async release(ownerId) {
      state.releases += 1;
      if (state.held === ownerId) state.held = null;
    },
  };

  return { store, state };
}

/**
 * Lease store that actually honours expiry, so "can a slow sync have its lease
 * stolen?" is genuinely exercised rather than assumed.
 */
function createExpiringLeaseStore() {
  let holder: { owner: string; expiresAt: number } | null = null;
  const state = { heartbeats: 0, releases: 0, blockedSteals: 0 };

  const store: SyncLockStore = {
    async acquire(ownerId, ttlMs) {
      const now = Date.now();
      if (holder && holder.owner !== ownerId && holder.expiresAt >= now) {
        state.blockedSteals += 1;
        return false;
      }
      holder = { owner: ownerId, expiresAt: now + ttlMs };
      return true;
    },
    async heartbeat(ownerId, ttlMs) {
      state.heartbeats += 1;
      if (!holder || holder.owner !== ownerId) return false;
      holder.expiresAt = Date.now() + ttlMs;
      return true;
    },
    async verify(ownerId) {
      return holder !== null && holder.owner === ownerId && holder.expiresAt >= Date.now();
    },
    async release(ownerId) {
      state.releases += 1;
      if (holder?.owner === ownerId) holder = null;
    },
  };

  return { store, state };
}

test('a second concurrent sync is rejected without running the task', async () => {
  const { store, state } = createFakeLockStore();

  let releaseFirst!: () => void;
  const firstStarted = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const first = withSyncLock(store, 'owner-1', 60_000, async () => {
    await firstStarted;
    return 'first';
  });

  const second = await withSyncLock(store, 'owner-2', 60_000, async () => 'second');

  assert.equal(second.acquired, false);
  assert.equal(second.result, undefined);

  releaseFirst();
  const firstOutcome = await first;
  assert.equal(firstOutcome.acquired, true);
  assert.equal(firstOutcome.result, 'first');

  // Lease handed back afterwards, so a later sync can start.
  assert.equal(state.held, null);
  assert.equal(state.releases, 1);
});

test('the lease is released when the task throws', async () => {
  const { store, state } = createFakeLockStore();

  await assert.rejects(
    () =>
      withSyncLock(store, 'owner-1', 60_000, async () => {
        throw new Error('boom');
      }),
    /boom/
  );

  assert.equal(state.held, null);
  assert.equal(state.releases, 1);
});

test('a rejected acquire never releases a lease it does not own', async () => {
  const { store, state } = createFakeLockStore(false);

  const outcome = await withSyncLock(store, 'owner-2', 60_000, async () => 'never');

  assert.equal(outcome.acquired, false);
  assert.equal(state.releases, 0);
  assert.equal(state.held, 'someone-else');
});

test('the lease is refreshed while a long-running sync is in progress', async () => {
  const { store, state } = createFakeLockStore();

  await withSyncLock(
    store,
    'owner-1',
    60,
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
      return 'done';
    },
    { heartbeatIntervalMs: 20 }
  );

  assert.ok(state.heartbeats > 0, 'expected at least one heartbeat');
  assert.equal(state.held, null);
});

// ---------------------------------------------------------------------------
// Lease ownership must fail closed before destructive writes
// ---------------------------------------------------------------------------

test('assertHeld confirms ownership against the store on every call', async () => {
  const { store, state } = createFakeLockStore();

  await withSyncLock(store, 'owner-1', 60_000, async (guard) => {
    await guard.assertHeld();
    await guard.assertHeld();
    await guard.assertHeld();
  });

  assert.equal(state.verifies, 3);
});

test('destructive writes are refused after ownership is lost mid-run', async () => {
  const { store, state } = createFakeLockStore();
  const writes: string[] = [];

  await assert.rejects(
    () =>
      withSyncLock(store, 'owner-1', 60_000, async (guard) => {
        await guard.assertHeld();
        writes.push('before-takeover');

        // Another process takes the lease.
        state.held = 'owner-2';

        await guard.assertHeld();
        writes.push('after-takeover');
      }),
    /lease is no longer held/i
  );

  assert.deepEqual(writes, ['before-takeover']);
  assert.equal(state.held, 'owner-2');
});

test('a heartbeat returning false fails closed for the rest of the run', async () => {
  const { store, state } = createFakeLockStore();
  state.heartbeatMode = 'lost';
  const writes: string[] = [];

  await assert.rejects(
    () =>
      withSyncLock(
        store,
        'owner-1',
        60,
        async (guard) => {
          writes.push('started');
          await new Promise((resolve) => setTimeout(resolve, 80));
          await guard.assertHeld();
          writes.push('destructive-write');
        },
        { heartbeatIntervalMs: 10 }
      ),
    /lease is no longer held/i
  );

  assert.deepEqual(writes, ['started']);
});

test('a heartbeat that throws fails closed and reports the error', async () => {
  const { store, state } = createFakeLockStore();
  state.heartbeatMode = 'throw';
  const reported: unknown[] = [];
  const writes: string[] = [];

  await assert.rejects(
    () =>
      withSyncLock(
        store,
        'owner-1',
        60,
        async (guard) => {
          writes.push('started');
          await new Promise((resolve) => setTimeout(resolve, 80));
          await guard.assertHeld();
          writes.push('destructive-write');
        },
        { heartbeatIntervalMs: 10, onHeartbeatFailure: (error) => reported.push(error) }
      ),
    /lease is no longer held/i
  );

  assert.deepEqual(writes, ['started']);
  assert.ok(reported.length >= 1, 'the heartbeat failure should be reported');
});

test('a slow sync is not stealable while its heartbeat keeps the lease alive', async () => {
  const { store, state } = createExpiringLeaseStore();
  const ttlMs = 80;
  const stealAttempts: boolean[] = [];

  await withSyncLock(store, 'owner-fast', ttlMs, async (guard) => {
    // Runs for ~4x the TTL. The default heartbeat interval (ttl/3) must keep the
    // lease alive for the whole duration.
    for (let i = 0; i < 4; i++) {
      await new Promise((resolve) => setTimeout(resolve, ttlMs));
      stealAttempts.push(await store.acquire('owner-slow', ttlMs));
      await guard.assertHeld();
    }
  });

  assert.deepEqual(stealAttempts, [false, false, false, false]);
  assert.ok(state.blockedSteals >= 4, 'expected every steal attempt to be blocked');
  assert.ok(state.heartbeats >= 3, 'expected the lease to be refreshed');
  assert.equal(state.releases, 1);
});

test('without heartbeats the lease lapses, so the guard refuses destructive work', async () => {
  const { store } = createExpiringLeaseStore();

  await assert.rejects(
    () =>
      withSyncLock(
        store,
        'owner-1',
        40,
        async (guard) => {
          await new Promise((resolve) => setTimeout(resolve, 90));
          // Stale lease: a second writer could now be active.
          assert.equal(await store.acquire('owner-2', 40), true);
          await guard.assertHeld();
        },
        { heartbeatIntervalMs: 0 }
      ),
    /lease is no longer held/i
  );
});

test('the default heartbeat interval refreshes well before the lease expires', async () => {
  const { store, state } = createFakeLockStore();
  const ttlMs = 300;

  await withSyncLock(store, 'owner-1', ttlMs, async (guard) => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    await guard.assertHeld();
  });

  // Default interval is ttl/3 = 100ms, so a refresh must land before the 300ms expiry.
  assert.ok(state.heartbeats >= 1);
  assert.equal(state.held, null);
});

test('the refresh cadence is always strictly shorter than the TTL', () => {
  for (const ttlMs of [30, 100, 900, 60_000, SYNC_LOCK_TTL_MS]) {
    const interval = heartbeatIntervalFor(ttlMs);
    assert.ok(interval >= 1, `interval must be positive for ttl ${ttlMs}`);
    assert.ok(interval < ttlMs, `interval ${interval} must be shorter than ttl ${ttlMs}`);
  }

  // Production cadence for the 15 minute lease.
  assert.equal(heartbeatIntervalFor(SYNC_LOCK_TTL_MS), 5 * 60 * 1000);
});

test('a failing release still lapses safely and does not mask the task result', async () => {
  const { store, state } = createFakeLockStore();
  const reported: unknown[] = [];
  const originalRelease = store.release.bind(store);
  store.release = async (ownerId: string) => {
    await originalRelease(ownerId);
    throw new Error('release failed');
  };

  const outcome = await withSyncLock(
    store,
    'owner-1',
    60_000,
    async () => 'completed',
    { onReleaseFailure: (error) => reported.push(error) }
  );

  assert.equal(outcome.acquired, true);
  assert.equal(outcome.result, 'completed');
  assert.equal(state.held, null);
  assert.equal(reported.length, 1);
});
