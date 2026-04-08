import { db } from '../src/db';
import { projects, syncLogs, systemConfig } from '../src/db/schema';
import { eq, asc, desc, lt, and } from 'drizzle-orm';

async function deepInvestigate() {
  try {
    console.log('--- SYSTEM CONFIG ---');
    const config = await db.query.systemConfig.findMany();
    config.forEach(c => console.log(`${c.key}: ${JSON.stringify(c.value)}`));

    const prevSyncConfig = config.find(c => c.key === 'PREVIOUS_FULL_SYNC_START');
    const prevSyncStart = prevSyncConfig ? new Date((prevSyncConfig.value as any).timestamp) : null;
    console.log('Parsed PREVIOUS_FULL_SYNC_START:', prevSyncStart?.toISOString());

    console.log('\n--- SYNC LOGS (Latest 5) ---');
    const logs = await db.query.syncLogs.findMany({ orderBy: [desc(syncLogs.timestamp)], limit: 10 });
    logs.forEach(l => console.log(`${l.timestamp.toISOString()} | ${l.status} | ${l.details}`));

    console.log('\n--- PROJECT DATA SAMPLES (Not Archived) ---');
    const samples = await db.select({
      id: projects.id,
      projectNumber: projects.projectNumber,
      lastSeenAt: projects.lastSeenAt,
      isArchived: projects.isArchived
    })
    .from(projects)
    .where(eq(projects.isArchived, false))
    .orderBy(asc(projects.lastSeenAt))
    .limit(20);

    samples.forEach(s => {
      const isMissing = prevSyncStart ? s.lastSeenAt < prevSyncStart : false;
      console.log(`Project: ${s.projectNumber} | lastSeenAt: ${s.lastSeenAt.toISOString()} | < prevSync: ${isMissing}`);
    });

    if (prevSyncStart) {
        const missingCount = await db.select({ count: sql`count(*)` })
            .from(projects)
            .where(and(
                eq(projects.isArchived, false),
                lt(projects.lastSeenAt, prevSyncStart)
            ));
        console.log('\nPotential Archives Count (query):', (missingCount[0] as any).count);
    }

  } catch (error) {
    console.error('Investigation failed:', error);
  } finally {
    process.exit();
  }
}

// @ts-ignore
import { sql } from 'drizzle-orm';
deepInvestigate();
