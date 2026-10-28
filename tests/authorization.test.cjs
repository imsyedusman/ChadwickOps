const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Compile real boundaries in an isolated VM. No application dependency is ever
// loaded by Node: DB, auth, services, fetch and timers are explicit test doubles.
function compile(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.resolve(file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports, console: { log() {}, warn() {}, error() {}, info() {} },
    process: { env: { BYPASS_AUTH_FOR_TEST: 'true' } },
    require(id) {
      if (Object.hasOwn(dependencies, id)) return dependencies[id];
      if (dependencies['*']) return dependencies['*'];
      throw new Error(`Unmocked dependency: ${id}`);
    },
    fetch() { throw new Error('Network forbidden'); }, ...globals,
  }, { filename: file });
  return exports;
}

const permissions = compile('src/lib/permissions.ts');
const session = roles => ({ user: { id: '7', roles, role: 'admin', sessionVersion: 3, isActive: true } });

function harness(current, options = {}) {
  const effects = [];
  const schema = new Proxy({}, { get: (_, table) => new Proxy({ __table: table }, {
    get: (obj, key) => key in obj ? obj[key] : `${table}.${String(key)}`,
  }) });
  let values;
  const chain = new Proxy(() => chain, {
    get(_, key) {
      if (key === 'then') return resolve => resolve([]);
      return (...args) => { if (key === 'set') values = args[0]; return chain; };
    },
  });
  const db = {
    query: new Proxy({}, { get: (_, table) => ({
      findFirst: async () => {
        effects.push(`read:${table}`);
        if (table === 'users') return options.dbUser;
        if (table === 'staffEfficiency') return options.staff?.[0];
        if (table === 'systemConfig') return { value: { apiKey: 'fake', apiSecret: 'fake' } };
        return { workguruId: '123' };
      },
      findMany: async () => { effects.push(`read:${table}`); return table === 'staffEfficiency' ? options.staff || [] : []; },
    }) }),
    ...Object.fromEntries(['select', 'insert', 'update', 'delete', 'execute'].map(op => [op, () => {
      effects.push(op); return chain;
    }])),
  };
  const helper = compile('src/lib/auth-helpers.ts', {
    './permissions': permissions, react: { cache: fn => fn },
    '@/auth': { auth: options.auth || (async () => current) },
    '@/db': { db }, '@/db/schema': schema, 'drizzle-orm': { eq: () => null },
    'next/navigation': {
      redirect: () => { throw new Error('Unauthorized'); },
      // Same contract as Next.js: framework control-flow signals must escape a
      // user try/catch instead of being converted into an "unauthenticated" result.
      unstable_rethrow: (error) => {
        const digest = error && typeof error === 'object' ? error.digest : undefined;
        if (typeof digest === 'string' && (
          digest === 'DYNAMIC_SERVER_USAGE' || digest === 'NEXT_REDIRECT' ||
          digest === 'NEXT_NOT_FOUND' || digest.startsWith('NEXT_HTTP_ERROR_FALLBACK')
        )) throw error;
      },
    },
  });
  // By default exercise the real validator with authoritative database roles.
  if (!Object.hasOwn(options, 'dbUser')) options.dbUser = current && {
    isActive: true, role: 'viewer', sessionVersion: 3,
    userRoles: current.user.roles.map(name => ({ role: { name } })),
  };
  const service = class {
    constructor() { effects.push('service'); }
    async runSync() { effects.push('workguru'); return { success: true, stats: {} }; }
    async syncProjectById() { effects.push('workguru'); return { success: true, projectNumber: 'test', total: 1 }; }
    async authenticate() { effects.push('workguru'); }
    async seedDefaultStages() { effects.push('seed'); }
    async seedDefaultMappings() { effects.push('seed'); }
  };
  const fallback = new Proxy({ __esModule: true }, { get: (_, key) => key === '__esModule' ? true : () => null });
  const deps = {
    '*': fallback, '@/lib/auth-helpers': helper, '@/db': { db }, '@/db/schema': schema,
    '@/lib/permissions': permissions,
    '@/lib/sync': { SyncService: service }, '@/lib/procurement-sync': { ProcurementSyncService: service },
    '@/lib/invoice-sync': { InvoiceSyncService: service }, '@/lib/profitability-sync': { ProfitabilitySyncService: service },
    '@/lib/workguru': { WorkGuruClient: service }, '@/lib/stages': { StageService: service },
    '@/lib/crypto': { decrypt: () => 'fake', encrypt: () => 'fake' },
    '@/lib/stage-capacity': { getWeeklyCapacityBreakdown: async () => [] },
    'next/cache': { revalidatePath() {} },
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) } },
  };
  return { helper, effects, load: file => compile(file, deps, {
    fetch() { effects.push('network'); throw new Error('Network forbidden'); },
  }), values: () => values };
}

