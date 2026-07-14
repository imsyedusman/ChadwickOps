CREATE TABLE "production_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"scheduled_start" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer,
	CONSTRAINT "production_schedule_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "project_stage_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"frame_assembly" numeric(8, 2),
	"switchgear_mount" numeric(8, 2),
	"busbar" numeric(8, 2),
	"wiring" numeric(8, 2),
	"labels" numeric(8, 2),
	"testing" numeric(8, 2),
	"packaging_freight" numeric(8, 2),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer,
	CONSTRAINT "project_stage_hours_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "staff_efficiency" (
	"id" serial PRIMARY KEY NOT NULL,
	"workguru_id" integer,
	"full_name" varchar(255) NOT NULL,
	"is_apprentice" boolean DEFAULT false NOT NULL,
	"hourly_rate" numeric(8, 2) DEFAULT '0' NOT NULL,
	"hourly_rate_overridden" boolean DEFAULT false NOT NULL,
	"frame_assembly" numeric(4, 2),
	"switchgear_mount" numeric(4, 2),
	"busbar" numeric(4, 2),
	"wiring" numeric(4, 2),
	"labels" numeric(4, 2),
	"testing" numeric(4, 2),
	"packaging_freight" numeric(4, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_workshop_staff" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_efficiency_workguru_id_unique" UNIQUE("workguru_id")
);
--> statement-breakpoint
ALTER TABLE "production_schedule" ADD CONSTRAINT "production_schedule_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_schedule" ADD CONSTRAINT "production_schedule_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stage_hours" ADD CONSTRAINT "project_stage_hours_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stage_hours" ADD CONSTRAINT "project_stage_hours_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;