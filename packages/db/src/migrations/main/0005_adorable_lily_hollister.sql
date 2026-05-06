ALTER TABLE "become_partner_applications" ALTER COLUMN "practice_countries" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "become_partner_applications" ALTER COLUMN "languages" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "become_partner_applications" ALTER COLUMN "category_slugs" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "event_types" ALTER COLUMN "languages" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "expert_profiles" ALTER COLUMN "languages" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "expert_profiles" ALTER COLUMN "practice_countries" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "expert_profiles" ALTER COLUMN "session_modes" SET DEFAULT '{"online"}';