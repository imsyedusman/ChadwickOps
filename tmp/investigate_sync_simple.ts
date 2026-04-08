import { db } from '../src/db';
import { projects, syncLogs, systemConfig } from '../src/db/schema';
import { count, eq, lt, and, desc } from 'drizzle-orm';

async function investigate() {
  try {
    const logs = await db.query.syncLogs.findMany({
      orderBy: [desc(syncLogs.timestamp)],
      limit: 10
    });
    console.log('SYNC_LOGS_START');
    logs.forEach(l => {
      console.log(`LOG|${l.id}|${l.status}|${l.timestamp.toISOString()}|${l.details}`);
    });
    console.log('SYNC_LOGS_END');

    const config = await db.query.systemConfig.findMany();
    console.log('CONFIG_START');
    config.forEach(c => {
      console.log(`CONFIG|${c.key}|${JSON.stringify(c.value)}`);
    });
    console.log('CONFIG_END');

    const [total] = await db.select({ value: count() }).from(projects);
    const [active] = await db.select({ value: count() }).from(projects).where(eq(projects.isArchived, false));
    const [archived] = await db.select({ value: count() }).from(projects).where(eq(projects.isArchived, true));
    console.log(`COUNTS|TOTAL:${total.value}|ACTIVE:${active.value}|ARCHIVED:${archived.value}`);

    const prevSyncConfig = config.find(c => c.key === 'PREVIOUS_FULL_SYNC_START');
    if (prevSyncConfig) {
        const prevSyncDate = new Date((prevSyncConfig.value as any).timestamp);
        console.log(`PREV_SYNC_START|${prevSyncDate.toISOString()}`);
        
        const [wouldBeArchived] = await db.select({ value: count() })
            .from(projects)
            .where(and(
                eq(projects.isArchived, false),
                lt(projects.lastSeenAt, prevSyncDate)
            ));
        console.log(`POTENTIAL_ARCHIVE|${wouldBeArchived.value}`);

        // Check if lastSeenAt is updating
        const [recentlySeen] = await db.select({ value: count() })
            .from(projects)
            .where(and(
                eq(projects.isArchived, false),
                sql`last_seen_at > now() - interval '1 hour'`
            ));
        console.log(`RECENTLY_SEEN|${recentlySeen.value}`);
    }

  } catch (error) {
    console.error('Investigation failed:', error);
  } finally {
    process.exit();
  }
}

// @ts-ignore
import { sql } from 'drizzle-orm';
investigate();
