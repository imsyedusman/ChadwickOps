# OPS-2 authorization audit

Audited 70 exported server actions. No provisioning scripts, real database access, WorkGuru calls, migrations, branch merges or deployments were executed. Existing OPS-1 working changes were retained.

## Action inventory

| Module | Every exported action checked |
| --- | --- |
| `src/app/actions/ai-insights.ts` | `generatePageAISummary`, `interpretNaturalLanguageFilter`, `generateProjectNarrative`, `generateGroupNarrative` |
| `src/app/actions/financials.ts` | `getJobCostReport`, `syncProjectFinancials`, `getInvoicedThisMonthReport` |
| `src/app/actions/invoice-sync.ts` | `triggerInvoiceSync`, `getLatestInvoiceSyncStatus` |
| `src/app/actions/procurement-sync.ts` | `triggerProcurementSync`, `getLatestProcurementSyncStatus`, `getProcurementSyncProgress` |
| `src/app/actions/procurement.ts` | `addSupplier`, `updateSupplier`, `deleteSupplier`, `addMasterSupplier`, `updateProjectProcurement`, `getProcurementDashboardData`, `getBackordersData`, `getSupplierRiskData`, `getProjectProcurementDetail` |
| `src/app/actions/production-scheduling.ts` | `getProductionSchedulingData`, `updateScheduledStart`, `resetScheduledStart`, `getProjectStageHours`, `saveProjectStageHours`, `getProjectedLabourCost`, `getBulkLabourCosts`, `getWorkerSuggestionsForProject`, `assignWorkerToStage`, `getWorkerAssignmentsForProject`, `deleteWorkerAssignment`, `fetchWeeklyCapacityBreakdown`, `getSchedulingInsights`, `previewAutoSchedule`, `applyAutoSchedule`, `undoAutoSchedule`, `getWorkerDetail`, `generateAISchedulingInsights` |
| `src/app/actions/profile.ts` | `changeUserPassword` |
| `src/app/actions/profitability.ts` | `triggerProfitabilitySync`, `getLiveProjectDetails` |
| `src/app/actions/project.ts` | `updateProjectOperationalFields` |
| `src/app/actions/sync-project.ts` | `handleSyncProject` |
| `src/app/actions/sync.ts` | `triggerSync`, `triggerFullSync`, `testApiConnection`, `updateApiCredentials`, `initializeSystem`, `getLatestSyncStatus`, `getSyncProgress` |
| `src/app/actions/users.ts` | `getUsersList`, `createUser`, `updateUserStatus`, `updateUserRole`, `resetUserPassword`, `deleteUser` |
| `src/app/actions/workshop-staff.ts` | `getWorkshopStaff`, `importWorkshopStaff`, `updateStaffMember`, `addStaffMemberManually`, `getStaffAbsences`, `addStaffAbsence`, `deleteStaffAbsence` |
| `src/app/actions/workshop.ts` | `getWorkshopArrivals`, `getWorkshopInProgress`, `getWorkshopDepartures`, `getWorkshopTesting` |
| `src/actions/capacity.ts` | `getCapacitySettings`, `updateCapacitySettings` |

## Route inventory

| Route | Protection checked / result |
| --- | --- |
| `/api/diag` GET | Current database-validated session; added admin membership requirement before credential lookup or upstream calls. Removed raw error/stack response. |
| `/api/inspect` GET | Current database-validated session; added admin membership requirement before credential lookup or upstream calls. Removed raw upstream error response. |
| `/api/procurement/export` GET | Existing validated session precedes export/data work; retained. |
| `/api/production/v1/freshness` GET | Existing independent API-key gate retained. |
| `/api/production/v1/projects` GET | Existing independent API-key gate retained. |
| `/api/production/v1/tasks` GET | Existing independent API-key gate retained. |
| `/api/production/v1/stage-hours` GET | Existing independent API-key gate retained. |
| `/api/production/v1/purchase-orders` GET | Existing independent API-key gate retained. |
| `/api/production/v1/suppliers` GET | Existing independent API-key gate retained. |
| `/api/production/v1/workforce/staff` GET | Existing independent API-key gate retained; selected DTO excludes hourly rates. |
| `/api/production/v1/workforce/absences` GET | Existing independent API-key gate retained. |
| `/api/production/v1/workforce/assignments` GET | Existing independent API-key gate retained. |
| `/api/auth/[...nextauth]` GET / POST | Intentionally public Auth.js handlers, including session/login and rate-limit handling. No new session prerequisite. |

