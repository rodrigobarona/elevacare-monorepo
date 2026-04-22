CREATE TABLE IF NOT EXISTS "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workos_user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_user_role" UNIQUE("workos_user_id","role")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_workos_user_id_idx" ON "roles" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");