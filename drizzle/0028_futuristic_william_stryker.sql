ALTER TABLE "profitability_data" ADD COLUMN "total_cost" double precision;--> statement-breakpoint
ALTER TABLE "profitability_data" ADD COLUMN "labour_cost" double precision;--> statement-breakpoint
ALTER TABLE "profitability_data" ADD COLUMN "materials_cost" double precision;--> statement-breakpoint
ALTER TABLE "profitability_data" ADD COLUMN "purchases_cost" double precision;--> statement-breakpoint
ALTER TABLE "profitability_data" ADD COLUMN "estimated_labour_cost" double precision;--> statement-breakpoint
ALTER TABLE "profitability_data" ADD COLUMN "estimated_materials_cost" double precision;--> statement-breakpoint
ALTER TABLE "profitability_data" ADD COLUMN "estimated_total_cost" double precision;--> statement-breakpoint
ALTER TABLE "profitability_data" ADD COLUMN "estimated_invoiced_amount" double precision;