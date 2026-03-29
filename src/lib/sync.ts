import { db } from '@/db';
import { clients, projects, tasks, timeEntries, syncLogs, systemConfig } from '@/db/schema';
import { WorkGuruClient } from './workguru';
import { eq, sql } from 'drizzle-orm';

export class SyncService {
  private client: WorkGuruClient;

  constructor(apiKey: string, apiSecret: string) {
    this.client = new WorkGuruClient(apiKey, apiSecret);
  }

  private parseDate(dateStr: any): Date | null {
    if (!dateStr) return null;
    const str = String(dateStr).trim();
    if (!str) return null;

    // Handle DD/MM/YYYY format
    const parts = str.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime())) return date;
      }
    }

    // Fallback to standard JS parsing
    const date = new Date(str);
    if (!isNaN(date.getTime())) return date;

    console.warn(`[Sync] Failed to parse date string: "${str}"`);
    return null;
  }

  private extractItems(data: any, entityName: string): any[] {
    const result = data?.result;
    let items: any[] | undefined;

    if (Array.isArray(result)) {
        // Pattern 1: result is directly an array (e.g. Tasks)
        items = result;
    } else if (result && Array.isArray(result.items)) {
        // Pattern 2: result contains an items array (e.g. Clients, Projects)
        items = result.items;
    } else if (data && Array.isArray(data.items)) {
        // Fallback Pattern 3: items is at the top level
        items = data.items;
    }

    if (!items) {
      console.error(`[Sync] Invalid ${entityName} response structure. Full data head:`, JSON.stringify(data).substring(0, 500));
      throw new Error(`Invalid WorkGuru response: could not find items array for ${entityName}`);
    }
    
    console.log(`[Sync] ${entityName} Items length:`, items.length);
    
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
      
      // Cleanup old duplicate records before syncing projects
      await this.cleanDatabase();
      
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
        // Detailed mapping based on API response
        // workguruId MUST be the numeric ID for API calls
        const workguruId = (remote.id || remote.ProjectID)?.toString();
        const projectNumber = remote.projectNo || remote.ProjectNumber || 'N/A';
        const name = remote.projectName || remote.ProjectName || remote.name;
        const remoteClientId = (remote.clientId || remote.ClientID)?.toString();
        const status = remote.status || remote.Status || 'UNKNOWN';
        const dueDate = this.parseDate(remote.dueDate || remote.DueDate);

        if (!workguruId || !name || !remoteClientId) {
            console.log(`[Sync] Skipping project: missing critical fields. ID=${workguruId}, Name=${name}, ClientID=${remoteClientId}`);
            continue;
        }

        const localClient = await db.query.clients.findFirst({
            where: eq(clients.workguruId, remoteClientId),
        });

        if (!localClient) {
            console.log(`[Sync] Skipping project ${workguruId}: Local client ${remoteClientId} not found.`);
            continue;
        }

        const budgetHours = remote.estimatedHours || remote.EstimatedHours || 0;
        const actualHours = remote.actualHours || remote.ActualHours || 0;
        const remainingHours = Math.max(0, budgetHours - actualHours);
        const progressPercent = budgetHours > 0 ? (actualHours / budgetHours) * 100 : 0;

        const projectData = {
            workguruId,
            projectNumber,
            name,
            clientId: localClient.id,
            rawStatus: status,
            budgetHours,
            actualHours,
            remainingHours,
            progressPercent,
            deliveryDate: dueDate,
            updatedAt: new Date(),
        };

        if (count === 0) {
            console.log(`[Sync] Sample mapped project:`, JSON.stringify(projectData, null, 2));
        }

        await db.insert(projects).values(projectData).onConflictDoUpdate({
            target: projects.workguruId,
            set: projectData,
        });

        // Sync tasks and time entries for this project
        // Defensive handling: only sync if we have a numeric-looking ID
        if (workguruId && !isNaN(Number(workguruId))) {
            try {
                await this.syncTasks(workguruId);
                await this.syncProjectTimeEntries(workguruId);
            } catch (taskError) {
                console.error(`[Sync] Failed to sync tasks/time for project ${projectNumber} (${workguruId}):`, taskError instanceof Error ? taskError.message : taskError);
                // Don't re-throw, continue with next project
            }
        } else {
            console.warn(`[Sync] Skipping task sync for project ${projectNumber}: Invalid numeric ID (${workguruId})`);
        }
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
        date: this.parseDate(remote.date || remote.Date) || new Date(),
        user: remote.user || remote.UserName || 'System',
        updatedAt: new Date(),
      };

      await db.insert(timeEntries).values(entryData).onConflictDoUpdate({
        target: timeEntries.workguruId,
        set: entryData,
      });
      count++;
    }
  }

  private async cleanDatabase() {
    console.log('[Sync] Cleaning up legacy duplicate records...');
    try {
        // Delete projects where workguruId contains a slash (legacy projectNo format)
        const deletedProjects = await db.delete(projects)
            .where(sql`workguru_id LIKE '%/%'`)
            .returning({ id: projects.id });
        
        if (deletedProjects.length > 0) {
            console.log(`[Sync] Removed ${deletedProjects.length} legacy duplicate projects.`);
        }

        // Also clean orphaned tasks and time entries if necessary
        // (Though cascade delete should handle it if defined, but our schema doesn't have it on all)
    } catch (error) {
        console.error('[Sync] Database cleanup failed:', error);
    }
  }
}
