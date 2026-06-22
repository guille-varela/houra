CREATE TYPE "public"."avatar_type" AS ENUM('initials', 'generated', 'upload', 'google');--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "avatar_type" "avatar_type" DEFAULT 'initials' NOT NULL;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "avatar_seed" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "avatar_variant" text;--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "avatar_color" text;