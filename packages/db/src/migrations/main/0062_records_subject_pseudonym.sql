-- Phase 10.1d AUD-030: expert-authored records about a deleted member keep
-- an HMAC tombstone instead of the member id (clinical retention exception).
ALTER TABLE "records" ADD COLUMN IF NOT EXISTS "subject_pseudonym" bytea;
