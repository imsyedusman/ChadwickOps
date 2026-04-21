import { db } from '../src/db';
import { projects } from '../src/db/schema';
import { eq, sql, and, or, notInArray, gt, isNull, asc } from 'drizzle-orm';

async function verifyPriority() {
    console.log('--- Verifying Deep Sync Queue Priority Order ---');

    const finishedStatuses = ['completed', 'invoiced', 'closed', 'cancelled'];
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const queue = await db.select({
        projectNumber: projects.projectNumber,
        lastDeepSyncAt: projects.lastDeepSyncAt,
        remoteUpdatedAt: projects.remoteUpdatedAt
    }).from(projects)
      .where(
        and(
          eq(projects.isArchived, false),
          or(
            notInArray(sql`lower(${projects.rawStatus})`, finishedStatuses),
            gt(projects.remoteUpdatedAt, sixtyDaysAgo),
            isNull(projects.remoteUpdatedAt),
            isNull(projects.lastDeepSyncAt)
          )
        )
      )
      .orderBy(
        sql`(${projects.lastDeepSyncAt} IS NULL) DESC`,
        sql`(${projects.remoteUpdatedAt} > ${oneDayAgo.toISOString()}) DESC`,
        asc(projects.lastDeepSyncAt),
        asc(projects.remoteUpdatedAt)
      )
      .limit(10);

    console.log('Top 10 items in queue:');
    queue.forEach((p, i) => {
        const priority = p.lastDeepSyncAt === null ? 'TIER 1 (New)' : 
                         (p.remoteUpdatedAt && new Date(p.remoteUpdatedAt) > oneDayAgo) ? 'TIER 2 (Recent)' : 
                         'TIER 3 (Rotation)';
        console.log(`${i+1}. Project: ${p.projectNumber} | Priority: ${priority} | LastSync: ${p.lastDeepSyncAt} | RemoteUpdate: ${p.remoteUpdatedAt}`);
    });

    process.exit(0);
}

verifyPriority().catch(console.error);
