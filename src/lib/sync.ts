import { db } from '@/db';
import { clients, projects, tasks, timeEntries, syncLogs, systemConfig } from '@/db/schema';
import { WorkGuruClient } from './workguru';
import { eq, sql, asc, inArray, and, notInArray, lt } from 'drizzle-orm';

// Deterministic Custom Field IDs from WorkGuru
const CF_IDS = {
    BAY_LOCATION: 8925,
    PROJECT_TYPE: 8926,
    DRAWING_APPROVAL_DATE: 9450,
    DRAWING_SUBMITTED_DATE: 9451,
    SHEETMETAL_ORDERED_DATE: 9487,
    SHEETMETAL_DELIVERED_DATE: 9488,
    SWITCHGEAR_ORDERED_DATE: 9489,
    SWITCHGEAR_DELIVERED_DATE: 9490,
} as const;

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
    // If it's a sync process, we want a much higher retry limit for rate limits
    const actualMax = Math.max(maxRetries, 50);

    for (let attempt = 1; attempt <= actualMax; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        const err = error as { response?: { status?: number }; status?: number };
        const status = err.response?.status || err.status;
        const isRateLimit = status === 429;
        const isRetryable = isRateLimit || status === 503;
        
        if (isRetryable && attempt < actualMax) {
          // Rule: For 429, wait 30-60s. For others, use exponential backoff.
          let delay: number;
          if (isRateLimit) {
            // Start at 30s, increase slightly up to 60s
            delay = Math.min(30000 + (attempt * 2000), 60000);
            console.warn(`[Sync] Rate limit (429) hit on ${label}. Attempt ${attempt}/${actualMax}. Waiting ${delay/1000}s before retrying SAME project...`);
          } else {
            delay = Math.pow(2, attempt) * 1000;
            console.warn(`[Sync] Service error (${status}) hit on ${label}. Attempt ${attempt}/${actualMax}. Retrying in ${delay/1000}s...`);
          }
          
          await this.sleep(delay);
          continue;
        }
        
        if (attempt === actualMax) {
          console.error(`[Sync] ${label} exhausted all ${actualMax} retries. Final error:`, error instanceof Error ? error.message : String(error));
          return null;
        }
        
        // Permanent error (401, 404, etc.)
        console.error(`[Sync] ${label} encountered non-retryable error (${status}):`, error instanceof Error ? error.message : String(error));
        return null;
      }
    }
    return null;
  }

  public extractItems<T>(data: any, entityName: string): T[] {
    const result = data?.result;
    let items: T[] | undefined;

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
        const remoteClients = this.extractItems<import('./workguru').WorkGuruClient>(clientData, 'Client');
        await this.syncClients(remoteClients);
      }

      const projectFetchMethod = () => this.client.getAllProjects();
      const projectData = await this.withRetry(projectFetchMethod, `Fetch All Projects`);
      if (projectData) {
        const remoteProjects = this.extractItems<import('./workguru').WorkGuruProject>(projectData, 'Project');
        console.log(`[Sync] WorkGuru API returned ${remoteProjects.length} projects.`);
        await this.cleanDatabase();
        await this.syncProjects(remoteProjects, stats);
      }

      // Cleanup logic - ALWAYS on success
      if (projectData) {
        stats.archivedCount = await this.archiveMissingProjects(startTime);
      }

      // 1. Global Time Entry Sync (Fetch all recent/open time once)
      await this.syncGlobalTimeEntries();

      const syncResults = await this.runFullDeepSyncCycle(stats);

      const status = syncResults.failedCount > 0 ? 'SUCCESS_WITH_ERRORS' : 'SUCCESS';
      
      const summary = {
        mode,
        total: syncResults.totalToProcess || 0,
        success: syncResults.processedCount || 0,
        failed: syncResults.failedCount || 0,
        archived: syncResults.archivedCount || 0,
        restored: syncResults.restoredCount || 0,
        synced: syncResults.syncedCount || 0,
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

  private async runFullDeepSyncCycle(initialStats: { syncedCount: number; restoredCount: number; archivedCount: number }) {
    const BATCH_SIZE = 25;
    let totalProcessed = 0;
    let totalFailed = 0;
    let totalMismatched = 0;
    
    const projectsCount = await db.select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.isArchived, false));
    
    const totalCount = projectsCount[0].count;

    console.log(`[Sync] Starting continuous Full Deep Sync for ${totalCount} active projects`);

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

  private async syncClients(remoteClients: import('./workguru').WorkGuruClient[]) {
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

  private async syncProjects(remoteProjects: import('./workguru').WorkGuruProject[], stats?: { syncedCount: number, restoredCount: number }) {
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
        const total = Number(remote.total || remote.Total || 0);
        
        // DIAGNOSTIC LOG: Log the first project to see raw structure (including custom fields)
        if (count === 0) {
          console.log('[Sync-Diag] Raw Project Sample:', JSON.stringify(remote, null, 2));
        }

        // New Field Mapping: Project Description -> Item Name
        const description = remote.description || remote.Description || null;

        // Custom Fields Mapping - Just used for side effect or testing here?
        this.getCustomFieldValue(remote, 'DrawingSubmittedDate');

        let projectManager = 'Unassigned';
        if (remote.projectManager) {
            if (typeof remote.projectManager === 'object' && remote.projectManager !== null) {
                projectManager = (remote.projectManager as any).name || (remote.projectManager as any).Name || 'Unassigned';
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
            // Clear archivedAt when restored
            await db.update(projects)
              .set({ isArchived: false, archivedAt: null, updatedAt: new Date() })
              .where(eq(projects.workguruId, workguruId));
          }
          stats.syncedCount++;
        }

        const projectData = {
            workguruId,
            projectNumber,
            name,
            clientId: localClient.id,
            rawStatus: status,
            description,
            drawingApprovalDate: null, // Populated during Deep Sync
            drawingSubmittedDate: null, // Populated during Deep Sync
            bayLocation: null, // Populated during Deep Sync
            sheetmetalOrderedDate: null, // Populated during Deep Sync
            sheetmetalDeliveredDate: null, // Populated during Deep Sync
            switchgearOrderedDate: null, // Populated during Deep Sync
            switchgearDeliveredDate: null, // Populated during Deep Sync
            deliveryDate: dueDate,
            projectManager,
            total,
            remoteUpdatedAt,
            updatedAt: new Date(),
            lastSeenAt: new Date(),
            isArchived: false,
            archivedAt: null, // Ensure archivedAt is null for active projects
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
            hasUnapprovedHours: 0,
            hasActualMismatch: 0,
        }).onConflictDoUpdate({
            target: projects.workguruId,
            set: {
                ...projectData,
                total: sql`CASE 
                    WHEN EXCLUDED.total = 0 THEN projects.total 
                    ELSE EXCLUDED.total 
                END`
            },
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

    const prevSyncStart = new Date((config.value as { timestamp: string }).timestamp);
    
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
      .set({ isArchived: true, archivedAt: new Date(), updatedAt: new Date() })
      .where(inArray(projects.id, idsToArchive));

    return projectsToArchive.length;
  }

  public async runDeepSyncQueue(limit = 15) {
    console.log(`[Sync] Starting Deep Sync Queue (Limit: ${limit}).`);
    
    const projectsToDeepSync = await db.select().from(projects)
      .where(eq(projects.isArchived, false))
      .orderBy(asc(projects.lastDeepSyncAt))
      .limit(limit);

    console.log(`[Sync] Selected ${projectsToDeepSync.length} active projects for Deep Sync.`);
    
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
        
        // 3. Fetch Full Project Details for Custom Fields (Enrichment)
        console.log(`[Sync] Fetching deep details for project ${localProject.projectNumber}...`);
        const detailResponse = await this.client.getProjectDetails(localProject.workguruId);
        const remoteDetails = (detailResponse?.result || detailResponse) as import('./workguru').WorkGuruProject;
        const bayLocation = this.getCustomFieldValue(remoteDetails, 'BayLocation');
        const drawingApprovalDate = this.parseDate(this.getCustomFieldValue(remoteDetails, 'ClientDrawingApprovalDate'));
        const drawingSubmittedDate = this.parseDate(this.getCustomFieldValue(remoteDetails, 'DrawingSubmittedDate'));
        const sheetmetalOrderedDate = this.parseDate(this.getCustomFieldValue(remoteDetails, 'SheetmetalOrderedDate'));
        const sheetmetalDeliveredDate = this.parseDate(this.getCustomFieldValue(remoteDetails, 'SheetmetalDeliveredDate'));
        const switchgearOrderedDate = this.parseDate(this.getCustomFieldValue(remoteDetails, 'SwitchgearOrderedDate'));
        const switchgearDeliveredDate = this.parseDate(this.getCustomFieldValue(remoteDetails, 'SwitchgearDeliveredDate'));
        let total = Number(remoteDetails.total || remoteDetails.Total || 0);
        
        // Fallback to product line items if top-level total is $0
        if (total === 0) {
            const lineItems = remoteDetails.productLineItems || remoteDetails.ProductLineItems || [];
            if (lineItems.length > 0) {
                total = (lineItems as import('./workguru').WorkGuruLineItem[]).reduce((acc: number, li) => {
                    const price = Number(li.unitAmount || li.unitPrice || li.UnitPrice || 0);
                    const qty = Number(li.quantity || li.Quantity || 0);
                    const lineTotal = Number(li.lineTotal || li.total || li.Total || (price * qty));
                    return acc + lineTotal;
                }, 0);
                
                if (total > 0) {
                    console.log(`[Sync] Project ${localProject.projectNumber} value derived from ${lineItems.length} line items: $${total}`);
                }
            }
        }

        // Final fallback to existing local total if both API sources are 0
        // (Prevents accidental reset of non-zero values due to transient API gaps)
        if (total === 0 && localProject.total > 0) {
            total = Number(localProject.total);
        }

        if (bayLocation) {
            console.log(`[Sync] Found Bay Location for ${localProject.projectNumber}: ${bayLocation}`);
        }

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
            bayLocation, 
            drawingApprovalDate,
            drawingSubmittedDate,
            sheetmetalOrderedDate,
            sheetmetalDeliveredDate,
            switchgearOrderedDate,
            switchgearDeliveredDate,
            total,
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
        console.error(`[Sync] HARD FAILURE: Project ${localProject.projectNumber} (${localProject.workguruId}) failed deep sync after all retries. Continuing...`);
        // Rule: DO NOT update lastDeepSyncAt on failure so it remains pending for next run.
        failedCount++;
      }
    }
    
    return { processedCount, failedCount, mismatchCount };
  }

  private getCustomFieldValueById(remote: import('./workguru').WorkGuruProject, id: number): string | null {
    if (!remote) return null;
    
    // Check customFieldValues array (the most reliable source)
    const values = remote.customFieldValues || remote.CustomFieldValues || [];
    if (Array.isArray(values)) {
        const found = values.find((v: any) => v.customFieldId === id || v.CustomFieldID === id) as any;
        if (found) return found.value || found.Value || null;
    }
    
    return null;
  }

  private getCustomFieldValue(remote: import('./workguru').WorkGuruProject, key: string): string | null {
    if (!remote) return null;
    
    // Map key to confirmed deterministic IDs for target fields
    const lowerKey = key.toLowerCase();
    
    if (lowerKey === 'baylocation' || lowerKey === 'bay location') 
        return this.getCustomFieldValueById(remote, CF_IDS.BAY_LOCATION);
        
    if (lowerKey === 'clientdrawingapprovaldate' || lowerKey === 'drawing approval date')
        return this.getCustomFieldValueById(remote, CF_IDS.DRAWING_APPROVAL_DATE);
        
    if (lowerKey === 'drawingsubmitteddate' || lowerKey === 'drawing submitted date')
        return this.getCustomFieldValueById(remote, CF_IDS.DRAWING_SUBMITTED_DATE);
        
    if (lowerKey === 'sheetmetalordereddate' || lowerKey === 'sheetmetal ordered date')
        return this.getCustomFieldValueById(remote, CF_IDS.SHEETMETAL_ORDERED_DATE);
        
    if (lowerKey === 'sheetmetaldelivereddate' || lowerKey === 'sheetmetal delivered date')
        return this.getCustomFieldValueById(remote, CF_IDS.SHEETMETAL_DELIVERED_DATE);
        
    if (lowerKey === 'switchgearordereddate' || lowerKey === 'switchgear ordered date')
        return this.getCustomFieldValueById(remote, CF_IDS.SWITCHGEAR_ORDERED_DATE);
        
    if (lowerKey === 'switchgeardelivereddate' || lowerKey === 'switchgear delivered date')
        return this.getCustomFieldValueById(remote, CF_IDS.SWITCHGEAR_DELIVERED_DATE);

    // 1. Check flat properties (various casings) for other fields
    if ((remote as any)[key] !== undefined) return (remote as any)[key];
    for (const k of Object.keys(remote)) {
        if (k.toLowerCase() === lowerKey) return (remote as any)[k];
    }
    
    // 2. Fallback to old name-based search for non-deterministic fields
    const fieldsArray = Array.isArray(remote.customFields) ? remote.customFields : 
                        Array.isArray(remote.customFieldValues) ? remote.customFieldValues : null;

    if (fieldsArray) {
      const field = (fieldsArray as any[]).find((f: any) => {
        const fieldKey = (f.key || f.Key || f.name || f.Name || f.customField?.name || f.customField?.Name || '').toLowerCase();
        return fieldKey === lowerKey;
      });
      return field?.value || field?.Value || null;
    }

    return null;
  }

  private parseDate(dateStr: unknown): Date | null {
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
    
    const tasksData = this.extractItems<import('./workguru').WorkGuruTask>(taskResponse, 'Task');
    
    const localProjectResults = await db.select().from(projects).where(eq(projects.workguruId, projectWorkGuruId)).limit(1);
    const localProject = localProjectResults[0];

    if (!localProject) return 0;

    let totalBudget = 0;
    for (const remote of tasksData) {
      const r = remote as Record<string, unknown>;
      const workguruId = (r.id || r.TaskID)?.toString();
      const name = r.name || r.TaskName;
      if (!workguruId || !name) continue;

      const taskBudget = Number(r.quantity || r.Quantity || 0);
      const actualHours = Number(r.actualHours || r.ActualHours || 0);
      
      totalBudget += taskBudget;

      const taskData = {
        workguruId,
        projectId: localProject.id,
        name: String(name),
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
    }
    return totalBudget;
  }

  private async syncGlobalTimeEntries() {
    console.log('[Sync] Performing Global Timesheet Sync...');
    // Fetch with wide range or standard recent window
    const entryResponse = await this.withRetry(() => this.client.getProjectTimeEntries(''), 'Global Fetch Timesheets');
    if (!entryResponse || typeof entryResponse === 'string') return;

    const timesheets = this.extractItems<import('./workguru').WorkGuruTimeSheet>(entryResponse, 'TimeSheet');
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
