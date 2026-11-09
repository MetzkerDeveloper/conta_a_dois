CREATE TABLE "recurring_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"day_of_month" integer NOT NULL,
	"start_month" date NOT NULL,
	"category_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"creation_key" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "recurring_household_id_unique" UNIQUE("household_id","id"),
	CONSTRAINT "recurring_creation_unique" UNIQUE("household_id","creation_key"),
	CONSTRAINT "recurring_amount_range" CHECK ("recurring_expenses"."amount_cents" between 1 and 9007199254740991),
	CONSTRAINT "recurring_day_range" CHECK ("recurring_expenses"."day_of_month" between 1 and 31),
	CONSTRAINT "recurring_first_day" CHECK (extract(day from "recurring_expenses"."start_month") = 1),
	CONSTRAINT "recurring_version_positive" CHECK ("recurring_expenses"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "recurring_occurrences" (
	"household_id" uuid NOT NULL,
	"recurring_id" uuid NOT NULL,
	"month" date NOT NULL,
	CONSTRAINT "recurring_occurrences_household_id_recurring_id_month_pk" PRIMARY KEY("household_id","recurring_id","month")
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "recurring_id" uuid;--> statement-breakpoint
ALTER TABLE "financial_months" ADD COLUMN "snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_household_id_category_id_categories_household_id_id_fk" FOREIGN KEY ("household_id","category_id") REFERENCES "public"."categories"("household_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_household_id_created_by_household_members_household_id_user_id_fk" FOREIGN KEY ("household_id","created_by") REFERENCES "public"."household_members"("household_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_household_id_recurring_id_recurring_expenses_household_id_id_fk" FOREIGN KEY ("household_id","recurring_id") REFERENCES "public"."recurring_expenses"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_household_id_month_financial_months_household_id_month_fk" FOREIGN KEY ("household_id","month") REFERENCES "public"."financial_months"("household_id","month") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_household_active_idx" ON "recurring_expenses" USING btree ("household_id","active");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_household_id_recurring_id_recurring_expenses_household_id_id_fk" FOREIGN KEY ("household_id","recurring_id") REFERENCES "public"."recurring_expenses"("household_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurring_month_unique" UNIQUE("household_id","recurring_id","month");