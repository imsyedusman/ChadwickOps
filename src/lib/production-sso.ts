import { cookieName, digest, equal, exactKeys, failure, getSsoConfig, GRANT_SECONDS, move, opaque, publicRequestUrl, readCookie,
  readJson, seal, securityHeaders, setCookie, unseal, validOpaque, validProfile, validQuery, validTuple, type SsoConfig } from "./sso-protocol";

export interface SsoUser { id: number; sessionVersion: number; isActive: boolean; username: string; name: string }
export interface CodeGrant { userId: string; sessionVersion: number; grantExpiresAt: number; clientId: string; redirectUri: string; challenge: string }
export interface SsoStore {
  rate(key: string, limit: number, seconds: number): Promise<boolean>;
  findIdentity(id: number): Promise<SsoUser | undefined>;
  issue(hash: string, grant: CodeGrant): Promise<boolean>;
  consume(hash: string, clientId: string, redirectUri: string, challenge: string): Promise<CodeGrant | null>;
}
export interface OpsBrowserSession { userId: string; sessionVersion: number; expires: number }
export interface SsoDependencies {
  store: () => Promise<SsoStore>;
  session: () => Promise<OpsBrowserSession | null>;
  signOut: () => Promise<void>;
  env?: () => Record<string, string | undefined>;
  now?: () => number;
}
function current(user: SsoUser | undefined, userId: string, sessionVersion: number): user is SsoUser {
  return !!user && user.isActive === true && String(user.id) === userId && user.sessionVersion === sessionVersion && validProfile(user.username) && validProfile(user.name);
}
function identity(user: SsoUser, grantExpiresAt: number, config: SsoConfig) {
  return Response.json({ issuer: config.opsOrigin, clientId: config.clientId, userId: String(user.id), sessionVersion: user.sessionVersion,
    username: user.username, displayName: user.name, grantExpiresAt }, { headers: securityHeaders });
}
function authorization(url: URL, config: SsoConfig) {
  if (!validQuery(url, ["response_type", "client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method"]) ||
    url.searchParams.get("response_type") !== "code" || url.searchParams.get("client_id") !== config.clientId ||
    url.searchParams.get("redirect_uri") !== config.redirectUri || url.searchParams.get("code_challenge_method") !== "S256" ||
    !validOpaque(url.searchParams.get("state")) || !validOpaque(url.searchParams.get("code_challenge"))) return false;
  return true;
}
export function createSsoHandler(operation: "authorize" | "resume" | "exchange" | "revalidate" | "logout", deps: SsoDependencies) {
  return async (request: Request): Promise<Response> => {
    const env = (deps.env || (() => process.env))(), config = getSsoConfig(env), now = (deps.now || (() => Math.floor(Date.now() / 1000)))();
    if (!config) {
      if (operation === "logout" && request.method === "GET" && new URL(request.url).search === "?from=ops") return move("/login");
      return failure(503);
    }
    const url = publicRequestUrl(request, config.opsOrigin);
    if (!url) {
      // Ops-first sign-out already ended the Auth.js session client-side. When the page
      // is served from a host that is not the configured SSO origin (for example the
      // retired localhost origin), finish locally instead of returning a JSON protocol
      // error. POST confirmations and Production-initiated logout stay strict.
      if (operation === "logout" && request.method === "GET" && new URL(request.url).search === "?from=ops") return move("/login");
      return failure();
    }
    const continuationName = cookieName("chadwick-ops.sso-continuation", config.secureOps);
    try {
      if (operation === "logout") {
        if (!validQuery(url, ["from"]) || !["ops", "production"].includes(url.searchParams.get("from") || "")) return failure();
        const nonceName = cookieName("chadwick-ops.sso-logout", config.secureOps);
        if (request.method === "GET") {
          if (url.searchParams.get("from") === "ops") return move(config.appOrigin + "/auth/logout-complete");
          const nonce = opaque();
          const response = new Response(`<!doctype html><html><head><title>Complete sign out</title></head><body><h1>Complete sign out</h1><p>This step signs ChadwickOps out of this browser. Production was cleared first only if you started sign-out there. Other devices are unaffected. If this step fails, Ops may remain signed in.</p><form method="post"><input type="hidden" name="csrf" value="${nonce}"><button>Sign out of ChadwickOps</button></form><a href="${config.postLogoutUri}">Leave Ops signed in</a></body></html>`,
            { headers: { ...securityHeaders, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" } });
          setCookie(response, nonceName, nonce, config.secureOps, 300); return response;
        }
        if (request.method !== "POST" || request.headers.get("origin") !== config.opsOrigin || url.searchParams.get("from") !== "production") return failure(403);
        // Bound form parsing as well; no unbounded request.formData().
        if (request.headers.get("content-type")?.split(";")[0] !== "application/x-www-form-urlencoded") return failure();
        const reader = request.body?.getReader(); if (!reader) return failure();
        let text = "", expired = false;
        const timer = setTimeout(() => { expired = true; void reader.cancel().catch(() => {}); }, 5000);
        try { while (true) { const part = await reader.read(); if (part.done) break; text += Buffer.from(part.value).toString("utf8"); if (text.length > 256) return failure(); } }
        finally { clearTimeout(timer); void reader.cancel().catch(() => {}); }
        const fields = new URLSearchParams(text), nonce = fields.get("csrf"), cookie = readCookie(request, nonceName);
        if (expired || [...fields.keys()].join(",") !== "csrf" || !validOpaque(nonce) || !cookie || !equal(nonce, cookie)) return failure(403);
        await deps.signOut();
        const response = move(config.postLogoutUri);
        setCookie(response, nonceName, "", config.secureOps, 0);
        setCookie(response, continuationName, "", config.secureOps, 0);
        return response;
      }
      if (operation === "authorize" || operation === "resume") {
        if (request.method !== "GET") return failure(405);
        let authUrl = url;
        if (operation === "resume") {
          if (url.search) return failure();
          const saved = unseal(readCookie(request, continuationName), env.AUTH_SECRET || "", "ops-sso-continuation/v1");
          if (!exactKeys(saved, "expiresAt,query") || typeof saved.expiresAt !== "number" || saved.expiresAt <= now || saved.expiresAt > now + 300 || typeof saved.query !== "string") return failure();
          authUrl = new URL(config.opsOrigin + "/api/sso/authorize?" + saved.query);
        }
        if (!authorization(authUrl, config) || !env.AUTH_SECRET || env.AUTH_SECRET.length < 32 || env.AUTH_SECRET === config.clientSecret) return failure();
        const store = await deps.store();
        if (!await store.rate("authorize:global", 60, 60)) return failure(429);
        const session = await deps.session();
        if (!session) {
          if (operation === "resume") return failure(401);
          const response = move(config.opsOrigin + "/login?sso=1");
          setCookie(response, continuationName, seal({ query: authUrl.searchParams.toString(), expiresAt: now + 300 }, env.AUTH_SECRET, "ops-sso-continuation/v1"), config.secureOps, 300);
          return response;
        }
        if (!validTuple(session) || !Number.isSafeInteger(session.expires) || session.expires <= now) return failure(401);
        const user = await store.findIdentity(Number(session.userId));
        if (!current(user, session.userId, session.sessionVersion)) return failure(401);
        const bucket = parseInt(Buffer.from(digest(session.userId), "base64url").subarray(0, 2).toString("hex"), 16) % 1024;
        if (!await store.rate(`authorize:bucket:${bucket}`, 10, 60)) return failure(429);
        const code = opaque();
        const grant = { userId: session.userId, sessionVersion: session.sessionVersion, grantExpiresAt: Math.min(session.expires, now + GRANT_SECONDS),
          clientId: config.clientId, redirectUri: config.redirectUri, challenge: authUrl.searchParams.get("code_challenge")! };
        if (!await store.issue(digest(code), grant)) return failure(429);
        const target = new URL(config.redirectUri); target.searchParams.set("code", code); target.searchParams.set("state", authUrl.searchParams.get("state")!); target.searchParams.set("iss", config.opsOrigin);
        const response = move(target.href); setCookie(response, continuationName, "", config.secureOps, 0); return response;
      }
      if (request.method !== "POST" || url.search || request.headers.get("content-type")?.split(";")[0] !== "application/json" || request.headers.has("content-encoding")) return failure();
      if (!equal(request.headers.get("authorization") || "", `Bearer ${config.clientSecret}`)) return failure(401);
      const store = await deps.store();
      if (!await store.rate(`${operation}:global`, operation === "exchange" ? 60 : 600, 60)) return failure(429);
      const body = await readJson(request);
      if (operation === "exchange") {
        if (!exactKeys(body, "clientId,code,redirectUri,verifier") || body.clientId !== config.clientId || body.redirectUri !== config.redirectUri ||
          !validOpaque(body.code) || typeof body.verifier !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(body.verifier)) return failure(401);
        const grant = await store.consume(digest(body.code), config.clientId, config.redirectUri, digest(body.verifier));
        if (!grant || !validTuple(grant) || !Number.isSafeInteger(grant.grantExpiresAt) || grant.grantExpiresAt <= now || grant.grantExpiresAt > now + GRANT_SECONDS) return failure(401);
        const user = await store.findIdentity(Number(grant.userId));
        if (!current(user, grant.userId, grant.sessionVersion)) return failure(401);
        return identity(user, grant.grantExpiresAt, config);
      }
      if (!exactKeys(body, "grantExpiresAt,sessionVersion,userId") || !validTuple(body) || typeof body.grantExpiresAt !== "number" ||
        !Number.isSafeInteger(body.grantExpiresAt) || body.grantExpiresAt <= now || body.grantExpiresAt > now + GRANT_SECONDS) return failure(401);
      const user = await store.findIdentity(Number(body.userId));
      if (!current(user, body.userId as string, body.sessionVersion as number)) return failure(401);
      return identity(user, body.grantExpiresAt, config);
    } catch {
      if (operation === "logout") return new Response("Could not confirm ChadwickOps sign out. Production may already be signed out. Close this page and retry sign out at each application; no further redirect was attempted.",
        { status: 503, headers: { ...securityHeaders, "Content-Type": "text/plain; charset=utf-8" } });
      return failure(503);
    }
  };
}
