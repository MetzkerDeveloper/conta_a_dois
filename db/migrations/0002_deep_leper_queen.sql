CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"month" date NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"status" "settlement_status" DEFAULT 'pending' NOT NULL,
	"creation_key" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "settlements_creation_unique" UNIQUE("household_id","creation_key"),
	CONSTRAINT "settlements_amount_range" CHECK ("settlements"."amount_cents" between 1 and 9007199254740991),
	CONSTRAINT "settlements_distinct_members" CHECK ("settlements"."from_user_id" <> "settlements"."to_user_id"),
	CONSTRAINT "settlements_confirmation_consistent" CHECK (("settlements"."status" = 'confirmed') = ("settlements"."confirmed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_household_id_month_financial_months_household_id_month_fk" FOREIGN KEY ("household_id","month") REFERENCES "public"."financial_months"("household_id","month") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_household_id_from_user_id_household_members_household_id_user_id_fk" FOREIGN KEY ("household_id","from_user_id") REFERENCES "public"."household_members"("household_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_household_id_to_user_id_household_members_household_id_user_id_fk" FOREIGN KEY ("household_id","to_user_id") REFERENCES "public"."household_members"("household_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "settlements_household_month_idx" ON "settlements" USING btree ("household_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "settlements_one_pending_month" ON "settlements" USING btree ("household_id","month") WHERE "settlements"."status" = 'pending';