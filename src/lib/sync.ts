import { db } from '@/db';
import { clients, projects, tasks, timeEntries, syncLogs, systemConfig } from '@/db/schema';
import { WorkGuruClient } from './workguru';
import { eq, sql } from 'drizzle-orm';

export class SyncService {
  private client: WorkGuruClient;

  constructor(apiKey: string, apiSecret: string) {
    this.client = new WorkGuruClient(apiKey, apiSecret);
  }

  private extractItems(data: any, entityName: string): any[] {
    console.log(`[Sync] Raw ${entityName} data head:`, JSON.stringify(data).substring(0, 200));
    console.log(`[Sync] ${entityName} result exists:`, !!data?.result);
    console.log(`[Sync] ${entityName} items exists:`, !!data?.result?.items);
    
    const items = data?.result?.items;
    
    if (!items) {
      throw new Error(`Missing items in WorkGuru response for ${entityName}`);
    }
    
    if (!Array.isArray(items)) {
      console.error(`[Sync] Invalid ${entityName} items structure:`, items);
      throw new Error(`Invalid WorkGuru response: items for ${entityName} is not an array (Type: ${typeof items})`);
    }
    
    console.log(`[Sync] ${entityName} Items length:`, items.length);
    
    // Debug log the first item to confirm structure
    if (items.length > 0) {
        console.log(`[Sync] First ${entityName} sample:`, JSON.stringify(items[0]).substring(0, 300));
    }
    
    return items;
  }

  async runFullSync() {
    const startTime = new Date();
    try {
      console.log('Starting full sync with standardized parsing...');
      
      const clientData = await this.client.getClients();
      const remoteClients = this.extractItems(clientData, 'Client');
      await this.syncClients(remoteClients);

      const projectData = await this.client.getProjects();
      const remoteProjects = this.extractItems(projectData, 'Project');
      await this.syncProjects(remoteProjects);

      const clientCount = await db.select({ count: sql<number>`count(*)` }).from(clients);
      const projectCount = await db.select({ count: sql<number>`count(*)` }).from(projects);

      const status = 'SUCCESS';
      const details = `Sync completed: ${remoteProjects.length} projects, ${remoteClients.length} clients`;

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
    let count = 0;
    for (const remote of remoteClients) {
      const workguruId = (remote.id || remote.tenantId || remote.ClientID)?.toString();
      const name = remote.name || remote.ClientName;

      if (!workguruId || !name) continue;

      await db.insert(clients).values({
        workguruId,
        name,
      }).onConflictDoUpdate({
        target: clients.workguruId,
        set: { name, updatedAt: new Date() },
      });
      count++;
    }
    console.log(`[Sync] Inserted/Updated ${count} clients.`);
  }

  private async syncProjects(remoteProjects: any[]) {
    let count = 0;
    for (const remote of remoteProjects) {
      const workguruId = (remote.id || remote.ProjectID)?.toString();
      const projectNumber = remote.projectNumber || remote.ProjectNumber;
      const name = remote.name || remote.ProjectName;
      const remoteClientId = (remote.clientId || remote.ClientID)?.toString();

      if (!workguruId || !name || !remoteClientId) continue;

      const localClient = await db.query.clients.findFirst({
        where: eq(clients.workguruId, remoteClientId),
      });

      if (!localClient) continue;

      const budgetHours = remote.estimatedHours || remote.EstimatedHours || 0;
      const actualHours = remote.actualHours || remote.ActualHours || 0;
      const remainingHours = Math.max(0, budgetHours - actualHours);
      const progressPercent = budgetHours > 0 ? (actualHours / budgetHours) * 100 : 0;

      const projectData = {
        workguruId,
        projectNumber,
        name,
        clientId: localClient.id,
        rawStatus: remote.status || remote.Status || 'UNKNOWN',
        budgetHours,
        actualHours,
        remainingHours,
        progressPercent,
        deliveryDate: remote.dueDate || remote.DueDate ? new Date(remote.dueDate || remote.DueDate) : null,
        updatedAt: new Date(),
      };

      await db.insert(projects).values(projectData).onConflictDoUpdate({
        target: projects.workguruId,
        set: projectData,
      });

      // Sync tasks and time entries for this project
      await this.syncTasks(workguruId);
      await this.syncProjectTimeEntries(workguruId);
      count++;
    }
    console.log(`[Sync] Inserted/Updated ${count} projects.`);
  }

  private async syncTasks(projectWorkGuruId: string) {
    const taskResponse = await this.client.getProjectTasks(projectWorkGuruId);
    const remoteTasks = this.extractItems(taskResponse, 'Task');
    
    const localProject = await db.query.projects.findFirst({
      where: eq(projects.workguruId, projectWorkGuruId),
    });

    if (!localProject) return;

    let count = 0;
    for (const remote of remoteTasks) {
      const workguruId = (remote.id || remote.TaskID)?.toString();
      const name = remote.name || remote.TaskName;
      if (!workguruId || !name) continue;

      const taskData = {
        workguruId,
        projectId: localProject.id,
        name,
        budgetHours: remote.estimatedHours || remote.EstimatedHours || 0,
        actualHours: remote.actualHours || remote.ActualHours || 0,
        updatedAt: new Date(),
      };

      await db.insert(tasks).values(taskData).onConflictDoUpdate({
        target: tasks.workguruId,
        set: taskData,
      });
      count++;
    }
    // Only log if significant, or keep it quiet to avoid log bloat for many projects
    // console.log(`[Sync] Project ${projectWorkGuruId}: Synced ${count} tasks.`);
  }

  private async syncProjectTimeEntries(projectWorkGuruId: string) {
    const entryResponse = await this.client.getProjectTimeEntries(projectWorkGuruId);
    const remoteEntries = this.extractItems(entryResponse, 'TimeEntry');

    const localProject = await db.query.projects.findFirst({
      where: eq(projects.workguruId, projectWorkGuruId),
    });

    if (!localProject) return;

    let count = 0;
    for (const remote of remoteEntries) {
      const workguruId = (remote.id || remote.TimeEntryID)?.toString();
      const remoteTaskId = (remote.taskId || remote.TaskID)?.toString();

      if (!workguruId) continue;

      let localTaskId = null;
      if (remoteTaskId) {
        const localTask = await db.query.tasks.findFirst({
          where: eq(tasks.workguruId, remoteTaskId),
        });
        localTaskId = localTask?.id || null;
      }

      const entryData = {
        workguruId,
        projectId: localProject.id,
        taskId: localTaskId,
        hours: remote.hours || remote.Hours || 0,
        date: new Date(remote.date || remote.Date),
        user: remote.userName || remote.UserName || 'Unknown',
        updatedAt: new Date(),
      };

      await db.insert(timeEntries).values(entryData).onConflictDoUpdate({
        target: timeEntries.workguruId,
        set: entryData,
      });
      count++;
    }
    // Only log if significant
    // console.log(`[Sync] Project ${projectWorkGuruId}: Synced ${count} time entries.`);
  }
}
