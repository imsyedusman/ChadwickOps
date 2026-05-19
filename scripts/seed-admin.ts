import { db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function seedAdmin() {
  const username = 'susman@chadwickswitchboards.com.au';
  const password = 'Developer@2k26!';
  const name = 'S Usman';
  
  console.log(`[Seed] Hashing password for admin ${username}...`);
  const passwordHash = await bcrypt.hash(password, 12);
  
  console.log('[Seed] Checking if admin already exists...');
  const existing = await db.query.users.findFirst({
    where: eq(users.username, username),
  });
  
  if (existing) {
    console.log('[Seed] Admin already exists. Updating details...');
    await db.update(users)
      .set({
        passwordHash,
        name,
        role: 'admin',
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    console.log('[Seed] Admin updated successfully!');
  } else {
    console.log('[Seed] Inserting new admin user...');
    await db.insert(users).values({
      username,
      passwordHash,
      name,
      role: 'admin',
      isActive: true,
    });
    console.log('[Seed] Admin seeded successfully!');
  }
  
  process.exit(0);
}

seedAdmin().catch(err => {
  console.error('[Seed] Error seeding admin:', err);
  process.exit(1);
});
