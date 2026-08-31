ALTER TABLE "activities" ALTER COLUMN "timestamp" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activities" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activities" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "caretakers" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "caretakers" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "health_records" ALTER COLUMN "date" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "health_records" ALTER COLUMN "booster_date" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "health_records" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "health_records" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "households" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "households" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "puppies" ALTER COLUMN "birth_date" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "puppies" ALTER COLUMN "weight_kg" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "puppies" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "puppies" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "puppies" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "puppies" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "puppies" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "puppies" ADD COLUMN "expected_adult_weight_kg" double precision;--> statement-breakpoint
CREATE INDEX "idx_activities_tenant_pup_time" ON "activities" USING btree ("household_id","puppy_id","timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_caretakers_household" ON "caretakers" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_health_records_tenant_pup_date" ON "health_records" USING btree ("household_id","puppy_id","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_puppies_household" ON "puppies" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "idx_users_household" ON "users" USING btree ("household_id");