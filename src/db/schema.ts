import { pgTable, serial, text, varchar, timestamp, doublePrecision, integer, jsonb, index, boolean, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  workguruId: varchar('workguru_id', { length: 255 }).notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const displayStages = pgTable('display_stages', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  order: integer('order').notNull(),
  color: varchar('color', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const stageMappings = pgTable('stage_mappings', {
  id: serial('id').primaryKey(),
  workguruStatus: varchar('workguru_status', { length: 255 }).notNull().unique(),
  displayStageId: integer('display_stage_id').notNull().references(() => displayStages.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  workguruId: varchar('workguru_id', { length: 255 }).notNull().unique(),
  projectNumber: varchar('project_number', { length: 100 }).notNull(),
  name: text('name').notNull(),
  clientId: integer('client_id').notNull().references(() => clients.id),
  displayStageId: integer('display_stage_id').references(() => displayStages.id),
  rawStatus: text('raw_status').notNull(),
  budgetHours: doublePrecision('budget_hours').default(0).notNull(),
  actualHours: doublePrecision('actual_hours').default(0).notNull(),
  approvedHours: doublePrecision('approved_hours').default(0).notNull(),
  hasUnapprovedHours: integer('has_unapproved_hours').default(0).notNull(), // 0 = false, 1 = true
  remainingHours: doublePrecision('remaining_hours').default(0).notNull(),
  progressPercent: doublePrecision('progress_percent').default(0).notNull(),
  deliveryDate: timestamp('delivery_date'),
  description: text('description'),
  drawingApprovalDate: timestamp('drawing_approval_date'),
  drawingSubmittedDate: timestamp('drawing_submitted_date'),
  drawingStatus: varchar('drawing_status', { length: 100 }),
  bayLocation: text('bay_location'),
  projectType: text('project_type'),
  sheetmetalOrderedDate: timestamp('sheetmetal_ordered_date'),
  sheetmetalDeliveredDate: timestamp('sheetmetal_delivered_date'),
  switchgearOrderedDate: timestamp('switchgear_ordered_date'),
  switchgearDeliveredDate: timestamp('switchgear_delivered_date'),
  procurementStatus: varchar('procurement_status', { length: 100 }),
  procurementNotes: text('procurement_notes'),
  productionReadiness: text('production_readiness'),
  projectManager: text('project_manager'),
  lastDeepSyncAt: timestamp('last_deep_sync_at'),
  remoteUpdatedAt: timestamp('remote_updated_at'),
  hasActualMismatch: integer('has_actual_mismatch').default(0).notNull(), // 0 = false, 1 = true
  isArchived: boolean('is_archived').default(false).notNull(),
  archivedAt: timestamp('archived_at'),
  total: doublePrecision('total').default(0).notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  projectCreationDate: timestamp('project_creation_date'),
  startDate: timestamp('start_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('project_client_idx').on(table.clientId),
    index('project_stage_idx').on(table.displayStageId),
  ];
});

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  workguruId: varchar('workguru_id', { length: 255 }).notNull().unique(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  budgetHours: doublePrecision('budget_hours').default(0).notNull(),
  actualHours: doublePrecision('actual_hours').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('task_project_idx').on(table.projectId),
  ];
});

export const timeEntries = pgTable('time_entries', {
  id: serial('id').primaryKey(),
  workguruId: varchar('workguru_id', { length: 255 }).notNull().unique(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  taskId: integer('task_id').references(() => tasks.id),
  hours: doublePrecision('hours').notNull(),
  cost: doublePrecision('cost').default(0).notNull(),
  status: varchar('status', { length: 50 }).default('Draft').notNull(),
  date: timestamp('date').notNull(),
  user: text('user').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('time_entry_project_idx').on(table.projectId),
    index('time_entry_task_idx').on(table.taskId),
  ];
});

export const purchaseOrders = pgTable('purchase_orders', {
  id: serial('id').primaryKey(),
  workguruId: varchar('workguru_id', { length: 255 }).notNull().unique(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  total: doublePrecision('total').default(0).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  issueDate: timestamp('issue_date').notNull(),
  supplierName: text('supplier_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('po_project_idx').on(table.projectId),
  ];
});

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  workguruId: varchar('workguru_id', { length: 255 }).notNull().unique(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  total: doublePrecision('total').default(0).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  issueDate: timestamp('issue_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('invoice_project_idx').on(table.projectId),
  ];
});

export const projectFinancialSnapshots = pgTable('project_financial_snapshots', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  snapshotMonth: varchar('snapshot_month', { length: 7 }).notNull(), // YYYY-MM
  totalCostToDate: doublePrecision('total_cost_to_date').default(0).notNull(),
  totalInvoicedToDate: doublePrecision('total_invoiced_to_date').default(0).notNull(),
  unrecoveredAmount: doublePrecision('unrecovered_amount').default(0).notNull(),
  labourCostThisMonth: doublePrecision('labour_cost_this_month').default(0).notNull(),
  materialCostThisMonth: doublePrecision('material_cost_this_month').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('financial_snapshot_project_idx').on(table.projectId),
    index('financial_snapshot_month_idx').on(table.snapshotMonth),
    unique('project_month_unique_idx').on(table.projectId, table.snapshotMonth),
  ];
});

export const masterSuppliers = pgTable('master_suppliers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projectSuppliers = pgTable('project_suppliers', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  masterSupplierId: integer('master_supplier_id').references(() => masterSuppliers.id),
  supplierName: text('supplier_name').notNull(), // Keep as denormalized for speed/fallback
  materialType: varchar('material_type', { length: 50 }).notNull(), // SM, SG, Other
  orderDate: timestamp('order_date'),
  expectedDeliveryDate: timestamp('expected_delivery_date'),
  deliveryStatus: varchar('delivery_status', { length: 50 }), // Ordered, Partially Delivered, Delivered, Delayed
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('supplier_project_idx').on(table.projectId),
  ];
});

export const systemConfig = pgTable('system_config', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const syncLogs = pgTable('sync_logs', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  status: varchar('status', { length: 50 }).notNull(), // SUCCESS, FAILURE, MISMATCH
  details: text('details'),
});

// Relations
export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects),
}));

export const displayStagesRelations = relations(displayStages, ({ many }) => ({
  projects: many(projects),
  mappings: many(stageMappings),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  displayStage: one(displayStages, { fields: [projects.displayStageId], references: [displayStages.id] }),
  tasks: many(tasks),
  timeEntries: many(timeEntries),
  suppliers: many(projectSuppliers),
}));

export const projectSuppliersRelations = relations(projectSuppliers, ({ one }) => ({
  project: one(projects, { fields: [projectSuppliers.projectId], references: [projects.id] }),
  masterSupplier: one(masterSuppliers, { fields: [projectSuppliers.masterSupplierId], references: [masterSuppliers.id] }),
}));

export const stageMappingsRelations = relations(stageMappings, ({ one }) => ({
  displayStage: one(displayStages, { fields: [stageMappings.displayStageId], references: [displayStages.id] }),
}));
