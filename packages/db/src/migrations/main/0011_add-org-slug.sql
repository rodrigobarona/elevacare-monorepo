ALTER TABLE "organizations" ADD COLUMN "slug" text;--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_slug_format" CHECK (slug IS NULL OR (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$' AND slug NOT LIKE '%--%'));