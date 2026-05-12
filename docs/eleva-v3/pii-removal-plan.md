# PII Removal: IDs-Only DB Architecture

## Status: Planned (next PR after onboarding routing fix)

## Motivation

WorkOS is our SSO / identity SSOT. Duplicating PII (email, display names) into
the Eleva DB creates unnecessary security surface, GDPR data-subject-request
complexity, and stale-data risk. The WorkOS AuthKit session token already
carries all PII needed at runtime.

## Current State

| Table           | PII columns             | Non-PII columns                              |
| --------------- | ----------------------- | -------------------------------------------- |
| `users`         | `email`, `display_name` | `workos_user_id`, `completed_onboarding`     |
| `organizations` | `display_name`          | `workos_org_id`, `type`                      |
| `memberships`   | (none)                  | `user_id`, `org_id`, `workos_role`, `status` |

## Target State

| Table           | Columns (all non-PII)                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| `users`         | `id`, `workos_user_id`, `completed_onboarding`, `created_at`, `updated_at`, `deleted_at` |
| `organizations` | `id`, `workos_org_id`, `type`, `created_at`, `updated_at`, `deleted_at`                  |
| `memberships`   | unchanged                                                                                |

## Where PII Comes From at Runtime

1. **Current user**: AuthKit session token (`withAuth()` returns `user.email`,
   `user.firstName`, `user.lastName`, `user.profilePictureUrl`).
2. **Other users** (e.g., admin viewing team): WorkOS User Management API
   (`workos.userManagement.getUser(id)`), cached in Redis with short TTL.
3. **Org display name**: WorkOS Organizations API
   (`workos.organizations.getOrganization(id)`), cached similarly.

## Migration Steps

1. **Update `resolveSessionFromWorkosUser`** to accept a `workosUser` param
   (from AuthKit token) for email/displayName instead of reading from DB.
2. **Drop columns** via Drizzle migration:
   - `ALTER TABLE users DROP COLUMN email, DROP COLUMN display_name;`
   - `ALTER TABLE organizations DROP COLUMN display_name;`
   - Drop `users_email_lower_idx` unique index.
3. **Simplify sync functions**: `syncUser` only upserts `workos_user_id` +
   timestamps. `syncOrganization` only upserts `workos_org_id` + `type`.
4. **Add a PII cache layer** (Redis, 5-min TTL): for cases where we need
   another user's name/email (team lists, admin panels).
5. **Update onboarding actions**: stop writing email/displayName to DB.
6. **Update any UI components** that read `session.user.email` /
   `session.user.displayName` — these will now come from the AuthKit session
   object passed through from `withAuth()`.

## Trade-offs

| Concern                  | Mitigation                                                               |
| ------------------------ | ------------------------------------------------------------------------ |
| WorkOS API rate limits   | Redis cache (5-min TTL); current user always from token (zero API calls) |
| Searching users by email | Use WorkOS User Management API `listUsers({ email })`                    |
| Transactional emails     | Read email from session at trigger time, or call WorkOS API              |
| Offline/degraded mode    | Graceful fallback: show "User" if cache miss + API unavailable           |
| GDPR deletion            | Automatic: WorkOS deletion removes all PII; our DB only has opaque IDs   |

## Files to Modify

- `packages/db/src/schema/main/users.ts` — drop email, display_name
- `packages/db/src/schema/main/organizations.ts` — drop display_name
- `packages/auth/src/session.ts` — get PII from WorkOS token param
- `packages/auth/src/types.ts` — ElevaSession.user still has email/displayName but sourced differently
- `packages/auth/src/server.ts` — pass WorkOS user to resolveSessionFromWorkosUser
- `packages/auth/src/sync.ts` — simplify syncUser/syncOrganization
- `apps/app/src/app/onboarding/actions.ts` — stop writing PII
- New: `packages/auth/src/pii-cache.ts` — Redis-backed PII lookup for other users
