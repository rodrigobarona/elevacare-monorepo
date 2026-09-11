# Eleva.care v3 API Contract Spec

Status: Living

## Purpose

This document defines how Eleva.care v3 should think about API boundaries and shared contracts across:

- `apps/web`
- `apps/app`
- `apps/api`
- `apps/diary-mobile`
- future jobs/workflows

The goal is to keep the system contract-driven even while the product starts as a monorepo with shared packages.

## API Principles

- The domain model is the source of truth; APIs expose that model safely.
- Contracts should be typed, versionable, and reusable across web and mobile.
- Public API surfaces should be narrower than internal package boundaries.
- Sensitive data access must be authorized before serialization, not after.
- Prefer stable DTOs over leaking raw ORM/database structures.

## API Surface Types

### Internal app-to-package contracts

These are not HTTP APIs.
They are shared TypeScript/domain contracts used inside the monorepo.

Examples:

- validation schemas
- service input/output types
- workflow payload types

### First-party product APIs

These are APIs used by Eleva-owned clients such as:

- authenticated web product
- public web flows where needed
- mobile app

Examples:

- booking creation
- dashboard data
- diary sync and sharing
- expert CRM actions

### External integration APIs

These are system-facing endpoints such as:

- Stripe webhooks
- Daily webhook intake
- inbound messaging hooks
- partner/admin integrations later

## Auth (Better Auth)

Human sessions are cookies on `.eleva.care`. Agents use exactly one of:

| Mode           | Header / cookie                                                     | Verifier                                    |
| -------------- | ------------------------------------------------------------------- | ------------------------------------------- |
| Session cookie | `better-auth.session_token` or `__Secure-better-auth.session_token` | Better Auth `getSession`; CSRF on mutations |
| Opaque bearer  | `Authorization: Bearer <session token>`                             | Better Auth session (not JWT)               |
| JWT            | `Authorization: Bearer` compact JWS with `kid`                      | JWKS EdDSA, 15m, non-revocable              |
| API key        | `x-api-key` only                                                    | apiKey plugin                               |

More than one source → `400 AMBIGUOUS_CREDENTIALS`. Duplicate session cookies →
`401 SESSION_COOKIE_AMBIGUOUS`. Cookie mutation with an untrusted origin →
`403 CSRF_ORIGIN_MISMATCH`. Typed client: `@eleva/api-client` (`auth.getSession`,
`organizations.setActive`). OpenAPI merges Better Auth paths under `/auth`.

## Recommended Contract Layers

### Domain layer

Defines:

- entities
- policies
- service contracts

### Transport layer

Defines:

- request DTOs
- response DTOs
- webhook payload normalization
- mobile-safe payloads

### UI consumption layer

Defines:

- query shapes
- pagination/filter contracts
- mutation result contracts

## Boundary Rules

- Apps should not depend on raw database rows.
- Mobile should not depend on web-only component assumptions.
- Public endpoints should never expose internal admin/system fields by accident.
- Webhook endpoints should normalize provider payloads into internal event contracts quickly.

## Contract Ownership

Recommended package ownership:

- `packages/db`: persistence schema only
- `packages/auth`: auth/session claims and access helpers
- `packages/scheduling`: booking/schedule contracts
- `packages/billing`: billing/payout contracts
- `packages/crm`: CRM-oriented contracts
- `packages/mobile`: mobile-safe DTOs and sync payloads
- `packages/notifications`: notification event payloads
- `packages/ai`: AI generation and review payloads

## API Style Direction

The exact transport can evolve, but the system should behave as if it has a formal API contract layer even when some calls stay in-process.

This means:

- explicit input schemas
- explicit output schemas
- stable resource naming
- stable mutation semantics
- documented error shapes

## Contract Categories To Define

The team should explicitly define contracts for:

