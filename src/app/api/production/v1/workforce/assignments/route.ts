import { NextRequest, NextResponse } from "next/server";
import { verifyProductionApiAuth } from "@/lib/production-api-auth";
import { db } from "@/db";
import { workerAssignments, projects, staffEfficiency } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = verifyProductionApiAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const searchParams = req.nextUrl.searchParams;
    const projectIdParam = searchParams.get("projectId");
    const staffIdParam = searchParams.get("staffId");
    const statusParam = searchParams.get("status") || "active"; // default to active

    const conditions: any[] = [];

    if (statusParam !== "all") {
      conditions.push(eq(workerAssignments.status, statusParam));
    }

    if (projectIdParam) {
      const pId = parseInt(projectIdParam, 10);
      if (!isNaN(pId)) {
        conditions.push(eq(workerAssignments.projectId, pId));
      }
    }

    if (staffIdParam) {
      const sId = parseInt(staffIdParam, 10);
      if (!isNaN(sId)) {
        conditions.push(eq(workerAssignments.staffId, sId));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select({
        id: workerAssignments.id,
        projectId: workerAssignments.projectId,
        projectNumber: projects.projectNumber,
        projectName: projects.name,
        staffId: workerAssignments.staffId,
        staffName: staffEfficiency.fullName,
        stage: workerAssignments.stage,
        assignedHours: workerAssignments.assignedHours,
        projectedStart: workerAssignments.projectedStart,
        projectedEnd: workerAssignments.projectedEnd,
        status: workerAssignments.status,
        completedAt: workerAssignments.completedAt,
        createdAt: workerAssignments.createdAt,
        updatedAt: workerAssignments.updatedAt,
      })
      .from(workerAssignments)
      .leftJoin(projects, eq(workerAssignments.projectId, projects.id))
      .leftJoin(staffEfficiency, eq(workerAssignments.staffId, staffEfficiency.id))
      .where(whereClause)
      .orderBy(desc(workerAssignments.updatedAt));

    const formatted = items.map((a) => ({
      id: a.id,
      projectId: a.projectId,
      projectNumber: a.projectNumber || null,
      projectName: a.projectName || null,
      staffId: a.staffId,
      staffName: a.staffName || `Staff #${a.staffId}`,
      stage: a.stage,
      assignedHours: Number(a.assignedHours) || 0,
      dates: {
        projectedStart: a.projectedStart ? new Date(a.projectedStart).toISOString().split("T")[0] : null,
        projectedEnd: a.projectedEnd ? new Date(a.projectedEnd).toISOString().split("T")[0] : null,
      },
      status: a.status || "active",
      completedAt: a.completedAt ? new Date(a.completedAt).toISOString() : null,
      updatedAt: a.updatedAt ? new Date(a.updatedAt).toISOString() : null,
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      total: formatted.length,
    });
  } catch (error: any) {
    console.error("[Production API v1: Worker Assignments] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve worker assignments." },
      { status: 500 }
    );
  }
}
