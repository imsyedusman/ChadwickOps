import { db } from '@/db';
import { clients, projects, tasks, timeEntries, syncLogs, systemConfig } from '@/db/schema';
import { WorkGuruClient } from './workguru';
import { eq, sql } from 'drizzle-orm';

export class SyncService {
  private client: WorkGuruClient;

  constructor(apiKey: string, apiSecret: string) {
    this.client = new WorkGuruClient(apiKey, apiSecret);
  }

  async runFullSync() {
    const startTime = new Date();
    try {
      console.log('Starting full sync with validation...');
      
      const remoteClients = await this.client.getClients();
      await this.syncClients(remoteClients);

      const remoteProjects = await this.client.getProjects();
      await this.syncProjects(remoteProjects);

      const remoteEntries = await this.client.getTimeEntries();
      await this.syncTimeEntries(remoteEntries);
      
      // Perform Sanity Check / Validation
      const localData = await db.select({
        count: sql<number>`count(*)`,
        totalBudget: sql<number>`sum(${projects.budgetHours})`,
        totalActual: sql<number>`sum(${projects.actualHours})`,
      }).from(projects);

      const remoteTotalBudget = remoteProjects.reduce((acc: number, p: any) => acc + (p.EstimatedHours || 0), 0);
      const remoteTotalActual = remoteProjects.reduce((acc: number, p: any) => acc + (p.ActualHours || 0), 0);
      
      const countMismatch = Number(localData[0].count) !== remoteProjects.length;
      const hoursMismatch = Math.abs(Number(localData[0].totalBudget) - remoteTotalBudget) > 0.1 || 
                           Math.abs(Number(localData[0].totalActual) - remoteTotalActual) > 0.1;

      const status = (countMismatch || hoursMismatch) ? 'WARNING' : 'SUCCESS';
      const details = [
        `Sync completed in ${Date.now() - startTime.getTime()}ms.`,
        `Projects: Remote=${remoteProjects.length}, Local=${localData[0].count}.`,
        `Budget Hours: Remote=${remoteTotalBudget.toFixed(1)}, Local=${Number(localData[0].totalBudget).toFixed(1)}.`,
        `Actual Hours: Remote=${remoteTotalActual.toFixed(1)}, Local=${Number(localData[0].totalActual).toFixed(1)}.`
      ].join(' ');

      await db.insert(syncLogs).values({
        status,
        details,
      });

      console.log('Sync result:', status, details);
    } catch (error) {
      console.error('Sync failed:', error);
      await db.insert(syncLogs).values({
        status: 'FAILURE',
        details: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async syncClients(remoteClients: any[]) {
    for (const remote of remoteClients) {
      await db.insert(clients).values({
        workguruId: remote.ClientID.toString(),
        name: remote.ClientName,
      }).onConflictDoUpdate({
        target: clients.workguruId,
        set: { name: remote.ClientName, updatedAt: new Date() },
      });
    }
  }

  private async syncProjects(remoteProjects: any[]) {
    for (const remote of remoteProjects) {
      // Find local client ID
      const localClient = await db.query.clients.findFirst({
        where: eq(clients.workguruId, remote.ClientID.toString()),
      });

      if (!localClient) continue;

      // Recalculate derived fields on every sync to prevent drift
      const budgetHours = remote.EstimatedHours || 0;
      const actualHours = remote.ActualHours || 0;
      const remainingHours = Math.max(0, budgetHours - actualHours);
      const progressPercent = budgetHours > 0 ? (actualHours / budgetHours) * 100 : 0;

      const projectData = {
        workguruId: remote.ProjectID.toString(),
        projectNumber: remote.ProjectNumber,
        name: remote.ProjectName,
        clientId: localClient.id,
        rawStatus: remote.Status || 'UNKNOWN',
        budgetHours,
        actualHours,
        remainingHours,
        progressPercent,
        deliveryDate: remote.DueDate ? new Date(remote.DueDate) : null,
        updatedAt: new Date(),
      };

      await db.insert(projects).values(projectData).onConflictDoUpdate({
        target: projects.workguruId,
        set: projectData,
      });

      // Sync tasks for this project
      await this.syncTasks(remote.ProjectID.toString());
    }
  }

  private async syncTasks(projectWorkGuruId: string) {
    const remoteTasks = await this.client.getProjectTasks(projectWorkGuruId);
    const localProject = await db.query.projects.findFirst({
      where: eq(projects.workguruId, projectWorkGuruId),
    });

    if (!localProject) return;

    for (const remote of remoteTasks) {
      const taskData = {
        workguruId: remote.TaskID.toString(),
        projectId: localProject.id,
        name: remote.TaskName,
        budgetHours: remote.EstimatedHours || 0,
        actualHours: remote.ActualHours || 0,
        updatedAt: new Date(),
      };

      await db.insert(tasks).values(taskData).onConflictDoUpdate({
        target: tasks.workguruId,
        set: taskData,
      });
    }
  }

  private async syncTimeEntries(remoteEntries: any[]) {
    for (const remote of remoteEntries) {
      const localProject = await db.query.projects.findFirst({
        where: eq(projects.workguruId, remote.ProjectID.toString()),
      });

      if (!localProject) continue;

      let localTaskId = null;
      if (remote.TaskID) {
        const localTask = await db.query.tasks.findFirst({
          where: eq(tasks.workguruId, remote.TaskID.toString()),
        });
        localTaskId = localTask?.id || null;
      }

      const entryData = {
        workguruId: remote.TimeEntryID.toString(),
        projectId: localProject.id,
        taskId: localTaskId,
        hours: remote.Hours || 0,
        date: new Date(remote.Date),
        user: remote.UserName || 'Unknown',
        updatedAt: new Date(),
      };

      await db.insert(timeEntries).values(entryData).onConflictDoUpdate({
        target: timeEntries.workguruId,
        set: entryData,
      });
    }
  }
}
