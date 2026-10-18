import { NextRequest, NextResponse } from "next/server";
import { verifyProductionApiAuth } from "@/lib/production-api-auth";
import { db } from "@/db";
import { tasks, projects } from "@/db/schema";
import { eq, and, count, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = verifyProductionApiAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const searchParams = req.nextUrl.searchParams;
    const projectIdParam = searchParams.get("projectId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "100", 10) || 100));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (projectIdParam) {
      const pId = parseInt(projectIdParam, 10);
      if (!isNaN(pId)) {
        conditions.push(eq(tasks.projectId, pId));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRes, taskList] = await Promise.all([
      db.select({ count: count() }).from(tasks).where(whereClause),
      db
        .select({
          id: tasks.id,
          workguruId: tasks.workguruId,
          projectId: tasks.projectId,
          projectNumber: projects.projectNumber,
          projectName: projects.name,
          name: tasks.name,
          budgetHours: tasks.budgetHours,
          actualHours: tasks.actualHours,
          updatedAt: tasks.updatedAt,
        })
        .from(tasks)
        .leftJoin(projects, eq(tasks.projectId, projects.id))
        .where(whereClause)
        .orderBy(desc(tasks.updatedAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(totalRes[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    const formatted = taskList.map((t) => {
      const budget = Number(t.budgetHours) || 0;
      const actual = Number(t.actualHours) || 0;
      return {
        id: t.id,
        workguruId: t.workguruId,
        projectId: t.projectId,
        projectNumber: t.projectNumber || null,
        projectName: t.projectName || null,
        taskName: t.name,
        hours: {
          budget,
          actual,
          remaining: Math.max(0, budget - actual),
        },
        updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : null,
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
    console.error("[Production API v1: Tasks] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve tasks." },
      { status: 500 }
    );
  }
}
