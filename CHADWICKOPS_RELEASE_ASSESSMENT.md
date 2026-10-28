# ChadwickOps — Pre-Deployment Release Assessment

> Historical assessment written before OPS-1/OPS-2. Its working-tree state, authorization gaps, admin provisioning and sync-lock findings describe the earlier code. See [the OPS-2 audit](OPS-2_AUTHORIZATION_AUDIT.md) for current verification and remaining limitations. Do not use the provisioning/deployment sequence below as a current runbook.

**Date:** 2026-10-28
**Scope:** Read-only assessment of the local repository. No files were modified (this report only), no Git writes, no DB/WorkGuru calls, no VPS access.
**Legend:** **[V]** = verified by reading code/Git on this machine. **[A]** = assumption or inference — needs your confirmation.

---

## 1. Current Git state — **[V]**

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `af06ed0` — "feat(api): consolidate read-only production API v1 on port 3000" (2026-10-19 11:51 +1100, Syed Usman) |
| Upstream | `origin/main` = `e5b4855` — **ahead 1, behind 0** |
| Working tree | **Clean** (tracked, staged, and untracked incl. `-uall`). Nothing to lose locally. |
| Stash | Empty |
| Remote | `https://github.com/imsyedusman/ChadwickOps.git` |
| Worktrees | `ChadwickOps` (main @ af06ed0) and `ChadwickOps-API-Dev` (`feat/production-api-main` @ 53aaaca) |
| Last fetch | `.git/FETCH_HEAD` = 2026-10-18 18:38 — **remote knowledge is ~10 days stale** |

**Branches:**
- `main` — 1 commit ahead of `origin/main`, **never pushed**.
- `feat/v2-production-api` (`35fa6b8`, pushed) — 1 commit ahead of the fork point, **not merged**: 47 files, +12,556 / −80 vs `main` (capacity & risk v2, workforce tabs, `tests/risk-v2.test.ts`, `tests/workforce-v2.test.ts`, proposed SQL).
- `feat/production-api-main` (`53aaaca`, pushed) — content-identical to `main` except `package.json` `dev` script. Occupied by the second worktree, which has **one uncommitted change**: `"dev": "next dev -p 3002 --webpack"` (local port only).

