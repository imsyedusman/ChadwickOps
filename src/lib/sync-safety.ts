/**
 * Pure safety rules for the WorkGuru -> ChadwickOps sync engine.
 *
 * This module deliberately has NO database, network or filesystem imports so the
 * rules can be unit-tested in isolation. All I/O lives in `sync.ts` / `sync-lock.ts`.
 *
 * The guiding principle: a destructive cleanup may only run when the remote
 * payload it is based on has been *verified* to be complete. A failed, malformed
 * or truncated response is never treated as an empty result.
 */

/** Canonical `system_config` key holding the cross-process sync lease. */
export const SYNC_LOCK_KEY = 'SYNC_LOCK:FULL';

/** Lease lifetime. Refreshed by the heartbeat at roughly one third of this value. */
export const SYNC_LOCK_TTL_MS = 15 * 60 * 1000;

export type CollectionIssue =
  | 'malformed-response'
  | 'api-reported-failure'
  | 'incomplete-pagination';

export interface CollectionAssessment<T> {
  /** True only when the payload is structurally valid AND known to be complete. */
  complete: boolean;
  items: T[];
  issue?: CollectionIssue;
  detail?: string;
}

export interface AssessCollectionOptions {
  /**
   * Page size requested from the API. Used to detect silent truncation when the
   * response does not report a `totalCount`.
   */
  requestedLimit?: number;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
}

/**
 * Normalises a WorkGuru list response and decides whether it can be trusted as a
 * complete snapshot.
 *
 * Supports the three shapes the WorkGuru API has been observed to return:
 *   1. `{ result: [...] }`
 *   2. `{ result: { items: [...], totalCount? } }`
 *   3. `{ items: [...] }`
 */
export function assessCollection<T>(
  data: unknown,
  entityName: string,
  options: AssessCollectionOptions = {}
): CollectionAssessment<T> {
  if (data === null || data === undefined || typeof data !== 'object') {
    return {
      complete: false,
      items: [],
      issue: 'malformed-response',
      detail: `${entityName}: response was not an object`,
    };
  }

  const envelope = data as Record<string, unknown>;

  if (envelope.success === false) {
    return {
      complete: false,
      items: [],
      issue: 'api-reported-failure',
      detail: `${entityName}: API reported success=false`,
    };
  }

  const result = envelope.result;
  let items: unknown[] | undefined;
  let totalCount: number | undefined;

  if (Array.isArray(result)) {
    items = result;
    totalCount = toFiniteNumber(envelope.totalCount);
  } else if (result && typeof result === 'object' && Array.isArray((result as Record<string, unknown>).items)) {
    const inner = result as Record<string, unknown>;
    items = inner.items as unknown[];
    totalCount = toFiniteNumber(inner.totalCount) ?? toFiniteNumber(envelope.totalCount);
  } else if (Array.isArray(envelope.items)) {
    items = envelope.items as unknown[];
    totalCount = toFiniteNumber(envelope.totalCount);
  }

  if (!items) {
    return {
      complete: false,
      items: [],
      issue: 'malformed-response',
      detail: `${entityName}: could not find an items array`,
    };
  }

  if (totalCount !== undefined && items.length < totalCount) {
    return {
      complete: false,
      items: items as T[],
      issue: 'incomplete-pagination',
      detail: `${entityName}: received ${items.length} of ${totalCount} rows`,
    };
  }

  const { requestedLimit } = options;
  if (totalCount === undefined && requestedLimit !== undefined && requestedLimit > 0 && items.length >= requestedLimit) {
    return {
      complete: false,
      items: items as T[],
      issue: 'incomplete-pagination',
      detail: `${entityName}: received ${items.length} rows at the requested page limit of ${requestedLimit} and the total is unknown`,
    };
  }

  return { complete: true, items: items as T[] };
}

export interface OrphanCleanupPlan<Row> {
  delete: Row[];
  skipped: boolean;
  reason?: string;
}

