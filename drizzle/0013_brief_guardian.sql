CREATE TABLE "procurement_failures" (
	"id" serial PRIMARY KEY NOT NULL,
	"po_id" varchar(50) NOT NULL,
	"po_number" varchar(100),
	"endpoint" text NOT NULL,
	"http_status" integer,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"response_snippet" text,
	"category" varchar(50),
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "procurement_sync_logs" ADD COLUMN "total_fetched" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "procurement_sync_logs" ADD COLUMN "total_hydrated" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "procurement_sync_logs" ADD COLUMN "total_failed" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "procurement_sync_logs" ADD COLUMN "total_skipped" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "procurement_sync_logs" ADD COLUMN "retry_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "po_number" varchar(100);--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "hydration_status" varchar(50) DEFAULT 'SUMMARY_ONLY' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "last_error" text;