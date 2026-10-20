-- Phase 10.1b: members can allow or refuse AI help drafting session reports.
ALTER TYPE "public"."consent_kind" ADD VALUE IF NOT EXISTS 'ai_processing';
