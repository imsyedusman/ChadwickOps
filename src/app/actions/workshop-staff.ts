"use server";

import { db } from "@/db";
import { staffEfficiency, systemConfig } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { validateSession, hasRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import axios from "axios";
import { decrypt } from "@/lib/crypto";

// Helper for session check (any valid user)
async function checkAuth() {
  const session = await validateSession();
  if (!session) {
    throw new Error("Unauthorized.");
  }
  return session;
}

// Helper for admin auth check
async function checkAdminAuth() {
  const session = await validateSession();
  if (!session || !hasRole(session, "admin")) {
    throw new Error("Unauthorized. Administrator role required.");
  }
  return session;
}

export async function getWorkshopStaff() {
  await checkAuth();

  try {
    const list = await db.query.staffEfficiency.findMany({
      orderBy: [asc(staffEfficiency.fullName)]
    });
    return { success: true, data: list };
  } catch (error: any) {
    console.error("[getWorkshopStaff] Error:", error);
    throw new Error(error.message || "Failed to load staff list.");
  }
}

export async function importWorkshopStaff() {
  await checkAdminAuth();

  try {
    const config = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, "WORKGURU_API_CREDENTIALS"),
    });

    if (!config) {
      throw new Error("WorkGuru API Credentials not configured");
    }

    const { apiKey, apiSecret } = config.value as { apiKey: string; apiSecret: string };
    const decryptedKey = decrypt(apiKey);
    const decryptedSecret = decrypt(apiSecret);

    const authRes = await axios.post("https://api.workguru.io/api/ClientTokenAuth/Authenticate/api/client/v1/tokenauth", {
      apiKey: decryptedKey,
      secret: decryptedSecret,
    });
    
    const token = authRes.data.accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    const usersRes = await axios.get("https://api.workguru.io/api/services/app/UserSharedExternal/GetAllUsers?MaxResultCount=1000", { headers });
    const wgUsers = usersRes.data.result?.items || usersRes.data.items || usersRes.data.result || [];

    const existingStaff = await db.query.staffEfficiency.findMany();
    const existingMap = new Map();
    existingStaff.forEach(staff => {
      if (staff.workguruId) {
        existingMap.set(staff.workguruId, staff);
      }
    });

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const wgUser of wgUsers) {
      const wgId = wgUser.id;
      const wgName = wgUser.fullName || `${wgUser.name} ${wgUser.surname}`.trim();
      const wgActive = !!wgUser.isActive;
      const wgRate = Number(wgUser.hourlyRate) || 0;

      if (existingMap.has(wgId)) {
        const current = existingMap.get(wgId);
        
        const updateData: any = {
          fullName: wgName,
          isActive: wgActive,
          updatedAt: new Date()
        };

        if (!current.hourlyRateOverridden) {
          updateData.hourlyRate = wgRate.toString();
          updated++;
        } else {
          skipped++;
        }

        await db.update(staffEfficiency)
          .set(updateData)
          .where(eq(staffEfficiency.workguruId, wgId));

      } else {
        await db.insert(staffEfficiency).values({
          workguruId: wgId,
          fullName: wgName,
          isApprentice: false,
          hourlyRate: wgRate.toString(),
          hourlyRateOverridden: false,
          isActive: wgActive,
          isWorkshopStaff: true,
          frameAssembly: null,
          switchgearMount: null,
          busbar: null,
          wiring: null,
          labels: null,
          testing: null,
          packagingFreight: null,
        });
        inserted++;
      }
    }

    revalidatePath("/admin/workshop-staff");
    return { success: true, counts: { inserted, updated, skipped } };
  } catch (error: any) {
    console.error("[importWorkshopStaff] Error:", error);
    throw new Error(error.message || "Failed to import staff.");
  }
}

export async function updateStaffMember(id: number, data: Partial<typeof staffEfficiency.$inferInsert>) {
  await checkAdminAuth();

  try {
    const updateData = { ...data, updatedAt: new Date() };

    if (data.hourlyRate !== undefined) {
      updateData.hourlyRateOverridden = true;
    }

    await db.update(staffEfficiency)
      .set(updateData)
      .where(eq(staffEfficiency.id, id));

    revalidatePath("/admin/workshop-staff");
    return { success: true };
  } catch (error: any) {
    console.error("[updateStaffMember] Error:", error);
    throw new Error(error.message || "Failed to update staff member.");
  }
}

export async function addStaffMemberManually(data: { fullName: string; isApprentice: boolean; hourlyRate: string | number }) {
  await checkAdminAuth();

  try {
    const [inserted] = await db.insert(staffEfficiency).values({
      workguruId: null,
      fullName: data.fullName,
      isApprentice: data.isApprentice,
      hourlyRate: data.hourlyRate.toString(),
      hourlyRateOverridden: false,
      isWorkshopStaff: true,
      isActive: true,
      frameAssembly: null,
      switchgearMount: null,
      busbar: null,
      wiring: null,
      labels: null,
      testing: null,
      packagingFreight: null,
    }).returning();

    revalidatePath("/admin/workshop-staff");
    return { success: true, data: inserted };
  } catch (error: any) {
    console.error("[addStaffMemberManually] Error:", error);
    throw new Error(error.message || "Failed to add staff member.");
  }
}
