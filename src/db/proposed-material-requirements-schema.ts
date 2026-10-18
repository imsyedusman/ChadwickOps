/**
 * PROPOSED SCHEMA DEFINITIONS FOR REVIEW ONLY (DO NOT IMPORT INTO LIVE DRIZZLE INSTANCE)
 * Phase 2A: Persistent Project Material Requirements & Supplier ETA Audit Trail
 */
import { pgTable, serial, integer, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { projects, purchaseOrders, users } from './schema';

export const projectMaterialRequirements = pgTable('project_material_requirements', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().unique().references(() => projects.id, { onDelete: 'cascade' }),
  requirement: varchar('requirement', { length: 30 }).default('unknown').notNull(),
  confirmedBy: integer('confirmed_by').references(() => users.id, { onDelete: 'set null' }),
  confirmedByName: text('confirmed_by_name'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }).defaultNow().notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('proj_mat_req_proj_idx').on(table.projectId),
]);

export const purchaseOrderEtaHistory = pgTable('purchase_order_eta_history', {
  id: serial('id').primaryKey(),
  purchaseOrderId: integer('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  previousExpectedDate: timestamp('previous_expected_date', { withTimezone: true }),
  revisedExpectedDate: timestamp('revised_expected_date', { withTimezone: true }).notNull(),
  revisionSource: varchar('revision_source', { length: 50 }).default('workguru_sync').notNull(),
  reason: text('reason'),
  detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('po_eta_hist_po_idx').on(table.purchaseOrderId),
]);
