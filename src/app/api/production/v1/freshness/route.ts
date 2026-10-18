import { NextRequest, NextResponse } from "next/server";
import { verifyProductionApiAuth } from "@/lib/production-api-auth";
import { db } from "@/db";
import { syncLogs, procurementSyncLogs, invoiceSyncLogs, projects, purchaseOrders, staffEfficiency } from "@/db/schema";
import { desc, eq, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = verifyProductionApiAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const [latestCoreSync, latestProcSync, latestInvSync] = await Promise.all([
      db.query.syncLogs.findFirst({ orderBy: [desc(syncLogs.timestamp)] }),
      db.query.procurementSyncLogs.findFirst({ orderBy: [desc(procurementSyncLogs.timestamp)] }),
      db.query.invoiceSyncLogs.findFirst({ orderBy: [desc(invoiceSyncLogs.timestamp)] }),
    ]);

    const [activeProjectsCount, openPOsCount, staffCount] = await Promise.all([
      db.select({ count: count() }).from(projects).where(eq(projects.isArchived, false)),
      db.select({ count: count() }).from(purchaseOrders),
      db.select({ count: count() }).from(staffEfficiency).where(eq(staffEfficiency.isActive, true)),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        serverTime: new Date().toISOString(),
        syncFreshness: {
          coreWorkGuruSync: {
            lastSyncAt: latestCoreSync?.timestamp ? new Date(latestCoreSync.timestamp).toISOString() : null,
            status: latestCoreSync?.status || "UNKNOWN",
            details: latestCoreSync?.details || null,
          },
          procurementSync: {
            lastSyncAt: latestProcSync?.timestamp ? new Date(latestProcSync.timestamp).toISOString() : null,
            status: latestProcSync?.status || "UNKNOWN",
            totalFetched: latestProcSync?.totalFetched || 0,
            totalHydrated: latestProcSync?.totalHydrated || 0,
            totalFailed: latestProcSync?.totalFailed || 0,
          },
          invoiceSync: {
            lastSyncAt: latestInvSync?.timestamp ? new Date(latestInvSync.timestamp).toISOString() : null,
            status: latestInvSync?.status || "UNKNOWN",
          },
        },
        counts: {
          activeProjects: Number(activeProjectsCount[0]?.count || 0),
          openPurchaseOrders: Number(openPOsCount[0]?.count || 0),
          activeStaff: Number(staffCount[0]?.count || 0),
        },
      },
    });
  } catch (error: any) {
    console.error("[Production API v1: Freshness] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve sync freshness." },
      { status: 500 }
    );
  }
}
