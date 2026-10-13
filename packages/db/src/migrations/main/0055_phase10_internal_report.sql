-- Expert-only unpublished session report (notes / suggestions / recommendations).
-- Distinct from published `report` (Phase 10.2 member-visible).
-- IF NOT EXISTS covers DBs that already applied 0054 without this value.

ALTER TYPE "record_kind" ADD VALUE IF NOT EXISTS 'internal_report';
