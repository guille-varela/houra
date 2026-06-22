CREATE TYPE "public"."auto_fill_mode" AS ENUM('percent', 'monthly_hours');--> statement-breakpoint
CREATE TYPE "public"."auto_fill_run_status" AS ENUM('preview', 'committed', 'reverted');--> statement-breakpoint
CREATE TYPE "public"."time_entry_source" AS ENUM('manual', 'auto_fill');--> statement-breakpoint
CREATE TABLE "auto_fill_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"triggered_by" uuid,
	"trigger_type" text NOT NULL,
	"status" "auto_fill_run_status" DEFAULT 'preview' NOT NULL,
	"summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_assignments" ADD COLUMN "auto_fill_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD COLUMN "auto_fill_mode" "auto_fill_mode";--> statement-breakpoint
ALTER TABLE "project_assignments" ADD COLUMN "dedication_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "project_assignments" ADD COLUMN "monthly_target_hours" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "project_assignments" ADD COLUMN "auto_fill_area" text;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD COLUMN "effective_from" date;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD COLUMN "effective_to" date;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "source" time_entry_source DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "auto_fill_run_id" uuid;--> statement-breakpoint
ALTER TABLE "auto_fill_runs" ADD CONSTRAINT "auto_fill_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_fill_runs" ADD CONSTRAINT "auto_fill_runs_triggered_by_persons_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auto_fill_runs_org_id_idx" ON "auto_fill_runs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auto_fill_runs_period_idx" ON "auto_fill_runs" USING btree ("period_start","period_end");--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_auto_fill_run_id_auto_fill_runs_id_fk" FOREIGN KEY ("auto_fill_run_id") REFERENCES "public"."auto_fill_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "time_entries_autofill_idx" ON "time_entries" USING btree ("person_id","project_id","date","source");