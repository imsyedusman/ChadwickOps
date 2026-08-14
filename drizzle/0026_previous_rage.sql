CREATE TABLE "profitability_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_number" varchar(100) NOT NULL,
	"quoted_profit" double precision DEFAULT 0 NOT NULL,
	"actual_profit" double precision DEFAULT 0 NOT NULL,
	"completion_date" timestamp,
	"is_historical" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profitability_data_project_number_unique" UNIQUE("project_number")
);
--> statement-breakpoint
CREATE INDEX "profitability_project_number_idx" ON "profitability_data" USING btree ("project_number");