## Authorization decisions and changes

- `validateSession` re-reads the user and joined `user_roles` memberships, rejects inactive/deleted accounts and session-version mismatches, replaces stale session roles, and fails closed on lookup errors. Added positive safe-integer ID validation. JWT refresh now marks the account inactive if its account lookup fails instead of retaining active state on error.
- `proxy.ts` remains Auth.js-backed and unchanged. Its matcher excludes APIs and login; it is not used as the action/API authorization boundary. The dashboard layout already validates sessions. Workshop reads now validate independently, including calls made from the standalone workshop page.
- Added reusable `getAuthorizedSession(permission)` and `requireSession()`. Sessions/role lists are never accepted as action arguments. Permissions use only normalized database memberships; the legacy `users.role` label cannot grant permission.
- All manual sync entry points (full/project/procurement/invoice/profitability/financial refresh) require **admin**. The existing OPS-1 admin gate on full sync was retained. API connection tests, credential updates and system initialization require **admin**.
- Procurement mutations require **admin, scheduler or finance**. Project operational field updates and capacity settings require **admin or scheduler**. This uses the existing four-role model; no new role/schema is introduced.
- Project updates now explicitly select their three allowed fields, preventing extra runtime properties from reaching `.set()` despite TypeScript's compile-time parameter type.
- Existing scheduling mutations require **admin or scheduler**; staff import/edit/create and user administration require **admin**; absence changes require **admin or scheduler**; password changes validate the current user's password and update only that session's account. Those existing gates were checked and retained.
- Removed environment-controlled authentication bypasses from scheduling reads and all four AI actions. Tests use VM dependency doubles, never a runtime auth bypass.
- Staff list/detail and worker suggestions no longer send hourly rates or monetary cost scores to non-finance callers. Projected labour-cost reads require **admin or finance**, matching the existing bulk labour-cost gate. Operational staff data and recommendations remain accessible to authenticated users.
- Removed the existing fallback password in `createUser`: an administrator must supply an explicit password of at least 12 characters. No credentials were added.

## Explicit admin provisioning (prepared, not executed)

`scripts/seed-admin.ts` previously wrote only `users.role = admin`, while authorization checks use the `user_roles` join. A freshly seeded administrator could therefore have no effective admin membership.

The prepared script requires explicit `SEED_ADMIN_USERNAME`, `SEED_ADMIN_NAME` and `SEED_ADMIN_PASSWORD` (12+ characters). One transaction ensures the named admin role exists, upserts only that explicitly named account, and inserts the `(user_id, role_id)` membership idempotently. Existing unrelated memberships are preserved. Reprovisioning increments `sessionVersion` to revoke old sessions. Provisioning remains an explicit password reset/reactivation operation; it must not run during application startup. No default identity, password or connection string is embedded. No provisioning or migration script was run, including with mocks.

## Sync conflict and OPS-1 preservation

`syncProjectById` previously called detail processing without acquiring the full-sync lease. It could race a full sync's task/financial refresh, snapshot calculation and destructive orphan cleanup. Both manual project entry points reach this method.

The smallest fix wraps that method in the existing PostgreSQL row lease, using the same key, TTL, heartbeat, ownership guard and release behavior as full sync. A busy lease rejects before detail processing; the guard is installed only while the callback runs and cleared in `finally`. The existing orphan/legacy cleanup rules and full-sync engine were not rewritten. Removed one redundant financial recalculation after `syncProjectById`, so recalculation stays inside the leased method.

The isolated test runs the actual `SyncService` entry methods with an in-memory lock store and fake detail/full work: full blocks single-project, single-project blocks full, and failure releases ownership and clears the guard. OPS-1's separate 38 safety tests still cover completeness, cleanup gating, lease expiry, heartbeat failure and ownership loss.

Separate procurement/invoice/profitability service engines have not been converted to the full-sync lease. Their existing cross-service concurrency behavior remains; authorization is enforced here, but this change does not claim global serialization of every sync engine.

## Verification

