-- PROPOSED MIGRATION (FOR REVIEW ONLY - DO NOT EXECUTE)
-- Phase 2A: Persistent Project Material Requirements & Supplier ETA Audit Trail

CREATE TABLE IF NOT EXISTS "project_material_requirements" (
  "id" serial PRIMARY KEY,
  "project_id" integer NOT NULL UNIQUE REFERENCES "projects"("id") ON DELETE CASCADE,
  "requirement" varchar(30) NOT NULL DEFAULT 'unknown',
  "confirmed_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "confirmed_by_name" text,
  "confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "proj_mat_req_proj_idx" ON "project_material_requirements" ("project_id");

-- Table to address WorkGuru sync limitation where expected delivery dates are overwritten in place
CREATE TABLE IF NOT EXISTS "purchase_order_eta_history" (
  "id" serial PRIMARY KEY,
  "purchase_order_id" integer NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
  "previous_expected_date" timestamp with time zone,
  "revised_expected_date" timestamp with time zone NOT NULL,
  "revision_source" varchar(50) DEFAULT 'workguru_sync' NOT NULL, -- 'workguru_sync' | 'manual_planner' | 'supplier_notice'
  "reason" text,
  "detected_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "po_eta_hist_po_idx" ON "purchase_order_eta_history" ("purchase_order_id");
