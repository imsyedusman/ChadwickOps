import { NextRequest, NextResponse } from "next/server";
import { verifyProductionApiAuth } from "@/lib/production-api-auth";
import { db } from "@/db";
import { staffAbsences, staffEfficiency } from "@/db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = verifyProductionApiAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const searchParams = req.nextUrl.searchParams;
    const staffIdParam = searchParams.get("staffId");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const conditions: any[] = [];

    if (staffIdParam) {
      const sId = parseInt(staffIdParam, 10);
      if (!isNaN(sId)) {
        conditions.push(eq(staffAbsences.staffId, sId));
      }
    }

    if (startDateParam) {
      conditions.push(gte(staffAbsences.endDate, startDateParam));
    }

    if (endDateParam) {
      conditions.push(lte(staffAbsences.startDate, endDateParam));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select({
        id: staffAbsences.id,
        staffId: staffAbsences.staffId,
        staffName: staffEfficiency.fullName,
        startDate: staffAbsences.startDate,
        endDate: staffAbsences.endDate,
        reason: staffAbsences.reason,
        createdAt: staffAbsences.createdAt,
      })
      .from(staffAbsences)
      .leftJoin(staffEfficiency, eq(staffAbsences.staffId, staffEfficiency.id))
      .where(whereClause)
      .orderBy(desc(staffAbsences.startDate));

    const formatted = items.map((a) => ({
      id: a.id,
      staffId: a.staffId,
      staffName: a.staffName || `Staff #${a.staffId}`,
      startDate: a.startDate,
      endDate: a.endDate,
      reason: a.reason || null,
      createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : null,
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      total: formatted.length,
    });
  } catch (error: any) {
    console.error("[Production API v1: Absences] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve absences." },
      { status: 500 }
    );
  }
}
