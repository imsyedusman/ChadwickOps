import { db } from "@/db";
import { sql } from "drizzle-orm";
import { identityStore } from "./production-identity-store";
import type { CodeGrant, SsoStore } from "./production-sso";

// Existing readers use explicit config keys. Never expose this private namespace in a config listing.
export const ssoStore: SsoStore = {
  rate: (key, limit, seconds) => identityStore.consumeRateLimit(`sso:rate:${key}`, limit, seconds),
  findIdentity: id => identityStore.findIdentity(id),
  async issue(hash, grant) {
    return db.transaction(async tx => {
      await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(1404, 1)`);
      await tx.execute(sql`DELETE FROM system_config WHERE id IN (
        SELECT id FROM system_config WHERE key LIKE 'sso:code:%'
        AND (value->>'codeExpiresAt')::numeric <= extract(epoch from statement_timestamp()) LIMIT 256
      )`);
      const count = await tx.execute(sql`SELECT count(*)::int AS n FROM system_config
        WHERE key LIKE 'sso:code:%' AND value->>'userId' = ${grant.userId}
        AND (value->>'codeExpiresAt')::numeric > extract(epoch from statement_timestamp())`);
      if (Number(count[0]?.n) >= 4) return false;
      const rows = await tx.execute(sql`INSERT INTO system_config(key, value, created_at, updated_at)
        VALUES (${`sso:code:${hash}`}, ${JSON.stringify(grant)}::jsonb || jsonb_build_object('codeExpiresAt', extract(epoch from statement_timestamp()) + 60), now(), now())
        ON CONFLICT (key) DO NOTHING RETURNING id`);
      return rows.length === 1;
    });
  },
  async consume(hash, clientId, redirectUri, challenge) {
    // Single statement: at most one concurrent redemption can return this row.
    const rows = await db.execute(sql`DELETE FROM system_config WHERE key = ${`sso:code:${hash}`}
      AND value->>'clientId' = ${clientId} AND value->>'redirectUri' = ${redirectUri}
      AND value->>'challenge' = ${challenge}
      AND (value->>'codeExpiresAt')::numeric > extract(epoch from statement_timestamp())
      AND (value->>'grantExpiresAt')::numeric > extract(epoch from statement_timestamp()) RETURNING value`);
    return rows.length === 1 ? rows[0].value as CodeGrant : null;
  },
};
