---
name: ""
overview: ""
todos: []
isProject: false
---

# Deep Audit Plan: `src/lib/` and `src/server/`

## Audit Summary

Full scan of 95 files in `src/lib/` and 20 files in `src/server/` against SDK best practices, Agent Skills Reference, and the "no legacy/backward compatibility" mandate.

---

## Findings by Severity

### CRITICAL (5 issues -- must fix)


| #   | File                                 | Issue                                                                                                                                                                                                                                                                           | Fix                                                                                                                                                                                                       |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `src/lib/webhooks/health.ts`         | Entire file references Clerk: `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `/api/webhooks/clerk` endpoint, `provider: 'clerk'` type. The Clerk webhook endpoint does not exist.                                                                                          | Replace Clerk webhook entry with WorkOS webhook (`/api/webhooks/workos`, `WORKOS_WEBHOOK_SECRET`). Remove `'clerk'` from provider union type. Update `getWebhookConfigStatus()` to check WorkOS env vars. |
| C2  | `src/lib/integrations/novu/utils.ts` | 200+ lines of Clerk-specific code: `ClerkUser` interface, `buildNovuSubscriberFromClerk()`, `CLERK_EVENT_TO_WORKFLOW_MAPPINGS` (60+ event mappings), `ClerkEventData` interface, `getWorkflowFromClerkEvent()`. This is dead code -- WorkOS webhooks use different event names. | Delete all Clerk-specific types, functions, and mappings. If any of this code is still called, refactor callers to use WorkOS event names.                                                                |
| C3  | `src/lib/integrations/novu/utils.ts` | `NOVU_API_KEY` legacy fallback at line 26-32. Module-level `console.log` that leaks API key prefixes to stdout on every cold start.                                                                                                                                             | Remove `NOVU_API_KEY` fallback. Remove all module-level `console.log` init logging.                                                                                                                       |
| C4  | `src/server/actions/schedule.ts`     | `saveSchedule` is called from client component (`ScheduleForm.tsx`) but is NOT wrapped with `Sentry.withServerActionInstrumentation`. This is the only unwrapped client-callable server action.                                                                                 | Wrap with `Sentry.withServerActionInstrumentation`.                                                                                                                                                       |
| C5  | `drizzle/schema.ts` + 12 files       | `expertClerkUserId` column in `PaymentTransfersTable` (line ~726) propagates Clerk naming into 12+ files: cron jobs, webhook handlers, API routes, admin UI. This is the last structural Clerk dependency.                                                                      | Rename column to `expertWorkosUserId` with a Drizzle migration. Update all 12+ consuming files.                                                                                                           |


### HIGH (14 issues -- should fix)


