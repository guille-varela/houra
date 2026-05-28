CREATE TYPE "public"."proposal_staffing_type" AS ENUM('person', 'role');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'internal_review', 'pending_approval', 'approved');--> statement-breakpoint
CREATE TABLE "proposal_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"name" text NOT NULL,
	"delivery_date" date,
	"billing_amount" numeric(12, 2),
	"sort_order" numeric DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_staffing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"phase_id" uuid,
	"staffing_type" "proposal_staffing_type" DEFAULT 'role' NOT NULL,
	"person_id" uuid,
	"role_category" text,
	"area" text NOT NULL,
	"estimated_hours" numeric(8, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid,
	"name" text NOT NULL,
	"status" "proposal_status" DEFAULT 'draft' NOT NULL,
	"project_type" text DEFAULT 'fixed_bag' NOT NULL,
	"billing_model" text DEFAULT 'hour_bag' NOT NULL,
	"target_margin_percent" numeric(5, 2),
	"internal_notes" text,
	"converted_project_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposal_phases" ADD CONSTRAINT "proposal_phases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_phases" ADD CONSTRAINT "proposal_phases_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_staffing" ADD CONSTRAINT "proposal_staffing_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_staffing" ADD CONSTRAINT "proposal_staffing_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_staffing" ADD CONSTRAINT "proposal_staffing_phase_id_proposal_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."proposal_phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_staffing" ADD CONSTRAINT "proposal_staffing_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_converted_project_id_projects_id_fk" FOREIGN KEY ("converted_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_persons_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proposal_phases_proposal_id_idx" ON "proposal_phases" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "proposal_staffing_proposal_id_idx" ON "proposal_staffing" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "proposal_staffing_phase_id_idx" ON "proposal_staffing" USING btree ("phase_id");--> statement-breakpoint
CREATE INDEX "proposals_org_id_idx" ON "proposals" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "proposals_client_id_idx" ON "proposals" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "proposals_status_idx" ON "proposals" USING btree ("status");