| Exact command | Result |
| --- | --- |
| `node --test --test-reporter=spec tests/authorization.test.cjs` | **147 passed, 0 failed.** |
| `node --test --test-reporter=dot tests/authorization.test.cjs` | Final rerun after adding explicit network-attempt tracking: **147 passed, 0 failed.** |
| `node --import tsx --test tests/sync-safety.test.ts tests/production-api.test.ts tests/status-utils.test.ts` | **49 passed, 0 failed:** 38 sync safety, 5 Provider API auth, 6 status regression. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | Initial run failed on generated declarations. **Final verification passed with the normal config**, including generated types; see below. |
| `node node_modules/typescript/bin/tsc --project tsconfig.ops2.json --noEmit` | **Passed.** Checks application sources, the provisioning script and TypeScript tests without importing generated Next.js declarations. |
| `git diff --check` | Passed (only an existing LF/CRLF warning for the OPS-1 diagnostics page). |

The first `tsx` regression invocation failed to initialize on Windows sandbox `uv_os_get_passwd`/`ENOMEM`, before loading tests. It was rerun successfully with approved escalation. The authorization suite uses TypeScript transpilation in an isolated VM with mocked dependencies and a forbidden network function; application modules cannot load live services. Denied callers cannot reach business DB reads/writes, credential decryption, service construction or WorkGuru calls. An authenticated denial necessarily performs the read-only user validation lookup first.

Coverage includes all 70 actions as anonymous callers (with the former bypass environment variable deliberately enabled), viewer denials for mutations, authoritative role refresh, inactive/deleted/revoked accounts, database failure, allowed admin/scheduler/finance workflows, wage redaction, all nine Provider route gates, diagnostic 401/403 behavior, procurement export denial, and public Auth.js handler delegation. Existing Provider auth tests cover valid and invalid Bearer/x-api-key callers. Provisioning was inspected and type-checked only. No full application build or integration tests were run because they can invoke real application dependencies.

## Remaining policy and release limitations

- No audited operational action or private API route is left anonymously accessible. Login/Auth.js routes remain intentionally public; the Provider API intentionally uses its separate key rather than application sessions.
- General operational reads, procurement exports, job-cost/invoicing reports and live profitability details retain their existing **any validated application user** policy. This work does not introduce a finance-only policy for every project/commercial value. Wage and projected labour-cost exposure is now enforced on the server. If finance-only commercial reporting is a release requirement, the report pages and their direct database reads need a separate coordinated policy change.
- Role membership/provisioning in the actual database is unverified by design. Before release, an operator must ensure an intended administrator has an actual normalized admin membership; the legacy label alone will not work. The prepared script has not changed any real account.
- The normal TypeScript pipeline now passes, including the existing generated Next.js declarations. Those local generated files no longer contain the earlier syntax errors; no regeneration or application/configuration change was needed in the final verification. This is not a production-build certification.
- Independent sync engines can still overlap each other; only full-vs-single-project concurrency is covered by the shared OPS-1 lease. If parallel manual sync families are allowed in production, coordinate those operations or address cross-service serialization before enabling them concurrently.
- VPS deployment readiness is therefore **not certified**. No VPS was accessed, and no live integration, credential configuration or database state was tested.

## Reference branch review

Reviewed local `feat/v2-production-api` using read-only `git show` / `git diff`. It contains candidate guards for project, workshop, procurement sync and diagnostic routes, but also an environment auth bypass, a legacy-role fallback and a cookie-presence proxy. Those changes were not merged or copied wholesale. No fetch, pull, merge, reset, commit or push occurred.

## Final verification of the 30-file change set

Reviewed all 22 modified tracked files and 8 untracked files, including the OPS-1 files already present before OPS-2. No unrelated application edits or newly embedded credentials were found. A local scan of all 30 files checked credential-bearing database URLs, private keys, common service-token formats and literal secret assignments; it reported no matches. This is a scoped review, not a complete Git-history secret audit.

The pre-existing, unchanged `scratch-query.js` still contains a credential-bearing local database URL. Its value was not printed or used. It is outside this change set; removal and credential rotation remain separate work before publishing or sharing the repository. No production infrastructure was changed.

Final verification made no application-logic changes. Only a stale lease comment and historical/current report wording were corrected. The older release assessment is now explicitly marked historical so its old migration/provisioning sequence is not mistaken for a current runbook.

