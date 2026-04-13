ALTER TABLE "projects" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "drawing_approval_date" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "drawing_submitted_date" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "bay_location" text;