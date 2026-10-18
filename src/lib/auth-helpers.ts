import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Session } from "next-auth";
import { redirect } from "next/navigation";

// Request-scoped React cache ensures this DB call runs exactly ONCE per page load
export const validateSession = cache(async () => {
  if (process.env.BYPASS_AUTH_FOR_TEST === "true") {
    return {
      user: { id: "1", name: "Test Admin", email: "admin@chadwickswitchboards.com.au", role: "admin", roles: ["admin"], sessionVersion: 1 },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as Session;
  }

  try {
    const session = await auth();
    if (!session?.user?.id) return null;

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, Number(session.user.id)),
      columns: {
        role: true,
        sessionVersion: true,
        isActive: true,
      },
      with: { userRoles: { with: { role: true } } }
    });

    if (!dbUser || !dbUser.isActive || session.user.sessionVersion !== dbUser.sessionVersion) {
      return null;
    }

    // Always use the latest database role
    session.user.role = dbUser.role;
    session.user.roles = dbUser.userRoles?.map((ur) => ur.role.name) || [];

    return session;
  } catch (error) {
    console.error("[validateSession] Error verifying session:", error);
    return null;
  }
});

import { hasRole } from "./permissions";
export { hasRole };

export function requireRoles(session: Session | null, roleNames: string[]) {
  if (!session?.user) {
    redirect("/login");
  }
  const hasRequiredRole = roleNames.some((role) => hasRole(session, role));
  if (!hasRequiredRole) {
    throw new Error("Unauthorized");
  }
}

