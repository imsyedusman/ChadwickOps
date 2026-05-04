'use server';

import { db } from '@/db';
import {
    projects,
    clients,
    projectFinancialSnapshots
} from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { ProjectFinancialService } from '@/lib/financials';

export async function getJobCostReport(monthStr: string) {
    // 1. Fetch all active projects
    const activeProjects = await db.select({
        id: projects.id,
        workguruId: projects.workguruId,
        projectNumber: projects.projectNumber,
        name: projects.name,
        projectManager: projects.projectManager,
        clientName: clients.name,
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projects.isArchived, false));

    // 2. Fetch snapshots for current month
    const snapshots = await db.select()
        .from(projectFinancialSnapshots)
        .where(eq(projectFinancialSnapshots.snapshotMonth, monthStr));

    const snapshotMap = new Map(snapshots.map(s => [s.projectId, s]));

    const projectsWithFinancials = activeProjects.map(p => {
        const snapshot = snapshotMap.get(p.id);
        
        return {
            ...p,
            financials: snapshot || {
                totalCostToDate: 0,
                totalInvoicedToDate: 0,
                unrecoveredAmount: 0,
                labourCostThisMonth: 0,
                materialCostThisMonth: 0,
                updatedAt: null
            }
        };
    });

    return projectsWithFinancials.sort((a, b) => {
        const valA = a.financials?.unrecoveredAmount || 0;
        const valB = b.financials?.unrecoveredAmount || 0;
        if (valB === valA) return a.name.localeCompare(b.name);
        return valB - valA;
    });
}

import { systemConfig } from '@/db/schema';
import { SyncService } from '@/lib/sync';
import { decrypt } from '@/lib/crypto';

export async function syncProjectFinancials(projectId: number) {
    try {
        // 1. Fetch credentials
        const config = await db.query.systemConfig.findFirst({
            where: eq(systemConfig.key, 'WORKGURU_API_CREDENTIALS'),
        });

        if (!config) throw new Error('WorkGuru API Credentials not configured');
        const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
        const decryptedKey = decrypt(apiKey);
        const decryptedSecret = decrypt(apiSecret);

        // 2. Find the project's workguruId
        const project = await db.query.projects.findFirst({
            where: eq(projects.id, projectId)
        });

        if (!project || !project.workguruId) {
            throw new Error('Project not found or missing WorkGuru ID');
        }

        // 3. Trigger Deep Sync (This will fetch from API)
        const syncService = new SyncService(decryptedKey, decryptedSecret);
        await syncService.syncProjectById(project.workguruId);

        // 4. Recalculate (Already called inside syncProjectById, but doing it again to be safe/explicit)
        await ProjectFinancialService.recalculateAll(projectId);

        return { success: true };
    } catch (error: any) {
        console.error(`[FinancialAction] Sync failed for project ${projectId}:`, error.message);
        return { success: false, error: error.message };
    }
}
