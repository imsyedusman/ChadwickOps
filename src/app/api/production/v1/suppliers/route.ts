import { NextRequest, NextResponse } from "next/server";
import { verifyProductionApiAuth } from "@/lib/production-api-auth";
import { db } from "@/db";
import { masterSuppliers, purchaseOrders } from "@/db/schema";
import { asc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = verifyProductionApiAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const [configuredSuppliers, activePoSuppliers] = await Promise.all([
      db.select().from(masterSuppliers).orderBy(asc(masterSuppliers.name)),
      db
        .select({
          supplierName: purchaseOrders.supplierName,
          orderCount: sql<number>`count(*)::int`,
        })
        .from(purchaseOrders)
        .groupBy(purchaseOrders.supplierName)
        .orderBy(asc(purchaseOrders.supplierName)),
    ]);

    const supplierMap = new Map<string, any>();

    for (const s of configuredSuppliers) {
      supplierMap.set(s.name.trim().toLowerCase(), {
        id: s.id,
        name: s.name,
        isConfigured: true,
      });
    }

    for (const po of activePoSuppliers) {
      if (!po.supplierName) continue;
      const key = po.supplierName.trim().toLowerCase();
      if (!supplierMap.has(key)) {
        supplierMap.set(key, {
          id: null,
          name: po.supplierName,
          isConfigured: false,
          activeOrdersCount: po.orderCount,
        });
      } else {
        const existing = supplierMap.get(key);
        existing.activeOrdersCount = po.orderCount;
      }
    }

    const result = Array.from(supplierMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      data: result,
      total: result.length,
    });
  } catch (error: any) {
    console.error("[Production API v1: Suppliers] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve suppliers." },
      { status: 500 }
    );
  }
}
