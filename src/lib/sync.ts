import { db } from '@/db';
import { clients, projects, tasks, timeEntries, syncLogs, systemConfig } from '@/db/schema';
import { WorkGuruClient } from './workguru';
import { eq, sql, asc, desc, inArray, and, notInArray } from 'drizzle-orm';

export class SyncService {
  private client: WorkGuruClient;

  constructor(apiKey: string, apiSecret: string) {
    this.client = new WorkGuruClient(apiKey, apiSecret);
  }

  private async sleep(ms: number) {
    const jitter = Math.floor(Math.random() * 300);
    return new Promise(resolve => setTimeout(resolve, ms + jitter));
  }

  private async withRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 5): Promise<T | null> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const isRateLimit = error.response?.status === 429 || error.status === 429;
        
        if (isRateLimit && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 500; // 1s, 2s, 4s, 8s...
          console.warn(`[Sync] Rate limit hit on ${label}. Attempt ${attempt}/${maxRetries}. Retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }
        
        if (attempt === maxRetries) {
          console.error(`[Sync] ${label} failed after ${maxRetries} attempts:`, error.message);
          return null;
        }
        
        // Non-rate limit error or other failure
        console.error(`[Sync] ${label} encountered error:`, error.message);
        return null;
      }
    }
    return null;
  }

  public extractItems(data: any, entityName: string): any[] {
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

  async runSync(mode: 'QUICK' | 'FULL' = 'QUICK') {
    const startTime = new Date();
    try {
      console.log(`Starting ${mode} sync...`);
      
      const clientData = await this.withRetry(() => this.client.getClients(), 'Fetch Clients');
      if (clientData) {
        const remoteClients = this.extractItems(clientData, 'Client');
        await this.syncClients(remoteClients);
      }

      const projectFetchMethod = mode === 'FULL' ? () => this.client.getAllProjects() : () => this.client.getProjects();
      const projectData = await this.withRetry(projectFetchMethod, `Fetch ${mode} Projects`);
      if (projectData) {
        const remoteProjects = this.extractItems(projectData, 'Project');
        await this.cleanDatabase();
        await this.syncProjects(remoteProjects);
      }

      // 1. Global Time Entry Sync (Fetch all recent/open time once)
      await this.syncGlobalTimeEntries();

      // Progression Sync Logic
      let deepSyncStats;
      if (mode === 'QUICK') {
        deepSyncStats = await this.runDeepSyncQueue(15, true); // 15 most recent
      } else {
        deepSyncStats = await this.runFullDeepSyncCycle(); // All batches sequentially or resumable
      }

      const status = 'SUCCESS';
      const details = `${mode} Sync completed. ${deepSyncStats.processedCount} projects deep-synced.`;

      await db.insert(syncLogs).values({
        status,
        details,
      });

      console.log('Sync result:', status, details);
      return { success: true, mode, stats: deepSyncStats };
    } catch (error) {
      console.error('Sync failed:', error);
      await db.insert(syncLogs).values({
        status: 'FAILURE',
        details: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async runFullDeepSyncCycle() {
    // Implement resumable full sync
    const configResults = await db.select().from(systemConfig).where(eq(systemConfig.key, 'FULL_SYNC_CURSOR')).limit(1);
    const config = configResults[0];
    
    let offset = config ? (config.value as { offset: number }).offset : 0;
    console.log(`[Sync] Resuming Full Sync at offset ${offset}`);

    const stats = await this.runDeepSyncQueue(20, false, offset); // Process batch of 20
    
    const newOffset = offset + stats.processedCount;
    const totalActive = await db.select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(notInArray(projects.rawStatus, ['Completed', 'Archived', 'Declined']));
    
    const isComplete = newOffset >= totalActive[0].count;
    
    await db.insert(systemConfig).values({
      key: 'FULL_SYNC_CURSOR',
      value: { offset: isComplete ? 0 : newOffset },
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: { offset: isComplete ? 0 : newOffset }, updatedAt: new Date() },
    });

    if (isComplete) console.log('[Sync] Full Sync Cycle Completed and Reset.');
    return stats;
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
        const projectManager = remote.projectManager || 'Unassigned';

        if (!workguruId || !name || !remoteClientId) {
            console.log(`[Sync] Skipping project: missing critical fields. ID=${workguruId}, Name=${name}, ClientID=${remoteClientId}`);
            continue;
        }

        const localClientResults = await db.select().from(clients).where(eq(clients.workguruId, remoteClientId)).limit(1);
        const localClient = localClientResults[0];

        if (!localClient) {
            console.log(`[Sync] Skipping project ${workguruId}: Local client ${remoteClientId} not found.`);
            continue;
        }

        const budgetHours = remote.estimatedHours || remote.EstimatedHours || 0;
        const actualHours = remote.actualHours || remote.ActualHours || 0;
        const remainingHours = Math.max(0, budgetHours - actualHours);
        const progressPercent = budgetHours > 0 ? (actualHours / budgetHours) * 100 : 0;

        const remoteUpdatedAt = this.parseDate(remote.lastModificationTime || remote.LastModificationTime);

        const projectData = {
            workguruId,
            projectNumber,
            name,
            clientId: localClient.id,
            rawStatus: status,
            deliveryDate: dueDate,
            projectManager,
            remoteUpdatedAt,
            updatedAt: new Date(),
        };

        if (count === 0) {
            console.log(`[Sync] Sample mapped project:`, JSON.stringify(projectData, null, 2));
        }

        await db.insert(projects).values({
            ...projectData,
            budgetHours: 0,
            actualHours: 0,
            remainingHours: 0,
            progressPercent: 0,
            hasActualMismatch: 0,
        }).onConflictDoUpdate({
            target: projects.workguruId,
            set: projectData, // Preserving hours, only updating metadata
        });

        count++;
    }
    console.log(`[Sync] Inserted/Updated ${count} base projects.`);
  }

  private async runDeepSyncQueue(limit = 15, prioritizeRecent = true, offset = 0) {
    console.log(`[Sync] Starting Deep Sync Queue (Limit: ${limit}, RecentFirst: ${prioritizeRecent}, Offset: ${offset})...`);
    
    const conditions = notInArray(projects.rawStatus, ['Completed', 'Archived', 'Declined']);
    
    const projectsToDeepSync = await db.select().from(projects)
      .where(conditions)
      .orderBy(...(prioritizeRecent ? [desc(projects.remoteUpdatedAt)] : [asc(projects.lastDeepSyncAt)]))
      .limit(limit)
      .offset(offset);

    console.log(`[Sync] Selected ${projectsToDeepSync.length} projects for Deep Sync.`);
    
    let processedCount = 0;
    let mismatchCount = 0;

    for (const localProject of projectsToDeepSync) {
      const result = await this.withRetry(async () => {
        await this.sleep(300); // Base spacing
        
        // 1. Fetch Task Metadata (Budget source)
        const calculatedBudget = await this.syncTasks(localProject.workguruId) || 0;
        
        // 2. Aggregate Hours LOCALLY from time_entries table
        const hoursData = await this.aggregateProjectHoursLocally(localProject.id);
        
        const calculatedActual = hoursData.totalActual;
        const calculatedApproved = hoursData.totalApproved;
        const hasUnapprovedHours = hoursData.hasUnapproved ? 1 : 0;
        
        // Detect mismatch logic
        const hasActualMismatch = (calculatedActual === 0 && calculatedBudget > 0) ? 1 : 0;
        
        const remainingHours = calculatedBudget - calculatedActual;
        const progressPercent = calculatedBudget > 0 ? (calculatedActual / calculatedBudget) * 100 : 0;
        
        await db.update(projects)
          .set({
            budgetHours: calculatedBudget,
            actualHours: calculatedActual,
            approvedHours: calculatedApproved,
            hasUnapprovedHours,
            remainingHours,
            progressPercent,
            hasActualMismatch,
            lastDeepSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(projects.workguruId, localProject.workguruId));
          
        return { hasActualMismatch };
      }, `Deep Sync Project ${localProject.projectNumber}`);

      if (result) {
        processedCount++;
        if (result.hasActualMismatch) mismatchCount++;
      }
    }
    
    console.log(`[Sync] Deep Sync complete. Processed: ${processedCount}, Mismatches: ${mismatchCount}`);
    return { processedCount, mismatchCount };
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

  private async syncTasks(projectWorkGuruId: string): Promise<number> {
    const taskResponse = await this.client.getProjectTasks(projectWorkGuruId);
    if (!taskResponse || typeof taskResponse === 'string') return 0;
    
    const tasksData = this.extractItems(taskResponse, 'Task');
    
    const localProjectResults = await db.select().from(projects).where(eq(projects.workguruId, projectWorkGuruId)).limit(1);
    const localProject = localProjectResults[0];

    if (!localProject) return 0;

    let count = 0;
    let totalBudget = 0;
    for (const remote of tasksData) {
      const workguruId = (remote.id || remote.TaskID)?.toString();
      const name = remote.name || remote.TaskName;
      if (!workguruId || !name) continue;

      // In WorkGuru, quantity is typically the quoted/budgeted amount for the task line
      const taskBudget = Number(remote.quantity || remote.Quantity || 0);
      const actualHours = Number(remote.actualHours || remote.ActualHours || 0);
      
      totalBudget += taskBudget;

      const taskData = {
        workguruId,
        projectId: localProject.id,
        name,
        budgetHours: taskBudget,
        actualHours: actualHours,
        updatedAt: new Date(),
      };

      await db.insert(tasks).values(taskData).onConflictDoUpdate({
        target: tasks.workguruId,
        set: {
          projectId: sql`excluded.project_id`,
          name: sql`excluded.name`,
          budgetHours: sql`excluded.budget_hours`,
          actualHours: sql`excluded.actual_hours`,
          updatedAt: new Date(),
        },
      });
      count++;
    }
    return totalBudget;
  }

  private async syncGlobalTimeEntries() {
    console.log('[Sync] Performing Global Timesheet Sync...');
    // Fetch with wide range or standard recent window
    const entryResponse = await this.withRetry(() => this.client.getProjectTimeEntries(''), 'Global Fetch Timesheets');
    if (!entryResponse || typeof entryResponse === 'string') return;

    const timesheets = this.extractItems(entryResponse, 'TimeSheet');
    console.log(`[Sync] Processing ${timesheets.length} global timesheets...`);

    // Pre-fetch all projects and tasks for in-memory lookup
    const allProjects = await db.select().from(projects);
    const projectMap = new Map(allProjects.map(p => [p.workguruId, p.id]));

    const allTasks = await db.select().from(tasks);
    const taskMap = new Map(allTasks.map(t => [t.workguruId, t.id]));

    const entriesToUpsert = [];

    for (const remote of timesheets) {
        const workguruId = (remote.id || remote.TimeSheetID)?.toString();
        const remoteProjectId = (remote.projectId || remote.ProjectID)?.toString();
        const remoteTaskId = (remote.taskId || remote.TaskID)?.toString();

        if (!workguruId || !remoteProjectId) continue;

        // Resolve local project ID from Map
        const localProjectId = projectMap.get(remoteProjectId);
        if (!localProjectId) continue;

        const hours = Number(remote.length || remote.Hours || remote.hours || 0);
        const status = remote.status || remote.Status || 'Draft';

        const localTaskId = remoteTaskId ? (taskMap.get(remoteTaskId) || null) : null;

        entriesToUpsert.push({
            workguruId,
            projectId: localProjectId,
            taskId: localTaskId,
            hours: hours,
            status: status,
            date: this.parseDate(remote.date || remote.Date || remote.startTime) || new Date(),
            user: remote.user || remote.UserName || remote.StaffName || 'System',
            updatedAt: new Date(),
        });
    }

    if (entriesToUpsert.length > 0) {
        // Chunk into batches of 100 for stability
        const chunkSize = 100;
        for (let i = 0; i < entriesToUpsert.length; i += chunkSize) {
            const chunk = entriesToUpsert.slice(i, i + chunkSize);
            await db.insert(timeEntries).values(chunk).onConflictDoUpdate({
                target: timeEntries.workguruId,
                set: {
                    projectId: sql`excluded.project_id`,
                    taskId: sql`excluded.task_id`,
                    hours: sql`excluded.hours`,
                    status: sql`excluded.status`,
                    date: sql`excluded.date`,
                    user: sql`excluded.user`,
                    updatedAt: new Date(),
                },
            });
        }
        console.log(`[Sync] Batch upserted ${entriesToUpsert.length} time entries.`);
    }
  }

  private async aggregateProjectHoursLocally(localProjectId: number) {
    const entries = await db.select().from(timeEntries).where(eq(timeEntries.projectId, localProjectId));
    
    let totalActual = 0;
    let totalApproved = 0;
    let hasUnapproved = false;

    for (const entry of entries) {
        totalActual += entry.hours;
        if (entry.status === 'Approved') {
            totalApproved += entry.hours;
        } else {
            hasUnapproved = true;
        }
    }

    return { totalActual, totalApproved, hasUnapproved };
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
