import { db } from '@/db';
import { displayStages, stageMappings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export class StageService {
  async getDisplayStageForStatus(workguruStatus: string) {
    // 1. Check if we have a direct mapping
    const mapping = await db.query.stageMappings.findFirst({
      where: eq(stageMappings.workguruStatus, workguruStatus),
      with: {
        displayStage: true,
      },
    });

    if (mapping) {
      return mapping.displayStage;
    }

    // 2. If no mapping, we might want to create a default one or return null
    return null;
  }

  async getAllStages() {
    return await db.query.displayStages.findMany({
      orderBy: (stages, { asc }) => [asc(stages.order)],
    });
  }

  async seedDefaultStages() {
    const defaults = [
      { name: 'Engineering', order: 1, color: '#facc15' }, // Yellow
      { name: 'Approved', order: 2, color: '#3b82f6' },    // Blue
      { name: 'Production', order: 3, color: '#f97316' },   // Orange
      { name: 'Testing', order: 4, color: '#a855f7' },      // Purple
      { name: 'Ready for Dispatch', order: 5, color: '#22c55e' }, // Green
    ];

    for (const stage of defaults) {
      await db.insert(displayStages).values(stage).onConflictDoNothing();
    }
  }

  async seedDefaultMappings() {
    // These are based on the Python scripts and meeting notes
    const defaultMappings = [
      { status: '1.1 - Not Drawn', stage: 'Engineering' },
      { status: '1.2 - Drawings Submitted', stage: 'Engineering' },
      { status: '1.3 - Drawings Approved', stage: 'Approved' },
      { status: '2.1 - Ready for Production', stage: 'Production' },
      { status: '2.2 - Ready for Testing', stage: 'Testing' },
      { status: '2.4 - Tested Passed', stage: 'Ready for Dispatch' },
      { status: '3.1 - Dispatched', stage: 'Ready for Dispatch' },
    ];

    for (const item of defaultMappings) {
      const stage = await db.query.displayStages.findFirst({
        where: eq(displayStages.name, item.stage),
      });

      if (stage) {
        await db.insert(stageMappings).values({
          workguruStatus: item.status,
          displayStageId: stage.id,
        }).onConflictDoNothing();
      }
    }
  }
}
