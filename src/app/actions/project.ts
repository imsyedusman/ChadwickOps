'use server';

import { db } from '@/db';
import { projects } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateSession, hasRole } from '@/lib/auth-helpers';

export async function updateProjectOperationalFields(
  projectId: number,
  fields: {
    drawingStatus?: string;
    procurementStatus?: string;
    productionReadiness?: string;
  }
) {
  const session = await validateSession();
  if (!session) {
    return { success: false, error: 'Unauthorized. Please log in.' };
  }

  const isAuthorized = session.user.role === 'admin' || hasRole(session, 'admin') || hasRole(session, 'scheduler');
  if (!isAuthorized) {
    return { success: false, error: 'Unauthorized. Only Admins and Schedulers can update project fields.' };
  }

  try {
    await db.update(projects)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

