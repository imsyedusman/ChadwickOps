'use server';

import { db } from '@/db';
import { projects, projectSuppliers, masterSuppliers } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function updateProjectProcurement(
  projectId: number,
  fields: {
    procurementStatus?: string;
    procurementNotes?: string;
  }
) {
  try {
    await db.update(projects)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    
    revalidatePath('/procurement');
    return { success: true };
  } catch (error) {
    console.error('[Action] Failed to update project procurement:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getMasterSuppliers() {
  try {
    const data = await db.query.masterSuppliers.findMany({
      orderBy: [asc(masterSuppliers.name)],
    });
    return data;
  } catch (error) {
    console.error('[Action] Failed to fetch master suppliers:', error);
    return [];
  }
}

export async function addMasterSupplier(name: string) {
  try {
    const existing = await db.query.masterSuppliers.findFirst({
      where: eq(masterSuppliers.name, name),
    });
    
    if (existing) return { success: true, id: existing.id };

    const res = await db.insert(masterSuppliers).values({
      name,
      updatedAt: new Date(),
    }).returning({ id: masterSuppliers.id });
    
    return { success: true, id: res[0].id };
  } catch (error) {
    console.error('[Action] Failed to add master supplier:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function addSupplier(
  projectId: number,
  supplier: {
    supplierName: string;
    masterSupplierId?: number | null;
    materialType: string;
    orderDate?: Date | null;
    expectedDeliveryDate?: Date | null;
    deliveryStatus?: string | null;
    notes?: string | null;
  }
) {
  try {
    const res = await db.insert(projectSuppliers).values({
      projectId,
      ...supplier,
      updatedAt: new Date(),
    }).returning({ id: projectSuppliers.id });
    
    revalidatePath('/procurement');
    return { success: true, id: res[0].id };
  } catch (error) {
    console.error('[Action] Failed to add supplier:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateSupplier(
  supplierId: number,
  fields: {
    supplierName?: string;
    masterSupplierId?: number | null;
    materialType?: string;
    orderDate?: Date | null;
    expectedDeliveryDate?: Date | null;
    deliveryStatus?: string | null;
    notes?: string | null;
  }
) {
  try {
    await db.update(projectSuppliers)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(projectSuppliers.id, supplierId));
    
    revalidatePath('/procurement');
    return { success: true };
  } catch (error) {
    console.error('[Action] Failed to update supplier:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteSupplier(supplierId: number) {
  try {
    await db.delete(projectSuppliers)
      .where(eq(projectSuppliers.id, supplierId));
    
    revalidatePath('/procurement');
    return { success: true };
  } catch (error) {
    console.error('[Action] Failed to delete supplier:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
