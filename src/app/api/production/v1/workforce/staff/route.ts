import { NextRequest, NextResponse } from "next/server";
import { verifyProductionApiAuth } from "@/lib/production-api-auth";
import { db } from "@/db";
import { staffEfficiency } from "@/db/schema";
import { asc, eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = verifyProductionApiAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const searchParams = req.nextUrl.searchParams;
    const workshopOnly = searchParams.get("workshopOnly") !== "false"; // default true
    const activeOnly = searchParams.get("activeOnly") !== "false"; // default true

    const conditions: any[] = [];
    if (activeOnly) {
      conditions.push(eq(staffEfficiency.isActive, true));
    }
    if (workshopOnly) {
      conditions.push(eq(staffEfficiency.isWorkshopStaff, true));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const staffList = await db
      .select({
        id: staffEfficiency.id,
        workguruId: staffEfficiency.workguruId,
        fullName: staffEfficiency.fullName,
        isApprentice: staffEfficiency.isApprentice,
        isWorkshopStaff: staffEfficiency.isWorkshopStaff,
        isActive: staffEfficiency.isActive,
        skills: {
          frameAssembly: staffEfficiency.frameAssembly,
          switchgearMount: staffEfficiency.switchgearMount,
          busbar: staffEfficiency.busbar,
          wiring: staffEfficiency.wiring,
          labels: staffEfficiency.labels,
          testing: staffEfficiency.testing,
          packagingFreight: staffEfficiency.packagingFreight,
        },
        createdAt: staffEfficiency.createdAt,
        updatedAt: staffEfficiency.updatedAt,
      })
      .from(staffEfficiency)
      .where(whereClause)
      .orderBy(asc(staffEfficiency.fullName));

    const formatted = staffList.map((s) => ({
      id: s.id,
      workguruId: s.workguruId,
      fullName: s.fullName,
      isApprentice: s.isApprentice,
      isWorkshopStaff: s.isWorkshopStaff,
      isActive: s.isActive,
      skillProficiencies: {
        frameAssembly: s.skills.frameAssembly ? Number(s.skills.frameAssembly) : null,
        switchgearMount: s.skills.switchgearMount ? Number(s.skills.switchgearMount) : null,
        busbar: s.skills.busbar ? Number(s.skills.busbar) : null,
        wiring: s.skills.wiring ? Number(s.skills.wiring) : null,
        labels: s.skills.labels ? Number(s.skills.labels) : null,
        testing: s.skills.testing ? Number(s.skills.testing) : null,
        packagingFreight: s.skills.packagingFreight ? Number(s.skills.packagingFreight) : null,
      },
      updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      total: formatted.length,
    });
  } catch (error: any) {
    console.error("[Production API v1: Staff] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve staff." },
      { status: 500 }
    );
  }
}
