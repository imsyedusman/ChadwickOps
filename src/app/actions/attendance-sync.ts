'use server';

import { getAuthorizedSession } from '@/lib/auth-helpers';
import { db } from '@/db';
import { systemConfig, attendanceSyncLogs, attendanceRecords } from '@/db/schema';
import { AttendanceSyncService } from '@/lib/attendance-sync';
import { decrypt } from '@/lib/crypto';
import { eq, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function triggerAttendanceSync(options: { daysBack?: number; startDate?: string; endDate?: string } = {}) {
  const session = await getAuthorizedSession('sync');
  if (!session) {
    return { success: false, error: 'Unauthorized: Admin privileges required to sync attendance data.' };
  }

  try {
    const config = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
    });

    if (!config) {
      throw new Error('WorkGuru API credentials are not configured.');
    }

    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    const syncService = new AttendanceSyncService(decryptedKey, decryptedSecret);
    const stats = await syncService.runSync(options);

    revalidatePath('/attendance');
    return { success: true, stats };
  } catch (error) {
    console.error('[AttendanceSyncAction] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during attendance sync',
    };
  }
}

export async function getLatestAttendanceSyncStatus() {
  try {
    const latestLog = await db.query.attendanceSyncLogs.findFirst({
      orderBy: [desc(attendanceSyncLogs.timestamp)],
    });

    return { success: true, latestLog };
  } catch (error) {
    console.error('[getLatestAttendanceSyncStatus] Error:', error);
    return { success: false, error: 'Failed to retrieve sync status' };
  }
}