- auth/session bootstrap
- organization/workspace selection
- expert profile and listing data
- search and discovery queries
- scheduling and slot availability
- booking creation/update/cancel
- packs and subscriptions
- patient dashboard data
- CRM views and follow-up actions
- diary sync/share flows
- transcript/report flows
- admin/operator actions

## Phase 04 public booking contracts (2026-09-10)

SSOT remains OpenAPI at `GET /openapi.json` and Zod in `@eleva/api-client`. Shipped public HTTP:

| Method | Path                                                  | Auth                                     | Notes                                                                                                                                                                                                                                         |
| ------ | ----------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/public/experts`                                     | public                                   | Marketplace list                                                                                                                                                                                                                              |
| GET    | `/public/experts/{username}`                          | public                                   | Profile + published event types                                                                                                                                                                                                               |
| GET    | `/public/experts/{username}/event-types/{slug}`       | public                                   | Offer                                                                                                                                                                                                                                         |
| GET    | `/public/experts/{username}/event-types/{slug}/slots` | public                                   | Availability; range capped                                                                                                                                                                                                                    |
| GET    | `/public/booking-links/{token}`                       | public                                   | Private invite; 404 on any validation failure                                                                                                                                                                                                 |
| POST   | `/bookings/reserve`                                   | public + BotID (non-bearer) + rate limit | Guest or session; consents required. BotID runs only for non-bearer callers. Private-link bookings must send `linkToken`; the server validates hash, expiry, revocation, `max_uses`, and recipient, and returns the same `404` on any failure |
| POST   | `/payments/intent`                                    | public + BotID (non-bearer) + rate limit | `{ reservationId, reservationToken }`. BotID runs only for non-bearer callers. After reserve, `reservationToken` is the only client credential. A revoked stored `booking_link_id` returns `404`                                              |
| POST   | `/bookings/confirm`                                   | public + BotID (non-bearer) + rate limit | `{ reservationId, reservationToken, paymentIntentId }`. BotID runs only for non-bearer callers. `reservationToken` required (Zod `400`). Same stored-link revocation `404` as intent                                                          |
| POST   | `/webhooks/stripe`                                    | Stripe signature                         | `payment_intent.succeeded` / `payment_intent.payment_failed`                                                                                                                                                                                  |

`ROUTE_POLICY` is declared on every `apps/api` handler (`pnpm check:route-guards`). Member cancel/reschedule HTTP shipped in Phase 5 (`POST /me/bookings/{id}/cancel` and `POST /me/bookings/{id}/reschedule`). Phase 6 executes Stripe refunds for `refund_pending` payments.

## Phase 05 member contracts (2026-09-11)

SSOT remains OpenAPI at `GET /openapi.json` and Zod in `@eleva/api-client`. Session cookie or Bearer. `RATE_LIMITS.authenticated` on `/me` and `/privacy`. Never weaken `RATE_LIMITS.public` (10/min). BotID is not used on these authenticated member routes. Consent, notification, cancellation, rescheduling, DSAR, and account-deletion mutations write audit records through `withAudit`.

| Method | Path                                | Auth                       | Notes                                                                                                                                                                         |
| ------ | ----------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/me`                               | session / bearer           | Profile (name, email, timezone, locale, avatarUrl) plus `notification_preferences` rows                                                                                       |
| PATCH  | `/me`                               | session / bearer           | Name, timezone, locale, avatarUrl. Avatar bytes stay on `PUT /users/avatar` (public Blob)                                                                                     |
| GET    | `/me/bookings`                      | session / bearer           | `range` upcoming or past, cursor. Reads via `withOrgContext(session.orgId)` + `member_user_id`. Expert/event joins run in the expert org                                      |
| GET    | `/me/payments`                      | session / bearer           | Joins `booking_payments`. `receipt_url` from cache or `@eleva/billing` Charge retrieve, then cached                                                                           |
| PUT    | `/me/notification-preferences`      | session / bearer           | Channel × category matrix, optional quiet hours + timezone                                                                                                                    |
| GET    | `/me/consents`                      | session / bearer           | Every kind with version, `granted_at`, `withdrawn_at`                                                                                                                         |
| PUT    | `/me/consents`                      | session / bearer           | Marketing withdraws immediately. `health_data_processing` → **409** while a confirmed future booking exists                                                                   |
| POST   | `/me/bookings/{id}/cancel`          | session / bearer           | ≥ 24h before `starts_at` (`MEMBER_CANCEL_MIN_HOURS`). Status `cancelled`, slot released, succeeded payment → `refund_pending` (Phase 6 executes the refund)                   |
| POST   | `/me/bookings/{id}/reschedule`      | session / bearer           | ≥ 24h. Body `{ startsAt, endsAt }`. Moves times, releases the old slot, ICS via existing helpers                                                                              |
| POST   | `/privacy/dsar`                     | session / bearer           | Creates `dsar_requests` (`pending`). Kickoff via `after()` + QStash (inline on localhost). Phase 5 working path (D-17); ADR-007 Vercel Workflows remains the long-term target |
| GET    | `/privacy/dsar/{id}`                | session / bearer           | Status. `downloadUrl` only when `ready` and the 24h HMAC link has not expired                                                                                                 |
| GET    | `/privacy/dsar/{id}/file`           | HMAC query (`exp` + `sig`) | Streams the private-Blob zip. Public rate limit. 404 if expired, not ready, or signature invalid                                                                              |
| POST   | `/privacy/delete-account`           | session / bearer           | 14-day grace. Marks `deletion_scheduled_at`. Future bookings cancelled; succeeded payments `refund_pending`. No Stripe refund here                                            |
| POST   | `/privacy/cancel-deletion`          | session / bearer           | Clears the flag so the member can book again                                                                                                                                  |
| POST   | `/workflows/dsar-export`            | QStash / drain secret      | Runs `@eleva/compliance` `dsarExport` onto **private** Blob                                                                                                                   |
| POST   | `/workflows/account-deletion-sweep` | QStash / drain secret      | Hourly. Erases account-scope consents; pseudonymises booking-scope consents (D-12)                                                                                            |

