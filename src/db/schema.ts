import { pgTable, serial, text, varchar, timestamp, doublePrecision, integer, jsonb, index, boolean, unique, primaryKey, decimal, date } from 'drizzle-orm/pg-core';
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
  priority: text('priority'),
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
  receivedDate: timestamp('received_date'),
  expectedDate: timestamp('expected_date'),
  supplierName: text('supplier_name'),
  poNumber: varchar('po_number', { length: 100 }), // Operational Identifier
  hydrationStatus: varchar('hydration_status', { length: 50 }).default('SUMMARY_ONLY').notNull(),
  retryCount: integer('retry_count').default(0).notNull(),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('po_project_idx').on(table.projectId),
  ];
});

export const purchaseOrderLines = pgTable('purchase_order_lines', {
  id: serial('id').primaryKey(),
  workguruId: varchar('workguru_id', { length: 255 }).notNull().unique(),
  purchaseOrderId: integer('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  poNumber: varchar('po_number', { length: 100 }).notNull(),
  supplierName: text('supplier_name'),
  productId: integer('product_id'),
  name: text('name'),
  description: text('description'),
  quantity: doublePrecision('quantity').default(0).notNull(),
  receivedQuantity: doublePrecision('received_quantity').default(0).notNull(),
  invoicedQuantity: doublePrecision('invoiced_quantity').default(0).notNull(),
  unitPrice: doublePrecision('unit_price').default(0).notNull(),
  total: doublePrecision('total').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    index('po_line_po_idx').on(table.purchaseOrderId),
    index('po_line_project_idx').on(table.projectId),
  ];
});

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  workguruId: varchar('workguru_id', { length: 255 }).notNull().unique(),
  invoiceNumber: varchar('invoice_number', { length: 100 }),
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
  labourCostThisMonth: doublePrecision('labour_cost_this_month').default(0).notNull(), // Total Logged
  approvedLabourCostThisMonth: doublePrecision('approved_labour_cost_this_month').default(0).notNull(),
  pendingLabourCostThisMonth: doublePrecision('pending_labour_cost_this_month').default(0).notNull(),
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

export const invoiceSyncLogs = pgTable('invoice_sync_logs', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  status: varchar('status', { length: 50 }).notNull(), // SUCCESS, FAILURE
  totalFetched: integer('total_fetched').default(0),
  totalUpserted: integer('total_upserted').default(0),
  details: text('details'),
});

export const procurementSyncLogs = pgTable('procurement_sync_logs', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  status: varchar('status', { length: 50 }).notNull(), // SUCCESS, FAILURE, WARNING, PARTIAL
  totalFetched: integer('total_fetched').default(0),
  totalHydrated: integer('total_hydrated').default(0),
  totalFailed: integer('total_failed').default(0),
  totalSkipped: integer('total_skipped').default(0),
  retryCount: integer('retry_count').default(0),
  details: text('details'),
});

export const procurementFailures = pgTable('procurement_failures', {
  id: serial('id').primaryKey(),
  poId: varchar('po_id', { length: 50 }).notNull(),
  poNumber: varchar('po_number', { length: 100 }),
  endpoint: text('endpoint').notNull(),
  httpStatus: integer('http_status'),
  retryCount: integer('retry_count').default(0).notNull(),
  errorMessage: text('error_message'),
  responseSnippet: text('response_snippet'),
  category: varchar('category', { length: 50 }), // RATE_LIMIT, AUTH, TIMEOUT, MALFORMED, EMPTY_LINES, DB_ERROR, etc.
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  description: varchar('description', { length: 255 }),
});

export const userRoles = pgTable('user_roles', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: integer('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
}, (table) => {
  return [
    primaryKey({ columns: [table.userId, table.roleId] }),
  ];
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).default('viewer').notNull(), // 'admin' | 'user' | 'viewer'
  isActive: boolean('is_active').default(true).notNull(),
  sessionVersion: integer('session_version').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
});

export const staffEfficiency = pgTable('staff_efficiency', {
  id: serial('id').primaryKey(),
  workguruId: integer('workguru_id').unique(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  isApprentice: boolean('is_apprentice').default(false).notNull(),
  hourlyRate: decimal('hourly_rate', { precision: 8, scale: 2 }).default('0').notNull(),
  hourlyRateOverridden: boolean('hourly_rate_overridden').default(false).notNull(),
  frameAssembly: decimal('frame_assembly', { precision: 4, scale: 2 }),
  switchgearMount: decimal('switchgear_mount', { precision: 4, scale: 2 }),
  busbar: decimal('busbar', { precision: 4, scale: 2 }),
  wiring: decimal('wiring', { precision: 4, scale: 2 }),
  labels: decimal('labels', { precision: 4, scale: 2 }),
  testing: decimal('testing', { precision: 4, scale: 2 }),
  packagingFreight: decimal('packaging_freight', { precision: 4, scale: 2 }),
  isActive: boolean('is_active').default(true).notNull(),
  isWorkshopStaff: boolean('is_workshop_staff').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// This table must never be modified by any sync process.
export const projectStageHours = pgTable('project_stage_hours', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().unique().references(() => projects.id),
  frameAssemblyIfc: decimal('frame_assembly_ifc', { precision: 8, scale: 2 }),
  frameAssemblyIfm: decimal('frame_assembly_ifm', { precision: 8, scale: 2 }),
  switchgearMount: decimal('switchgear_mount', { precision: 8, scale: 2 }),
  busbarIfc: decimal('busbar_ifc', { precision: 8, scale: 2 }),
  busbarIfm: decimal('busbar_ifm', { precision: 8, scale: 2 }),
  wiring: decimal('wiring', { precision: 8, scale: 2 }),
  labels: decimal('labels', { precision: 8, scale: 2 }),
  testing: decimal('testing', { precision: 8, scale: 2 }),
  packagingFreight: decimal('packaging_freight', { precision: 8, scale: 2 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: integer('updated_by').references(() => users.id),
});

// This table must never be modified by any sync process.
export const productionSchedule = pgTable('production_schedule', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().unique().references(() => projects.id),
  scheduledStart: date('scheduled_start'),
  scheduledByAuto: boolean('scheduled_by_auto').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: integer('updated_by').references(() => users.id),
});

// This table must never be modified by any sync process.
export const workerAssignments = pgTable('worker_assignments', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  stage: varchar('stage', { length: 50 }).notNull(),
  staffId: integer('staff_id').notNull().references(() => staffEfficiency.id),
  assignedHours: decimal('assigned_hours', { precision: 8, scale: 2 }).notNull(),
  projectedStart: date('projected_start'),
  projectedEnd: date('projected_end'),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: integer('created_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return [
    unique('worker_assignment_unique_idx').on(table.projectId, table.stage, table.staffId),
  ];
});

// This table must never be modified by any sync process.
export const staffAbsences = pgTable('staff_absences', {
  id: serial('id').primaryKey(),
  staffId: integer('staff_id').notNull().references(() => staffEfficiency.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  reason: varchar('reason', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: integer('created_by').references(() => users.id),
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

export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));
