# Production SSO — Phase 14D

ChadwickOps remains the only authentication authority. Production receives no employee passwords, Ops session cookies or AUTH_SECRET. No external IdP is used. Production's own role database remains authoritative for Production access.

## Configuration (not configured by this change)

Set the following in both server environments, with exactly matching values where shared:

- `CHADWICK_OPS_SSO_ORIGIN`: approved local `http://ops.localhost:3000`; HTTPS canonical Ops origin in production.
- `PRODUCTION_APP_ORIGIN`: approved local `http://production.localhost:3101`; a distinct company hostname in production.
- `PRODUCTION_SSO_CLIENT_ID`: a nonsecret environment-specific client ID.
- `PRODUCTION_SSO_CLIENT_SECRET`: independent 32-byte random credential encoded as 64 lowercase hex characters; server-only, different from every existing key. Provision through the operator's secret manager later; no operational secrets were generated here.
- `PRODUCTION_SSO_REDIRECT_URI`: exactly Production origin plus `/api/auth/sso/callback`.
- `PRODUCTION_SSO_POST_LOGOUT_URI`: exactly Production origin plus `/auth/signed-out`.
- `SSO_ALLOW_LOOPBACK_HTTP=true`: non-production development only, for the approved distinct `.localhost` hosts. HTTPS remains mandatory with `NODE_ENV=production`.

Ops retains its existing `DATABASE_URL` and private `AUTH_SECRET` (at least 32 characters for SSO continuation encryption). Configure its installed Auth.js canonical URL using supported `AUTH_URL`/legacy `NEXTAUTH_URL` consistently with `http://ops.localhost:3000`; do not leave an old localhost or conflicting alias. Production retains its own `PRODUCTION_SESSION_SECRET` and database connection. Never copy AUTH_SECRET to Production.

Next.js may put an internal listening hostname in request.url. SSO compares the actual Host against the exact configured public authority, then constructs URLs only from the configured origin. X-Forwarded-Host never chooses an allowed origin. The proxy must preserve the canonical public Host. Isolated tests cover this behavior and actual incoming-JWT expiry capping.

No environment files, database, account, password, deployment or VPS settings were accessed or changed. Operators must verify local hostname resolution and both browser/backchannel access. Existing localhost cookies do not migrate to the new hostname. The proxy must strip untrusted forwarded host headers and preserve the canonical host; no trusted origins are derived from client headers. Exclude callback queries, secret headers and auth bodies from ingress/APM logs before rollout.

## Flow and guarantees

`/api/sso/authorize` explicitly validates registered client, exact redirect, state and S256 challenge, then uses the actual existing Auth.js browser session plus fresh active/version/profile checks. An existing Ops session goes straight to Production without credentials. A missing session goes to existing `/login?sso=1`, carrying only an encrypted, five-minute, Ops-host-only continuation cookie. Existing credential login establishes its normal Ops session; a top-level `/api/sso/resume` navigation continues the validated request. Normal login still goes home.

The authority issues a 60-second opaque code. Only a digest is stored under private `sso:code:*` keys in existing `system_config`. Issuance is limited globally/per bucket; active codes are capped at four per user. Issuance serialization, bounded expiry cleanup and atomic conditional DELETE RETURNING consumption operate across workers. The predicate binds code digest, exact client, exact redirect, challenge, code expiry and grant expiry. Only one concurrent exchange can succeed. No process-local or reusable signed-code fallback exists.

Auth.js's displayed session expiry rolls forward. The Ops runtime also verifies the actual incoming JWT using its installed private `getToken` helper, requires matching ID/version and caps grant expiry to that JWT's `exp`. Neither the JWT nor its decryption key is returned or shared with Production.

`/api/sso/exchange` accepts only authenticated backend POST JSON with the dedicated SSO client credential, code, exact redirect/client and PKCE verifier. It rereads current Ops identity after consumption and returns only issuer, client ID, user ID, sessionVersion, username, displayName and grantExpiresAt. No Ops roles/cookies/passwords are returned. Grant lifetime is at most eight hours and never exceeds the Ops session expiry observed at issuance. `/api/sso/revalidate` checks exact protected identity/version, expiry, active state and current profile on every Production protected operation. Account/version revocations apply at the next check; availability failures deny access.

