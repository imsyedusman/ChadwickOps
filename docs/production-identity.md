# Chadwick Production identity bridge

This additive API verifies existing ChadwickOps passwords for the Chadwick Production backend. It does not issue Ops cookies/tokens, share sessions, expose Ops roles or maintain another password store. Existing Ops login, Provider API endpoints and sync behavior are unchanged.

## Design review before implementation

- The existing NextAuth Credentials provider trims/lowercases the username, restricts its domain, verifies the existing bcrypt hash and requires an active user. The bridge follows that behavior using the same bcrypt library and existing account fields, but deliberately does not call NextAuth `authorize`: that callback also writes last-login information and returns Ops roles/session data.
- Existing password resets, role/status changes and password changes increment `sessionVersion`. Bridge authentication returns that version and revalidation compares it to a fresh database read. Deactivation/deletion is also checked. No user record or role is written by the bridge.
- The existing login limiter is in-memory and unsuitable for multiple workers. The bridge uses atomic PostgreSQL counters in the existing `system_config` table, with no schema change. There is no per-process fallback if the database fails.
- A dedicated, independently generated identity secret is essential: the read-only Provider key must not grant password-verification or identity access. Missing, malformed or reused configuration disables the bridge before database module loading.
- Passwords travel only in an HTTPS POST body from the Production backend. An API secret in a browser, URL, repository, analytics event or application log would expose the credential-verification service. The implementation does not log bodies, passwords, usernames, secrets or caught exceptions.
- Generic failure status/body and bcrypt work for unknown accounts reduce account-enumeration exposure, consistent with the [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html). This is not a guarantee of identical timing across existing bcrypt hashes with different work factors.

## Configuration contract (no deployment changes made)

Both backends need the same dedicated `CHADWICK_PRODUCTION_IDENTITY_SECRET`: generate **32 cryptographically random bytes encoded as 64 lowercase hex characters** using a trusted secret manager. Do not use a human-chosen value. Format is enforced; randomness cannot be established from configuration text. The secret must differ from `CHADWICK_PRODUCTION_API_KEY`, its legacy `PRODUCTION_API_KEY` alias, and `AUTH_SECRET`; matching configured values are rejected.

The bridge returns 503 until the identity secret is correctly configured. Do not add the secret to `NEXT_PUBLIC_*`, client code, logs, examples or Git. Existing `DATABASE_URL` is reused without editing it. No secrets were generated, read from local environment files, configured or deployed for this work.

Use HTTPS with normal server certificate validation. This repository's handler cannot prevent an external proxy/APM from recording bodies or authorization headers: independently verify that those systems exclude these requests from body/header capture before enabling the integration. Do not enable HTTP debug/body logging in either application. No proxy, infrastructure or deployment setting was changed here.

## HTTP contract

Both endpoints are **server-to-server POST only**:

- `/api/production/v1/identity/authenticate`
- `/api/production/v1/identity/revalidate`

Send `Authorization: Bearer <dedicated identity secret>` and `Content-Type: application/json`. Provider `x-api-key` headers and Ops session cookies are not accepted as identity authentication. Do not send query parameters or content encodings.

Authenticate request fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `username` | string | Existing Ops username; trimmed/lowercased, approved domain required; at most 255 input characters. |
| `password` | string | Existing Ops password, unchanged; never trimmed, stored or echoed. |

Revalidate request fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `userId` | string | Positive decimal Ops ID previously returned by authenticate. |
| `sessionVersion` | integer | Positive version previously returned by authenticate. |

Each successful response is exactly an object containing `userId` (string) and `sessionVersion` (integer). No name, email, username, password hash, Ops permissions, password, session cookie or session token is returned. Revalidation never selects the password hash. Unexpected fields are rejected. Requests are limited to 4096 actual streamed body bytes, including when Content-Length is absent or misleading, with a five-second body-read deadline.

| Status | Meaning / body |
| --- | --- |
| 200 | Credentials/identity verified; minimal identity tuple. |
| 401 | Missing/wrong service key, invalid input, wrong password, unknown/inactive/deleted/revoked account: `{"error":"Identity verification failed"}`. |
| 429 | Shared rate limit exceeded: `{"error":"Too many requests"}`, plus `Retry-After` seconds. |
| 503 | Missing/invalid secret configuration, database/limiter failure or internal verification error: `{"error":"Identity service unavailable"}`. Fail closed. |

All handler responses include `Cache-Control: no-store, private, max-age=0`, `Pragma: no-cache`, `Expires: 0` and `Vary: Authorization`. POST handlers are dynamic and never use React/Next caching. Unsupported HTTP methods receive Next.js's standard 405 response and cannot access identity data. No Set-Cookie header is produced.

## Production backend responsibilities

1. Accept the user's password only over HTTPS and immediately forward it server-side to authenticate. Do not retain it in the Production database/session or log it. Never proxy the identity secret to a browser.
2. On 200, create **Production's own** signed/encrypted or server-backed session, storing the returned ID/version in protected server-trusted state. Do not share Ops cookies. Apply Production's own authorization independently; Ops roles are intentionally not provided.
3. Revalidate the protected session's exact ID/version server-side on every protected request. Do not take this tuple from browser-supplied fields and do not treat it as a token proving that a password was checked. Anyone holding the service secret is a trusted identity client.
4. On 401 from revalidate, invalidate the Production session. On 429/503/timeouts, deny the protected operation; never fall back to cached success or an older version. Never replace a revoked version with a current one without new password verification.
5. Rate-limit public login submissions in Production as well. This Ops-side limiter is an additional shared boundary. Do not automatically retry wrong credentials. Honor Retry-After on throttling.

