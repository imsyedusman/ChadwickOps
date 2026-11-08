import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const CALLBACK = "/api/auth/sso/callback";
export const SIGNED_OUT = "/auth/signed-out";
export const GRANT_SECONDS = 8 * 60 * 60;
export const securityHeaders = { "Cache-Control": "no-store, private, max-age=0", Pragma: "no-cache", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
export function getSsoConfig(env: Record<string, string | undefined> = process.env) {
  try {
    const ops = new URL(env.CHADWICK_OPS_SSO_ORIGIN || ""), production = new URL(env.PRODUCTION_APP_ORIGIN || "");
    for (const url of [ops, production]) {
      if (url.origin !== url.href.slice(0, -1) || url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
      if (url.protocol !== "https:" && !(env.NODE_ENV !== "production" && env.SSO_ALLOW_LOOPBACK_HTTP === "true" &&
        url.protocol === "http:" && ["ops.localhost", "production.localhost"].includes(url.hostname))) return null;
    }
    if (ops.hostname === production.hostname) return null;
    const clientId = env.PRODUCTION_SSO_CLIENT_ID, clientSecret = env.PRODUCTION_SSO_CLIENT_SECRET;
    if (!clientId || !/^[A-Za-z0-9_-]{1,80}$/.test(clientId) || !clientSecret || !/^[a-f0-9]{64}$/.test(clientSecret)) return null;
    if ([env.AUTH_SECRET, env.PRODUCTION_SESSION_SECRET, env.CHADWICK_PRODUCTION_IDENTITY_SECRET, env.CHADWICK_PRODUCTION_API_KEY,
      env.CHADWICK_OPS_API_KEY, env.PRODUCTION_API_KEY].some(secret => secret === clientSecret)) return null;
    const redirectUri = production.origin + CALLBACK, postLogoutUri = production.origin + SIGNED_OUT;
    if (env.PRODUCTION_SSO_REDIRECT_URI !== redirectUri || env.PRODUCTION_SSO_POST_LOGOUT_URI !== postLogoutUri) return null;
    return { opsOrigin: ops.origin, appOrigin: production.origin, clientId, clientSecret, redirectUri, postLogoutUri,
      secureOps: ops.protocol === "https:", secure: production.protocol === "https:" };
  } catch { return null; }
}
export type SsoConfig = NonNullable<ReturnType<typeof getSsoConfig>>;
export const opaque = () => randomBytes(32).toString("base64url");
export const digest = (value: string) => createHash("sha256").update(value).digest("base64url");
export const validOpaque = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
export function equal(a: string, b: string) { return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest()); }
export function exactKeys(value: unknown, keys: string): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === keys;
}
export function validTuple(value: { userId?: unknown; sessionVersion?: unknown }) {
  return typeof value.userId === "string" && /^[1-9][0-9]{0,15}$/.test(value.userId) && Number.isSafeInteger(Number(value.userId)) &&
    typeof value.sessionVersion === "number" && Number.isSafeInteger(value.sessionVersion) && value.sessionVersion > 0;
}
export const validProfile = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 255 && !/[\u0000-\u001f\u007f]/.test(value);
export function seal(value: object, secret: string, context: string) {
  const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(secret).digest(), nonce);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return [nonce, data, cipher.getAuthTag()].map(part => part.toString("base64url")).join(".");
}
export function unseal(token: string | undefined, secret: string, context: string): unknown {
  try {
    if (!token || token.length > 4096 || !/^[A-Za-z0-9_.-]+$/.test(token)) return null;
    const parts = token.split(".").map(part => Buffer.from(part, "base64url"));
    if (parts.length !== 3 || parts[0].length !== 12 || parts[2].length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(secret).digest(), parts[0]);
    decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(parts[2]);
    return JSON.parse(Buffer.concat([decipher.update(parts[1]), decipher.final()]).toString("utf8"));
  } catch { return null; }
}
export function cookieName(name: string, secure: boolean) { return `${secure ? "__Host-" : ""}${name}`; }
export function readCookie(request: Request, name: string) {
  const matches = (request.headers.get("cookie") || "").split(";").map(part => part.trim()).filter(part => part.startsWith(name + "="));
  return matches.length === 1 ? matches[0].slice(name.length + 1) : undefined;
}
export function setCookie(response: Response, name: string, value: string, secure: boolean, maxAge: number) {
  response.headers.append("Set-Cookie", `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`);
}
export function move(url: string) { return new Response(null, { status: 303, headers: { ...securityHeaders, Location: url } }); }
export function failure(status = 400) { return Response.json({ error: "SSO could not be completed. Restart sign-in." }, { status, headers: securityHeaders }); }
export async function readJson(request: Request | Response): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  let size = 0; const chunks: Uint8Array[] = [];
  let expired = false;
  const timer = setTimeout(() => { expired = true; void reader.cancel().catch(() => {}); }, 5000);
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.length; if (size > 4096) return null; chunks.push(part.value);
    }
    return expired ? null : JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return null; }
  finally { clearTimeout(timer); void reader.cancel().catch(() => {}); }
}
export function validQuery(url: URL, names: string[]) {
  return names.every(name => url.searchParams.getAll(name).length === 1) && [...url.searchParams.keys()].every(name => names.includes(name));
}
/** Next may use its internal listening hostname in request.url. Validate Host
 * against the configured authority, then use ONLY the configured public origin.
 * Proxies must preserve Host; no X-Forwarded-Host value selects a trusted origin. */
export function publicRequestUrl(request: Request, configuredOrigin: string) {
  const actual = new URL(request.url), expected = new URL(configuredOrigin), host = request.headers.get("host");
  if (actual.hash || (host ? host.toLowerCase() !== expected.host : actual.origin !== configuredOrigin)) return null;
  return new URL(actual.pathname + actual.search, configuredOrigin);
}