const actionFiles = [...fs.readdirSync('src/app/actions').filter(f => f.endsWith('.ts')).map(f => `src/app/actions/${f}`), 'src/actions/capacity.ts'];
for (const file of actionFiles) {
  const module = harness(null).load(file);
  const names = Object.keys(module).filter(name => typeof module[name] === 'function');
  for (const name of names) test(`unauthenticated: ${file}:${name} denies before business IO even with bypass env`, async () => {
    const h = harness(null);
    let result;
    try { result = await h.load(file)[name](1, {}, 1, 1); }
    catch (error) { assert.match(error.message, /Unauthorized/); }
    if (result !== undefined && result !== null) assert.equal(result.success, false);
    assert.deepEqual(h.effects, []);
  });
}

const mutations = {
  sync: ['triggerSync', 'triggerFullSync', 'testApiConnection', 'updateApiCredentials', 'initializeSystem'],
  'sync-project': ['handleSyncProject'], 'procurement-sync': ['triggerProcurementSync'],
  'invoice-sync': ['triggerInvoiceSync'], profitability: ['triggerProfitabilitySync'],
  financials: ['syncProjectFinancials'], project: ['updateProjectOperationalFields'],
  procurement: ['addSupplier', 'updateSupplier', 'deleteSupplier', 'addMasterSupplier', 'updateProjectProcurement'],
  users: ['getUsersList', 'createUser', 'updateUserStatus', 'updateUserRole', 'resetUserPassword', 'deleteUser'],
  'workshop-staff': ['importWorkshopStaff', 'updateStaffMember', 'addStaffMemberManually', 'addStaffAbsence', 'deleteStaffAbsence'],
  'production-scheduling': ['updateScheduledStart', 'resetScheduledStart', 'saveProjectStageHours', 'assignWorkerToStage', 'deleteWorkerAssignment', 'previewAutoSchedule', 'applyAutoSchedule', 'undoAutoSchedule'],
};
for (const [file, names] of Object.entries(mutations)) for (const name of names) {
  test(`viewer with legacy admin label denied: ${file}:${name}`, async () => {
    const h = harness(session(['viewer']));
    let result;
    try { result = await h.load(`src/app/actions/${file}.ts`)[name](1, {}, 1, 1); }
    catch (error) { assert.match(error.message, /Unauthorized/); }
    if (result !== undefined) assert.equal(result.success, false);
    assert.deepEqual(h.effects, ['read:users']);
  });
}

test('capacity settings deny viewer before reading/writing configuration', async () => {
  const h = harness(session(['viewer']));
  await assert.rejects(h.load('src/actions/capacity.ts').updateCapacitySettings({}), /Unauthorized/);
  assert.deepEqual(h.effects, ['read:users']);
});

test('admin user creation requires an explicit password before account reads or writes', async () => {
  const h = harness(session(['admin']));
  await assert.rejects(h.load('src/app/actions/users.ts').createUser({
    name: 'Test', username: 'test@chadwickswitchboards.com.au', roles: ['admin'],
  }), /explicit password/);
  assert.deepEqual(h.effects, ['read:users']);
});

for (const route of ['diag', 'inspect']) for (const roles of [null, ['viewer'], ['admin']]) {
  test(`${route}: ${roles || 'anonymous'} gets the expected server authorization`, async () => {
    const h = harness(roles && session(roles));
    const result = await h.load(`src/app/api/${route}/route.ts`).GET();
    assert.equal(result.status, roles ? roles.includes('admin') ? 200 : 403 : 401);
    // Admin reaches mocked DB (no config from select); others cannot.
    assert.deepEqual(h.effects, roles ? roles.includes('admin') ? ['read:users', 'select'] : ['read:users'] : []);
  });
}

for (const state of [undefined, { isActive: false, sessionVersion: 3 }, { isActive: true, sessionVersion: 4 }]) {
  test(`invalid database account fails closed: ${JSON.stringify(state)}`, async () => {
    const h = harness(session(['admin']), { dbUser: state });
    assert.equal(await h.helper.getAuthorizedSession('sync'), null);
  });
}

