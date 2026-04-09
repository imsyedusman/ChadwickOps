import { pgTable, serial, text, varchar, timestamp, doublePrecision, integer, jsonb, index, boolean } from 'drizzle-orm/pg-core';
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
  drawingStatus: varchar('drawing_status', { length: 100 }),
  procurementStatus: varchar('procurement_status', { length: 100 }),
  productionReadiness: text('production_readiness'),
  projectManager: text('project_manager'),
  lastDeepSyncAt: timestamp('last_deep_sync_at'),
  remoteUpdatedAt: timestamp('remote_updated_at'),
  hasActualMismatch: integer('has_actual_mismatch').default(0).notNull(), // 0 = false, 1 = true
  isArchived: boolean('is_archived').default(false).notNull(),
  archivedAt: timestamp('archived_at'),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
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
}));

export const stageMappingsRelations = relations(stageMappings, ({ one }) => ({
  displayStage: one(displayStages, { fields: [stageMappings.displayStageId], references: [displayStages.id] }),
}));
