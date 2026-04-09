import { db } from '@/db';
import { clients, projects, tasks, timeEntries, syncLogs, systemConfig } from '@/db/schema';
import { WorkGuruClient } from './workguru';
import { eq, sql, asc, desc, inArray, and, notInArray, lt, lte, or, count } from 'drizzle-orm';

export class SyncService {
  private client: WorkGuruClient;

  constructor(apiKey: string, apiSecret: string) {
    this.client = new WorkGuruClient(apiKey, apiSecret);
  }

  private async sleep(ms: number) {
    const jitter = Math.floor(Math.random() * 300);
    return new Promise(resolve => setTimeout(resolve, ms + jitter));
  }

  private async withRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 3): Promise<T | null> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status || error.status;
        const isRetryable = status === 429 || status === 503;
        
        if (isRetryable && attempt < maxRetries) {
          const delay = status === 429 ? Math.pow(2, attempt) * 1000 : 2000;
          console.warn(`[Sync] ${status === 429 ? 'Rate limit' : 'Service error (503)'} hit on ${label}. Attempt ${attempt}/${maxRetries}. Retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }
        
        if (attempt === maxRetries) {
          console.error(`[Sync] ${label} failed after ${maxRetries} attempts:`, error.message);
          return null;
        }
        
        // Permanent error or other failure
        console.error(`[Sync] ${label} encountered non-retryable error:`, error.message);
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
    const stats = {
      syncedCount: 0,
      restoredCount: 0,
      archivedCount: 0,
    };

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
        console.log(`[Sync] WorkGuru API returned ${remoteProjects.length} projects for ${mode} sync.`);
        await this.cleanDatabase();
        await this.syncProjects(remoteProjects, stats);
      }

      // Cleanup logic - ONLY on FULL sync success
      if (mode === 'FULL' && projectData) {
        stats.archivedCount = await this.archiveMissingProjects(startTime);
      }

      // 1. Global Time Entry Sync (Fetch all recent/open time once)
      await this.syncGlobalTimeEntries();

      // Progression Sync Logic
      let syncResults;
      if (mode === 'QUICK') {
        const deepSyncStats = await this.runDeepSyncQueue(15);
        syncResults = { ...stats, ...deepSyncStats, totalToProcess: 15 };
      } else {
        syncResults = await this.runFullDeepSyncCycle(stats);
      }

      const status = syncResults.failedCount > 0 ? 'PARTIAL' : 'SUCCESS';
      
      const summary = {
        mode,
        total: syncResults.totalToProcess,
        success: syncResults.processedCount,
        failed: syncResults.failedCount,
        archived: syncResults.archivedCount,
        restored: syncResults.restoredCount,
        timestamp: startTime.toISOString()
      };

      await db.insert(syncLogs).values({
        status,
        details: JSON.stringify(summary),
      });

      // Update baseline for next cycle ONLY if sync didn't fully fail
      if (mode === 'FULL' && syncResults.processedCount > 0) {
        await db.insert(systemConfig).values({
          key: 'PREVIOUS_FULL_SYNC_START',
          value: { timestamp: startTime.toISOString() },
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: systemConfig.key,
          set: { value: { timestamp: startTime.toISOString() }, updatedAt: new Date() },
        });
      }

      // Clear progress on completion
      await db.delete(systemConfig).where(eq(systemConfig.key, 'SYNC_PROGRESS'));

      console.log('Sync result:', status, summary);
      return { success: true, mode, stats: syncResults };
    } catch (error) {
      console.error('Sync failed:', error);
      await db.delete(systemConfig).where(eq(systemConfig.key, 'SYNC_PROGRESS'));
      await db.insert(syncLogs).values({
        status: 'FAILURE',
        details: JSON.stringify({ error: error instanceof Error ? error.message : String(error), timestamp: startTime.toISOString() }),
      });
      throw error;
    }
  }

  private async runFullDeepSyncCycle(initialStats: any) {
    const BATCH_SIZE = 25;
    let totalProcessed = 0;
    let totalFailed = 0;
    let totalMismatched = 0;
    
    const activeProjectsCount = await db.select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(notInArray(projects.rawStatus, ['Completed', 'Archived', 'Declined']));
    
    const totalCount = activeProjectsCount[0].count;
    let offset = 0;

    console.log(`[Sync] Starting continuous Full Deep Sync for ${totalCount} projects`);

    while (totalProcessed + totalFailed < totalCount) {
      // Update progress
      await db.insert(systemConfig).values({
        key: 'SYNC_PROGRESS',
        value: { processed: totalProcessed + totalFailed, total: totalCount, mode: 'FULL' },
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: systemConfig.key,
        set: { value: { processed: totalProcessed + totalFailed, total: totalCount, mode: 'FULL' }, updatedAt: new Date() },
      });

      const stats = await this.runDeepSyncQueue(BATCH_SIZE);
      
      totalProcessed += stats.processedCount;
      totalFailed += stats.failedCount;
      totalMismatched += stats.mismatchCount;
      
      const attempted = totalProcessed + totalFailed;
      console.log(`[Sync] Progress: ${attempted}/${totalCount} projects attempted.`);
      
      if (attempted < totalCount) {
          await new Promise(r => setTimeout(r, 500));
      }

      // Safety break to prevent infinite loops if something goes wrong
      if (stats.processedCount === 0 && stats.failedCount === 0) {
          console.warn('[Sync] Queue returned no results but goal not reached. Terminating cycle.');
          break;
      }
    }

    console.log(`[Sync] Full Deep Sync complete. Success: ${totalProcessed}, Failed: ${totalFailed}`);
    
    return { 
      ...initialStats,
      processedCount: totalProcessed, 
      failedCount: totalFailed,
      mismatchCount: totalMismatched,
      totalToProcess: totalCount
    };
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

  private async syncProjects(remoteProjects: any[], stats?: { syncedCount: number, restoredCount: number }) {
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
        let projectManager = 'Unassigned';
        if (remote.projectManager) {
            if (typeof remote.projectManager === 'object') {
                projectManager = remote.projectManager.name || remote.projectManager.Name || 'Unassigned';
            } else {
                projectManager = String(remote.projectManager);
            }
        }

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

        // Check for unarchive logic
        if (stats) {
          const existing = await db.query.projects.findFirst({
            where: eq(projects.workguruId, workguruId),
            columns: { isArchived: true }
          });
          if (existing?.isArchived) {
            console.log(`[Sync] Project ${workguruId} (${projectNumber}) found in WorkGuru - Unarchiving.`);
            stats.restoredCount++;
          }
          stats.syncedCount++;
        }

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
            lastSeenAt: new Date(),
            isArchived: false,
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

  private async archiveMissingProjects(syncStartTime: Date): Promise<number> {
    console.log('[Sync] Checking for projects to archive...');
    
    // 1. Fetch config and check for first-run protection
    const config = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'PREVIOUS_FULL_SYNC_START'),
    });
    
    if (!config) {
      console.log('[Sync] First-time FULL sync detected. Establishing baseline only (No archiving).');
      return 0;
    }

    const prevSyncStart = new Date((config.value as any).timestamp);
    
    // Check for global override flag
    const overrideConfig = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'ALLOW_AUTO_ARCHIVE'),
    });
    const allowAutoArchive = overrideConfig?.value === true;

    // 2. Identify projects to archive
    // Rule: Missing in current sync AND last seen before the PREVIOUS successful full sync start
    // UNLESS override flag is on
    const missingCondition = allowAutoArchive 
      ? lt(projects.lastSeenAt, syncStartTime)
      : lt(projects.lastSeenAt, prevSyncStart);

    const projectsToArchive = await db.select({ id: projects.id, projectNumber: projects.projectNumber })
      .from(projects)
      .where(and(
        eq(projects.isArchived, false),
        missingCondition
      ));

    if (projectsToArchive.length === 0) {
      console.log('[Sync] No projects found to archive.');
      return 0;
    }

    console.log(`[Sync] Archiving ${projectsToArchive.length} projects missing from WorkGuru ${allowAutoArchive ? '(Immediate)' : '(2rd cycle) '}.`);
    
    const idsToArchive = projectsToArchive.map(p => p.id);
    await db.update(projects)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(inArray(projects.id, idsToArchive));

    return projectsToArchive.length;
  }

  private async runDeepSyncQueue(limit = 15) {
    console.log(`[Sync] Starting Deep Sync Queue (Limit: ${limit}).`);
    
    const conditions = notInArray(projects.rawStatus, ['Completed', 'Archived', 'Declined']);
    
    const projectsToDeepSync = await db.select().from(projects)
      .where(conditions)
      .orderBy(asc(projects.lastDeepSyncAt))
      .limit(limit);

    console.log(`[Sync] Selected ${projectsToDeepSync.length} projects for Deep Sync.`);
    
    let processedCount = 0;
    let failedCount = 0;
    let mismatchCount = 0;

    for (const localProject of projectsToDeepSync) {
      const result = await this.withRetry(async () => {
        // Enforce safe pace: 1300ms total delay
        await this.sleep(1000); 
        
        // 1. Fetch Task Metadata (Budget source)
        const calculatedBudget = await this.syncTasks(localProject.workguruId) || 0;
        
        // 2. Aggregate Hours LOCALLY from time_entries table
        const hoursData = await this.aggregateProjectHoursLocally(localProject.id);
        
        const calculatedActual = hoursData.totalActual;
        const calculatedApproved = hoursData.totalApproved;
        const hasUnapprovedHours = hoursData.hasUnapproved ? 1 : 0;
        
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
      } else {
        console.warn(`[Sync] Skipping project ${localProject.projectNumber} due to persistent errors.`);
        // Mark as "attempted" so it moves to back of queue
        await db.update(projects)
          .set({ 
            lastDeepSyncAt: new Date(),
            updatedAt: new Date() 
          })
          .where(eq(projects.workguruId, localProject.workguruId));
        failedCount++;
      }
    }
    
    return { processedCount, failedCount, mismatchCount };
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