test('framework dynamic-rendering signals are not swallowed by session validation', async () => {
  const signal = Object.assign(new Error('Dynamic server usage: route could not be rendered statically'), {
    digest: 'DYNAMIC_SERVER_USAGE',
  });
  const h = harness(null, { auth: async () => { throw signal; } });
  await assert.rejects(h.helper.validateSession(), error => error === signal);
  await assert.rejects(h.helper.requireSession(), error => error === signal);
});

test('genuine session lookup failures still fail closed', async () => {
  const h = harness(null, { auth: async () => { throw new Error('session store unavailable'); } });
  assert.equal(await h.helper.validateSession(), null);
  await assert.rejects(h.helper.requireSession(), /Unauthorized/);
});

test('database memberships replace stale session roles', async () => {
  const h = harness(session(['admin']), { dbUser: { isActive: true, sessionVersion: 3, role: 'admin', userRoles: [] } });
  assert.equal(await h.helper.getAuthorizedSession('sync'), null);
});

test('legacy or caller supplied labels do not grant permissions', () => {
  for (const permission of Object.keys(permissions.permissionRoles)) {
    assert.equal(permissions.hasPermission({ user: { role: 'admin', roles: [] } }, permission), false);
  }
});

for (const role of ['admin', 'scheduler']) test(`${role} can update only allowed project fields`, async () => {
  const h = harness(session([role]));
  const result = await h.load('src/app/actions/project.ts').updateProjectOperationalFields(1, {
    drawingStatus: 'Approved', total: 999, role: 'admin', isArchived: true,
  });
  assert.equal(result.success, true);
  assert.equal(h.values().drawingStatus, 'Approved');
  assert.equal(h.values().total, undefined);
  assert.equal(h.values().isArchived, undefined);
  assert.deepEqual(h.effects, ['read:users', 'update']);
});

for (const role of ['admin', 'scheduler', 'finance']) test(`${role} can make procurement changes`, async () => {
  const h = harness(session([role]));
  assert.equal((await h.load('src/app/actions/procurement.ts').updateProjectProcurement(1, { procurementNotes: 'test' })).success, true);
  assert.deepEqual(h.effects, ['read:users', 'update']);
});

for (const name of ['triggerSync', 'triggerFullSync', 'testApiConnection', 'initializeSystem']) test(`admin workflow accessible: ${name}`, async () => {
  const h = harness(session(['admin']));
  assert.equal((await h.load('src/app/actions/sync.ts')[name]('fake', 'fake')).success, true);
  assert.ok(h.effects.includes(name === 'initializeSystem' ? 'seed' : 'workguru'));
});

test('viewer can read workshop data', async () => {
  const h = harness(session(['viewer']));
  const result = await h.load('src/app/actions/workshop.ts').getWorkshopArrivals();
  assert.ok(Array.isArray(result));
  assert.deepEqual(h.effects, ['read:users', 'select']);
});

for (const role of ['viewer', 'scheduler', 'finance', 'admin']) {
  test(`${role}: wage DTOs enforce finance permission without blocking staff workflows`, async () => {
    const staff = [{ id: 1, fullName: 'Test Worker', hourlyRate: '42', frameAssembly: '1' }];
    const h = harness(session([role]), { staff });
    const canRead = ['finance', 'admin'].includes(role);
    const list = await h.load('src/app/actions/workshop-staff.ts').getWorkshopStaff();
    assert.equal(list.data[0].hourlyRate, canRead ? '42' : null);
    const scheduling = h.load('src/app/actions/production-scheduling.ts');
    const detail = await scheduling.getWorkerDetail(1);
    assert.equal(detail.success, true);
    assert.equal(detail.data.staff.hourlyRate, canRead ? '42' : null);
    const suggestions = await scheduling.getWorkerSuggestionsForProject(1);
    assert.equal(suggestions.success, true);
    assert.equal(suggestions.data.frame_assembly[0].implied_hourly_rate, canRead ? 42 : null);
    assert.equal(suggestions.data.frame_assembly[0].cost_effectiveness_score, canRead ? 42 : null);
  });
}

test('projected labour costs deny non-finance users before business reads', async () => {
  const h = harness(session(['scheduler']));
  assert.equal((await h.load('src/app/actions/production-scheduling.ts').getProjectedLabourCost(1)).success, false);
  assert.deepEqual(h.effects, ['read:users']);
});

test('procurement export rejects unauthenticated requests before data access', async () => {
  const h = harness(null);
  const result = await h.load('src/app/api/procurement/export/route.ts').GET({});
  assert.equal(result.status, 401);
  assert.deepEqual(h.effects, []);
});

