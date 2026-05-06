# Tech-Debt Backlog

Items identified during the 2026-05 code review that were intentionally deferred. Each entry notes severity, category, and suggested timeline.

---

## Security

| #   | Location                                         | Issue                                                                                           | Severity | Suggested Sprint                                              |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------- |
| 1   | `packages/auth/src/server.ts`                    | `getWidgetToken` trusts caller-supplied `userId`/`organizationId` without deriving from session | Low      | Sprint 5+ (all callers currently pass session-derived values) |
| 2   | `packages/db/src/schema/main/expert-profiles.ts` | RLS policy `expert_profiles_tenant_isolation` lacks platform-admin bypass clause                | Medium   | Sprint 6 (requires migration + policy testing)                |
| 3   | `packages/db/src/schema/main/memberships.ts`     | RLS policy blocks bootstrap reads when `eleva.org_id` is unset                                  | Medium   | Sprint 6 (same RLS migration batch)                           |
| 4   | `packages/db/src/schema/main/organizations.ts`   | RLS policy blocks bootstrap reads                                                               | Medium   | Sprint 6 (same RLS migration batch)                           |

## Data Integrity

| #   | Location                                                           | Issue                                                                                                                            | Severity | Suggested Sprint                                                             |
| --- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| 5   | `packages/db/src/schema/main/event-types.ts`                       | `scheduleId` FK lacks tenant-awareness (composite FK with `org_id`)                                                              | Medium   | Sprint 7 (requires careful migration with existing data)                     |
| 6   | `packages/db/src/migrations/main/0003_milky_enchantress.sql`       | Migration drops `connected_calendars` and adds NOT NULL `expert_integration_id` without backfill — already applied to production | Low      | No action (document only; data issues addressed via forward migrations)      |
| 7   | `packages/db/src/migrations/main/0005_adorable_lily_hollister.sql` | Drops DB-side defaults for array columns without backfilling NULLs — already applied                                             | Low      | No action (same as above)                                                    |
| 8   | `packages/scheduling/src/reserve-slot.ts`                          | Redis lock key uses only `(expertProfileId, startsAtIso)` — overlapping holds with different times bypass lock layer             | Low      | Not needed (`checkConflicts` DB-level detection is the correctness boundary) |

## DX / Refactoring

| #   | Location                                               | Issue                                                                       | Severity | Suggested Sprint                                               |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------- | -------- | -------------------------------------------------------------- |
| 9   | `packages/calendar/src/adapters/google.ts`             | All errors throw generic `Error` instead of typed `CalendarAdapterError`    | Medium   | Sprint 5 (requires new error type hierarchy + caller updates)  |
| 10  | `apps/app/src/app/expert/calendars/page.tsx`           | `SLUG_LABEL` is a hardcoded 2-entry map instead of manifest-driven          | Low      | Deferred until manifest exports `displayName` at runtime       |
| 11  | `apps/app/src/app/expert/schedule/schedule-editor.tsx` | `rulesToDayMap` silently drops multiple windows per day (reduces to single) | Medium   | Sprint 5 (product feature: multi-window availability)          |
| 12  | `apps/app/src/app/expert/calendars/actions.ts`         | `disconnectCalendarAction` updates local DB but does not revoke at WorkOS   | Low      | Not needed (WorkOS Pipes manages its own revocation lifecycle) |

## Cosmetic / i18n

| #   | Location                                               | Issue                                           | Severity | Suggested Sprint                           |
| --- | ------------------------------------------------------ | ----------------------------------------------- | -------- | ------------------------------------------ |
| 13  | `apps/app/src/app/expert/schedule/schedule-editor.tsx` | UI strings hardcoded without i18n (`next-intl`) | Low      | Sprint 6 (i18n sweep ticket)               |
| 14  | `packages/workflows/src/scheduling/ics-email.ts`       | Dedupe/outbox pattern beyond idempotency key    | Low      | Sprint 7+ (requires outbox infrastructure) |

---

## Resolution Notes

- Items 2–4 (RLS policies) should be batched into a single migration with comprehensive testing.
- Item 5 (composite FK) requires data analysis to confirm all existing `scheduleId` references are tenant-correct before adding the constraint.
- Items 6–7 are documentation-only; never modify already-applied migrations.
- Item 9 (typed errors) is a prerequisite for better error handling in the calendar UI and monitoring.
