import { NextRequest, NextResponse } from "next/server";
import { verifyProductionApiAuth } from "@/lib/production-api-auth";
import { db } from "@/db";
import { purchaseOrders, purchaseOrderLines, projects } from "@/db/schema";
import { eq, and, inArray, count, desc, ilike } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = verifyProductionApiAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));
    const offset = (page - 1) * limit;

    const projectIdParam = searchParams.get("projectId");
    const supplierParam = searchParams.get("supplier");
    const statusParam = searchParams.get("status");
    const poNumberParam = searchParams.get("poNumber");

    const conditions: any[] = [];

    if (projectIdParam) {
      const pId = parseInt(projectIdParam, 10);
      if (!isNaN(pId)) {
        conditions.push(eq(purchaseOrders.projectId, pId));
      }
    }

    if (supplierParam) {
      conditions.push(ilike(purchaseOrders.supplierName, `%${supplierParam}%`));
    }

    if (statusParam) {
      conditions.push(eq(purchaseOrders.status, statusParam));
    }

    if (poNumberParam) {
      conditions.push(ilike(purchaseOrders.poNumber, `%${poNumberParam}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 1. Fetch paginated PO headers
    const [totalRes, orderHeaders] = await Promise.all([
      db.select({ count: count() }).from(purchaseOrders).where(whereClause),
      db
        .select({
          id: purchaseOrders.id,
          workguruId: purchaseOrders.workguruId,
          projectId: purchaseOrders.projectId,
          projectNumber: projects.projectNumber,
          projectName: projects.name,
          poNumber: purchaseOrders.poNumber,
          supplierName: purchaseOrders.supplierName,
          issueDate: purchaseOrders.issueDate,
          expectedDate: purchaseOrders.expectedDate,
          receivedDate: purchaseOrders.receivedDate,
          status: purchaseOrders.status,
          hydrationStatus: purchaseOrders.hydrationStatus,
        })
        .from(purchaseOrders)
        .leftJoin(projects, eq(purchaseOrders.projectId, projects.id))
        .where(whereClause)
        .orderBy(desc(purchaseOrders.issueDate))
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(totalRes[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    // 2. Fetch all linked lines in a single query (batch to eliminate N+1)
    const poIds = orderHeaders.map((po) => po.id);
    const linesByPoId = new Map<number, any[]>();

    if (poIds.length > 0) {
      const lines = await db
        .select({
          id: purchaseOrderLines.id,
          purchaseOrderId: purchaseOrderLines.purchaseOrderId,
          productId: purchaseOrderLines.productId,
          name: purchaseOrderLines.name,
          description: purchaseOrderLines.description,
          quantity: purchaseOrderLines.quantity,
          receivedQuantity: purchaseOrderLines.receivedQuantity,
          unitPrice: purchaseOrderLines.unitPrice,
          supplierName: purchaseOrderLines.supplierName,
        })
        .from(purchaseOrderLines)
        .where(inArray(purchaseOrderLines.purchaseOrderId, poIds));

      for (const line of lines) {
        if (!linesByPoId.has(line.purchaseOrderId)) {
          linesByPoId.set(line.purchaseOrderId, []);
        }
        const qty = Number(line.quantity) || 0;
        const rec = Number(line.receivedQuantity) || 0;
        linesByPoId.get(line.purchaseOrderId)!.push({
          id: line.id,
          productId: line.productId || null,
          name: line.name || "Unknown item",
          description: line.description || null,
          quantity: qty,
          receivedQuantity: rec,
          outstandingQuantity: Math.max(0, qty - rec),
          isFullyReceived: rec >= qty && qty > 0,
        });
      }
    }

    const formatted = orderHeaders.map((po) => {
      const lines = linesByPoId.get(po.id) || [];
      const totalItems = lines.length;
      const fullyReceivedItems = lines.filter((l) => l.isFullyReceived).length;

      return {
        id: po.id,
        workguruId: po.workguruId,
        projectId: po.projectId,
        projectNumber: po.projectNumber || null,
        projectName: po.projectName || null,
        poNumber: po.poNumber,
        supplierName: po.supplierName || "Unknown",
        status: po.status || "Unknown",
        hydrationStatus: po.hydrationStatus || "COMPLETE",
        dates: {
          issueDate: po.issueDate ? new Date(po.issueDate).toISOString().split("T")[0] : null,
          expectedDate: po.expectedDate ? new Date(po.expectedDate).toISOString().split("T")[0] : null,
          receivedDate: po.receivedDate ? new Date(po.receivedDate).toISOString().split("T")[0] : null,
        },
        readinessSummary: {
          totalLineItems: totalItems,
          fullyReceivedLineItems: fullyReceivedItems,
          allReceived: totalItems > 0 && totalItems === fullyReceivedItems,
        },
        lines,
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
    console.error("[Production API v1: Purchase Orders] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve purchase orders." },
      { status: 500 }
    );
  }
}
