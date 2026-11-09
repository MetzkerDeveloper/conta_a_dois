CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#286351' NOT NULL,
	CONSTRAINT "categories_household_id_unique" UNIQUE("household_id","id"),
	CONSTRAINT "categories_household_name_unique" UNIQUE("household_id","name")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"month" date NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"due_date" date NOT NULL,
	"category_id" uuid NOT NULL,
	"paid_by_user_id" text,
	"paid_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"creation_key" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_creation_unique" UNIQUE("household_id","creation_key"),
	CONSTRAINT "expenses_amount_range" CHECK ("expenses"."amount_cents" between 1 and 9007199254740991),
	CONSTRAINT "expenses_version_positive" CHECK ("expenses"."version" > 0),
	CONSTRAINT "expenses_payment_consistent" CHECK (("expenses"."paid_by_user_id" is null) = ("expenses"."paid_at" is null))
);
--> statement-breakpoint
CREATE TABLE "financial_months" (
	"household_id" uuid NOT NULL,
	"month" date NOT NULL,
	"split_mode" "split_mode" NOT NULL,
	"higher_share_bps" integer NOT NULL,
	"tiebreak_user_id" text,
	"designated_payer_id" text,
	"transfer_day" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "financial_months_household_id_month_pk" PRIMARY KEY("household_id","month"),
	CONSTRAINT "financial_months_first_day" CHECK (extract(day from "financial_months"."month") = 1),
	CONSTRAINT "financial_months_share_range" CHECK ("financial_months"."higher_share_bps" between 0 and 10000),
	CONSTRAINT "financial_months_transfer_day_range" CHECK ("financial_months"."transfer_day" between 1 and 31)
);
--> statement-breakpoint
CREATE TABLE "incomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"month" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incomes_member_month_unique" UNIQUE("household_id","user_id","month"),
	CONSTRAINT "incomes_amount_range" CHECK ("incomes"."amount_cents" between 0 and 9007199254740991),
	CONSTRAINT "incomes_version_positive" CHECK ("incomes"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_household_id_month_financial_months_household_id_month_fk" FOREIGN KEY ("household_id","month") REFERENCES "public"."financial_months"("household_id","month") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_household_id_category_id_categories_household_id_id_fk" FOREIGN KEY ("household_id","category_id") REFERENCES "public"."categories"("household_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_household_id_paid_by_user_id_household_members_household_id_user_id_fk" FOREIGN KEY ("household_id","paid_by_user_id") REFERENCES "public"."household_members"("household_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_household_id_created_by_household_members_household_id_user_id_fk" FOREIGN KEY ("household_id","created_by") REFERENCES "public"."household_members"("household_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_months" ADD CONSTRAINT "financial_months_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_months" ADD CONSTRAINT "financial_months_household_id_tiebreak_user_id_household_members_household_id_user_id_fk" FOREIGN KEY ("household_id","tiebreak_user_id") REFERENCES "public"."household_members"("household_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_months" ADD CONSTRAINT "financial_months_household_id_designated_payer_id_household_members_household_id_user_id_fk" FOREIGN KEY ("household_id","designated_payer_id") REFERENCES "public"."household_members"("household_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_household_id_month_financial_months_household_id_month_fk" FOREIGN KEY ("household_id","month") REFERENCES "public"."financial_months"("household_id","month") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_household_id_user_id_household_members_household_id_user_id_fk" FOREIGN KEY ("household_id","user_id") REFERENCES "public"."household_members"("household_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_household_month_due_idx" ON "expenses" USING btree ("household_id","month","due_date");--> statement-breakpoint
CREATE INDEX "expenses_household_category_idx" ON "expenses" USING btree ("household_id","category_id");--> statement-breakpoint
CREATE INDEX "incomes_household_month_idx" ON "incomes" USING btree ("household_id","month");
--> statement-breakpoint
-- Categorias para os casais que já existiam antes da camada financeira.
INSERT INTO "categories" ("household_id", "name", "color")
SELECT h.id, c.name, c.color
FROM "households" h
CROSS JOIN (VALUES
  ('Moradia', '#286351'), ('Alimentação', '#88602c'),
  ('Serviços', '#426a88'), ('Transporte', '#685382'),
  ('Saúde', '#8b4855'), ('Lazer', '#607035'), ('Outros', '#657274')
) AS c(name, color)
ON CONFLICT ("household_id", "name") DO NOTHING;
