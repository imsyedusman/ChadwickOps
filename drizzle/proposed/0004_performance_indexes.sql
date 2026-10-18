-- Proposed SQL Migration for Performance Indexes
-- DO NOT EXECUTE ON PRODUCTION OR VPS WITHOUT EXPLICIT APPROVAL
-- Author: ChadwickOps / WIP Dashboard Team
-- Purpose: Accelerate active pipeline queries, sorting, and date-range lookups across all dashboard routes

-- 1. Projects table performance indexes
-- Accelerates filtering active, non-archived projects (used in /, /risk, /risk-v2, /production-scheduling)
CREATE INDEX IF NOT EXISTS "idx_projects_archived_status" 
  ON "projects" ("is_archived", "raw_status");

-- Accelerates the global 'ORDER BY updated_at DESC' present in almost every route
CREATE INDEX IF NOT EXISTS "idx_projects_updated_at" 
  ON "projects" ("updated_at" DESC);

-- Accelerates delivery window filtering and overdue project sorting
CREATE INDEX IF NOT EXISTS "idx_projects_delivery_date" 
  ON "projects" ("delivery_date");

-- Accelerates project number lookup and prefix filtering (e.g. 99% internal check)
CREATE INDEX IF NOT EXISTS "idx_projects_project_number" 
  ON "projects" ("project_number");

-- 2. Worker Assignments performance indexes
-- Accelerates worker availability lookups and double-booking checks by staff and status
CREATE INDEX IF NOT EXISTS "idx_worker_assignments_staff_status" 
  ON "worker_assignments" ("staff_id", "status");

-- Accelerates schedule window overlap queries (projected_start <= end AND projected_end >= start)
CREATE INDEX IF NOT EXISTS "idx_worker_assignments_dates" 
  ON "worker_assignments" ("projected_start", "projected_end");

-- 3. Purchase Orders performance indexes
-- Accelerates material readiness lookups by project and status (filtering out received/cancelled)
CREATE INDEX IF NOT EXISTS "idx_purchase_orders_project_status" 
  ON "purchase_orders" ("project_id", "status");

-- 4. Staff Absences performance indexes
-- Accelerates absence conflict checks during workforce availability and scheduling
CREATE INDEX IF NOT EXISTS "idx_staff_absences_staff_dates" 
  ON "staff_absences" ("staff_id", "start_date", "end_date");
