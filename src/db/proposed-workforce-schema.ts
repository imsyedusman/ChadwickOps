/**
 * PROPOSED SCHEMA FOR WORKFORCE TEAMS, EXTENDED LEAVE REQUESTS & OVERTIME SHIFTS
 * Phase 2B Proposal — NOT APPLIED TO DATABASE.
 * 
 * In accordance with strict project safety rules:
 * - Do not run drizzle-kit push or drizzle-kit migrate.
 * - This file documents the target production schema for future manual migration review.
 * - Active Phase 2B local state is persisted safely via system_config records.
 */

import { pgTable, serial, integer, varchar, text, boolean, date, timestamp, decimal, unique } from 'drizzle-orm/pg-core';
import { users, staffEfficiency, projects } from './schema';

/**
 * Workshop Teams (e.g. Alex's Team, Loc's Team)
 */
export const workshopTeams = pgTable('workshop_teams', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  leaderStaffId: integer('leader_staff_id').references(() => staffEfficiency.id),
  color: varchar('color', { length: 30 }).default('blue').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Team Memberships (historical and current)
 */
export const teamMemberships = pgTable('team_memberships', {
  id: serial('id').primaryKey(),
  staffId: integer('staff_id').notNull().references(() => staffEfficiency.id, { onDelete: 'cascade' }),
  teamId: varchar('team_id', { length: 50 }).notNull().references(() => workshopTeams.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).default('member').notNull(), // 'leader' | 'member'
  isTemporaryLoan: boolean('is_temporary_loan').default(false).notNull(),
  loanedToTeamId: varchar('loaned_to_team_id', { length: 50 }).references(() => workshopTeams.id),
  loanNotes: text('loan_notes'),
  startDate: date('start_date').defaultNow().notNull(),
  endDate: date('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Extended Leave Administration (Paper/PDF intake workflow)
 */
export const leaveRequests = pgTable('leave_requests', {
  id: serial('id').primaryKey(),
  staffId: integer('staff_id').notNull().references(() => staffEfficiency.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  isPartialDay: boolean('is_partial_day').default(false).notNull(),
  partialHours: decimal('partial_hours', { precision: 4, scale: 2 }),
  leaveType: varchar('leave_type', { length: 30 }).default('annual').notNull(), // 'annual' | 'sick' | 'unpaid' | 'other'
  status: varchar('status', { length: 30 }).default('pending').notNull(), // 'pending' | 'approved' | 'rejected' | 'cancelled'
  notes: text('notes'), // General intake note (e.g. "Paper form signed 14/10", NO private medical details)
  submittedBy: varchar('submitted_by', { length: 100 }).notNull(),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewedByName: varchar('reviewed_by_name', { length: 100 }),
  reviewedAt: timestamp('reviewed_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Proposed & Approved Overtime Shifts
 */
export const overtimeShifts = pgTable('overtime_shifts', {
  id: serial('id').primaryKey(),
  staffId: integer('staff_id').notNull().references(() => staffEfficiency.id),
  date: date('date').notNull(),
  hours: decimal('hours', { precision: 4, scale: 2 }).notNull(),
  status: varchar('status', { length: 30 }).default('proposed').notNull(), // 'proposed' | 'approved' | 'cancelled'
  associatedProjectId: integer('associated_project_id').references(() => projects.id),
  associatedTeamId: varchar('associated_team_id', { length: 50 }).references(() => workshopTeams.id),
  notes: text('notes'),
  createdBy: integer('created_by').references(() => users.id),
  createdByName: varchar('created_by_name', { length: 100 }).notNull(),
  approvedBy: integer('approved_by').references(() => users.id),
  approvedByName: varchar('approved_by_name', { length: 100 }),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
