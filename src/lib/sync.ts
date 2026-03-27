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
      console.log('Starting full sync...');
      await this.syncClients();
      await this.syncProjects();
      await this.syncTimeEntries();
      
      await db.insert(syncLogs).values({
        status: 'SUCCESS',
        details: `Full sync completed in ${Date.now() - startTime.getTime()}ms`,
      });
    } catch (error) {
      console.error('Sync failed:', error);
      await db.insert(syncLogs).values({
        status: 'FAILURE',
        details: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async syncClients() {
    const remoteClients = await this.client.getClients();
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

  private async syncProjects() {
    const remoteProjects = await this.client.getProjects();
    for (const remote of remoteProjects) {
      // Find local client ID
      const localClient = await db.query.clients.findFirst({
        where: eq(clients.workguruId, remote.ClientID.toString()),
      });

      if (!localClient) continue;

      const projectData = {
        workguruId: remote.ProjectID.toString(),
        projectNumber: remote.ProjectNumber,
        name: remote.ProjectName,
        clientId: localClient.id,
        rawStatus: remote.Status || 'UNKNOWN',
        budgetHours: remote.EstimatedHours || 0,
        actualHours: remote.ActualHours || 0,
        remainingHours: (remote.EstimatedHours || 0) - (remote.ActualHours || 0),
        progressPercent: remote.EstimatedHours > 0 ? (remote.ActualHours / remote.EstimatedHours) * 100 : 0,
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

  private async syncTimeEntries() {
    const remoteEntries = await this.client.getTimeEntries();
    for (const remote of remoteEntries) {
      const localProject = await db.query.projects.findFirst({
        where: eq(projects.workguruId, remote.ProjectID.toString()),
      });

      if (!localProject) continue;

      // Task is optional in my schema
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
