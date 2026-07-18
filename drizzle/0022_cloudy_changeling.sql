CREATE TABLE "worker_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"stage" varchar(50) NOT NULL,
	"staff_id" integer NOT NULL,
	"assigned_hours" numeric(8, 2) NOT NULL,
	"projected_start" date,
	"projected_end" date,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "worker_assignment_unique_idx" UNIQUE("project_id","stage","staff_id")
);
--> statement-breakpoint
ALTER TABLE "worker_assignments" ADD CONSTRAINT "worker_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_assignments" ADD CONSTRAINT "worker_assignments_staff_id_staff_efficiency_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_efficiency"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_assignments" ADD CONSTRAINT "worker_assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;