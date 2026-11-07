-- Beta is adults only (decision log 2026-11-07). Every booking records an
-- "I am 18 or older and booking for myself" declaration as its own
-- versioned consent row, next to terms, privacy and health data.
ALTER TYPE "consent_kind" ADD VALUE IF NOT EXISTS 'adult_confirmation';