The bridge cannot enforce these client-side-of-the-integration responsibilities from this repository. Chadwick Production was not edited or contacted. Password changes that bypass the established `sessionVersion` increment will not revoke a stored identity tuple; use existing account-management paths.

## Distributed rate limiting and operational tradeoffs

- Authenticate: **30 requests per 60 seconds globally**, plus **5 attempts per 300 seconds per opaque username bucket**. Successes and failures both count. Malformed, service-authenticated requests consume the global budget too.
- Revalidate: **300 requests per 60 seconds globally**, independent of authenticate. Protected requests must deny rather than bypass checks if traffic exceeds this budget.
- Counters are one atomic `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE ... RETURNING` per consumed scope. PostgreSQL statement time controls expiry; simultaneous workers/instances sharing the database share the budget. Exceeding a scope stops processing before account lookup or bcrypt. Backend/store exceptions return 503 with no in-memory fallback.
- Two global rows and at most 1024 reusable username-bucket rows bound storage growth. Bucket assignment is HMAC-SHA256 keyed with the identity secret; no username/IP/password is stored in counters. Fixed buckets can collide, so unrelated users can conservatively share a limit. Counter rows are reused, not periodically deleted.
- No trust is placed in client IP, X-Forwarded-For or X-Real-IP for these limits. Moving between workers or spoofing those headers does not reset a budget. Secret rotation changes bucket mapping but not global counters; coordinate rotations explicitly.
- Limits deliberately favor safety over availability. One compromised identity client can exhaust the shared budget. These counters do not protect the edge from unkeyed volumetric traffic; existing ingress protections remain relevant. This work adds no infrastructure configuration.

At runtime, authenticated requests write **only rate-limit metadata** in `system_config`. No real database calls were made during development. No migrations, tables, users, roles, Ops sessions or last-login timestamps were changed.

## Isolated verification

The dedicated suite compiles the actual new handlers in a VM with explicit dependencies. Real bcrypt is exercised against synthetic hashes; every database import is blocked or stubbed. Fake shared stores exercise limits across handler instances and concurrent calls. The SQL adapter is inspected with a stubbed DB and Drizzle query generation; real PostgreSQL execution/concurrency is **not** integration-tested. No production build or application server was started.

Final verification results:

| Exact command | Result |
| --- | --- |
| `node --test --test-reporter=spec tests/production-identity.test.cjs` | **60 passed, 0 failed**. |
| `node --test --test-reporter=spec tests/production-identity.test.cjs tests/authorization.test.cjs` | **209 passed, 0 failed**: 60 identity + 149 existing authorization tests. |
| `node --import tsx --test tests/sync-safety.test.ts tests/production-api.test.ts tests/status-utils.test.ts` | **49 passed, 0 failed**. Node emitted the existing tsx loader deprecation warning. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | **Passed**, normal project configuration. |
| `node node_modules/eslint/bin/eslint.js src/lib/production-identity.ts src/lib/production-identity-store.ts src/app/api/production/v1/identity/authenticate/route.ts src/app/api/production/v1/identity/revalidate/route.ts` | **Passed**, no warnings or errors. |
| `git diff --check` and a whitespace/credential-pattern scan of all six new files | **Passed**, no trailing whitespace or credential-pattern matches. Synthetic test passwords/hashes are generated/used only within isolated tests. |

Total final suite coverage: **258 tests passed**. No real authentication request, production database access, WorkGuru request, migration, user change, infrastructure change, commit, push or deployment occurred. The secret was not configured. SQL adapter execution on PostgreSQL, proxy/APM redaction and the Production-side session integration remain unverified.

Exact files added (no existing tracked files modified):

- `src/app/api/production/v1/identity/authenticate/route.ts`
- `src/app/api/production/v1/identity/revalidate/route.ts`
- `src/lib/production-identity.ts`
- `src/lib/production-identity-store.ts`
- `tests/production-identity.test.cjs`
- `docs/production-identity.md`

## Manual verification (instructions only)

Use a disposable local/staging database and fixture users only, with two app instances sharing that database. Keep real credentials and production URLs out of the test client and its logs. None of these HTTP calls were performed for this change.

1. With no identity secret configured, submit a fixture request: expect 503. Existing Ops login and the read-only Provider API should continue behaving as before.
2. Configure an independent random identity secret in both test backends. Call either identity endpoint with no key, the Provider key or a wrong identity key: expect 401, no user queries and no counter writes.
3. Authenticate an active fixture account with its correct password: expect 200 with only userId/sessionVersion, no Set-Cookie and no-store headers. Confirm lastLoginAt and user/role rows did not change; only counter metadata may change.
4. Try wrong passwords, nonexistent fixture names and an inactive fixture: expect the same 401 JSON. Inspect client/app/APM logs and confirm they contain no bodies, passwords or service secrets.
5. Revalidate a successful fixture identity tuple: expect 200. Using fixture-only account management, deactivate it or increment its version; the old tuple must return the same generic 401 and Production must clear/deny its session. Do not test this against actual users.
6. Across the two test instances, make six attempts for one normalized username within five minutes: only the first five proceed to password checking; the sixth gets 429 and Retry-After. Changing forwarded IP headers must not help. After the window, attempts are allowed again.
7. Send malformed JSON, extra role fields and a streamed body larger than 4096 bytes: expect generic 401 with no account lookup. Check the global limit also applies to malformed authenticated requests.
8. Make the disposable rate-limit store unavailable: expect 503, no fallback authentication and no sensitive error details. Confirm Production fails closed for 429/503/timeouts too.

Do not enable the integration in production until the separate secret, Production session/revalidation behavior, HTTPS and log-redaction configuration have been verified by their operators. No deployment settings are changed by this patch.

Suggested Conventional Commit: `feat(auth): add server-to-server Production identity bridge`.
