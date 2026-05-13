CREATE TABLE "procurement_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"status" varchar(50) NOT NULL,
	"details" text
);
--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"workguru_id" varchar(255) NOT NULL,
	"purchase_order_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"po_number" varchar(100) NOT NULL,
	"supplier_name" text,
	"product_id" integer,
	"name" text,
	"description" text,
	"quantity" double precision DEFAULT 0 NOT NULL,
	"received_quantity" double precision DEFAULT 0 NOT NULL,
	"invoiced_quantity" double precision DEFAULT 0 NOT NULL,
	"unit_price" double precision DEFAULT 0 NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_order_lines_workguru_id_unique" UNIQUE("workguru_id")
);
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "expected_date" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "po_line_po_idx" ON "purchase_order_lines" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "po_line_project_idx" ON "purchase_order_lines" USING btree ("project_id");