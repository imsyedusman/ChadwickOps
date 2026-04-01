CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"workguru_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clients_workguru_id_unique" UNIQUE("workguru_id")
);
--> statement-breakpoint
CREATE TABLE "display_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"order" integer NOT NULL,
	"color" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "display_stages_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"workguru_id" varchar(255) NOT NULL,
	"project_number" varchar(100) NOT NULL,
	"name" text NOT NULL,
	"client_id" integer NOT NULL,
	"display_stage_id" integer,
	"raw_status" text NOT NULL,
	"budget_hours" double precision DEFAULT 0 NOT NULL,
	"actual_hours" double precision DEFAULT 0 NOT NULL,
	"approved_hours" double precision DEFAULT 0 NOT NULL,
	"has_unapproved_hours" integer DEFAULT 0 NOT NULL,
	"remaining_hours" double precision DEFAULT 0 NOT NULL,
	"progress_percent" double precision DEFAULT 0 NOT NULL,
	"delivery_date" timestamp,
	"drawing_status" varchar(100),
	"procurement_status" varchar(100),
	"production_readiness" text,
	"project_manager" text,
	"last_deep_sync_at" timestamp,
	"remote_updated_at" timestamp,
	"has_actual_mismatch" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projects_workguru_id_unique" UNIQUE("workguru_id")
);
--> statement-breakpoint
CREATE TABLE "stage_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"workguru_status" varchar(255) NOT NULL,
	"display_stage_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stage_mappings_workguru_status_unique" UNIQUE("workguru_status")
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"status" varchar(50) NOT NULL,
	"details" text
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"workguru_id" varchar(255) NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"budget_hours" double precision DEFAULT 0 NOT NULL,
	"actual_hours" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_workguru_id_unique" UNIQUE("workguru_id")
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"workguru_id" varchar(255) NOT NULL,
	"project_id" integer NOT NULL,
	"task_id" integer,
	"hours" double precision NOT NULL,
	"status" varchar(50) DEFAULT 'Draft' NOT NULL,
	"date" timestamp NOT NULL,
	"user" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "time_entries_workguru_id_unique" UNIQUE("workguru_id")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_display_stage_id_display_stages_id_fk" FOREIGN KEY ("display_stage_id") REFERENCES "public"."display_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_mappings" ADD CONSTRAINT "stage_mappings_display_stage_id_display_stages_id_fk" FOREIGN KEY ("display_stage_id") REFERENCES "public"."display_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_client_idx" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "project_stage_idx" ON "projects" USING btree ("display_stage_id");--> statement-breakpoint
CREATE INDEX "task_project_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "time_entry_project_idx" ON "time_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "time_entry_task_idx" ON "time_entries" USING btree ("task_id");