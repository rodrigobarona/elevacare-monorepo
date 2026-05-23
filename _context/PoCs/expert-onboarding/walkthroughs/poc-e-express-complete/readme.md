# POC E — Express or Complete

Route: `/expert-onboarding/poc-e` · Component: `apps/poc/src/domains/expert-onboarding/components/pocs/poc-e-express-complete.tsx`

## Fork (after modal)

Two cards: **Express (~3 min)** vs **Complete (~15 min)**.

## Express path

Registry: `apps/poc/src/domains/expert-onboarding/lib/registries/poc-e-express-steps.ts`

| Step ID | Goal |
|---------|------|
| `e-specialty` | Specialty grid |
| `e-country` | Country grid |
| `e-express-name` | Workspace name |
| `e-ai-summary` | AI draft summary (read-only) |
| `e-dashboard` | Dashboard checklist |

## Complete path

Delegates to `POC_A_REGISTRY` (same as POC A).

[← Domain hub](../../readme.md)
