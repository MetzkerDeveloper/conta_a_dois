CREATE TABLE "income_defaults" (
	"household_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"effective_month" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	CONSTRAINT "income_defaults_household_id_user_id_effective_month_pk" PRIMARY KEY("household_id","user_id","effective_month"),
	CONSTRAINT "income_defaults_amount_range" CHECK ("income_defaults"."amount_cents" between 0 and 9007199254740991)
);
--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "extra_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "income_defaults" ADD CONSTRAINT "income_defaults_household_id_user_id_household_members_household_id_user_id_fk" FOREIGN KEY ("household_id","user_id") REFERENCES "public"."household_members"("household_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_extra_range" CHECK ("incomes"."extra_cents" between 0 and "incomes"."amount_cents");
--> statement-breakpoint
INSERT INTO "income_defaults" ("household_id", "user_id", "effective_month", "amount_cents")
SELECT DISTINCT ON ("household_id", "user_id") "household_id", "user_id", "month", "amount_cents"
FROM "incomes" ORDER BY "household_id", "user_id", "month" DESC;