| #   | File                                                       | Issue                                                                                                                                                                                                                 | Fix                                                                                       |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| H1  | `src/server/googleCalendar.ts`                             | 24 `console.log/error/warn` calls. No Sentry logger. JSDoc says "OAuth authentication with Clerk" (line 63).                                                                                                          | Replace all with `Sentry.logger`. Update JSDoc.                                           |
| H2  | `src/server/schedulingSettings.ts`                         | 5 `console.log/error` calls. JSDoc says "Clerk user ID" (lines 32, 79, 99). `updateSchedulingSettings` does not invalidate `schedule-${userId}` cache after mutation.                                                 | Replace with `Sentry.logger`. Update JSDoc. Add `invalidateCache()` call.                 |
| H3  | `src/lib/redis/manager.ts`                                 | 30+ `console.log/error/warn` calls. Should use Sentry structured logger for production visibility.                                                                                                                    | Replace with `Sentry.logger`.                                                             |
| H4  | `src/lib/integrations/novu/client.ts` + `email-service.ts` | 60+ combined `console.log/error/warn`. Novu client init, email sending, workflow triggers all log to console.                                                                                                         | Replace with `Sentry.logger`.                                                             |
| H5  | `src/lib/integrations/novu/email.ts`                       | 6 `as any` casts for Resend API types. 2 `console.error` calls.                                                                                                                                                       | Fix types using Resend SDK types. Replace console calls.                                  |
| H6  | `src/lib/integrations/workos/vault.ts`                     | 5 `as any` casts for WorkOS SDK types. 6 `console.log/error`.                                                                                                                                                         | Fix types. Replace console calls.                                                         |
| H7  | `src/lib/integrations/workos/rbac.ts`                      | `const authkitUser = user as any` (line 48).                                                                                                                                                                          | Use proper WorkOS AuthKit type from `@workos-inc/authkit-nextjs`.                         |
| H8  | `src/server/actions/profile.ts`                            | Missing `invalidateCache(['expert-profile-${userId}'])` after `ProfilesTable` update.                                                                                                                                 | Add cache invalidation after mutation.                                                    |
| H9  | `src/server/actions/billing.ts`                            | Missing `invalidateCache(['user-${workosUserId}', 'user-full-${workosUserId}'])` after `handleConnectStripe` updates `UsersTable`. Dead `syncIdentityToConnect` function (confirmed dead code from previous session). | Add cache invalidation. Remove `syncIdentityToConnect` and `p-retry` if unused elsewhere. |
| H10 | `src/server/actions/subscriptions.ts`                      | 9 error handlers use `logger.error` but never call `Sentry.captureException`. Errors are logged but invisible in Sentry issue tracking.                                                                               | Add `Sentry.captureException(error)` alongside `logger.error` in catch blocks.            |
| H11 | `src/server/actions/stripe.ts`                             | Uses `Sentry.startSpan` instead of `withServerActionInstrumentation` for 3 exported functions (`createStripeProduct`, `updateStripeProduct`, `createPaymentIntent`). JSDoc says "Clerk user ID" (lines 30, 146).      | Migrate to `withServerActionInstrumentation`. Update JSDoc.                               |
| H12 | `src/server/actions/meetings.ts`                           | `createMeeting` uses `Sentry.startSpan` instead of `withServerActionInstrumentation`.                                                                                                                                 | Migrate to `withServerActionInstrumentation`.                                             |
| H13 | `src/lib/stripe/price-resolver.ts`                         | 6 `console.log/warn/error` calls.                                                                                                                                                                                     | Replace with `Sentry.logger`.                                                             |
| H14 | `src/lib/utils/server/service-health.ts`                   | Deprecated `checkClerk()` function that delegates to `checkWorkOS()`.                                                                                                                                                 | Delete `checkClerk()`. Check for callers.                                                 |


### MEDIUM (18 issues -- nice to fix)