/**
 * Decides which locally stored rows may be deleted.
 *
 * Deletion is only ever planned when `verified` is true, i.e. the caller has
 * confirmed that the remote collection was retrieved completely. Otherwise the
 * local rows are preserved untouched.
 */
export function planOrphanCleanup<Row>(params: {
  local: readonly Row[];
  verified: boolean;
  keepIds: ReadonlySet<string>;
  getWorkguruId: (row: Row) => string | null | undefined;
  reason?: string;
}): OrphanCleanupPlan<Row> {
  const { local, verified, keepIds, getWorkguruId, reason } = params;

  if (!verified) {
    return {
      delete: [],
      skipped: true,
      reason: reason ?? 'remote collection was not verified complete',
    };
  }

  const deletable = local.filter((row) => {
    const id = getWorkguruId(row);
    if (!id) return false;
    return !keepIds.has(id);
  });

  return { delete: deletable, skipped: false };
}

export interface ProjectIdRow {
  id: number;
  workguruId: string;
  projectNumber: string;
}

export interface LegacyCleanupPermission {
  allowed: boolean;
  reason?: string;
}

/**
 * Gate in front of the slash-ID cleanup. Deletion must never be based on a project
 * list whose completeness has not been established.
 */
export function canRunLegacyCleanup(params: {
  remoteListComplete: boolean;
  remoteProjectIds: ReadonlySet<string>;
}): LegacyCleanupPermission {
  if (!params.remoteListComplete) {
    return { allowed: false, reason: 'the WorkGuru project list was not verified complete' };
  }
  if (params.remoteProjectIds.size === 0) {
    return { allowed: false, reason: 'no verified WorkGuru project IDs in this run' };
  }
  return { allowed: true };
}

export interface LegacyDuplicatePlan {
  deleteIds: number[];
  kept: Array<{ id: number; workguruId: string; reason: string }>;
}

/**
 * Identifies slash-containing `workguru_id` rows that are *provably* legacy
 * duplicates of a canonical numeric project.
 *
 * A row is only deletable when ALL of the following hold:
 *   1. its `workguru_id` is not present in the current WorkGuru project list, and
 *   2. a slash-free sibling row with the same `project_number` exists, and
 *   3. that sibling's `workguru_id` IS present in the current WorkGuru list.
 *
 * Condition 3 is the actual evidence: WorkGuru confirms the numeric ID for this
 * project, so the slash form cannot be the live identifier.
 */
export function findVerifiedLegacyDuplicates(
  rows: readonly ProjectIdRow[],
  remoteProjectIds: ReadonlySet<string>
): LegacyDuplicatePlan {
  const plan: LegacyDuplicatePlan = { deleteIds: [], kept: [] };

  if (remoteProjectIds.size === 0) {
    for (const row of rows) {
      if (row.workguruId.includes('/')) {
        plan.kept.push({
          id: row.id,
          workguruId: row.workguruId,
          reason: 'no verified WorkGuru project IDs in this run',
        });
      }
    }
    return plan;
  }

  const canonicalByProjectNumber = new Map<string, string[]>();
  for (const row of rows) {
    if (row.workguruId.includes('/')) continue;
    const existing = canonicalByProjectNumber.get(row.projectNumber) ?? [];
    existing.push(row.workguruId);
    canonicalByProjectNumber.set(row.projectNumber, existing);
  }

  for (const row of rows) {
    if (!row.workguruId.includes('/')) continue;

    if (remoteProjectIds.has(row.workguruId)) {
      plan.kept.push({ id: row.id, workguruId: row.workguruId, reason: 'still referenced by WorkGuru' });
      continue;
    }

    const candidates = canonicalByProjectNumber.get(row.projectNumber) ?? [];
    const verifiedCanonical = candidates.find((id) => remoteProjectIds.has(id));

    if (!verifiedCanonical) {
      plan.kept.push({
        id: row.id,
        workguruId: row.workguruId,
        reason: 'no verified numeric duplicate for this project number',
      });
      continue;
    }

    plan.deleteIds.push(row.id);
  }

  return plan;
}

