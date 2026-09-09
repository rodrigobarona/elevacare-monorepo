-- Better Auth 1.7 JWT plugin persists alg/crv on auth.jwks.
ALTER TABLE "auth"."jwks" ADD COLUMN "alg" text;
--> statement-breakpoint
ALTER TABLE "auth"."jwks" ADD COLUMN "crv" text;