| #   | File                                            | Issue                                                                                         | Fix                                               |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| M1  | `src/lib/integrations/dub/client.ts`            | 4 `console.warn/log/error`. Env vars read at module load.                                     | Replace with `Sentry.logger`. Consider lazy init. |
| M2  | `src/lib/integrations/qstash/client.ts`         | 25+ `console.log/warn/error`.                                                                 | Replace with `Sentry.logger`.                     |
| M3  | `src/lib/integrations/qstash/schedules.ts`      | Console calls in schedule management.                                                         | Replace with `Sentry.logger`.                     |
| M4  | `src/lib/integrations/betterstack/heartbeat.ts` | 8 `console.warn/log/error`.                                                                   | Replace with `Sentry.logger`.                     |
| M5  | `src/lib/cache/redis-error-boundary.ts`         | 6 `console.error/log`.                                                                        | Replace with `Sentry.logger`.                     |
| M6  | `src/lib/redis/cleanup.ts`                      | 25+ `console.log/error`.                                                                      | Replace with `Sentry.logger`.                     |
| M7  | `src/lib/redis/rate-limiter.ts`                 | 2 `console.error`.                                                                            | Replace with `Sentry.logger`.                     |
| M8  | `src/lib/cron/appointment-utils.ts`             | 2 `console.log/error`.                                                                        | Replace with `Sentry.logger`.                     |
| M9  | `src/lib/notifications/payment.ts` + `core.ts`  | 6 `console.log/error/warn`.                                                                   | Replace with `Sentry.logger`.                     |
| M10 | `src/lib/utils/server/audit.ts`                 | Comment: "orgId is temporarily nullable during Clerk to WorkOS migration". 1 `console.error`. | Update comment. Replace console call.             |
| M11 | `src/lib/utils/customerUtils.ts`                | JSDoc: "The Clerk user ID" (lines 37, 62).                                                    | Update to "WorkOS user ID".                       |
| M12 | `src/lib/i18n/index.ts`                         | Comment: "combined with Clerk authentication middleware".                                     | Update to "WorkOS".                               |
| M13 | `src/lib/integrations/google/calendar.ts`       | JSDoc: "Clerk user" in 4 places.                                                              | Update to "WorkOS user".                          |
| M14 | `src/lib/integrations/stripe/client.ts`         | JSDoc line 641: "The Clerk user ID".                                                          | Update to "WorkOS user ID".                       |
| M15 | `src/server/actions/experts.ts`                 | JSDoc: "Clerk user ID" (lines 26, 122, 187).                                                  | Update to "WorkOS user ID".                       |
| M16 | `src/server/actions/expert-setup.ts`            | JSDoc: "replaces Clerk unsafeMetadata" (lines 4-56).                                          | Update JSDoc.                                     |
| M17 | `src/server/actions/eligibility.ts`             | `checkAnnualEligibility` rethrows without `Sentry.captureException`.                          | Add `Sentry.captureException` before rethrow.     |
| M18 | `src/lib/integrations/novu/index.ts`            | Re-exports Clerk-specific functions from `utils.ts`.                                          | Update after C2 is done.                          |


### LOW (5 issues -- cleanup)


| #   | File                                 | Issue                                                                                                                        | Fix                                                                                 |
| --- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| L1  | `src/lib/README.md`                  | References `clerk-cache.ts`, `clerk-cache-utils.ts`, `clerk-cache-keys.ts`, `integrations/clerk/` -- files that don't exist. | Update README to reflect current architecture.                                      |
| L2  | `src/lib/utils/logger.ts`            | TODO comment: "Sentry integration for production errors" (lines 63-69).                                                      | Implement or remove TODO.                                                           |
| L3  | `src/server/actions/profile.ts`      | `logger.info('Raw input'...)` for every social link -- too verbose for info level.                                           | Change to `logger.debug` or remove.                                                 |
| L4  | `drizzle/schema-clerk-legacy.ts`     | Legacy Clerk schema reference.                                                                                               | **Keep** -- future reference for migrating data from old Clerk DB to new WorkOS DB. |
| L5  | `src/lib/integrations/novu/utils.ts` | `console.log` leaks env var details (key prefix, has-key checks) at module scope on every cold start.                        | Remove or gate behind `NODE_ENV === 'development'`.                                 |


---

## Execution Plan

### Phase 0: Remove Dead Code & Clerk Legacy (C1-C3, C5, L4)

**Estimated effort:** Medium  
**Risk:** Medium (schema migration for C5)


| Step | Action                                                                                                                                                                                                                                              | Files     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 0.1  | ~~Delete `drizzle/schema-clerk-legacy.ts~~` **Skipped** -- kept as migration reference                                                                                                                                                              | --        |
| 0.2  | Rewrite `src/lib/webhooks/health.ts`: Replace Clerk webhook with WorkOS, remove `'clerk'` from types, update `getWebhookConfigStatus()`                                                                                                             | 1 file    |
| 0.3  | Clean `src/lib/integrations/novu/utils.ts`: Delete `ClerkUser`, `buildNovuSubscriberFromClerk`, `CLERK_EVENT_TO_WORKFLOW_MAPPINGS`, `ClerkEventData`, `getWorkflowFromClerkEvent`. Remove `NOVU_API_KEY` fallback and module-level console logging. | 1 file    |
| 0.4  | Update `src/lib/integrations/novu/index.ts`: Remove Clerk re-exports.                                                                                                                                                                               | 1 file    |
| 0.5  | **DB Migration**: Rename `expertClerkUserId` to `expertWorkosUserId` in `PaymentTransfersTable`. Update all 12+ consuming files.                                                                                                                    | 13+ files |
| 0.6  | Delete deprecated `checkClerk()` from `service-health.ts`. Check for callers.                                                                                                                                                                       | 1-3 files |


