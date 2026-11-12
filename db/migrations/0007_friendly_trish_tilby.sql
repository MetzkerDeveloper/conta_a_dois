ALTER TABLE "incomes" ADD COLUMN "extra_entries" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE "incomes" SET "extra_entries" = jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'description', 'Renda extra', 'amountCents', "extra_cents")) WHERE "extra_cents" > 0;
