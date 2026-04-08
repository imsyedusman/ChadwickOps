ALTER TABLE "projects" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "last_seen_at" timestamp DEFAULT now() NOT NULL;