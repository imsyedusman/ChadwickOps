'use server';

import { db } from '@/db';
import { purchaseOrders, purchaseOrderLines, projects } from '@/db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import { determineLineAction } from '@/lib/procurement-logic';
import { differenceInDays, startOfDay } from 'date-fns';

export async function getWorkshopArrivals() {
    // Arrivals: open purchase orders where supplier is exactly "HI SWITCH" or "PM SWITCHBOARDS(NSW)P/L"
    const arrivalsData = await db.select({
        line: purchaseOrderLines,
        po: purchaseOrders,
        project: projects
    })
    .from(purchaseOrderLines)
    .innerJoin(purchaseOrders, eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id))
    .innerJoin(projects, eq(purchaseOrderLines.projectId, projects.id))
    .where(and(
        eq(projects.isArchived, false), // Drop inactive projects
        sql`${purchaseOrderLines.quantity} > ${purchaseOrderLines.receivedQuantity}`,
        or(
            eq(purchaseOrderLines.supplierName, 'HI SWITCH'),
            eq(purchaseOrderLines.supplierName, 'PM SWITCHBOARDS(NSW)P/L'),
            eq(purchaseOrders.supplierName, 'HI SWITCH'),
            eq(purchaseOrders.supplierName, 'PM SWITCHBOARDS(NSW)P/L')
        )
    ));
    
    const arrivals = arrivalsData.map(item => {
        const supplier = item.line.supplierName && item.line.supplierName !== 'Unknown' 
            ? item.line.supplierName 
            : (item.po.supplierName || 'Unknown');
        
        // Exact same risk status logic that already powers Procurement Hub
        const action = determineLineAction({
            workguruId: item.line.workguruId,
            poNumber: item.line.poNumber,
            supplierName: supplier,
            name: item.line.name || 'Unknown',
            quantity: item.line.quantity,
            receivedQuantity: item.line.receivedQuantity,
            unitPrice: item.line.unitPrice,
            expectedDate: item.po.expectedDate
        }, item.project.deliveryDate);
        
        return {
            projectName: item.project.name,
            projectNumber: item.project.projectNumber,
            expectedDate: item.po.expectedDate,
            riskStatus: action.label,
            actionRequired: action.actionRequired,
            severity: action.severity,
            color: action.color,
            supplierName: supplier,
        };
    });
    
    // Sort by expected date, soonest first
    arrivals.sort((a, b) => {
        const dateA = a.expectedDate ? new Date(a.expectedDate).getTime() : Infinity;
        const dateB = b.expectedDate ? new Date(b.expectedDate).getTime() : Infinity;
        return dateA - dateB;
    });
    
    return arrivals;
}

export async function getWorkshopInProgress() {
    const inProgressProjects = await db.select()
        .from(projects)
        .where(eq(projects.isArchived, false)); // Drop inactive projects
        
    // Fixed list covering every bay number from 1 to 24
    const bayGroups: Record<string, any[]> = {};
    for (let i = 1; i <= 24; i++) {
        bayGroups[i.toString()] = [];
    }

    for (const p of inProgressProjects) {
        if (!p.bayLocation) continue;
        
        const bay = p.bayLocation.trim();
        // Only include it if it's one of the 1-24 numbered bays.
        // If it's something else like "Dispatch", it won't map to 1-24.
        if (bayGroups[bay]) {
            bayGroups[bay].push({
                projectName: p.name,
                projectNumber: p.projectNumber,
                progressPercent: p.progressPercent // Uncapped, exactly as calculated
            });
        }
    }

    return bayGroups;
}

export async function getWorkshopDepartures() {
    const dispatchProjects = await db.select()
        .from(projects)
        .where(and(
            eq(projects.isArchived, false), // Drop inactive projects
            eq(projects.bayLocation, 'Dispatch')
        ));
        
    const today = startOfDay(new Date());
    const departures = [];
    
    for (const p of dispatchProjects) {
        const status = p.rawStatus;
        
        // 1. Drop completely finished jobs
        if (status === '3.2 - Delivered' || status === 'Completed' || status === 'Cancelled') {
            continue;
        }
        
        // 2. Blocked (Hasn't passed testing)
        if (status === '2.3 - Ready for Testing' || status === '2.4 - Tested Defective') {
            departures.push({
                projectName: p.name,
                projectNumber: p.projectNumber,
                deliveryDate: p.deliveryDate,
                classification: 'Blocked',
                statusReason: status
            });
            continue;
        }

        // 3. On Hold (Separate bucket, skips date check)
        if (status === 'On Hold') {
            departures.push({
                projectName: p.name,
                projectNumber: p.projectNumber,
                deliveryDate: p.deliveryDate,
                classification: 'On Hold',
                statusReason: status
            });
            continue;
        }
        
        // 4. Genuinely finished and waiting
        if (status === '2.6 - Ready for Invoicing' || status === '3.1 - Invoiced') {
            let dateStatus = "On track";
            if (p.deliveryDate) {
                const dDate = startOfDay(new Date(p.deliveryDate));
                if (dDate < today) {
                    dateStatus = "Overdue";
                } else {
                    const diff = differenceInDays(dDate, today);
                    if (diff >= 0 && diff <= 2) {
                        dateStatus = "Due soon";
                    }
                }
            }
            departures.push({
                projectName: p.name,
                projectNumber: p.projectNumber,
                deliveryDate: p.deliveryDate,
                classification: 'Ready',
                dateStatus: dateStatus,
                statusReason: status
            });
            continue;
        }
        
        // 5. Data Check Needed (Remaining statuses)
        departures.push({
            projectName: p.name,
            projectNumber: p.projectNumber,
            deliveryDate: p.deliveryDate,
            classification: 'Data Check Needed',
            statusReason: status
        });
    }
    
    return departures;
}
