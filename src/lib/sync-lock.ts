import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { SYNC_LOCK_KEY, type SyncLockStore } from './sync-safety';

/**
 * PostgreSQL-backed sync lease stored in the existing `system_config` table.
 *
 * Why a row lease rather than `pg_advisory_lock`:
 *  - `pg_advisory_lock` is bound to a single database session. The app runs on a
 *    pooled connection (postgres.js `max: 10`), so acquire/heartbeat/release could
 *    land on different connections and silently fail to release.
 *  - A row lease is a plain atomic statement, so it works across processes, across
 *    Node workers and across multiple VPS app instances sharing one database.
 *
 * No schema change is required: `system_config` already exists with a unique `key`.
 *
 * `expiresAt` is always written as an ISO-8601 UTC string (`toISOString()`), so the
 * lexicographic comparison below is safe and cannot raise a cast error on a
 * malformed legacy value.
 */
export function createPostgresSyncLock(): SyncLockStore {
  return {
    async acquire(ownerId: string, ttlMs: number): Promise<boolean> {
      const nowIso = new Date().toISOString();
      const expiresAt = new Date(Date.now() + ttlMs).toISOString();

      const rows = (await db.execute(sql`
        INSERT INTO system_config (key, value, created_at, updated_at)
        VALUES (
          ${SYNC_LOCK_KEY},
          jsonb_build_object('owner', ${ownerId}::text, 'expiresAt', ${expiresAt}::text),
          now(),
          now()
        )
        ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value,
              updated_at = now()
          WHERE system_config.value->>'owner' = ${ownerId}
             OR system_config.value->>'expiresAt' IS NULL
             OR system_config.value->>'expiresAt' < ${nowIso}
        RETURNING id
      `)) as unknown as unknown[];

      return rows.length > 0;
    },

    async heartbeat(ownerId: string, ttlMs: number): Promise<boolean> {
      const expiresAt = new Date(Date.now() + ttlMs).toISOString();

      const rows = (await db.execute(sql`
        UPDATE system_config
           SET value = jsonb_set(value, '{expiresAt}', to_jsonb(${expiresAt}::text)),
               updated_at = now()
         WHERE key = ${SYNC_LOCK_KEY}
           AND value->>'owner' = ${ownerId}
        RETURNING id
      `)) as unknown as unknown[];

      return rows.length > 0;
    },

    async verify(ownerId: string): Promise<boolean> {
      const rows = (await db.execute(sql`
        SELECT id
          FROM system_config
         WHERE key = ${SYNC_LOCK_KEY}
           AND value->>'owner' = ${ownerId}
         LIMIT 1
      `)) as unknown as unknown[];

      return rows.length > 0;
    },

    async release(ownerId: string): Promise<void> {
      await db.execute(sql`
        DELETE FROM system_config
         WHERE key = ${SYNC_LOCK_KEY}
           AND value->>'owner' = ${ownerId}
      `);
    },
  };
}