### Phase 1: Missing Sentry Instrumentation (C4, H11, H12)

**Estimated effort:** Small


| Step | Action                                                                                             | Files         |
| ---- | -------------------------------------------------------------------------------------------------- | ------------- |
| 1.1  | Wrap `saveSchedule` with `withServerActionInstrumentation`                                         | `schedule.ts` |
| 1.2  | Migrate `stripe.ts` from `Sentry.startSpan` to `withServerActionInstrumentation` for 3 functions   | `stripe.ts`   |
| 1.3  | Migrate `meetings.ts` `createMeeting` from `Sentry.startSpan` to `withServerActionInstrumentation` | `meetings.ts` |


### Phase 2: Missing Cache Invalidation (H8, H9)

**Estimated effort:** Small


| Step | Action                                                                                                   | Files                   |
| ---- | -------------------------------------------------------------------------------------------------------- | ----------------------- |
| 2.1  | Add `invalidateCache(['expert-profile-${userId}'])` in `profile.ts` after update                         | `profile.ts`            |
| 2.2  | Add cache invalidation in `billing.ts` after `handleConnectStripe`. Remove dead `syncIdentityToConnect`. | `billing.ts`            |
| 2.3  | Add `invalidateCache(['schedule-${userId}'])` in `schedulingSettings.ts` after update                    | `schedulingSettings.ts` |


### Phase 3: Console-to-Sentry Logger Migration (H1-H6, H13, M1-M9)

**Estimated effort:** Large (150+ console calls across 20+ files)

Priority order (most impactful first):


| Step | Files                                                      | Console calls                        |
| ---- | ---------------------------------------------------------- | ------------------------------------ |
| 3.1  | `src/server/googleCalendar.ts`                             | 24 calls                             |
| 3.2  | `src/lib/redis/manager.ts`                                 | 30 calls                             |
| 3.3  | `src/lib/integrations/novu/client.ts` + `email-service.ts` | 60 calls                             |
| 3.4  | `src/lib/integrations/novu/email.ts`                       | Fix `as any` casts + 2 console calls |
| 3.5  | `src/lib/integrations/qstash/client.ts` + `schedules.ts`   | 25+ calls                            |
| 3.6  | `src/lib/integrations/workos/vault.ts`                     | Fix `as any` casts + 6 console calls |
| 3.7  | `src/lib/integrations/workos/rbac.ts`                      | Fix `as any` cast                    |
| 3.8  | `src/server/schedulingSettings.ts`                         | 5 calls + JSDoc                      |
| 3.9  | `src/lib/stripe/price-resolver.ts`                         | 6 calls                              |
| 3.10 | `src/lib/integrations/dub/client.ts`                       | 4 calls                              |
| 3.11 | `src/lib/integrations/betterstack/heartbeat.ts`            | 8 calls                              |
| 3.12 | `src/lib/cache/redis-error-boundary.ts`                    | 6 calls                              |
| 3.13 | `src/lib/redis/cleanup.ts` + `rate-limiter.ts`             | 27 calls                             |
| 3.14 | `src/lib/cron/appointment-utils.ts`                        | 2 calls                              |
| 3.15 | `src/lib/notifications/payment.ts` + `core.ts`             | 6 calls                              |
| 3.16 | `src/lib/utils/server/audit.ts`                            | 1 call + comment update              |


### Phase 4: Missing Sentry.captureException (H10, M17)

