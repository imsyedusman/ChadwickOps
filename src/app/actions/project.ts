'use server';

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
  try {
    await db.update(projects)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
