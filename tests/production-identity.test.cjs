const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

// No application module is loaded through Node. All database imports are blocked
// or replaced explicitly; only crypto/bcrypt operate for real on synthetic data.
function compile(file, dependencies, globals = {}) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports, Request, Response, URL, TextDecoder, Uint8Array, setTimeout, clearTimeout,
    console: new Proxy({}, { get: () => () => { throw new Error('Logging forbidden'); } }),
    process: { env: {} },
    require(id) {
      if (!Object.hasOwn(dependencies, id)) throw new Error(`Forbidden dependency: ${id}`);
      return dependencies[id];
    }, ...globals,
  }, { filename: file });
  return exports;
}

const { createIdentityHandler } = compile('src/lib/production-identity.ts', {
  'node:crypto': crypto, bcryptjs: bcrypt,
});
const secret = crypto.createHash('sha256').update('isolated identity fixture key').digest('hex');
const password = 'identity-fixture-only';
const hash = bcrypt.hashSync(password, 4);
const active = { id: 17, sessionVersion: 3, isActive: true, passwordHash: hash, role: 'admin',
  username: 'test@chadwickswitchboards.com.au', name: 'Fixture Planner' };
const goodBody = { username: ' Test@ChadwickSwitchboards.com.au ', password };

function request(body = goodBody, options = {}) {
  return new Request(`https://ops.example/api/production/v1/identity/${options.operation || 'authenticate'}${options.query || ''}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.key === null ? {} : { Authorization: `Bearer ${options.key || secret}` }),
      ...options.headers,
    },
    body: options.raw ?? JSON.stringify(body),
  });
}

function fixture(options = {}) {
  const calls = [];
  const counters = options.counters || new Map();
  let now = 0;
  const user = Object.hasOwn(options, 'user') ? options.user : { ...active };
  const store = {
    async consumeRateLimit(key, limit, seconds) {
      calls.push(['limit', key]);
      if (options.limiterError) throw new Error('sensitive database failure');
      const counter = counters.get(key);
      if (!counter || counter.resetAt <= now) { counters.set(key, { count: 1, resetAt: now + seconds }); return true; }
      if (counter.count >= limit) return false;
      counter.count++; return true;
    },
    async findCredentials(username) {
      calls.push(['credentials', username]);
      if (options.lookupError) throw new Error('sensitive account query failure');
      return user;
    },
    async findIdentity(id) {
      calls.push(['identity', id]);
      return Object.hasOwn(options, 'latest') ? options.latest : user;
    },
  };
  const env = { CHADWICK_PRODUCTION_IDENTITY_SECRET: secret, ...options.env };
  const load = async () => { calls.push(['load']); return store; };
  const compare = async (plain, encoded) => {
    calls.push(['compare']);
    if (options.compareError) throw new Error('password-containing exception must not escape');
    return bcrypt.compare(plain, encoded);
  };
  const dummy = async () => { calls.push(['dummy']); return hash; };
  return {
    calls, counters, store, env,
    authenticate: createIdentityHandler('authenticate', load, () => env, compare, dummy),
    revalidate: createIdentityHandler('revalidate', load, () => env, compare, dummy),
    advance: seconds => { now += seconds; },
  };
}

async function assertNoStore(response) {
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('pragma'), 'no-cache');
  assert.equal(response.headers.get('expires'), '0');
  assert.equal(response.headers.get('set-cookie'), null);
  return response.json();
}

test('real bcrypt validates the existing password; verified profile excludes hashes, roles and tokens', async () => {
  const f = fixture();
  const response = await f.authenticate(request());
  assert.equal(response.status, 200);
  const body = await assertNoStore(response);
  assert.deepEqual(body, {
    userId: '17', sessionVersion: 3,
    username: 'test@chadwickswitchboards.com.au', displayName: 'Fixture Planner',
  });
  assert.deepEqual(Object.keys(body).sort(), ['displayName', 'sessionVersion', 'userId', 'username']);
  assert.equal(JSON.stringify(body).includes(hash), false);
  assert.doesNotMatch(JSON.stringify(body), /passwordHash|role|token/i);
  assert.deepEqual(f.calls.filter(c => c[0] === 'credentials'), [['credentials', 'test@chadwickswitchboards.com.au']]);
  assert.equal(f.calls.at(-1)[0], 'identity');
});

test('authenticate returns the profile from the final identity reread, not the login input', async () => {
  const f = fixture({ latest: { ...active, username: 'renamed@chadwickswitchboards.com.au', name: 'Renamed Person' } });
  const response = await f.authenticate(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await assertNoStore(response), {
    userId: '17', sessionVersion: 3,
    username: 'renamed@chadwickswitchboards.com.au', displayName: 'Renamed Person',
  });
});

test('production comparator and lazy dummy hash fail safely for an unknown account', async () => {
  const f = fixture({ user: undefined });
  const handler = createIdentityHandler('authenticate', async () => f.store, () => f.env);
  const response = await handler(request());
  assert.equal(response.status, 401);
  assert.deepEqual(await assertNoStore(response), { error: 'Identity verification failed' });
});

test('password whitespace is preserved rather than normalized', async () => {
  const f = fixture();
  assert.equal((await f.authenticate(request({ ...goodBody, password: `${password} ` }))).status, 401);
});

for (const [name, options, body] of [
  ['wrong password', {}, { ...goodBody, password: 'wrong' }],
  ['unknown account', { user: undefined }, goodBody],
  ['inactive account', { user: { ...active, isActive: false } }, goodBody],
  ['unapproved domain', {}, { ...goodBody, username: 'test@example.com' }],
  ['deleted during compare', { latest: undefined }, goodBody],
  ['deactivated during compare', { latest: { ...active, isActive: false } }, goodBody],
  ['password reset during compare', { latest: { ...active, sessionVersion: 4 } }, goodBody],
  ['unexpected identity during compare', { latest: { ...active, id: 18 } }, goodBody],
]) test(`${name}: same generic failure without logs or cookies`, async () => {
  const f = fixture(options);
  const response = await f.authenticate(request(body));
  assert.equal(response.status, 401);
  assert.deepEqual(await assertNoStore(response), { error: 'Identity verification failed' });
  assert.equal(f.calls.filter(c => c[0] === 'compare').length, 1);
});

for (const operation of ['authenticate', 'revalidate']) {
  for (const key of [null, 'invalid', 'f'.repeat(64)]) test(`${operation}: absent/invalid API key rejects before store or body access (${key?.length || 0})`, async () => {
    const f = fixture();
    const req = request({}, { key });
    Object.defineProperty(req, 'body', { get() { throw new Error('Body accessed before authorization'); } });
    assert.equal((await f[operation](req)).status, 401);
    assert.deepEqual(f.calls, []);
  });
}

for (const env of [
  { CHADWICK_PRODUCTION_IDENTITY_SECRET: undefined },
  { CHADWICK_PRODUCTION_IDENTITY_SECRET: 'short' },
  { CHADWICK_PRODUCTION_IDENTITY_SECRET: 'NOT-HEX'.repeat(10) },
  { CHADWICK_PRODUCTION_API_KEY: secret },
  { PRODUCTION_API_KEY: secret },
  { AUTH_SECRET: secret },
]) test(`misconfigured/reused secret fails closed before DB: ${Object.keys(env).join(',')}`, async () => {
  const f = fixture({ env });
  const response = await f.authenticate(request());
  assert.equal(response.status, 503);
  await assertNoStore(response);
  assert.deepEqual(f.calls, []);
});

test('read-only Provider key and application cookies do not authenticate identity calls', async () => {
  const f = fixture({ env: { CHADWICK_PRODUCTION_API_KEY: 'readonly-test-key' } });
  assert.equal((await f.authenticate(request({}, { key: null, headers: { 'x-api-key': 'readonly-test-key', Cookie: 'authjs.session-token=fixture' } }))).status, 401);
  assert.deepEqual(f.calls, []);
});

test('per-account limiter counts successes and failures and ignores spoofed client IPs', async () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) {
    const response = await f.authenticate(request({ ...goodBody, password: i ? 'wrong' : password }));
    assert.equal(response.status, i ? 401 : 200);
  }
  const response = await f.authenticate(request({ ...goodBody, username: goodBody.username.toUpperCase() }, {
    headers: { 'x-forwarded-for': '203.0.113.1', 'x-real-ip': '203.0.113.2' },
  }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '300');
  assert.deepEqual(await assertNoStore(response), { error: 'Too many requests' });
  assert.equal(f.calls.filter(c => c[0] === 'compare').length, 5);
  f.advance(300);
  assert.equal((await f.authenticate(request())).status, 200);
});

test('independent handler instances share distributed account limits under concurrency', async () => {
  const counters = new Map();
  const first = fixture({ counters });
  const second = fixture({ counters });
  const responses = await Promise.all(Array.from({ length: 8 }, (_, i) =>
    (i % 2 ? first : second).authenticate(request())));
  assert.equal(responses.filter(r => r.status === 200).length, 5);
  assert.equal(responses.filter(r => r.status === 429).length, 3);
});

test('global login limit prevents password spraying; counters retain no usernames or passwords', async () => {
  const f = fixture();
  // Malformed authorized requests count against the same global budget too.
  for (let i = 0; i < 30; i++) assert.equal((await f.authenticate(request({}, { raw: '{' }))).status, 401);
  const response = await f.authenticate(request());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal(f.calls.filter(c => c[0] === 'credentials').length, 0);
  assert.deepEqual([...f.counters.keys()], ['identity:authenticate:global']);
});

for (const [name, body, raw, headers] of [
  ['missing password', { username: goodBody.username }],
  ['password object', { ...goodBody, password: {} }],
  ['empty password', { ...goodBody, password: '' }],
  ['oversized username', { ...goodBody, username: 'a'.repeat(256) }],
  ['extra role field', { ...goodBody, roles: ['admin'] }],
  ['extra identity field', { ...goodBody, userId: '17' }],
  ['JSON array', []], ['null JSON', null],
  ['malformed JSON', {}, '{'],
  ['oversized streamed body', {}, JSON.stringify({ ...goodBody, password: 'p'.repeat(5000) })],
  ['unsupported content type', goodBody, undefined, { 'Content-Type': 'text/plain' }],
  ['encoded body', goodBody, undefined, { 'Content-Encoding': 'gzip' }],
]) test(`bounded login input: ${name}`, async () => {
  const f = fixture();
  const response = await f.authenticate(request(body, { raw, headers }));
  assert.equal(response.status, 401);
  await assertNoStore(response);
  assert.equal(f.calls.filter(c => c[0] === 'credentials').length, 0);
});

test('credential query strings reject before DB rather than accepting logged URL credentials', async () => {
  const f = fixture();
  assert.equal((await f.authenticate(request({}, { query: '?username=test' }))).status, 401);
  assert.deepEqual(f.calls, []);
});

test('body limit measures actual chunks, not a misleading Content-Length', async () => {
  const f = fixture();
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('{"password":"'));
    controller.enqueue(new Uint8Array(4097).fill(97));
    controller.close();
  } });
  const req = new Request('https://ops.example/identity', {
    method: 'POST', duplex: 'half', body: stream,
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', 'Content-Length': '1' },
  });
  assert.equal((await f.authenticate(req)).status, 401);
  assert.equal(f.calls.filter(c => c[0] === 'credentials').length, 0);
});

test('slow body is cancelled at the read deadline without credential lookup', async () => {
  let expire;
  let cancelled = false;
  const module = compile('src/lib/production-identity.ts', { 'node:crypto': crypto, bcryptjs: bcrypt }, {
    setTimeout: callback => { expire = callback; return 1; }, clearTimeout() {},
  });
  const f = fixture();
  const handler = module.createIdentityHandler('authenticate', async () => f.store, () => f.env);
  const req = new Request('https://ops.example/identity', {
    method: 'POST', duplex: 'half', body: new ReadableStream({ cancel() { cancelled = true; } }),
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
  });
  const pending = handler(req);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof expire, 'function');
  expire();
  assert.equal((await pending).status, 401);
  assert.equal(cancelled, true);
  assert.equal(f.calls.filter(c => c[0] === 'credentials').length, 0);
});

for (const options of [{ limiterError: true }, { lookupError: true }, { compareError: true }]) {
  test(`service failure is generic and never logs request/error details: ${Object.keys(options)[0]}`, async () => {
    const f = fixture(options);
    const response = await f.authenticate(request());
    assert.equal(response.status, 503);
    assert.deepEqual(await assertNoStore(response), { error: 'Identity service unavailable' });
  });
}

test('active identity with matching sessionVersion revalidates without loading password or roles', async () => {
  const f = fixture();
  const response = await f.revalidate(request({ userId: '17', sessionVersion: 3 }));
  assert.equal(response.status, 200);
  const body = await assertNoStore(response);
  assert.deepEqual(body, {
    userId: '17', sessionVersion: 3,
    username: 'test@chadwickswitchboards.com.au', displayName: 'Fixture Planner',
  });
  assert.deepEqual(Object.keys(body).sort(), ['displayName', 'sessionVersion', 'userId', 'username']);
  assert.doesNotMatch(JSON.stringify(body), /passwordHash|role|token/i);
  assert.deepEqual(f.calls.map(c => c[0]), ['load', 'limit', 'identity']);
});

test('revalidate returns the current profile after an Ops name/username change', async () => {
  const f = fixture({ latest: { ...active, username: 'changed@chadwickswitchboards.com.au', name: 'Changed Name' } });
  const response = await f.revalidate(request({ userId: '17', sessionVersion: 3 }));
  assert.equal(response.status, 200);
  assert.deepEqual(await assertNoStore(response), {
    userId: '17', sessionVersion: 3,
    username: 'changed@chadwickswitchboards.com.au', displayName: 'Changed Name',
  });
});

test('both endpoints return the identical validated response structure', async () => {
  const f = fixture();
  const login = await f.authenticate(request());
  const check = await f.revalidate(request({ userId: '17', sessionVersion: 3 }));
  assert.equal(login.status, 200);
  assert.equal(check.status, 200);
  const [loginBody, checkBody] = [await login.clone().json(), await check.clone().json()];
  assert.deepEqual(Object.keys(loginBody).sort(), Object.keys(checkBody).sort());
  assert.deepEqual(loginBody, checkBody);
});

for (const operation of ['authenticate', 'revalidate']) {
  for (const [name, profile] of [
    ['empty username', { username: '' }],
    ['whitespace username', { username: '   ' }],
    ['oversized username', { username: 'a'.repeat(256) }],
    ['control characters in username', { username: 'test@chadwickswitchboards.com.au\n' }],
    ['missing username', { username: undefined }],
    ['non-string username', { username: 17 }],
    ['empty name', { name: '' }],
    ['whitespace name', { name: '\t\t' }],
    ['oversized name', { name: 'n'.repeat(256) }],
    ['control characters in name', { name: 'Fixture\u0000Person' }],
    ['missing name', { name: undefined }],
    ['non-string name', { name: null }],
  ]) test(`${operation}: malformed verified profile fails closed (${name})`, async () => {
    const f = fixture({ user: { ...active, ...profile }, latest: { ...active, ...profile } });
    const response = operation === 'authenticate'
      ? await f.authenticate(request())
      : await f.revalidate(request({ userId: '17', sessionVersion: 3 }));
    assert.equal(response.status, 401);
    assert.deepEqual(await assertNoStore(response), { error: 'Identity verification failed' });
  });
}

for (const user of [undefined, { ...active, isActive: false }, { ...active, sessionVersion: 4 }]) {
  test(`deleted/inactive/version-revoked identity is denied (${user?.isActive}/${user?.sessionVersion})`, async () => {
    const f = fixture({ user });
    const response = await f.revalidate(request({ userId: '17', sessionVersion: 3 }));
    assert.equal(response.status, 401);
    assert.deepEqual(await assertNoStore(response), { error: 'Identity verification failed' });
  });
}

for (const body of [
  {}, { userId: 17, sessionVersion: 3 }, { userId: '17', sessionVersion: '3' },
  { userId: '0', sessionVersion: 3 }, { userId: '9007199254740993', sessionVersion: 3 },
  { userId: '17', sessionVersion: 0 }, { userId: '17', sessionVersion: 3, role: 'admin' },
]) test(`invalid identity tuple rejected before account lookup: ${JSON.stringify(body)}`, async () => {
  const f = fixture();
  assert.equal((await f.revalidate(request(body))).status, 401);
  assert.equal(f.calls.filter(c => c[0] === 'identity').length, 0);
});

test('revalidation is rate-limited separately from authentication', async () => {
  const f = fixture();
  for (let i = 0; i < 300; i++) assert.equal((await f.revalidate(request({ userId: '17', sessionVersion: 3 }))).status, 200);
  assert.equal((await f.revalidate(request({ userId: '17', sessionVersion: 3 }))).status, 429);
  assert.equal((await f.authenticate(request())).status, 200);
});

for (const operation of ['authenticate', 'revalidate']) test(`${operation} route wires only its POST handler and lazily imports the store`, async () => {
  let selected;
  const routes = compile(`src/app/api/production/v1/identity/${operation}/route.ts`, {
    '@/lib/production-identity': { createIdentityHandler: (name, load) => {
      selected = name; assert.equal(typeof load, 'function'); return () => {};
    } },
  });
  assert.equal(selected, operation);
  assert.equal(routes.runtime, 'nodejs');
  assert.equal(routes.dynamic, 'force-dynamic');
  assert.equal(typeof routes.POST, 'function');
  assert.equal(routes.GET, undefined);
});

test('SQL adapter uses atomic bounded counters and selects only required account columns', async () => {
  const { sql, eq } = require('drizzle-orm');
  const { PgDialect } = require('drizzle-orm/pg-core');
  const queries = [];
  const selections = [];
  let rows = [{ id: 1 }];
  const { identityStore } = compile('src/lib/production-identity-store.ts', {
    '@/db': { db: {
      execute: async query => { queries.push(new PgDialect().sqlToQuery(query)); return rows; },
      query: { users: { findFirst: async selection => { selections.push(selection); return active; } } },
    } },
    '@/db/schema': { users: { username: 'username', id: 'id' } },
    'drizzle-orm': { sql, eq },
  });
  assert.equal(await identityStore.consumeRateLimit('identity:authenticate:global', 30, 60), true);
  rows = [];
  assert.equal(await identityStore.consumeRateLimit('identity:authenticate:global', 30, 60), false);
  assert.match(queries[0].sql, /ON CONFLICT \(key\) DO UPDATE/);
  assert.match(queries[0].sql, /statement_timestamp\(\)/);
  assert.match(queries[0].sql, /WHERE.*resetAt/s);
  assert.deepEqual(queries[0].params, ['identity:authenticate:global', 60, 30]);
  await identityStore.findCredentials('test@chadwickswitchboards.com.au');
  await identityStore.findIdentity(17);
  assert.deepEqual(Object.keys(selections[0].columns).sort(), ['id', 'isActive', 'passwordHash', 'sessionVersion']);
  assert.deepEqual(Object.keys(selections[1].columns).sort(), ['id', 'isActive', 'name', 'sessionVersion', 'username']);
  assert.equal(selections[0].with, undefined);
  assert.equal(selections[1].with, undefined);
});
