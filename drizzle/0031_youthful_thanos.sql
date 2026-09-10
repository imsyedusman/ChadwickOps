ALTER TABLE "projects" ADD COLUMN "drawing_issued_date" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "drawing_revision" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "issued_to" text;