CREATE TABLE "invoice_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"status" varchar(50) NOT NULL,
	"total_fetched" integer DEFAULT 0,
	"total_upserted" integer DEFAULT 0,
	"details" text
);
