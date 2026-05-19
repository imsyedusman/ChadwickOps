"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { validateSession } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export async function changeUserPassword(data: {
  currentPass: string;
  newPass: string;
}) {
  const session = await validateSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized. Please log in first.");
  }

  const { currentPass, newPass } = data;

  if (!currentPass || !newPass) {
    throw new Error("Please fill in all fields.");
  }

  if (newPass.length < 6) {
    throw new Error("New password must be at least 6 characters long.");
  }

  // Load user details
  const user = await db.query.users.findFirst({
    where: eq(users.id, Number(session.user.id)),
  });

  if (!user) {
    throw new Error("User account not found.");
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPass, user.passwordHash);
  if (!isValid) {
    throw new Error("The current password you entered is incorrect.");
  }

  // Update password hash and increment session version
  try {
    const passwordHash = await bcrypt.hash(newPass, 10);
    
    await db.update(users)
      .set({
        passwordHash,
        // Increment session version to force all active sessions (including this one) to log out on next check
        sessionVersion: sql`session_version + 1`,
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));

    revalidatePath("/profile");
    return { success: true };
  } catch (error: any) {
    console.error("[changeUserPassword] Error:", error);
    throw new Error(error.message || "Failed to update your password.");
  }
}
