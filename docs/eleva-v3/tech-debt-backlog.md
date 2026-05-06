# Tech-Debt Backlog

Items identified during the 2026-05 code review that were intentionally deferred. Each entry notes severity, category, and suggested timeline.

---

## Security

| #   | Location                                         | Issue                                                                                                                  | Severity | Suggested Sprint                                              |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------- |
| 1   | `packages/auth/src/server.ts`                    | `getWidgetToken` trusts caller-supplied `userId`/`organizationId` without deriving from session                        | Low      | Sprint 5+ (all callers currently pass session-derived values) |
| 2   | `packages/db/src/schema/main/expert-profiles.ts` | RLS policy `expert_profiles_tenant_isolation` lacks platform-admin bypass clause                                       | Medium   | Sprint 6 (requires migration + policy testing)                |
| 3   | `packages/db/src/schema/main/memberships.ts`     | RLS policy blocks bootstrap reads when `eleva.org_id` is unset                                                         | Medium   | Sprint 6 (same RLS migration batch)                           |
| 4   | `packages/db/src/schema/main/organizations.ts`   | RLS policy blocks bootstrap reads                                                                                      | Medium   | Sprint 6 (same RLS migration batch)                           |
| 17  | `apps/api/src/app/accounting/callback/route.ts`  | PKCE `codeVerifier` embedded in URL state param; should use server-side opaque state with Redis-backed ephemeral store | Medium   | Sprint 7+ (requires ephemeral state infra + adapter changes)  |

## Data Integrity

| #   | Location                                                           | Issue                                                                                                                                                                               | Severity | Suggested Sprint                                                             |
| --- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| 5   | `packages/db/src/schema/main/event-types.ts`                       | `scheduleId` FK lacks tenant-awareness (composite FK with `org_id`)                                                                                                                 | Medium   | Sprint 7 (requires careful migration with existing data)                     |
| 6   | `packages/db/src/migrations/main/0003_milky_enchantress.sql`       | Migration drops `connected_calendars` and adds NOT NULL `expert_integration_id` without backfill — already applied to production                                                    | Low      | No action (document only; data issues addressed via forward migrations)      |
| 7   | `packages/db/src/migrations/main/0005_adorable_lily_hollister.sql` | Drops DB-side defaults for array columns without backfilling NULLs — already applied                                                                                                | Low      | No action (same as above)                                                    |
| 8   | `packages/scheduling/src/reserve-slot.ts`                          | Redis lock key `(expertProfileId, startsAtIso)` is per-slot, not per-expert — concurrent holds for different times bypass the lock; DB `checkConflicts` is the correctness boundary | Low      | Not needed (`checkConflicts` DB-level detection is the correctness boundary) |
| 15  | `packages/db/src/schema/main/expert-integrations.ts`               | `calendarBusySources` and `calendarDestinations` FKs reference `expertIntegrations.id` only — add composite FKs with `org_id` (and `expert_profile_id` for destinations)            | Medium   | Sprint 7 (batched with Item #5 composite FK migration)                       |
| 16  | `packages/workflows/src/scheduling/calendar-event-sync.ts`         | `calendarEventCreate` persists only `calendarEventId`; update/delete re-resolves current destination instead of using the original integration/calendar                             | Medium   | Sprint 7 (requires adding columns to `sessions` table)                       |

## DX / Refactoring

| #   | Location                                               | Issue                                                                       | Severity | Suggested Sprint                                               |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------- | -------- | -------------------------------------------------------------- |
| 9   | `packages/calendar/src/adapters/google.ts`             | All errors throw generic `Error` instead of typed `CalendarAdapterError`    | Medium   | Sprint 5 (requires new error type hierarchy + caller updates)  |
| 10  | `apps/app/src/app/expert/calendars/page.tsx`           | `SLUG_LABEL` is a hardcoded 2-entry map instead of manifest-driven          | Low      | Deferred until manifest exports `displayName` at runtime       |
| 11  | `apps/app/src/app/expert/schedule/schedule-editor.tsx` | `rulesToDayMap` silently drops multiple windows per day (reduces to single) | Medium   | Sprint 5 (product feature: multi-window availability)          |
| 12  | `apps/app/src/app/expert/calendars/actions.ts`         | `disconnectCalendarAction` updates local DB but does not revoke at WorkOS   | Low      | Not needed (WorkOS Pipes manages its own revocation lifecycle) |

## Cosmetic / i18n

| #   | Location                                               | Issue                                                                                                      | Severity | Suggested Sprint                                                    |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| 13  | `apps/app/src/app/expert/schedule/schedule-editor.tsx` | UI strings hardcoded without i18n (`next-intl`)                                                            | Low      | Sprint 6 (i18n sweep ticket)                                        |
| 14  | `packages/workflows/src/scheduling/ics-email.ts`       | Dedupe/outbox pattern beyond idempotency key                                                               | Low      | Sprint 7+ (requires outbox infrastructure)                          |
| 18  | `packages/calendar/src/ics-generator.ts`               | `IcsEventInput.timezone` accepted but unused; DTSTART/DTEND use UTC `Z` format instead of TZID + VTIMEZONE | Low      | Sprint 7+ (UTC is correct; VTIMEZONE is display enhancement)        |
| 19  | `apps/web/app/[locale]/[username]/[event]/actions.ts`  | `externalBusyTimes: []` hardcoded — connected calendar busy blocks never filter public slots               | Medium   | Sprint 5+ (requires pre-computed busy-time cache for public funnel) |

---

## Resolution Notes

- Items 2–4 (RLS policies) should be batched into a single migration with comprehensive testing.
- Item 5 (composite FK) requires data analysis to confirm all existing `scheduleId` references are tenant-correct before adding the constraint.
- Items 6–7 are documentation-only; never modify already-applied migrations.
- Item 9 (typed errors) is a prerequisite for better error handling in the calendar UI and monitoring.
- Item 11 (`rulesToDayMap`) resolution plan:
  1. **Data audit**: Query production for experts who have configured multiple availability windows per day in the legacy format.
  2. **Schema migration**: Extend `rules` to support an array of `{ start, end }` windows per day instead of a single pair.
  3. **Editor update**: Replace the single time-range picker per day with a multi-window list (add/remove entries).
  4. **Test cases**: Verify `getAvailableSlots` correctly merges multiple non-overlapping windows, rejects overlapping windows, and maintains backward compatibility with single-window data.
- Items 15–16 (composite FKs + session column additions) should be batched with Item 5 in the Sprint 7 schema migration.
- Item 17 (PKCE server-side state) requires an ephemeral state store (Redis key with TTL) and changes to both the authorization initiation path (in each accounting adapter) and the callback route.
- Item 19 (external busy times) is a feature addition: the public booking funnel is unauthenticated, so external busy times must be pre-computed and cached server-side.
