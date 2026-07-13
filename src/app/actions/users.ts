"use server";

import { db } from "@/db";
import { users, roles, userRoles } from "@/db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { validateSession, hasRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

// Ensure current request context is an active administrator
async function checkAdminAuth() {
  const session = await validateSession();
  if (!session || !hasRole(session, "admin")) {
    throw new Error("Unauthorized. Administrator role required.");
  }
  return session;
}

export async function getUsersList() {
  await checkAdminAuth();
  
  try {
    const list = await db.query.users.findMany({
      orderBy: [desc(users.createdAt)],
      with: { userRoles: { with: { role: true } } }
    });
    
    // Do not return password hashes to the client
    return list.map(({ passwordHash, userRoles: ur, ...rest }) => ({
      ...rest,
      roles: ur?.map(u => u.role.name) || []
    }));
  } catch (error: any) {
    console.error("[getUsersList] Error:", error);
    throw new Error(error.message || "Failed to load user list.");
  }
}

export async function createUser(data: {
  name: string;
  username: string;
  roles: string[];
  password?: string;
}) {
  await checkAdminAuth();

  const { name, username, roles: userRoleNames, password = "TempPassword123!" } = data;

  // Enforce domain check
  const usernameStr = username.trim().toLowerCase();
  const APPROVED_DOMAINS = ["chadwickswitchboards.com.au"];
  const domain = usernameStr.split("@").pop();
  if (!domain || !APPROVED_DOMAINS.includes(domain)) {
    throw new Error("Access is restricted to @chadwickswitchboards.com.au accounts only.");
  }

  // Check if username already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.username, usernameStr),
  });

  if (existingUser) {
    throw new Error("An account with this email/username already exists.");
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const legacyRole = userRoleNames.includes("admin") ? "admin" : "viewer";
    
    const [inserted] = await db.insert(users).values({
      name: name.trim(),
      username: usernameStr,
      passwordHash,
      role: legacyRole as any,
      isActive: true,
      sessionVersion: 1,
    }).returning();

    // Map roles
    if (userRoleNames && userRoleNames.length > 0) {
      const allRoles = await db.query.roles.findMany({
        where: inArray(roles.name, userRoleNames)
      });
      if (allRoles.length > 0) {
        await db.insert(userRoles).values(
          allRoles.map(r => ({ userId: inserted.id, roleId: r.id }))
        );
      }
    }

    revalidatePath("/admin/users");
    
    // Clean user object before sending to client
    const { passwordHash: _, ...cleanUser } = inserted;
    return { success: true, user: { ...cleanUser, roles: userRoleNames } };
  } catch (error: any) {
    console.error("[createUser] Error:", error);
    throw new Error(error.message || "Failed to create user.");
  }
}

export async function updateUserStatus(userId: number, isActive: boolean) {
  const session = await checkAdminAuth();
  
  // Prevent self-deactivation
  if (Number(session.user.id) === userId) {
    throw new Error("You cannot deactivate your own account.");
  }

  try {
    await db.update(users)
      .set({ 
        isActive,
        // Incrementing sessionVersion forces immediate revocation of active sessions on the next request-scoped page validation
        sessionVersion: sql`session_version + 1`,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: any) {
    console.error("[updateUserStatus] Error:", error);
    throw new Error(error.message || "Failed to update user status.");
  }
}

export async function updateUserRole(userId: number, userRoleNames: string[]) {
  const session = await checkAdminAuth();

  // Prevent self-role modification to avoid accidental lockout
  if (Number(session.user.id) === userId && !userRoleNames.includes("admin")) {
    throw new Error("You cannot remove your own administrative role.");
  }

  try {
    const legacyRole = userRoleNames.includes("admin") ? "admin" : "viewer";

    await db.update(users)
      .set({ 
        role: legacyRole as any,
        sessionVersion: sql`session_version + 1`,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Update user_roles
    await db.delete(userRoles).where(eq(userRoles.userId, userId));
    
    if (userRoleNames && userRoleNames.length > 0) {
      const allRoles = await db.query.roles.findMany({
        where: inArray(roles.name, userRoleNames)
      });
      if (allRoles.length > 0) {
        await db.insert(userRoles).values(
          allRoles.map(r => ({ userId, roleId: r.id }))
        );
      }
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: any) {
    console.error("[updateUserRole] Error:", error);
    throw new Error(error.message || "Failed to update user role.");
  }
}

export async function resetUserPassword(userId: number, password: string) {
  await checkAdminAuth();

  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    
    await db.update(users)
      .set({ 
        passwordHash,
        // Increment session version to force active sessions to re-authenticate on next validateSession
        sessionVersion: sql`session_version + 1`,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: any) {
    console.error("[resetUserPassword] Error:", error);
    throw new Error(error.message || "Failed to reset password.");
  }
}

export async function deleteUser(userId: number) {
  const session = await checkAdminAuth();

  // Prevent self-deletion
  if (Number(session.user.id) === userId) {
    throw new Error("You cannot delete your own account.");
  }

  // Prevent deleting the last administrator
  const admins = await db.query.userRoles.findMany({
    with: { role: true }
  });
  const adminUsers = admins.filter(ur => ur.role.name === "admin").map(ur => ur.userId);
  
  if (adminUsers.includes(userId) && adminUsers.length <= 1) {
    throw new Error("You cannot delete the last administrative account.");
  }

  try {
    await db.delete(users).where(eq(users.id, userId));
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: any) {
    console.error("[deleteUser] Error:", error);
    throw new Error(error.message || "Failed to delete user.");
  }
}
