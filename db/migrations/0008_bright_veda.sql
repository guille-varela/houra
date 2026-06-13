CREATE TABLE "insights_monthly" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"month" date NOT NULL,
	"project_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"area" text NOT NULL,
	"hours" numeric(12, 2) NOT NULL,
	"revenue_cents" bigint NOT NULL,
	"cost_cents" bigint NOT NULL,
	"entry_count" integer NOT NULL,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "insights_monthly" ADD CONSTRAINT "insights_monthly_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights_monthly" ADD CONSTRAINT "insights_monthly_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights_monthly" ADD CONSTRAINT "insights_monthly_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "insights_monthly_grain_idx" ON "insights_monthly" USING btree ("organization_id","month","project_id","person_id","area");--> statement-breakpoint
CREATE INDEX "insights_monthly_org_month_idx" ON "insights_monthly" USING btree ("organization_id","month");--> statement-breakpoint
CREATE INDEX "insights_monthly_project_idx" ON "insights_monthly" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "insights_monthly_person_idx" ON "insights_monthly" USING btree ("person_id");