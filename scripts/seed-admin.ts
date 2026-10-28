/** Explicit provisioning only. Never run as part of application startup. */
import { db } from '../src/db';
import { users, roles, userRoles } from '../src/db/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function seedAdmin() {
  const username = process.env.SEED_ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim();
  if (!username || !/^[^@\s]+@chadwickswitchboards\.com\.au$/.test(username) || !name || !password || password.length < 12) {
    throw new Error('Explicit SEED_ADMIN_USERNAME, SEED_ADMIN_NAME and SEED_ADMIN_PASSWORD (12+ characters) are required.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  // Atomic and repeatable: legacy label alone never grants admin access.
  await db.transaction(async (tx) => {
    await tx.insert(roles).values({ name: 'admin', description: 'Administrator with full access' })
      .onConflictDoNothing({ target: roles.name });
    const adminRole = await tx.query.roles.findFirst({ where: eq(roles.name, 'admin') });
    if (!adminRole) throw new Error('Administrator role unavailable');
    const [user] = await tx.insert(users).values({
      username, passwordHash, name, role: 'admin', isActive: true,
    }).onConflictDoUpdate({
      target: users.username,
      set: { passwordHash, name, role: 'admin', isActive: true,
        sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date() },
    }).returning({ id: users.id });
    await tx.insert(userRoles).values({ userId: user.id, roleId: adminRole.id }).onConflictDoNothing();
  });
}

seedAdmin().then(() => {
  console.log('[Seed] Administrator provisioned.');
  process.exit(0);
}).catch(() => {
  console.error('[Seed] Administrator provisioning failed.');
  process.exit(1);
});
