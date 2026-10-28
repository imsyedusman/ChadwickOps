import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { IdentityStore } from './production-identity';

/** Atomic shared counters in the existing table; no migration or process-local fallback. */
export const identityStore: IdentityStore = {
  async consumeRateLimit(key, limit, windowSeconds) {
    // Database time and a single UPSERT avoid application clock skew and check/write races.
    // Counter rows are a fixed bounded keyspace, contain no usernames/IPs and are reused.
    const rows = await db.execute(sql`
      INSERT INTO system_config (key, value, created_at, updated_at)
      VALUES (${key}, jsonb_build_object(
        'count', 1, 'resetAt', extract(epoch from statement_timestamp()) + ${windowSeconds}::int
      ), now(), now())
      ON CONFLICT (key) DO UPDATE SET
        value = CASE
          WHEN (system_config.value->>'resetAt')::numeric <= extract(epoch from statement_timestamp())
          THEN EXCLUDED.value
          ELSE jsonb_set(system_config.value, '{count}',
            to_jsonb((system_config.value->>'count')::int + 1))
        END,
        updated_at = now()
      WHERE (system_config.value->>'resetAt')::numeric <= extract(epoch from statement_timestamp())
         OR (system_config.value->>'count')::int < ${limit}
      RETURNING id
    `);
    return rows.length > 0;
  },
  async findCredentials(username) {
    return db.query.users.findFirst({
      where: eq(users.username, username),
      columns: { id: true, passwordHash: true, isActive: true, sessionVersion: true },
    });
  },
  async findIdentity(id) {
    return db.query.users.findFirst({
      where: eq(users.id, id),
      // Profile fields are returned only after the active/version checks pass.
      columns: { id: true, isActive: true, sessionVersion: true, username: true, name: true },
    });
  },
};