Error shape stays `{ error, issues?, message? }`. Policy conflicts use **409** (`POLICY_TOO_LATE`, `INVALID_STATUS`, `SLOT_TAKEN`, `HEALTH_DATA_CONSENT_IN_USE`, `ACCOUNT_DELETION_ALREADY_SCHEDULED`, `ACCOUNT_DELETION_SCHEDULED`).

## Error Model

The platform should standardize:

- validation errors
- authentication errors
- authorization errors
- conflict errors
- integration failure responses
- retryable workflow errors

Do not let each route invent its own shape casually.

## Pagination And Filtering

Search/list APIs should support explicit:

- pagination
- sort
- filter params
- stable cursors or page semantics

This is especially important for:

- marketplace discovery
- CRM lists
- admin queues
- notifications

## Mobile Considerations

The mobile API contract should be:

- explicit
- minimal
- offline-aware where needed later
- not tightly coupled to web navigation or server component assumptions

## Security Considerations

- authorize before serialization
- minimize fields by audience
- do not expose sensitive content in debug/error payloads
- validate all inbound provider webhooks separately from internal action calls

## Open Questions

- exact transport style for first-party APIs
- how much of the contract layer is package-only versus HTTP-first
- first pass of versioning policy for mobile-sensitive endpoints

## Related Docs

- [`domain-model.md`](./domain-model.md)
- [`identity-rbac-spec.md`](./identity-rbac-spec.md)
- [`mobile-integration-spec.md`](./mobile-integration-spec.md)
- [`workflow-orchestration-spec.md`](./workflow-orchestration-spec.md)
- [`compliance-data-governance.md`](./compliance-data-governance.md)
- [`notifications-spec.md`](./notifications-spec.md)
