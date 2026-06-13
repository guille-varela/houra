ALTER TYPE "public"."proposal_status" ADD VALUE 'paused';--> statement-breakpoint
ALTER TYPE "public"."proposal_status" ADD VALUE 'expired';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "default_target_margin_pct" numeric(5, 2) DEFAULT '40' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "proposal_expiry_days" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "use_default_margin" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "total_bag_hours" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "use_framework_agreement_rate" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "expiry_notified_at" timestamp with time zone;