export interface SyncLockStore {
  /** Must be atomic across processes. Returns false when another owner holds the lease. */
  acquire(ownerId: string, ttlMs: number): Promise<boolean>;
  /** Extends the lease. Returns false when the lease is no longer owned. */
  heartbeat(ownerId: string, ttlMs: number): Promise<boolean>;
  /** Read-only ownership check. Used immediately before destructive writes. */
  verify(ownerId: string): Promise<boolean>;
  release(ownerId: string): Promise<void>;
}

/** Thrown when this process can no longer prove it owns the sync lease. */
export class SyncLockLostError extends Error {
  constructor(message = 'Sync lease is no longer held by this process; aborting the sync.') {
    super(message);
    this.name = 'SyncLockLostError';
  }
}

export interface LeaseGuard {
  /** True once a heartbeat failed or ownership was found to be lost. */
  readonly lost: boolean;
  /**
   * Fails closed: throws `SyncLockLostError` unless ownership has been confirmed
   * directly against the store. Call immediately before any destructive write.
   */
  assertHeld(): Promise<void>;
}

export interface SyncLockOutcome<T> {
  acquired: boolean;
  result?: T;
}

export interface SyncLockCallbacks {
  heartbeatIntervalMs?: number;
  onHeartbeatFailure?: (error: unknown) => void;
  onReleaseFailure?: (error: unknown) => void;
}

/**
 * Refresh cadence for a given lease TTL. Always strictly shorter than the TTL, so
 * a live process renews its lease before expiry and cannot be legitimately stolen.
 */
export function heartbeatIntervalFor(ttlMs: number, overrideMs?: number): number {
  if (overrideMs !== undefined) return overrideMs;
  return Math.max(1, Math.floor(ttlMs / 3));
}

/**
 * Runs `task` while holding a cross-process lease. The lease is always released,
 * including when the task throws.
 *
 * Fail-closed semantics: if a heartbeat returns false (lease taken over) or throws
 * (ownership unknown), the guard is permanently marked lost and every subsequent
 * `assertHeld()` rejects. Destructive work therefore stops as soon as ownership is
 * in doubt.
 */
export async function withSyncLock<T>(
  store: SyncLockStore,
  ownerId: string,
  ttlMs: number,
  task: (guard: LeaseGuard) => Promise<T>,
  options: SyncLockCallbacks = {}
): Promise<SyncLockOutcome<T>> {
  const acquired = await store.acquire(ownerId, ttlMs);
  if (!acquired) return { acquired: false };

  let lost = false;

  const guard: LeaseGuard = {
    get lost() {
      return lost;
    },
    async assertHeld() {
      if (lost) throw new SyncLockLostError();
      const held = await store.verify(ownerId);
      if (!held) {
        lost = true;
        throw new SyncLockLostError();
      }
    },
  };

  // Default refresh cadence. Strictly below the TTL so the lease is always renewed
  // before it can expire, no matter how short the TTL is.
  const intervalMs = heartbeatIntervalFor(ttlMs, options.heartbeatIntervalMs);
  let timer: ReturnType<typeof setInterval> | undefined;

  if (intervalMs > 0) {
    timer = setInterval(() => {
      Promise.resolve()
        .then(() => store.heartbeat(ownerId, ttlMs))
        .then((stillHeld) => {
          if (!stillHeld) lost = true;
        })
        .catch((error: unknown) => {
          // Unknown ownership: stop destructive work rather than risk a second writer.
          lost = true;
          options.onHeartbeatFailure?.(error);
        });
    }, intervalMs);

    const unref = (timer as { unref?: () => void }).unref;
    if (typeof unref === 'function') unref.call(timer);
  }

  try {
    const result = await task(guard);
    return { acquired: true, result };
  } finally {
    if (timer) clearInterval(timer);
    try {
      await store.release(ownerId);
    } catch (error) {
      // The lease will lapse on its own after the TTL.
      options.onReleaseFailure?.(error);
    }
  }
}
