CREATE TABLE "attendance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"workguru_id" varchar(255) NOT NULL,
	"employee_name" varchar(255) NOT NULL,
	"employee_id" varchar(100),
	"project_id" integer,
	"workguru_project_id" varchar(255),
	"project_number" varchar(100),
	"project_name" text,
	"task_id" integer,
	"workguru_task_id" varchar(255),
	"task_name" text,
	"date" timestamp NOT NULL,
	"start_time" timestamp,
	"finish_time" timestamp,
	"duration_hours" double precision DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'Draft' NOT NULL,
	"cost" double precision DEFAULT 0 NOT NULL,
	"notes" text,
	"creation_time" timestamp,
	"last_modified_time" timestamp,
	"has_flags" boolean DEFAULT false NOT NULL,
	"flag_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"raw_payload" jsonb,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_records_workguru_id_unique" UNIQUE("workguru_id")
);
--> statement-breakpoint
CREATE TABLE "attendance_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"status" varchar(50) NOT NULL,
	"total_fetched" integer DEFAULT 0 NOT NULL,
	"total_upserted" integer DEFAULT 0 NOT NULL,
	"total_deleted" integer DEFAULT 0 NOT NULL,
	"flagged_count" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"details" text
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_emp_idx" ON "attendance_records" USING btree ("employee_name");--> statement-breakpoint
CREATE INDEX "attendance_date_idx" ON "attendance_records" USING btree ("date");--> statement-breakpoint
CREATE INDEX "attendance_start_idx" ON "attendance_records" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "attendance_project_idx" ON "attendance_records" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "attendance_status_idx" ON "attendance_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "attendance_has_flags_idx" ON "attendance_records" USING btree ("has_flags");