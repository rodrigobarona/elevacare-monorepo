ALTER TABLE "bookings" RENAME COLUMN "patient_user_id" TO "member_user_id";--> statement-breakpoint
ALTER TABLE "sessions" RENAME COLUMN "patient_user_id" TO "member_user_id";--> statement-breakpoint
ALTER INDEX "bookings_patient_idx" RENAME TO "bookings_member_idx";--> statement-breakpoint
ALTER INDEX "sessions_patient_idx" RENAME TO "sessions_member_idx";--> statement-breakpoint
ALTER TABLE "bookings" RENAME CONSTRAINT "bookings_patient_user_id_users_id_fk" TO "bookings_member_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "sessions" RENAME CONSTRAINT "sessions_patient_user_id_users_id_fk" TO "sessions_member_user_id_users_id_fk";