The old password-verification bridge is left unchanged for independent legacy clients; Production has no code path or UI that uses it. Its dedicated identity credential is not accepted by SSO. WorkGuru and read-only Provider APIs are unchanged. No SSO schema migration is needed: existing system_config is reused. Reviewed existing configuration readers use explicit keys; future generic configuration listings must exclude the entire `sso:*` namespace.

## Logout

The Ops header calls the existing CSRF-protected Auth.js signOut, verifies the local session endpoint reports no user, then top-level navigates through `/api/sso/logout?from=ops` to Production's confirmation page. Failure stops locally with a clear message. If SSO is unconfigured, completed local logout still lands on `/login`.

Production-initiated logout clears Production first, then visits `/api/sso/logout?from=production`. GET renders confirmation without changing Ops state. POST requires exact Ops Origin and a matching browser-bound CSRF nonce cookie/form field; Auth.js clears its own cookies, then the browser returns to the fixed Production terminal page. Bad post-logout destinations are never accepted. Logout failure stops locally with an explicit incomplete-signout message. No GET logs a browser out and no terminal page restarts login.

Users must complete both browser steps. Canceled/interrupted flows can leave the other app signed in. Plain Ops cookie deletion/ordinary local signout is not an account-version revocation, so a previously issued Production grant may remain usable up to expiry if browser coordination fails. No immediate other-device/global logout or per-session backchannel revocation is claimed. No account-wide version bump is added to ordinary logout.

## Files in this repository

Added: `src/lib/sso-protocol.ts`, `src/lib/production-sso.ts`, `src/lib/production-sso-store.ts`, `src/lib/production-sso-runtime.ts`; five route wrappers at `src/app/api/sso/{authorize,resume,exchange,revalidate,logout}/route.ts`; `tests/production-sso.test.cjs`; this document.

Modified: `src/app/(auth)/login/page.tsx` (validated SSO continuation only); `src/components/layout/header.tsx` (browser-coordinated logout and failure handling). No changes to auth.ts, schema, users, legacy bridge, WorkGuru or Provider handlers.

## Verification and manual checks

Run `node --test --test-reporter=spec tests/production-sso.test.cjs tests/production-identity.test.cjs tests/authorization.test.cjs` and `node node_modules/typescript/bin/tsc --noEmit --incremental false`. The SSO suite runs actual protocol/core/runtime code in a VM with fake sessions and stores; all real DB/network imports are blocked. Adapter SQL is inspected using Drizzle SQL generation only. Actual Auth.js browser cookie delivery and PostgreSQL concurrency remain manual/disposable-environment checks. `npm run build` (`next build`) completes successfully; no production server was started.

Final verification: 257 passed in the combined SSO/identity/authorization suite (21 SSO, 236 existing), and 49 passed in isolated Provider/status/sync-safety tests. TypeScript and focused new SSO-code ESLint passed, and the production `next build` succeeded. Broader changed-file lint still reports the pre-existing login set-state-in-effect error and existing image/unused-import warnings; the login error was confirmed by linting HEAD. No unrelated lint rules/code were changed or suppressed.

1. Sign into approved Ops hostname, open Production: no credential prompt; correct local Production role or pending state.
2. Clear both sessions, start at Production, sign in through the existing Ops form: return to Production; opening Ops requires no additional login.
3. Try unknown/expired/reused codes, wrong state, absent transaction cookie, wrong PKCE/client/redirect: deny without a Production session. Concurrent redemption yields one success.
4. Deactivate/reset a fixture Ops account through approved disposable account management: next Production protected read/write denies; stale versions are not upgraded.
5. Exercise logout in both directions; complete the other app's confirmation: both cookies clear, no loop. Cancel/fail the second step: explicit incomplete-signout behavior, no global logout promise.
6. Inspect distinct host-only cookies; neither app receives the other's session cookie. Test HTTPS Secure/HttpOnly/Lax attributes and confirm same-host port-only configuration is rejected.
7. Confirm normal Ops login, protected Ops reads, legacy identity and read-only Provider APIs behave as before without triggering any WorkGuru sync.

The complete cross-repository file inventory, results and detailed numbered browser steps are in Production `docs/PHASE_14D_SSO_IMPLEMENTATION.md`.

Suggested Conventional Commit: `feat(auth): authorize Production SSO with single-use PKCE-bound codes`.
