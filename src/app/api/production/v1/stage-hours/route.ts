import { NextRequest, NextResponse } from "next/server";
import { verifyProductionApiAuth } from "@/lib/production-api-auth";
import { db } from "@/db";
import { projectStageHours, projects } from "@/db/schema";
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
        conditions.push(eq(projectStageHours.projectId, pId));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRes, items] = await Promise.all([
      db.select({ count: count() }).from(projectStageHours).where(whereClause),
      db
        .select({
          id: projectStageHours.id,
          projectId: projectStageHours.projectId,
          projectNumber: projects.projectNumber,
          projectName: projects.name,
          frameAssemblyIfc: projectStageHours.frameAssemblyIfc,
          frameAssemblyIfm: projectStageHours.frameAssemblyIfm,
          switchgearMount: projectStageHours.switchgearMount,
          busbarIfc: projectStageHours.busbarIfc,
          busbarIfm: projectStageHours.busbarIfm,
          wiring: projectStageHours.wiring,
          labels: projectStageHours.labels,
          testing: projectStageHours.testing,
          packagingFreight: projectStageHours.packagingFreight,
          updatedAt: projectStageHours.updatedAt,
        })
        .from(projectStageHours)
        .leftJoin(projects, eq(projectStageHours.projectId, projects.id))
        .where(whereClause)
        .orderBy(desc(projectStageHours.updatedAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(totalRes[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    const formatted = items.map((item) => {
      const stages = {
        frameAssemblyIfc: Number(item.frameAssemblyIfc) || 0,
        frameAssemblyIfm: Number(item.frameAssemblyIfm) || 0,
        switchgearMount: Number(item.switchgearMount) || 0,
        busbarIfc: Number(item.busbarIfc) || 0,
        busbarIfm: Number(item.busbarIfm) || 0,
        wiring: Number(item.wiring) || 0,
        labels: Number(item.labels) || 0,
        testing: Number(item.testing) || 0,
        packagingFreight: Number(item.packagingFreight) || 0,
      };

      const totalStageHours = Object.values(stages).reduce((sum, h) => sum + h, 0);

      return {
        id: item.id,
        projectId: item.projectId,
        projectNumber: item.projectNumber || null,
        projectName: item.projectName || null,
        stages,
        totalStageHours,
        updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : null,
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
    console.error("[Production API v1: Stage Hours] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve stage hours." },
      { status: 500 }
    );
  }
}
