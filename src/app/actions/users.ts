"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { validateSession } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

// Ensure current request context is an active administrator
async function checkAdminAuth() {
  const session = await validateSession();
  if (!session || session.user.role !== "admin") {
    throw new Error("Unauthorized. Administrator role required.");
  }
  return session;
}

export async function getUsersList() {
  await checkAdminAuth();
  
  try {
    const list = await db.query.users.findMany({
      orderBy: [desc(users.createdAt)],
    });
    
    // Do not return password hashes to the client
    return list.map(({ passwordHash, ...rest }) => rest);
  } catch (error: any) {
    console.error("[getUsersList] Error:", error);
    throw new Error(error.message || "Failed to load user list.");
  }
}

export async function createUser(data: {
  name: string;
  username: string;
  role: string;
  password?: string;
}) {
  await checkAdminAuth();

  const { name, username, role, password = "TempPassword123!" } = data;

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
    
    const [inserted] = await db.insert(users).values({
      name: name.trim(),
      username: usernameStr,
      passwordHash,
      role: role as any,
      isActive: true,
      sessionVersion: 1,
    }).returning();

    revalidatePath("/admin/users");
    
    // Clean user object before sending to client
    const { passwordHash: _, ...cleanUser } = inserted;
    return { success: true, user: cleanUser };
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

export async function updateUserRole(userId: number, role: string) {
  const session = await checkAdminAuth();

  // Prevent self-role modification to avoid accidental lockout
  if (Number(session.user.id) === userId) {
    throw new Error("You cannot modify your own administrative role.");
  }

  try {
    await db.update(users)
      .set({ 
        role: role as any,
        sessionVersion: sql`session_version + 1`,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

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
  const admins = await db.query.users.findMany({
    where: eq(users.role, "admin"),
  });
  
  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (targetUser?.role === "admin" && admins.length <= 1) {
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