**Estimated effort:** Small


| Step | Action                                                                                | Files              |
| ---- | ------------------------------------------------------------------------------------- | ------------------ |
| 4.1  | Add `Sentry.captureException(error)` in `subscriptions.ts` catch blocks (9 locations) | `subscriptions.ts` |
| 4.2  | Add `Sentry.captureException(error)` in `eligibility.ts` before rethrow               | `eligibility.ts`   |


### Phase 5: JSDoc/Comment Cleanup (M10-M16, L1-L3)

**Estimated effort:** Small


| Step | Action                                                                          | Files     |
| ---- | ------------------------------------------------------------------------------- | --------- |
| 5.1  | Batch find-replace "Clerk user ID" → "WorkOS user ID" in JSDoc across all files | 10+ files |
| 5.2  | Update `src/lib/README.md` to remove Clerk references                           | 1 file    |
| 5.3  | Update `src/lib/i18n/index.ts` comment                                          | 1 file    |
| 5.4  | Update `src/lib/utils/server/audit.ts` comment about migration                  | 1 file    |
| 5.5  | Clean `profile.ts` verbose logging                                              | 1 file    |
| 5.6  | Address `logger.ts` TODO                                                        | 1 file    |


---

## Metrics


| Category                        | Count           |
| ------------------------------- | --------------- |
| **Critical**                    | 5               |
| **High**                        | 14              |
| **Medium**                      | 18              |
| **Low**                         | 5               |
| **Total**                       | **42 findings** |
| Files to modify                 | ~50             |
| `console.*` calls to replace    | ~180            |
| Clerk references to remove      | ~80             |
| `as any` casts to fix           | ~12             |
| Missing cache invalidations     | 3               |
| Missing Sentry instrumentation  | 3 actions       |
| Missing Sentry.captureException | 10 catch blocks |


---

## Dependencies & Risks


| Risk                                                       | Mitigation                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| C5 (schema rename) requires DB migration + 12 file updates | Run migration on staging first. The column rename can use `ALTER TABLE ... RENAME COLUMN`. |
| Phase 3 is large (150+ replacements)                       | Batch by module. Each module can be done independently.                                    |
| Novu utils cleanup (C2) may break webhook handlers         | Grep for all callers of Clerk-specific functions before deleting.                          |
| `p-retry` removal (H9) may affect other consumers          | Verify no other imports exist before removing from `package.json`.                         |


---

## SDK Compliance Check


| Integration       | SDK                          | Status      | Issues                                                                                                              |
| ----------------- | ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| **Stripe**        | `stripe@^17.7.0`             | Good        | Singleton pattern, idempotency keys, Sentry error capture. JSDoc cleanup needed.                                    |
| **WorkOS**        | `@workos-inc/authkit-nextjs` | Good        | Proper `withAuth()`, `authkit()` composable. `as any` in rbac/vault.                                                |
| **Drizzle**       | `drizzle-orm@0.45.1`         | Good        | `$withCache()` on select queries. Missing invalidation on 3 mutations.                                              |
| **Novu**          | `@novu/api`                  | Needs work  | Clerk dead code, console logging, `as any` casts, legacy API key fallback.                                          |
| **Upstash Redis** | `@upstash/redis`             | Good        | Proper error boundary, fallback to in-memory. Console logging.                                                      |
| **QStash**        | `@upstash/qstash`            | Good        | Signature validation, no-op fallback. Console logging.                                                              |
| **Sentry**        | `@sentry/nextjs`             | Mostly good | 3 actions use `startSpan` instead of `withServerActionInstrumentation`. 10 catch blocks missing `captureException`. |
| **Google**        | `googleapis`                 | Good        | Proper OAuth flow. Console logging + Clerk JSDoc.                                                                   |
| **Dub**           | `dub`                        | Good        | Module-level init, console logging.                                                                                 |
| **BetterStack**   | fetch-based                  | Good        | Console logging.                                                                                                    |


