import { db } from "../src/db";
import { users, roles, userRoles } from "../src/db/schema";
import { eq } from "drizzle-orm";
import postgres from "postgres";

async function main() {
  console.log("Starting roles migration...");

  // 1. Seed roles
  const rolesToInsert = [
    { name: "admin", description: "Administrator with full access" },
    { name: "finance", description: "Finance user" },
    { name: "scheduler", description: "Scheduler user" },
    { name: "viewer", description: "Read-only access" }
  ];

  for (const r of rolesToInsert) {
    await db.insert(roles).values(r).onConflictDoNothing({ target: roles.name });
  }
  console.log("Roles seeded.");

  // 2. Read users
  const allUsers = await db.select().from(users);
  console.log(`Found ${allUsers.length} users to migrate.`);

  // 3. Map and insert
  const allRoles = await db.select().from(roles);
  const roleMap = allRoles.reduce((acc, r) => {
    acc[r.name] = r.id;
    return acc;
  }, {} as Record<string, number>);

  let migratedCount = 0;
  const roleCounts: Record<string, number> = { admin: 0, finance: 0, scheduler: 0, viewer: 0 };

  for (const user of allUsers) {
    let newRoleName = "viewer";
    const legacyRole = user.role?.toLowerCase() || "";

    if (legacyRole === "admin" || legacyRole === "administrator") {
      newRoleName = "admin";
    }

    const roleId = roleMap[newRoleName];
    if (roleId) {
      await db.insert(userRoles)
        .values({ userId: user.id, roleId })
        .onConflictDoNothing();
      migratedCount++;
      roleCounts[newRoleName]++;
    }
  }

  console.log(`Successfully migrated ${migratedCount} users.`);
  console.log("Breakdown by role:", roleCounts);

  // Verification as requested
  const verifyRoles = await db.select().from(userRoles);
  console.log(`Total rows in user_roles table: ${verifyRoles.length}`);
  
  if (verifyRoles.length !== allUsers.length) {
    console.error(`FLAG: Row count in user_roles (${verifyRoles.length}) does not match total user count (${allUsers.length}).`);
  } else {
    console.log("Verification passed: Row counts match.");
  }
  
  process.exit(0);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
