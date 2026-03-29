'use server'

import { db } from "@/db";
import { systemConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface CapacitySettings {
  staff: number;
  hoursPerWeek: number;
  efficiency: number; // 0 to 1
  weeksPerMonth: number;
}

const DEFAULT_SETTINGS: CapacitySettings = {
  staff: 10,
  hoursPerWeek: 38,
  efficiency: 0.8,
  weeksPerMonth: 4.33
};

const CONFIG_KEY = 'capacity_settings';

export async function getCapacitySettings(): Promise<CapacitySettings> {
  const record = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, CONFIG_KEY)
  });

  if (!record || !record.value) {
    return DEFAULT_SETTINGS;
  }

  return { ...DEFAULT_SETTINGS, ...(record.value as Partial<CapacitySettings>) };
}

export async function updateCapacitySettings(data: CapacitySettings) {
  if (data.staff <= 0) throw new Error("Staff must be > 0");
  if (data.hoursPerWeek <= 0) throw new Error("Hours per week must be > 0");
  if (data.efficiency < 0 || data.efficiency > 1) throw new Error("Efficiency must be between 0 and 1");
  if (data.weeksPerMonth <= 0) throw new Error("Weeks per month must be > 0");

  const existing = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, CONFIG_KEY)
  });

  if (existing) {
    await db.update(systemConfig)
      .set({ value: data, updatedAt: new Date() })
      .where(eq(systemConfig.key, CONFIG_KEY));
  } else {
    await db.insert(systemConfig).values({
      key: CONFIG_KEY,
      value: data,
    });
  }

  revalidatePath('/risk');
  return { success: true };
}
