import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';

export interface IdentityUser {
  id: number;
  isActive: boolean;
  sessionVersion: number;
}

export interface CredentialUser extends IdentityUser {
  passwordHash: string;
}

/** Verified profile fields returned with every successful response. */
export interface VerifiedIdentity extends IdentityUser {
  username: string;
  name: string;
}

export interface IdentityStore {
  consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean>;
  findCredentials(username: string): Promise<CredentialUser | undefined>;
  findIdentity(id: number): Promise<VerifiedIdentity | undefined>;
}

type Environment = Record<string, string | undefined>;
type Operation = 'authenticate' | 'revalidate';
const BODY_LIMIT = 4096;
const FAILURE = { error: 'Identity verification failed' };
const PROFILE_FIELD_LIMIT = 255;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
let dummyHash: Promise<string> | undefined;

function reply(body: object, status: number, retryAfter?: number): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, private, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Vary': 'Authorization',
      'X-Content-Type-Options': 'nosniff',
      ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}),
    },
  });
}

function configuredSecret(env: Environment): string | null {
  const secret = env.CHADWICK_PRODUCTION_IDENTITY_SECRET;
  // Require a dedicated 256-bit random hex secret, never a Provider/session key.
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) return null;
  if ([env.CHADWICK_PRODUCTION_API_KEY, env.PRODUCTION_API_KEY, env.AUTH_SECRET]
    .some(other => other === secret)) return null;
  return secret;
}

function authorized(request: Request, secret: string): boolean {
  const header = request.headers.get('authorization') || '';
  if (!/^Bearer [a-f0-9]{64}$/.test(header)) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(secret));
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return null;
  if (request.headers.has('content-encoding') || !request.body) return null;
  const reader = request.body.getReader();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, 5000);
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut) return null;
      if (done) break;
      size += value.byteLength;
      if (size > BODY_LIMIT) return null;
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown> : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function current<T extends IdentityUser>(user: T | undefined): user is T {
  return !!user && user.isActive === true && Number.isSafeInteger(user.id) && user.id > 0
    && Number.isSafeInteger(user.sessionVersion) && user.sessionVersion >= 1;
}

/** Nonempty, at most 255 characters, no control characters; never used for authorization. */
function validProfileField(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
    && value.length <= PROFILE_FIELD_LIMIT && !CONTROL_CHARACTERS.test(value);
}

/**
 * The single successful response shape for authenticate and revalidate. Only the fresh
 * verified ID/version and the fresh database username/name are returned; malformed profile
 * data fails closed rather than degrading to a partial or unverified identity.
 */
function identityResponse(user: VerifiedIdentity): Response {
  if (!validProfileField(user.username) || !validProfileField(user.name)) return reply(FAILURE, 401);
  return reply({
    userId: String(user.id),
    sessionVersion: user.sessionVersion,
    username: user.username,
    displayName: user.name,
  }, 200);
}

/** No NextAuth dependency: never creates an Ops session, updates a user or loads roles. */
export function createIdentityHandler(
  operation: Operation,
  loadStore: () => Promise<IdentityStore>,
  env: () => Environment = () => process.env,
  compare: (password: string, hash: string) => Promise<boolean> = bcrypt.compare,
  missingUserHash: () => Promise<string> = () => dummyHash ??= bcrypt.hash(randomBytes(32).toString('hex'), 12),
) {
  return async (request: Request): Promise<Response> => {
    const secret = configuredSecret(env());
    if (!secret) return reply({ error: 'Identity service unavailable' }, 503);
    // Do not import the DB module, read a body or touch shared counters until authenticated.
    if (!authorized(request, secret)) return reply(FAILURE, 401);
    if (request.method !== 'POST' || new URL(request.url).search) return reply(FAILURE, 401);

    try {
      const store = await loadStore();
      const login = operation === 'authenticate';
      if (!await store.consumeRateLimit(`identity:${operation}:global`, login ? 30 : 300, 60)) {
        return reply({ error: 'Too many requests' }, 429, 60);
      }
      const body = await readBody(request);
      if (!body) return reply(FAILURE, 401);

      if (login) {
        if (Object.keys(body).some(key => key !== 'username' && key !== 'password')
          || typeof body.username !== 'string' || typeof body.password !== 'string'
          || !body.password || body.username.length > 255) return reply(FAILURE, 401);
        // Match the existing Credentials provider: trim/lowercase username, preserve password.
        const username = body.username.trim().toLowerCase();
        // Bounded keyed buckets hide usernames and cap storage at 1024 account counters.
        // Collisions conservatively share a limit; client IP headers cannot bypass it.
        const bucket = createHmac('sha256', secret).update(username).digest().readUInt16BE(0) % 1024;
        if (!await store.consumeRateLimit(`identity:authenticate:bucket:${bucket}`, 5, 300)) {
          return reply({ error: 'Too many requests' }, 429, 300);
        }
        const allowedDomain = username.split('@').pop() === 'chadwickswitchboards.com.au';
        const user = allowedDomain ? await store.findCredentials(username) : undefined;
        // Do bcrypt work for unknown/disallowed accounts too; never reveal existence/activity.
        const matches = await compare(body.password, user?.passwordHash ?? await missingUserHash());
        if (!matches || !current(user)) return reply(FAILURE, 401);
        // Catch password reset/deactivation during the expensive password comparison.
        const latest = await store.findIdentity(user.id);
        if (!current(latest) || latest.id !== user.id || latest.sessionVersion !== user.sessionVersion) return reply(FAILURE, 401);
        // The profile comes from the final verified reread, never from the login body.
        return identityResponse(latest);
      }

      if (Object.keys(body).some(key => key !== 'userId' && key !== 'sessionVersion')
        || typeof body.userId !== 'string' || !/^[1-9][0-9]*$/.test(body.userId)
        || !Number.isSafeInteger(Number(body.userId))
        || !Number.isSafeInteger(body.sessionVersion) || (body.sessionVersion as number) < 1) {
        return reply(FAILURE, 401);
      }
      const user = await store.findIdentity(Number(body.userId));
      if (!current(user) || user.id !== Number(body.userId) || user.sessionVersion !== body.sessionVersion) return reply(FAILURE, 401);
      return identityResponse(user);
    } catch {
      // Deliberately no logging: errors may embed query parameters, passwords or bodies.
      return reply({ error: 'Identity service unavailable' }, 503);
    }
  };
}
