import { NextRequest, NextResponse } from "next/server";
import { verifyProductionApiAuth } from "@/lib/production-api-auth";
import { db } from "@/db";
import { projects, clients } from "@/db/schema";
import { eq, and, gte, or, ilike, count, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = verifyProductionApiAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));
    const offset = (page - 1) * limit;

    const archivedParam = searchParams.get("archived") || "false";
    const statusParam = searchParams.get("status") || "";
    const searchParam = searchParams.get("search") || "";
    const updatedSinceParam = searchParams.get("updatedSince") || "";

    const conditions: any[] = [];

    if (archivedParam === "false") {
      conditions.push(eq(projects.isArchived, false));
    } else if (archivedParam === "true") {
      conditions.push(eq(projects.isArchived, true));
    }

    if (statusParam) {
      conditions.push(eq(projects.rawStatus, statusParam));
    }

    if (searchParam) {
      conditions.push(
        or(
          ilike(projects.projectNumber, `%${searchParam}%`),
          ilike(projects.name, `%${searchParam}%`)
        )
      );
    }

    if (updatedSinceParam) {
      const sinceDate = new Date(updatedSinceParam);
      if (!isNaN(sinceDate.getTime())) {
        conditions.push(gte(projects.updatedAt, sinceDate));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalCountRes, projectList] = await Promise.all([
      db.select({ count: count() }).from(projects).where(whereClause),
      db
        .select({
          id: projects.id,
          projectNumber: projects.projectNumber,
          name: projects.name,
          clientName: clients.name,
          projectManager: projects.projectManager,
          rawStatus: projects.rawStatus,
          priority: projects.priority,
          budgetHours: projects.budgetHours,
          actualHours: projects.actualHours,
          deliveryDate: projects.deliveryDate,
          startDate: projects.startDate,
          projectType: projects.projectType,
          bayLocation: projects.bayLocation,
          drawingApprovalDate: projects.drawingApprovalDate,
          expectedDrawingApprovalDate: projects.expectedDrawingApprovalDate,
          sheetmetalOrderedDate: projects.sheetmetalOrderedDate,
          sheetmetalDeliveredDate: projects.sheetmetalDeliveredDate,
          switchgearOrderedDate: projects.switchgearOrderedDate,
          switchgearDeliveredDate: projects.switchgearDeliveredDate,
          isArchived: projects.isArchived,
          updatedAt: projects.updatedAt,
          remoteUpdatedAt: projects.remoteUpdatedAt,
        })
        .from(projects)
        .leftJoin(clients, eq(projects.clientId, clients.id))
        .where(whereClause)
        .orderBy(desc(projects.updatedAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(totalCountRes[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    // Format fields with safe types and remaining hours calculation
    const formatted = projectList.map((p) => {
      const budget = Number(p.budgetHours) || 0;
      const actual = Number(p.actualHours) || 0;
      const remainingHours = Math.max(0, budget - actual);

      return {
        id: p.id,
        projectNumber: p.projectNumber,
        name: p.name,
        clientName: p.clientName || null,
        projectManager: p.projectManager || null,
        status: p.rawStatus || "Unknown",
        priority: p.priority || null,
        bayLocation: p.bayLocation || null,
        projectType: p.projectType || null,
        hours: {
          budget,
          actual,
          remaining: remainingHours,
        },
        dates: {
          deliveryDate: p.deliveryDate ? new Date(p.deliveryDate).toISOString().split("T")[0] : null,
          startDate: p.startDate ? new Date(p.startDate).toISOString().split("T")[0] : null,
          drawingApprovalDate: p.drawingApprovalDate ? new Date(p.drawingApprovalDate).toISOString() : null,
          expectedDrawingApprovalDate: p.expectedDrawingApprovalDate ? new Date(p.expectedDrawingApprovalDate).toISOString() : null,
          sheetmetalOrderedDate: p.sheetmetalOrderedDate ? new Date(p.sheetmetalOrderedDate).toISOString() : null,
          sheetmetalDeliveredDate: p.sheetmetalDeliveredDate ? new Date(p.sheetmetalDeliveredDate).toISOString() : null,
          switchgearOrderedDate: p.switchgearOrderedDate ? new Date(p.switchgearOrderedDate).toISOString() : null,
          switchgearDeliveredDate: p.switchgearDeliveredDate ? new Date(p.switchgearDeliveredDate).toISOString() : null,
        },
        isArchived: p.isArchived,
        updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : null,
        remoteUpdatedAt: p.remoteUpdatedAt ? new Date(p.remoteUpdatedAt).toISOString() : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    console.error("[Production API v1: Projects] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve projects." },
      { status: 500 }
    );
  }
}
