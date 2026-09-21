-- Cap OTP guesses on phone_verifications. Incremented outside the
-- confirm transaction so a thrown INVALID_CODE still records the miss.

ALTER TABLE "phone_verifications"
  ADD COLUMN IF NOT EXISTS "attempts" integer NOT NULL DEFAULT 0;