Final commands and results:

- `node --test --test-reporter=spec tests/authorization.test.cjs`: **147 passed, 0 failed**.
- `node --import tsx --test tests/sync-safety.test.ts tests/production-api.test.ts tests/status-utils.test.ts`: **49 passed, 0 failed**. The loader emits a Node deprecation warning; it does not affect results.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: **passed**, normal project configuration and generated declarations included.
- `node node_modules/typescript/bin/tsc --project tsconfig.ops2.json --noEmit`: **passed**.
- `git diff --check`: **passed**, apart from the informational LF/CRLF warning on the existing diagnostics page.

No application server, production build, provisioning script, migration or integration test was started. All executed tests were isolated from databases and WorkGuru. A browser workflow against a real deployment was not verified.

Remaining limits confirmed during review:

1. The admin script is prepared only. Real role memberships are unknown. Explicit provisioning resets/reactivates the named account and invalidates old sessions; it must never run automatically. A legacy `users.role` label does not grant admin access.
2. Full and single-project sync share the OPS-1 lease. Procurement, invoice, profitability and staff-import operations do not all share that lease. Run sync families sequentially; global serialization is not implemented.
3. OPS-1 still assumes nonempty nested timesheet/invoice arrays are complete. A failed/incomplete dedicated invoice response can leave that nested-array completeness flag true. Those responses were not checked live, and the helper tests do not establish their completeness. This inherited sync limitation needs review before claiming complete data-loss protection; it was not rewritten during this final check.
4. The SQL lease adapter itself was not integration-tested against PostgreSQL. Its ownership check matches the owner but does not independently enforce expiry; fake-store expiry tests are not proof of the SQL adapter's behavior. Lease protection should not be treated as full fencing of every write after a long process pause.
5. General commercial reads retain the authenticated-user policy described above. No production build, live permissions/provisioning or production configuration was verified.

**Commit assessment:** the scoped OPS-1/OPS-2 changes are suitable to commit as reviewed, with these limitations documented. A commit is not deployment approval or certification that every sync family is safe to overlap. Include the new permission/lease/safety helpers and tests along with their callers; do not commit only the tracked modifications.

Suggested Conventional Commit message: `fix(security): enforce server-side authorization and guard sync operations`.

### Simple manual checks (instructions only; not executed)

Use a separately configured local/staging instance with disposable fixture data, fixture accounts and mocked WorkGuru. Do not point these checks at production. If that environment is not available, defer the browser checks rather than running them on the current configured database.

| Step | Expected result |
| --- | --- |
| In a private browser window, open `/login`, then a dashboard page. | Login page is public; dashboard redirects to login. |
| Logged out, request `/api/diag`, `/api/inspect` and `/api/procurement/export`. | Each returns 401, with no WorkGuru request. |
| Log in as a viewer. Open the workshop board and inspect staff/action response data. | Operational reads work. Hourly rates and worker cost scores are null; raw wages are absent from these responses. |
| As viewer, attempt a project/procurement change or manual sync, using a captured fixture action request if the control is hidden. | Action denies access; fixture rows and mocked WorkGuru call counts do not change. Next.js action denials may be returned as an action result/error rather than HTTP 403. |
| Log in as scheduler. Change an allowed project field and procurement note on a disposable project; try manual sync. | The allowed edits persist; sync is denied. Fields outside the explicit project allow-list cannot be changed. |
| Log in as finance. Open staff cost data and change a disposable procurement note; try changing a project operational field. | Finance wage responses and procurement edit work; project operational edit is denied. |
| As admin, load `/diagnostics/sync` without clicking its button. | Page load does not trigger a sync. |
| With mocked WorkGuru only, start a full sync, then single-project sync; repeat in reverse. | The second operation reports a sync is already running; only the first reaches mocked detail work. After completion/failure, a later request is allowed. Do not overlap the independent sync engines. |
| Request a Provider API endpoint without a key, then with the staging test key. | With a configured server key: no/wrong key gets 401; valid key gets the read-only data response without application login. An unconfigured server key returns 500. |

Do not run `seed-admin.ts` as a manual smoke test. Provisioning correctness was reviewed and type-checked only; a future explicitly authorized provisioning exercise should use a disposable database and verify the actual `user_roles` membership and old-session invalidation.