**What could be lost**
- **[V]** The unpushed `af06ed0` is the *only* copy of the Production Provider API (1,430 lines + `docs/production-api.md`). A deploy from a fresh clone, `git reset --hard origin/main`, or a "deploy the remote branch" pipeline would silently ship **without** the API the Chadwick Production app depends on.
- **[V]** No risk to current work from a normal `git pull` (tree is clean, remote hasn't diverged as of the last fetch).
- **[A]** Cannot confirm the remote hasn't moved since 2026-10-18 because no fetch was performed (per instructions). Someone else may have pushed.

---

## 2. What the application is — **[V]**

**Stack:** Next.js 16.2.6 (App Router) · React 19.2.4 · TypeScript (strict) · Tailwind 4 · Drizzle ORM 0.45 + `postgres-js` · PostgreSQL · Node `>=22.13.0` (local Node is v26).

**Structure:** `src/app/(dashboard)` pages (WIP, Workshop, Procurement, Capacity & Risk, Production Scheduling, Reports, Profitability, Logs, Help, Admin), `src/app/actions` server actions, `src/lib` domain logic, `src/db/schema.ts` (26 tables), `src/app/api` route handlers.

**External dependencies:** WorkGuru REST (`api.workguru.io`), PostgreSQL, Ollama (`OLLAMA_URL`) for AI summary cards. NCR/Q2C are outbound links only.

**Authentication / access control:**
- NextAuth v5 beta, credentials + bcrypt, JWT sessions (30 days), `AUTH_SECRET`.
- Login is **domain-restricted** to `chadwickswitchboards.com.au` (`src/auth.ts:54-58`).
- Roles: `admin`, `finance`, `scheduler`, `viewer` via `roles` / `user_roles`, plus legacy `users.role`. `validateSession()` re-reads the user on every request and invalidates on `sessionVersion` change.
- Route protection is `src/proxy.ts` (Next 16's rename of `middleware.ts`) with matcher `/((?!api|_next/static|_next/image|favicon.ico|login).*)`.

**Production API consumed by Chadwick Production:** `/api/production/v1` — 9 **GET-only** endpoints (freshness, projects, stage-hours, tasks, purchase-orders, suppliers, workforce/staff, workforce/absences, workforce/assignments). All call `verifyProductionApiAuth` (Bearer or `x-api-key`, constant-time compare, key `CHADWICK_PRODUCTION_API_KEY`). No DB writes in any route. **[V]**

**Environment keys required** (names only — values not read or reported): `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `CHADWICK_PRODUCTION_API_KEY`, `AUTH_TRUST_HOST`, `NEXTAUTH_URL`, `OLLAMA_URL`, `OLLAMA_MODEL`, `SEED_ADMIN_PASSWORD`. `.env` exists locally and is **not** tracked and nowhere in Git history. **[V]**

---

## 3. Sync flow — **[V]**

**Main sync** (`src/lib/sync.ts`, triggered from the header by a logged-in user, awaited in the browser):
1. `getClients` → upsert `clients`
2. `getAllProjects` (`MaxResultCount: 5000`, **single page, no pagination loop**)
3. `cleanDatabase()` → `DELETE FROM projects WHERE workguru_id LIKE '%/%'` (`sync.ts:125, 732-749`)
4. upsert `projects` (archive flag only when WorkGuru status = `Archived`)
5. global time-entry sync
6. deep cycle over **every non-archived project**, batches of 25, per project: tasks → project detail → purchase orders → time entries → invoices, then **delete "orphans"** (local rows not returned by the API)

**Separate, independently-triggered syncs** (not chained to the main sync, no scheduler anywhere):
- Procurement (`INCREMENTAL` / `FULL` / `RETRY_FAILED`)
- Invoices (last 3 months)
- Profitability (10-year historical pivot reports)
- Workshop staff import (`UserSharedExternal/GetAllUsers`)
- Manual per-project sync

`runSync(mode)` **ignores** `QUICK` vs `FULL`; both entry points do the same full deep cycle. **[V]**

---

## 4. Existing deployment setup — **[V]**

- **No Dockerfile, no docker-compose, no Coolify/nixpacks config, no CI workflows, no vercel.json.** Only an orphan `.dockerignore` exists.
- `README.md` is unmodified `create-next-app` boilerplate. `ARCHITECTURE.md` describes the workflow as `npx drizzle-kit push`.
- `package.json` scripts: `dev`, `build` (`next build`), `start` (`next start`), `lint`, `diag:trace`. **No `db:migrate`, no `test`.**
- `next.config.ts` has security headers only — **no `output: 'standalone'`**.
- **32 Drizzle migrations** (`drizzle/0000`–`0031`) all registered in `meta/_journal.json`, including two hand-authored ones (`0020_drop_columns`, `0021_add_ifm_ifc_columns`).
- **The app never runs migrations at boot** — no `instrumentation.ts`, no migrate call in `src/**`. **[V]**
- **No cron / scheduled jobs / background worker**, and no boot-time sync. Verified by grep for `cron`, `setInterval`, `instrumentation`. **[V]**

**Therefore a deploy (build + start) alone changes no data.** Data changes only when a human triggers a sync or a migration is run manually. **[V]**

**What a deploy would need to supply:** Node 22+, `PORT`, a Postgres database with schema at v0031, all nine env vars, and a reverse proxy with HTTPS (`trustHost: true` is already set). **[A]** for the proxy choice (Coolify/Traefik/Nginx).

---

## 5. Actual deployment blockers

### B1 — `ENCRYPTION_KEY` continuity (highest risk) **[V]**
WorkGuru API credentials are stored in `system_config` encrypted with AES-256-CBC using `ENCRYPTION_KEY`, which must be **exactly 32 characters** (`src/lib/crypto.ts:3-28`). Every sync decrypts them at runtime (`src/app/actions/sync.ts:38-40`). If the VPS gets a new/regenerated key, decryption throws and **every sync, procurement refresh and invoice pull fails** — while the UI still looks healthy. The key must be carried over exactly, or the credentials re-entered after deployment.

### B2 — Migration baseline is unknown **[V]** + **[A]**
There is no migrate script and no record of how the current database was created. `drizzle/0000` uses plain `CREATE TABLE` (no `IF NOT EXISTS`), so running `drizzle-kit migrate` against an already-populated database that lacks a matching `__drizzle_migrations` table will fail part-way — or, if it continues, leave the schema half-applied. **The `__drizzle_migrations` state on the target database must be inspected before deploying.** This is the single biggest "deployment breaks the app" risk.

### B3 — Sync can permanently delete production rows **[V]**
`syncProjectFinancials()` falls back to **empty arrays** if the dedicated PO/invoice/timesheet fetch throws (`sync.ts:905-935`). The orphan-cleanup immediately after (`sync.ts:980-985`, `1023-1027`, `1060-1064`) then deletes **all** local timesheets, purchase orders and invoices for that project. A single rate-limit, timeout or 5xx during a deep sync silently wipes financial detail that cannot be recovered without a backup.

### B4 — Unconditional hard delete on every sync **[V]**
`cleanDatabase()` issues `DELETE FROM projects WHERE workguru_id LIKE '%/%'` on **every** main sync run. It is wrapped in `try/catch` and only logs, so it can also leave FK-referenced rows half-deleted.

### B5 — First sync cannot run reliably as a web request **[V]**
The full cycle calls 5+ WorkGuru endpoints sequentially for every non-archived project, awaited inside one server action. A few hundred projects already means thousands of HTTP calls and many minutes-to-hours. Behind a VPS reverse proxy this will time out, the browser request/action will abort, and the sync will be left partially applied with no resume and no lock (two users clicking sync at once interleave writes and deletes).

### B6 — Admin has no roles after a fresh bootstrap **[V]**
`scripts/seed-admin.ts` inserts the admin user but **does not create `user_roles` rows**. `hasRole()` checks `session.user.roles` (from `user_roles`), so a freshly seeded admin can log in but cannot open `/admin`, drag the Gantt, or change credentials until `scripts/migrate-roles.ts` is also run.

### B7 — Missing authorisation inside server actions **[V]**
These exported actions have **no session/role check at all**:
- `src/app/actions/procurement-sync.ts` — all three (including a full procurement sync **and DB writes**)
- `src/app/actions/project.ts` — `updateProjectOperationalFields` (unauthenticated **DB write**)
- `src/app/actions/sync-project.ts` — triggers a WorkGuru sync
- `src/app/actions/workshop.ts` — four read actions over project/PO data

Protection currently depends entirely on `proxy.ts`. Next's own docs state Proxy "should not be used as a full session management or authorization solution", and the matcher deliberately **excludes `/api` and `/login`** — a Server Action POST is routed by action ID, not by the page it belongs to. On a public VPS this is a real exposure, not a theoretical one.

### B8 — No deployment artefact exists **[V]**
"Safe VPS deployment" currently has nothing to deploy *with*: no Dockerfile/compose/Coolify config, no `.env.example`, no health endpoint, no migrate step, no backup step. This must be written before go-live (task blocker, not a code defect).

### Additional hidden trigger — **[V]**
`src/app/(dashboard)/diagnostics/sync/page.tsx` **automatically runs a FULL sync on page load**. It is not in the sidebar, but any logged-in user who hits the URL (or a bookmarked link) starts a destructive full sync. `src/app/api/diag` and `/api/inspect` are also still present: session-guarded, but they call WorkGuru live and dump full project payloads, and any logged-in viewer can use them.

---

## 6. Risks to existing data

| Risk | Severity | Evidence |
|---|---|---|
| New `ENCRYPTION_KEY` → all syncs fail against existing encrypted credentials | **High** | `crypto.ts:3-28` |
| `drizzle-kit migrate` on a drifted/existing DB → schema damage | **High** | `drizzle/0000` plain `CREATE TABLE`; no migrate script |
| Orphan cleanup deletes timesheets/POs/invoices after a transient API error | **High** | `sync.ts:905-935, 980-1064` |
| `cleanDatabase()` hard delete on every sync | **Medium-High** | `sync.ts:125, 732-749` |
| Two concurrent syncs (e.g. dev machine + VPS on the same DB) | **High** | no lock found |
| `seed-admin.ts` re-run resets the admin password | Medium | `scripts/seed-admin.ts:23-34` |
| Deploy itself | **Low/None** | no boot hooks, no auto-migration, no cron |

**Critical unknown [A]:** whether the VPS will use the **same PostgreSQL database** as the current working environment, or a new one restored from a dump. If it shares the DB, the local machine and the VPS can both trigger syncs into it. This must be decided before anything else.

---

## 7. Verified status/feature coverage findings (not blockers)

**Status model is fragmented — three lists that disagree:**
- `src/lib/constants.ts:23-39` — "canonical" list: `… 2.3 Ready for Testing`, `2.4 - Tested Defective`, **`2.4 - Tested Passed`**, `2.6 Ready for Invoicing`, `3.1 Invoiced`, `3.2 Delivered`, `Cancelled`, `Completed`.
- `src/lib/project-utils.ts:33-57` — `Tested Passed` and `Invoiced` are **active**; `Delivered/Completed/Cancelled` excluded.
- `src/lib/project-logic.ts:12-19` — `tested passed`, `invoiced`, `delivered`, `completed`, `cancelled`, `closed` are all **terminal**.
Result: a staged-passed or invoiced job is "active" on the WIP dashboard and "terminal" in schedule/backlog logic.

**2.4 vs 2.5 — unresolved in code [V], needs your answer [A]:**
`WORKGURU_PROJECT_STATUSES` and `tests/status-utils.test.ts` assert `2.4 - Tested Passed`. `auto-scheduler.ts:166-177` and `GanttChart.tsx:28` use `2.5 - Tested Passed` (and `auto-scheduler` does **not** include `2.4 - Tested Passed`). Both strings exist in Git history. I could not read the live `raw_status` values (that requires a DB/WorkGuru call, which was out of scope). **Which string does WorkGuru actually emit?** If it is `2.4 -`, the auto-scheduler silently excludes those projects; if `2.5 -`, the canonical list and normalizer are wrong.

**Exact-string matching in the hot paths:**
- `auto-scheduler.ts:166-193` — hard-coded list, excludes 1.1/1.2 (intentional) and `2.4 - Tested Passed` (likely not).
- `GanttChart.tsx:28,37-43` — colours/dimming by exact string.
- `src/app/actions/workshop.ts:131,136,160` — `3.2 - Delivered`, `2.3 - Ready for Testing`, `2.4 - Tested Defective`, `2.6`, `3.1` exact matches; anything unrecognised falls into "Data Check Needed".
- `CapacityClientView.tsx:230` — confirmed-only mode matches `1.1 -`/`1.2 -` exactly.

**Delivered / Completed / Cancelled handling:**
- Excluded from WIP totals correctly (`isActiveWorkStatus`). **[V]**
- **Never archived** (only WorkGuru status `Archived` sets `isArchived`), and **not** in the deep-sync cooldown list (`finishedStatuses = completed, invoiced, closed, cancelled` — no `delivered`). Delivered jobs are therefore re-fetched on every full sync forever. **[V]**
- `archiveMissingProjects()` exists but is **dead code — never called**, so nothing is auto-archived. **[V]**
- Production API `activeProjects` and `openPurchaseOrders` counts include delivered/completed/cancelled and all POs (no status filter), so the downstream app's "active" numbers are overstated. **[V]**

**Capacity & Risk:** the headline capacity uses a **manual** `staff` number from `capacity_settings` (default 10 × 38 h × 0.8), while `stage-capacity.ts` uses the real `staff_efficiency` roster and absences — so the two capacity figures can disagree by design. The unmerged `feat/v2-production-api` branch is the fix for this. **[V]**

**Production Gantt / scheduling:** feature-complete on `main` (drag-to-reschedule, stage hours, worker assignment, auto-schedule preview/apply/undo, AI insights) and correctly role-gated on `scheduler`/`admin`. It depends on manual data: `project_stage_hours`, `worker_assignments` and the imported staff roster. **[V]**

**Performance / freshness:**
- WIP dashboard loads **all** non-archived projects and calls `calculateProjectRisk()` per project, which calls `getCapacitySettings()` — **one DB query per project** (N+1) plus a per-row `console.log` of project JSON. **[V]** (`(dashboard)/page.tsx:43-63`, `risk.ts:15-16`, `actions/capacity.ts:29-36`)
- Stage-breakdown chart is permanently empty: `projects.display_stage_id` is **never written** anywhere in `src`, and `stages.ts:45-53` seeds mappings for statuses that don't exist (`2.1 - Ready for Production`, `2.2 - Ready for Testing`, `3.1 - Dispatched`). **[V]**
- No scheduler → freshness depends entirely on someone clicking sync; "Last Updated" comes from the latest `sync_logs` row. **[V]**
- `getAllProjects` requests 5,000 in one page with no paging loop — projects beyond the API cap will never sync. **[V]** (exact cap unconfirmed **[A]**)

**Production API contract vs documentation (`docs/production-api.md`):**
- Docs say `dates.scheduledStart`; the route returns `dates.startDate` (`projects/route.ts:115`).
- Docs say `search` covers number, name **and client**; only number/name are searched (`projects/route.ts:36-43`).
- Docs promise supplier `tier`, `leadTimeWeeks`, `notes`; those columns do not exist — the route returns `id/name/isConfigured/activeOrdersCount` only.
- Docs' freshness example (`syncedProjectsCount`, `mode`, `totalOrders`) does not match the actual shape (`details`, `totalFetched`, `totalHydrated`, `totalFailed`).
If Chadwick Production was written against the doc, these are real integration gaps.

**Minor/hygiene (verified):**
- ~60 scratch/diagnostic/data-dump/log files are **committed at repo root** (`diag_*`, `scratch_*`, `workshop_data_output*.json`, `tailwindcss-*.log`, stale `errors.txt`/`lint_output.txt` from an old `D:\Work\...` path). The unpushed commit adds ignore rules for them but does not untrack them.
- `scratch-query.js` (tracked) contains a **localhost** Postgres URL with a password — local only, but rotate/remove.
- `rate-limiter-flexible` is a dependency but unused; the public production API has no rate limiting.
- `seed-admin.ts` re-run overwrites the admin password.
- Two overlapping production views exist; `/production` is not in the sidebar.

---

## 8. Verification performed (safe, read-only)

| Check | Result |
|---|---|
| `tsc --noEmit` on `src/**` with strict config | **Clean — 0 errors** (a project-wide run only fails on stale generated `.next/dev/types/*`, not source) |
| `node --test` via `tsx` on `tests/status-utils.test.ts` + `tests/production-api.test.ts` | **11/11 pass** |
| `eslint src` | **352 errors / 220 warnings** (mostly `no-explicit-any`); does **not** block `next build` — Next 16 no longer lints during build |
| `next build` | **Not run** — it writes `.next` and may connect to the configured database during prerender; excluded per your rules |
| DB / WorkGuru / VPS | **Not contacted** |

Note: the two test files are not wired to any npm script, and one test's assertions sit inside an **unawaited** dynamic import (`status-utils.test.ts:99-133`), so that test can pass without asserting.

---

## 9. Recommended order of work

**Phase 0 — decisions and safety net (no code)**
1. Decide the database: **new VPS database restored from a dump** (recommended) vs sharing the current one. Then take a verified `pg_dump` and store it off-box.
2. Confirm whether the existing production credentials were encrypted with the **same** `ENCRYPTION_KEY` you will deploy. If not, plan to re-enter WorkGuru credentials via `/admin` after deploy.
3. Decide the release point: push `af06ed0` (or tag a release). Do not deploy from a fresh clone until it is pushed.

**Phase 1 — make deployment possible**
4. Push `main`; decide the fate of `feat/v2-production-api` (leave archived, merge later, or block release on it — it is *not* required for the production API).
5. Add: `Dockerfile` (Node 22, `output: 'standalone'`), compose file (app + Postgres + volume), `.env.example` (names only), `/api/health`, `db:migrate` script, and a documented pre-deploy `pg_dump`.
6. Decide Coolify settings: port, persistent volume, health check, HTTPS/HSTS (headers already set in `next.config.ts`).

**Phase 2 — protect the data (before any sync)**
7. Guard the orphan deletes (`sync.ts:980-1064`) so an empty/failed remote response never deletes local rows, and remove or harden `cleanDatabase()`.
8. Add a single-flight lock around sync (DB advisory lock or a `system_config` claim) so two syncs cannot interleave.
9. Verify migration state on the target DB (`__drizzle_migrations`); baseline it if the DB was built with `drizzle-kit push`.

**Phase 3 — access control**
10. Add session/role checks to the actions listed in **B7**; delete or admin-gate `/api/diag`, `/api/inspect` and `/diagnostics/sync` (and remove its auto-run-on-load behaviour).

**Phase 4 — bootstrap and first data load (maintenance window)**
11. Migrations → `scripts/migrate-roles.ts` → `scripts/seed-admin.ts` (**this exact order**; seed first means the admin gets a password but no roles).
12. Log in, confirm `/admin` is reachable, re-enter/confirm WorkGuru credentials, run `initializeSystem` (display stages).
13. Import workshop staff, then run the **main sync once** and watch it complete; then procurement → invoice → profitability.
14. Verify `/api/production/v1/freshness` shows recent timestamps and sensible counts, and that Chadwick Production receives data.

**Phase 5 — optional improvements (post-go-live)**
15. Resolve the 2.4/2.5 status question and unify the three status lists.
16. Fix the N+1 capacity query and the empty stage breakdown.
17. Align `docs/production-api.md` with the actual response shapes (`startDate` vs `scheduledStart`).
18. Add a scheduled sync (system cron hitting an authenticated job endpoint) if manual freshness is unacceptable.
19. Untrack scratch files, rotate the local DB password in `scratch-query.js`, add an `npm test` script and CI.

---

## 10. Items requiring your approval

1. **Do not deploy from the remote yet** — `af06ed0` is unpushed. Approve pushing it (or nominating a different release commit/tag).
2. **Database strategy** — reuse existing data via restore, or start clean. Who runs the `pg_dump`, and where it is stored.
3. **`ENCRYPTION_KEY`** — reuse the current 32-char key, or accept re-entering WorkGuru credentials after deploy. (I will not read or copy the value.)
4. **Fate of `feat/v2-production-api`** — deferred or a go-live requirement. Today's Capacitiy & Risk numbers use a manual staff count, not the real roster.
5. **Approval to make source edits** for the release blockers: sync data-loss guards (B3/B4), sync lock, auth gaps (B7), removing debug endpoints.
6. **Migration baseline** — permission to inspect `__drizzle_migrations` on the target DB (read-only) before any deploy.
7. **Scheduled vs manual sync** for go-live — there is no scheduler today; freshness depends on a human pressing sync.
8. **2.4 vs 2.5** — which exact WorkGuru status string do "Tested Passed" projects carry? (Answer from WorkGuru settings is enough; no API call needed.)
9. **Existing production data** — confirm whether the VPS already hosts this app's database, and if so, that a restore/overwrite is acceptable.
10. **Repo visibility** — if `github.com/imsyedusman/ChadwickOps` is public, the committed diagnostic dumps and the local DB credential in `scratch-query.js` should be cleaned and the credential rotated.

---

### Bottom line
Nothing in the repository will spontaneously modify VPS data on deploy — there are no migrations at boot, no cron, no background jobs. The danger is entirely in **what you do after deploy**: the encryption-key dependency, an unbaselined migration run, and a full sync whose orphan-cleanup can delete real financial rows on a transient API error. Fix those three, add the missing auth checks, and bootstrap in the stated order; the unmerged v2 work and the status-model inconsistencies are quality issues, not release blockers.