test('session validation fails closed on authentication database errors', async () => {
  const helper = compile('src/lib/auth-helpers.ts', {
    './permissions': permissions, react: { cache: fn => fn },
    '@/auth': { auth: async () => session(['admin']) },
    '@/db': { db: { query: { users: { findFirst: async () => { throw new Error('DB unavailable'); } } } } },
    '@/db/schema': { users: { id: 'id' } }, 'drizzle-orm': { eq() {} },
    'next/navigation': { unstable_rethrow: () => {} },
  });
  assert.equal(await helper.validateSession(), null);
});

test('JWT refresh marks the account inactive when its database lookup fails', async () => {
  let config;
  compile('src/auth.ts', {
    'next-auth': { default: value => { config = value; return {}; }, __esModule: true },
    'next-auth/providers/credentials': { default: value => value, __esModule: true },
    '@/db': { db: { query: { users: { findFirst: async () => { throw new Error('DB unavailable'); } } } } },
    '@/db/schema': { users: { id: 'id' } }, 'drizzle-orm': { eq() {} }, bcryptjs: {},
  });
  const token = await config.callbacks.jwt({ token: { id: '7', isActive: true } });
  assert.equal(token.isActive, false);
});

test('single-project and full sync share the lease in both directions, release after failure', async () => {
  const safety = compile('src/lib/sync-safety.ts', {}, { setInterval, clearInterval });
  let owner = null;
  const store = {
    async acquire(id) { if (owner) return false; owner = id; return true; },
    async heartbeat(id) { return owner === id; }, async verify(id) { return owner === id; },
    async release(id) { if (owner === id) owner = null; },
  };
  const { SyncService } = compile('src/lib/sync.ts', {
    '*': {}, crypto: { randomUUID: require('node:crypto').randomUUID },
    './sync-safety': safety, './sync-lock': { createPostgresSyncLock: () => store },
    './workguru': { WorkGuruClient: class {} },
  });
  let enter, release;
  const started = () => new Promise(resolve => { enter = resolve; });
  const heldTask = async () => { enter(); await new Promise(resolve => { release = resolve; }); return { success: true }; };
  const full = new SyncService('fake', 'fake');
  const single = new SyncService('fake', 'fake');
  full.executeSync = heldTask; single.processProjectDetail = heldTask;
  let ready = started();
  const runningFull = full.runSync('FULL'); await ready;
  await assert.rejects(single.syncProjectById('1'), /already in progress/);
  release(); await runningFull;
  assert.equal(owner, null);
  ready = started();
  const runningSingle = single.syncProjectById('1'); await ready;
  assert.equal((await full.runSync('FULL')).code, 'SYNC_ALREADY_RUNNING');
  release(); await runningSingle;
  assert.equal(owner, null);
  assert.equal(single.leaseGuard, null);
  single.processProjectDetail = async () => { throw new Error('fake failure'); };
  await assert.rejects(single.syncProjectById('1'), /fake failure/);
  assert.equal(owner, null);
  assert.equal(single.leaseGuard, null);
});

const providerRoutes = [
  'freshness', 'projects', 'tasks', 'stage-hours', 'purchase-orders', 'suppliers',
  'workforce/staff', 'workforce/absences', 'workforce/assignments',
];
for (const route of providerRoutes) test(`provider ${route} retains separate API-key gate before DB access`, async () => {
  let gateCalls = 0;
  const denied = { status: 401 };
  const module = compile(`src/app/api/production/v1/${route}/route.ts`, {
    '*': {}, '@/lib/production-api-auth': { verifyProductionApiAuth() {
      gateCalls++; return { authorized: false, response: denied };
    } },
    '@/db': { db: new Proxy({}, { get() { throw new Error('DB accessed before API authentication'); } }) },
  });
  assert.equal(await module.GET({}), denied);
  assert.equal(gateCalls, 1);
});

test('public authentication GET and credential POST still reach Auth.js without a session', async () => {
  const calls = [];
  const routes = compile('src/app/api/auth/[...nextauth]/route.ts', {
    '@/auth': { handlers: {
      GET: async () => { calls.push('GET'); return { status: 200 }; },
      POST: async () => { calls.push('POST'); return { status: 200 }; },
    } },
    'next/server': {},
    'rate-limiter-flexible': { RateLimiterMemory: class { async consume() { calls.push('rate-limit'); } } },
  });
  assert.equal((await routes.GET({ nextUrl: { pathname: '/api/auth/session' } })).status, 200);
  assert.equal((await routes.POST({ nextUrl: { pathname: '/api/auth/callback/credentials' }, headers: new Headers() })).status, 200);
  assert.deepEqual(calls, ['GET', 'rate-limit', 'POST']);
});
