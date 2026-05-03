CREATE TABLE "master_suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "master_suppliers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "project_suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"master_supplier_id" integer,
	"supplier_name" text NOT NULL,
	"material_type" varchar(50) NOT NULL,
	"order_date" timestamp,
	"expected_delivery_date" timestamp,
	"delivery_status" varchar(50),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "procurement_notes" text;--> statement-breakpoint
ALTER TABLE "project_suppliers" ADD CONSTRAINT "project_suppliers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_suppliers" ADD CONSTRAINT "project_suppliers_master_supplier_id_master_suppliers_id_fk" FOREIGN KEY ("master_supplier_id") REFERENCES "public"."master_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_project_idx" ON "project_suppliers" USING btree ("project_id");