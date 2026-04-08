import { db } from '../src/db';
import { projects, syncLogs, systemConfig } from '../src/db/schema';
import { count, eq, lt, and, desc } from 'drizzle-orm';

async function investigate() {
  try {
    // 1. Check latest sync logs
    console.log('--- Latest Sync Logs ---');
    const logs = await db.query.syncLogs.findMany({
      orderBy: [desc(syncLogs.timestamp)],
      limit: 5
    });
    console.table(logs.map(l => ({ id: l.id, status: l.status, timestamp: l.timestamp, details: l.details?.substring(0, 100) })));

    // 2. Check system config
    console.log('--- System Config ---');
    const config = await db.query.systemConfig.findMany();
    console.table(config.map(c => ({ key: c.key, value: JSON.stringify(c.value) })));

    // 3. Project counts
    console.log('--- Project Counts ---');
    const total = await db.select({ value: count() }).from(projects);
    const active = await db.select({ value: count() }).from(projects).where(eq(projects.isArchived, false));
    const archived = await db.select({ value: count() }).from(projects).where(eq(projects.isArchived, true));
    console.log(`Total: ${total[0].value}, Active: ${active[0].value}, Archived: ${archived[0].value}`);

    // 4. Sample timestamps
    console.log('--- Sample Timestamps ---');
    const sampleProjects = await db.select({ 
      id: projects.id, 
      projectNumber: projects.projectNumber, 
      lastSeenAt: projects.lastSeenAt, 
      isArchived: projects.isArchived 
    })
    .from(projects)
    .where(eq(projects.isArchived, false))
    .limit(10);
    console.table(sampleProjects);

    // 5. Check missing threshold
    const prevSyncConfig = config.find(c => c.key === 'PREVIOUS_FULL_SYNC_START');
    if (prevSyncConfig) {
        const prevSyncDate = new Date((prevSyncConfig.value as any).timestamp);
        console.log(`Previous Full Sync Start: ${prevSyncDate.toISOString()}`);
        
        const wouldBeArchived = await db.select({ value: count() })
            .from(projects)
            .where(and(
                eq(projects.isArchived, false),
                lt(projects.lastSeenAt, prevSyncDate)
            ));
        console.log(`Projects with lastSeenAt < PreviousSyncStart: ${wouldBeArchived[0].value}`);
    } else {
        console.log('PREVIOUS_FULL_SYNC_START not found in config.');
    }

  } catch (error) {
    console.error('Investigation failed:', error);
  } finally {
    process.exit();
  }
}

investigate();
