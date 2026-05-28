CREATE TYPE "public"."billing_model" AS ENUM('hour_bag', 'monthly_fee', 'by_phase');--> statement-breakpoint
CREATE TYPE "public"."project_phase_status" AS ENUM('planned', 'in_progress', 'delivered', 'invoiced');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"has_marco" boolean DEFAULT false NOT NULL,
	"marco_start_date" date,
	"marco_end_date" date,
	"marco_use_per_role_rates" boolean DEFAULT false NOT NULL,
	"marco_global_rate_cents" integer,
	"marco_rate_by_category" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"estimated_hours" numeric(8, 2),
	"billing_amount" numeric(12, 2),
	"delivery_date" date,
	"status" "project_phase_status" DEFAULT 'planned' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "persons" ADD COLUMN "internal_level" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "billing_model" "billing_model" DEFAULT 'hour_bag' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "target_margin_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "hour_bag_alert_threshold" numeric(5, 2) DEFAULT '80' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_org_id_idx" ON "clients" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "project_phases_project_id_idx" ON "project_phases" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_phases_org_id_idx" ON "project_phases" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_client_id_idx" ON "projects" USING btree ("client_id");