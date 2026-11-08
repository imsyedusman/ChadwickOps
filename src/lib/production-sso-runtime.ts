import "server-only";
import { auth, signOut } from "@/auth";
import { headers } from "next/headers";
import { getToken } from "next-auth/jwt";
import { createSsoHandler } from "./production-sso";
import { getSsoConfig } from "./sso-protocol";

export function ssoHandler(operation: Parameters<typeof createSsoHandler>[0]) {
  return createSsoHandler(operation, {
    store: async () => (await import("./production-sso-store")).ssoStore,
    session: async () => {
      const session = await auth();
      if (!session?.user?.isActive) return null;
      const config = getSsoConfig();
      if (!config) return null;
      // Auth.js session.expires is a rolling presentation expiry. Bound the
      // grant to the actual incoming JWT exp, decoded ONLY inside Ops.
      const incoming = await headers();
      const token = await getToken({ req: new Request(config.opsOrigin, { headers: { cookie: incoming.get("cookie") || "" } }),
        secret: process.env.AUTH_SECRET!, secureCookie: config.secureOps,
        cookieName: `${config.secureOps ? "__Secure-" : ""}authjs.session-token` });
      if (!token || token.id !== session.user.id || token.sessionVersion !== session.user.sessionVersion || !Number.isSafeInteger(token.exp)) return null;
      return { userId: session.user.id, sessionVersion: session.user.sessionVersion,
        expires: Math.min(Math.floor(Date.parse(session.expires) / 1000), token.exp!) };
    },
    signOut: async () => {
      const result = await signOut({ redirect: false });
      if (!result || result.status >= 400) throw new Error("Sign-out unconfirmed");
    },
  });
}
