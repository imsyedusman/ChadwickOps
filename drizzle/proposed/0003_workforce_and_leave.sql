-- Proposed SQL Migration for Phase 2B (Workforce Teams, Leave Requests & Overtime Shifts)
-- DO NOT EXECUTE ON PRODUCTION OR VPS WITHOUT EXPLICIT APPROVAL
-- Author: ChadwickOps / WIP Dashboard Team

CREATE TABLE IF NOT EXISTS "workshop_teams" (
  "id" varchar(50) PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "leader_staff_id" integer REFERENCES "staff_efficiency"("id"),
  "color" varchar(30) DEFAULT 'blue' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "team_memberships" (
  "id" serial PRIMARY KEY,
  "staff_id" integer NOT NULL REFERENCES "staff_efficiency"("id") ON DELETE cascade,
  "team_id" varchar(50) NOT NULL REFERENCES "workshop_teams"("id") ON DELETE cascade,
  "role" varchar(20) DEFAULT 'member' NOT NULL,
  "is_temporary_loan" boolean DEFAULT false NOT NULL,
  "loaned_to_team_id" varchar(50) REFERENCES "workshop_teams"("id"),
  "loan_notes" text,
  "start_date" date DEFAULT CURRENT_DATE NOT NULL,
  "end_date" date,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "leave_requests" (
  "id" serial PRIMARY KEY,
  "staff_id" integer NOT NULL REFERENCES "staff_efficiency"("id"),
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "is_partial_day" boolean DEFAULT false NOT NULL,
  "partial_hours" numeric(4, 2),
  "leave_type" varchar(30) DEFAULT 'annual' NOT NULL,
  "status" varchar(30) DEFAULT 'pending' NOT NULL,
  "notes" text,
  "submitted_by" varchar(100) NOT NULL,
  "submitted_at" timestamp DEFAULT now() NOT NULL,
  "reviewed_by" integer REFERENCES "users"("id"),
  "reviewed_by_name" varchar(100),
  "reviewed_at" timestamp,
  "rejection_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "overtime_shifts" (
  "id" serial PRIMARY KEY,
  "staff_id" integer NOT NULL REFERENCES "staff_efficiency"("id"),
  "date" date NOT NULL,
  "hours" numeric(4, 2) NOT NULL,
  "status" varchar(30) DEFAULT 'proposed' NOT NULL,
  "associated_project_id" integer REFERENCES "projects"("id"),
  "associated_team_id" varchar(50) REFERENCES "workshop_teams"("id"),
  "notes" text,
  "created_by" integer REFERENCES "users"("id"),
  "created_by_name" varchar(100) NOT NULL,
  "approved_by" integer REFERENCES "users"("id"),
  "approved_by_name" varchar(100),
  "approved_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS "idx_team_memberships_staff" ON "team_memberships"("staff_id");
CREATE INDEX IF NOT EXISTS "idx_team_memberships_team" ON "team_memberships"("team_id");
CREATE INDEX IF NOT EXISTS "idx_leave_requests_staff" ON "leave_requests"("staff_id");
CREATE INDEX IF NOT EXISTS "idx_leave_requests_dates" ON "leave_requests"("start_date", "end_date");
CREATE INDEX IF NOT EXISTS "idx_overtime_shifts_staff_date" ON "overtime_shifts"("staff_id", "date");
