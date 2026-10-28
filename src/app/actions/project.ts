'use server';

import { getAuthorizedSession } from '@/lib/auth-helpers';

import { db } from '@/db';
import { projects } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function updateProjectOperationalFields(
  projectId: number,
  fields: {
    drawingStatus?: string;
    procurementStatus?: string;
    productionReadiness?: string;
  }
) {
  const session = await getAuthorizedSession('project');
  if (!session) return { success: false, error: 'Unauthorized' };

  try {
    await db.update(projects)
      .set({ drawingStatus: fields.drawingStatus, procurementStatus: fields.procurementStatus,
        productionReadiness: fields.productionReadiness, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
