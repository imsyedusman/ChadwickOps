import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Session } from "next-auth";
import { redirect } from "next/navigation";

// Request-scoped React cache ensures this DB call runs exactly ONCE per page load
export const validateSession = cache(async () => {
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

export function hasRole(session: Session | null, roleName: string): boolean {
  if (!session?.user?.roles) return false;
  return session.user.roles.includes(roleName);
}

export function requireRoles(session: Session | null, roleNames: string[]) {
  if (!session?.user?.roles) {
    redirect("/login");
  }
  const hasRequiredRole = roleNames.some((role) => session.user.roles.includes(role));
  if (!hasRequiredRole) {
    // In a Next.js server component/action, returning a response or throwing an error
    // For page components, redirecting to an unauthorized page or throwing is common.
    // For server actions, throwing an error is usually preferred.
    // However, throwing an error with "unauthorized" works generically.
    throw new Error("Unauthorized");
  }
}

