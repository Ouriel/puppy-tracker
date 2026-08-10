CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"puppy_id" text NOT NULL,
	"type" text NOT NULL,
	"timestamp" text NOT NULL,
	"logged_by" text NOT NULL,
	"potty_location" text,
	"stool_consistency" text,
	"food_type" text,
	"quantity_grams" double precision,
	"quantity_cups" double precision,
	"duration_minutes" integer,
	"weight_kg" double precision,
	"medication_name" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "caretakers" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"color" text NOT NULL,
	"email" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "health_records" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"puppy_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"date" text NOT NULL,
	"booster_date" text,
	"batch_number" text,
	"vet_clinic" text,
	"product_name" text,
	"weight_at_time" double precision,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" text PRIMARY KEY NOT NULL,
	"family_pack_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "households_family_pack_id_unique" UNIQUE("family_pack_id")
);
--> statement-breakpoint
CREATE TABLE "puppies" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"breed" text NOT NULL,
	"birth_date" text NOT NULL,
	"weight_kg" double precision,
	"daily_food_gram_goal" integer DEFAULT 200 NOT NULL,
	"target_meals_per_day" integer DEFAULT 3 NOT NULL,
	"avatar_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
