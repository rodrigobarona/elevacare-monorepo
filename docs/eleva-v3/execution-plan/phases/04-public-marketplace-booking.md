# Phase 4 — Public marketplace + booking funnel (`apps/web` + API)

| Field      | Value                                                                                                                                                                                                                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-04/public-marketplace-booking` (split: `phase-04.1/public-api-and-explorer`, `phase-04.2/booking-funnel-payment`)                                                                                                                                                                                                      |
| Depends on | Phase 3                                                                                                                                                                                                                                                                                                                       |
| Effort     | 2 weeks                                                                                                                                                                                                                                                                                                                       |
| Touches    | `apps/web/**`, `apps/api/src/app/{public,bookings,payments}/**`, `packages/scheduling/**`, `packages/billing/src/server/{payments,commission}.ts`, `packages/db/src/schema/main/{bookings,booking-payments}.ts`, `packages/api-client/**`, `packages/ui/**` (booking components), `packages/config/src/reserved-usernames.ts` |
| Exit gate  | An unauthenticated visitor finds an expert, picks a slot, pays with a Stripe test card and MB WAY (test), receives a confirmation page and email stub; 100 concurrent reservations of the same slot -> exactly one winner                                                                                                     |

## Why this phase exists

Revenue starts here. The MVP already proves the funnel (`/[locale]/[username]/[eventSlug]`);
v3 must reproduce it on the new scheduling core (`reserveSlot`), Better Auth guest activation, and
Stripe Payment Element with Dynamic Payment Methods, while keeping the public URL shape for the
Phase 14 migration.

## Scope

In:

- `apps/api` public + booking + payment routes (all Zod + OpenAPI + rate limit + BotID on POSTs):
  - `GET /public/experts` (filters: category, language, price range, availability window, sort;
    cursor pagination; cached with `use cache`/`revalidateTag`).
  - `GET /public/experts/[username]` (profile, categories, event types, next 3 available slots).
  - `GET /public/experts/[username]/event-types/[slug]/slots?from&to&tz` (availability engine +
    external busy-time cache from calendar adapters; 5-minute cache).
  - `POST /bookings/reserve` (guest or member; `reserveSlot` 5-minute TTL; returns
    `reservationId`).
  - `POST /payments/intent` (creates PaymentIntent for the reservation: amount from event type
    price, currency EUR, charged on the **platform** account — Stripe "separate charges and
    transfers" funds flow, so **no** `transfer_data` and **no** `application_fee_amount`; the
    platform fee from the `@eleva/billing` commission SSOT is stored in the ledger as
    `booking_payments.application_fee_cents` and the payout engine (Phase 6) later transfers
    `amount - fee` to the expert; `transfer_group = bookingId`, `automatic_payment_methods`,
    metadata `reservationId`, `bookingId`; idempotency key = reservationId). Destination
    charges are rejected because payouts are delayed until eligibility (Phase 6).
  - `POST /bookings/confirm` (called from webhook `payment_intent.succeeded` path and client
    return; converts reservation -> booking `confirmed`; guest -> Better Auth user created with
    `emailVerified=false` + magic link activation; member's personal Space is the buyer org).
  - `POST /bookings/[id]/cancel`, `POST /bookings/[id]/reschedule` with rules from
    `scheduling-booking-spec.md` (notice windows, 100% refund on expert conflict).
- `packages/db`: `bookings` finalize fields (`status` enum, `guest_email`, `buyer_org_id`,
  `expert_org_id`, `event_type_id`, `start_at`, `end_at`, `timezone`, `price_cents`,
  `currency`, `reservation_id`, `cancellation_reason`), `booking_payments` (payment intent id,
  status, amount, fee, transfer group), indexes, RLS for both orgs (expert org and buyer org can
  read).
- `@eleva/scheduling`: `getAvailableSlots()` combining availability rules, date overrides,
  existing bookings, buffers (10 min before default), minimum notice (24h default), slot interval
  (30 min default), booking window (60 days default), timezone conversion; external busy-time
  provider interface fed by `@eleva/calendar`.
- `apps/web`:
  - `/[locale]/experts`, `/[locale]/experts/[category]` explorer (filters, cards, pagination, SEO).
  - `/[locale]/[username]` public profile (experts and clinics share the namespace; reserved
    usernames from `@eleva/config`).
  - `/[locale]/[username]/[eventSlug]` booking funnel: step 1 slot picker (month/week view,
    timezone selector, `Intl` based), step 2 details (name, email, phone optional, consent
    checkboxes: terms, privacy, health-data processing), step 3 payment (Stripe Payment Element,
    Dynamic Payment Methods: card, MB WAY, wallets; Multibanco excluded), step 4 confirmation
    (ICS download, "create your account" CTA using the magic link already sent).
  - Marketing/legal/trust: `/about`, `/become-expert`, `/for-clinics`, `/legal/terms`,
    `/legal/privacy`, `/legal/health-data`, `/trust/security`, `/trust/ers` with ERS-compliant copy
    ported from the MVP MDX (`_context/clone-repo/eleva-care-app/content/**`) — no claims of
    diagnosis, "members" not "patients".
  - SEO: metadata per route, `sitemap.ts`, `robots.ts`, OG images (`opengraph-image.tsx`),
    JSON-LD `Person`/`MedicalBusiness` where accurate, hreflang for `pt/en/es/pt-BR`.
- `@eleva/api-client`: typed calls for all new endpoints; `@eleva/ui`: `SlotPicker`,
  `TimezoneSelect`, `PriceTag`, `ConsentCheckbox`, `BookingSummary`.
- Playwright `e2e/booking.spec.ts` (Stripe test mode with `4242` card).

Out: payouts/transfers (Phase 6), emails beyond stubs (Phase 8), video (Phase 9).

## Deliverables

1. API routes above with OpenAPI registration and `@eleva/api-client` methods.
2. DB migration for bookings/booking_payments; RLS policies and isolation test extension.
3. `@eleva/scheduling` availability engine + tests (DST, timezone edges, buffers, overrides).
4. `apps/web` pages, components, messages for `pt/en/es` (+ `pt-BR` alias decision recorded).
5. Stripe Payment Element integration (client `@stripe/stripe-js` only via `@eleva/billing/client`).
6. Concurrency test: 100 parallel `POST /bookings/reserve` against the same slot -> one 201, rest 409.
7. `e2e/booking.spec.ts`.

## Acceptance criteria

- [ ] Explorer lists seeded experts with working filters and pagination; profile renders in
      `pt/en/es`.
- [ ] Slot picker shows correct slots for an expert in `Europe/Lisbon` viewed from
      `America/Sao_Paulo`, honoring buffers, min notice, overrides and existing bookings.
- [ ] Reserve -> pay (card 4242, MB WAY test) -> confirmation page; `bookings.status = confirmed`,
      `booking_payments.status = succeeded`, `audit_outbox` rows for reserve/confirm.
- [ ] Guest booking creates a Better Auth user with a pending magic link; second booking with the
      same email reuses the user.
- [ ] Concurrency test passes; expired reservations are released by the existing
      `slot-reservation-expiry` workflow.
- [ ] Every POST route has BotID + rate limit; every route registered in OpenAPI; api-client
      typechecks.
- [ ] `check:i18n-parity` green; Lighthouse (mobile) on profile page >= 90 performance on staging.

## Tests

- vitest: availability engine (DST spring-forward/fall-back, overrides, buffers), commission
  application, reserve/confirm state machine, reserve concurrency (existing test extended to HTTP
  level with `undici` against a local server).
- Playwright: `booking.spec.ts` (Stripe test card), explorer filters.

## Docs to update

- `scheduling-booking-spec.md` (final API), `payments-payouts-spec.md` (intent creation, fee at
  charge time), `api-contract-spec.md`, `content-seo-spec.md`, `search-and-discovery-spec.md`,
  `decision-log.md` (`pt-BR` decision).

## Local references

- `packages/scheduling/src/*` (`reserve-slot.ts`, `availability.ts`, `booking-rules.ts`,
  `timezone.ts`), `packages/workflows/src/scheduling/slot-reservation-expiry.ts`.
- `packages/billing/src/server/{commission,connect,client}.ts`, `packages/billing/src/client/**`.
- `packages/db/src/schema/main/{bookings,event-types,schedules,expert-profiles,expert-listings,expert-categories}.ts`.
- `apps/api/src/lib/{rate-limit,bot-protection,openapi,auth}.ts`, existing `experts/*` routes as
  patterns.
- `apps/web/src/app/**`, `apps/web/src/proxy.ts`, `packages/config/src/{routing,reserved-usernames,i18n}.ts`.
- MVP funnel for parity: `_context/clone-repo/eleva-care-app/app/[locale]/(public)/**`,
  `_context/clone-repo/eleva-care-app/components/organisms/forms/MeetingForm.tsx`,
  `_context/clone-repo/eleva-care-app/server/actions/meetings.ts`, ERS content under
  `_context/clone-repo/eleva-care-app/content/**` and `.cursor/rules/ers-content-compliance.mdc`.
- `docs/eleva-v3/{scheduling-booking-spec,payments-payouts-spec,search-and-discovery-spec,content-seo-spec}.md`.

## External docs

- Stripe `/websites/stripe`: Payment Element, Dynamic Payment Methods, MB WAY, Connect "separate
  charges and transfers" funds flow (platform charge, `transfer_group`, later `transfers.create`
  with `source_transaction`), idempotency keys.
- Next.js 16 `/vercel/next.js`: `use cache`, `cacheTag`/`revalidateTag`, `generateMetadata`,
  `sitemap.ts`, `opengraph-image`.
- next-intl v4 `/amannn/next-intl`.
- Vercel BotID `/vercel/botid` (or Vercel docs).
- Temporal/Intl for time zones (MDN) or `date-fns-tz` `/date-fns/date-fns`.

## Risks

- Availability correctness across DST: write tests first with fixed dates.
- Stripe MB WAY availability in test mode: fall back to card in E2E, verify MB WAY manually.

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(/Users/<you>/…/elevacare-monorepo). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc (api-first-agentic, audit-wiring, stripe-webhooks,
   eleva-icons, better-auth) and the matching skills plus .cursor/skills/coderabbit-review/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/04-public-marketplace-booking.md in full.
3. Read every file under "Local references" (including the MVP funnel files under
   _context/clone-repo/eleva-care-app for parity). Pull Stripe (Payment Element, Dynamic Payment
   Methods, Connect separate charges and transfers), Next.js 16 (use cache, metadata, sitemap), next-intl v4
   and BotID docs through Context7
   (resolve-library-id then query-docs); prefer those docs over memory.

Workflow (mandatory):
- git checkout main && git pull --ff-only && git checkout -b phase-04.1/public-api-and-explorer
  (second PR: phase-04.2/booking-funnel-payment). Each under 150 reviewable files.
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build &&
  pnpm check:i18n-parity
- Run: pnpm review -> fix -> repeat. Conventional Commits. pnpm review:branch -> fix.
- git push -u origin <branch> && gh pr create --base main (PR body template README section 8).
- Loop on CodeRabbit GitHub App comments + CI until zero unresolved and all green; request
  approval from @rodrigobarona; gh pr merge --squash --delete-branch.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for pt/en/es, cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 4 TASK — Public marketplace and booking funnel with payment.

PR 04.1 — data, scheduling engine, public API, explorer + profile:
1. packages/db: finalize bookings (id, reservation_id, expert_org_id, buyer_org_id nullable until
   activation, guest_email, guest_name, member_user_id nullable, event_type_id, start_at, end_at,
   timezone, price_cents, currency, status enum reserved|pending_payment|confirmed|cancelled|
   completed|no_show|refunded, cancellation_reason, cancelled_by, created_at, updated_at) and
   booking_payments (id, booking_id, stripe_payment_intent_id unique, stripe_charge_id, status,
   amount_cents, application_fee_cents, transfer_group, payment_method_type, paid_at,
   refunded_cents, created_at). RLS: expert org and buyer org may read; only API (service role via
   withOrgContext of the expert org) writes. Migration + rls-isolation test extension. Extend
   @eleva/audit entity/action unions (booking: reserved|confirmed|cancelled|rescheduled;
   booking_payment: created|succeeded|failed|refunded).
2. @eleva/scheduling: getAvailableSlots({ expertOrgId, eventTypeId, from, to, viewerTz,
   busySources }) merging availability_rules, date_overrides, existing bookings, before/after
   buffers (default 10 min before), minimum notice (default 24h), slot interval (default 30 min),
   booking window (default 60 days) and external busy intervals (interface BusyTimeProvider
   implemented in @eleva/calendar with a 5-minute cache in Upstash Redis). Tests: DST transitions
   (Europe/Lisbon 2026-03-29 and 2026-10-25), override closes a day, buffer prevents adjacent
   slot, viewer in America/Sao_Paulo sees converted times.
3. apps/api routes (Zod bodies/queries, OpenAPI registration, rate limit, requireApiAuth optional
   for public GETs, BotID on all POSTs): GET /public/experts (filters category, language, minPrice,
   maxPrice, availableWithinDays, sort relevance|price|rating; cursor pagination; use cache with
   cacheTag("public-experts") revalidated by profile/event-type mutations), GET /public/experts/
   [username], GET /public/experts/[username]/event-types/[slug]/slots?from&to&tz. Reserved
   usernames from @eleva/config. Update @eleva/api-client.
4. apps/web: /[locale]/experts and /[locale]/experts/[category] (filter sidebar, cards with
   avatar/price/next slot, pagination), /[locale]/[username] profile (bio, categories, languages,
   event types with price/duration, next 3 slots, trust badges), SEO metadata, sitemap.ts,
   robots.ts, opengraph-image.tsx, JSON-LD, hreflang. Messages in pt/en/es (add pt-BR only if the
   team confirms; otherwise alias pt-BR -> pt in @eleva/config routing and record it in
   decision-log.md). Copy: "members", never "patients"; ERS-compliant wording per
   _context/clone-repo/eleva-care-app/.cursor/rules/ers-content-compliance.mdc.

PR 04.2 — funnel + payment + marketing/legal:
5. apps/api: POST /bookings/reserve (guest {email,name} or session; calls reserveSlot with 5-min
   TTL; returns reservationId + expiresAt; 409 on conflict), POST /payments/intent
   ({ reservationId }) creating a Stripe PaymentIntent via @eleva/billing: amount from event type,
   currency EUR, automatic_payment_methods enabled (never hardcode payment_method_types),
   charged on the platform account (separate charges and transfers: NO transfer_data and NO
   application_fee_amount — the payout engine in Phase 6 transfers amount - fee after eligibility),
   platform fee computed by the commission SSOT (packages/billing/src/server/commission.ts — make
   it the single function used everywhere) and stored as booking_payments.application_fee_cents +
   applied_commission_bps, transfer_group = bookingId, metadata { reservationId, bookingId, expertOrgId },
   idempotencyKey = reservationId; POST /bookings/confirm ({ reservationId, paymentIntentId })
   idempotent — verifies intent status with Stripe, converts reservation to confirmed booking,
   creates the guest's Better Auth user if missing (auth.api.signUpEmail is not appropriate for
   passwordless: use magicLink sendMagicLink with a callback to /account/activate) and links the
   booking to the member's personal Space; POST /bookings/[id]/cancel and /reschedule enforcing
   scheduling-booking-spec.md rules (member cancel >= 24h full refund; < 24h per policy; expert
   cancel always 100% refund). Refund execution itself is Phase 6 — here only record the intent
   (booking_payments.status = refund_pending) and emit audit. Also handle
   payment_intent.succeeded / payment_intent.payment_failed in packages/billing/src/server/
   webhook.ts to confirm/fail the booking (two-file contract: also add the events to
   infra/stripe/setup-webhooks.ts and re-run pnpm stripe:setup:webhooks -- --url <url> --apply
   on staging).
6. apps/web /[locale]/[username]/[eventSlug]: 4-step funnel (SlotPicker with month/week view and
   TimezoneSelect; details form with Zod + consent checkboxes for terms, privacy, health-data
   processing; Payment step using Stripe Payment Element from @eleva/billing/client with
   Dynamic Payment Methods; confirmation with ICS download from @eleva/calendar ics-generator and
   CTA to activate the account). Reservation countdown visible; expired -> restart. Components in
   @eleva/ui (SlotPicker, TimezoneSelect, PriceTag, ConsentCheckbox, BookingSummary).
7. Marketing/legal/trust pages: /about, /become-expert, /for-clinics, /legal/terms,
   /legal/privacy, /legal/health-data, /trust/security, /trust/ers, ported from the MVP MDX with
   ERS-compliant copy in pt/en/es. Footer + header navigation in apps/web.
8. Tests: HTTP-level concurrency test (100 parallel reserve calls -> one 201, 99 409) in
   apps/api; state machine tests; e2e/booking.spec.ts with Stripe test card 4242 and a seeded
   expert (extend db:seed:demo if needed).
9. Docs: scheduling-booking-spec.md, payments-payouts-spec.md (fee at charge time), api-contract-
   spec.md, content-seo-spec.md, search-and-discovery-spec.md, decision-log.md.

Acceptance (paste evidence): explorer + profile in pt/en/es; slot correctness tests incl. DST;
reserve -> pay -> confirm flow with DB rows and audit rows; guest user + magic link created;
concurrency test passes; BotID + rate limit on every POST; OpenAPI + api-client updated; i18n
parity green; Lighthouse mobile performance >= 90 on the profile page (staging).

Report: endpoints added, migrations, tests, CodeRabbit CLI counts, PR URLs, Stripe webhook events
added, anything deferred.
```
