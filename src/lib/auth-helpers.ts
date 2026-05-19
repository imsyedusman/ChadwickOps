import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

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
      }
    });

    if (!dbUser || !dbUser.isActive || session.user.sessionVersion !== dbUser.sessionVersion) {
      return null;
    }

    // Always use the latest database role
    session.user.role = dbUser.role;

    return session;
  } catch (error) {
    console.error("[validateSession] Error verifying session:", error);
    return null;
  }
});
