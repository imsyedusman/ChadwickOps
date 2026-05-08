CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"workguru_id" varchar(255) NOT NULL,
	"project_id" integer NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"status" varchar(50) NOT NULL,
	"issue_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_workguru_id_unique" UNIQUE("workguru_id")
);
--> statement-breakpoint
CREATE TABLE "project_financial_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"snapshot_month" varchar(7) NOT NULL,
	"total_cost_to_date" double precision DEFAULT 0 NOT NULL,
	"total_invoiced_to_date" double precision DEFAULT 0 NOT NULL,
	"unrecovered_amount" double precision DEFAULT 0 NOT NULL,
	"labour_cost_this_month" double precision DEFAULT 0 NOT NULL,
	"material_cost_this_month" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_month_unique_idx" UNIQUE("project_id","snapshot_month")
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"workguru_id" varchar(255) NOT NULL,
	"project_id" integer NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"status" varchar(50) NOT NULL,
	"issue_date" timestamp NOT NULL,
	"received_date" timestamp,
	"supplier_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_workguru_id_unique" UNIQUE("workguru_id")
);
--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "cost" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_financial_snapshots" ADD CONSTRAINT "project_financial_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_project_idx" ON "invoices" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "financial_snapshot_project_idx" ON "project_financial_snapshots" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "financial_snapshot_month_idx" ON "project_financial_snapshots" USING btree ("snapshot_month");--> statement-breakpoint
CREATE INDEX "po_project_idx" ON "purchase_orders" USING btree ("project_id");