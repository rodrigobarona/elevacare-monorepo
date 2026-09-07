# Phase 4 — Public marketplace + booking funnel (`apps/web` + API)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-04/public-marketplace-booking` (split: `phase-04.1/public-api-and-explorer`, `phase-04.2/booking-funnel-payment`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Depends on | Phase 3. PR 04.2 also needs the **entry gate** below. Phase 4B may start once PR 04.1 is merged (it consumes the tables and public reads, not the funnel).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Entry gate | Approved before PR 04.2 opens (recorded in `decision-log.md`): terms / privacy / health-data consent texts with version ids (owner: legal + DPO); cookie + CSRF threat model from Phase 2 signed off (D-13); EUR-only launch (D-02); launch payment-method set (D-14); public-site parity dispositions (D-10); `pt-BR` retirement (D-01).                                                                                                                                                                                                                                                                                                                                                                                                     |
| Effort     | 2 weeks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Touches    | `apps/web/**`, `apps/api/src/app/{public,bookings,payments}/**`, `packages/scheduling/**`, `packages/billing/src/server/{payments,commission}.ts`, `packages/workflows/src/domain-events.ts`, `apps/api/src/app/workflows/domain-events-publisher/**`, `packages/db/src/schema/main/{domain-events-outbox,domain-event-deliveries,public-handles,consents}.ts`, `packages/db/src/schema/main/{bookings,booking-payments,slot-reservations}.ts`, `packages/compliance/src/consents.ts`, `packages/billing/src/server/payment-method-policy.ts`, `infra/stripe/setup-payment-methods.ts`, `scripts/check-route-guards.mjs`, `packages/api-client/**`, `packages/ui/**` (booking components), `packages/config/src/{reserved-usernames,i18n}.ts` |
| Exit gate  | An unauthenticated visitor finds an expert, picks a slot, pays with a Stripe test card and MB WAY (test), receives a confirmation page and email stub; 100 concurrent reservations of the same slot -> exactly one winner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

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
  - `GET /public/experts/[username]` (profile, categories, languages, service countries, event
    types with their **delivery modes**, next 3 available slots).
  - `GET /public/experts/[username]/event-types/[slug]` (event type + bookable modes, each with
    `mode`, location summary, price, duration, `country_scope`, `languages`, `label`).
  - `GET /public/experts/[username]/event-types/[slug]/slots?modeId&from&to&tz` (availability
    engine **per delivery mode** + external busy-time cache from calendar adapters; 5-minute cache;
    `modeId` required — a single-mode event type still passes it).
  - `GET /public/booking-links/[token]` + the same slots route with `?linkToken=` — resolve a
    private booking link (`booking_links`, `scheduling-booking-spec.md`): returns the pinned event
    type/mode, price override, and computes slots on the link's schedule override; 404 for
    revoked, expired or exhausted links; never reveals whether a token existed.
  - `POST /bookings/reserve` (guest or member; body carries `eventTypeModeId`, `language`
    (BCP-47), `memberCountry` (ISO 3166-1 alpha-2, pre-filled from the geo header, editable) and
    optional `linkToken`; `assertModeBookable(mode, memberCountry, language)` runs before the
    slot lock and returns 422 `MODE_NOT_AVAILABLE_IN_COUNTRY` / `MODE_LANGUAGE_MISMATCH`;
    `reserveSlot` 5-minute TTL. The Redis lock is a **performance optimisation, not the
    consistency boundary**: the final guarantee of one occupant per slot is a PostgreSQL
    exclusion constraint on `slot_reservations` (`btree_gist`; `EXCLUDE USING gist
(expert_user_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) WHERE (status IN
('reserved', 'converted'))`). Every booking is born from a reservation (`bookings.reservation_id`
    unique) and a confirmed booking keeps its reservation in `converted`, so the constraint covers
    active holds **and** confirmed bookings in one table; expiry and cancellation flip the
    reservation to `expired|released` and it leaves the constraint. **Reschedule keeps the same
    reservation row** (so `bookings.reservation_id`, the `pi:` key and the intent binding never
    move): `POST /bookings/[id]/reschedule` runs one transaction that `SELECT ... FOR UPDATE`s
    the reservation, updates `start_at`/`end_at`/`mode_id` in place and lets the exclusion
    constraint re-check the new window — `23P01` -> 409 `SLOT_TAKEN` and the booking stays on
    its old time; a concurrency test races a reschedule against a fresh `/bookings/reserve` on
    the target window and expects exactly one winner. A `23P01` violation is
    mapped to 409 `SLOT_TAKEN`; the 100-way concurrency test runs twice — with Redis and with the
    lock disabled (`SCHEDULING_DISABLE_REDIS_LOCK=1`, test-only) — and expects one 201 both times.
    The body also carries `consents: [{ kind, version }]` for `terms`, `privacy` and
    `health_data_processing` (all three required by Zod, versions must equal the current
    `CONSENT_DOCUMENTS` versions in `@eleva/compliance`); they are persisted in the reservation
    transaction as `consents` rows (see the `packages/db` bullet) so a paid booking always has a
    durable, versioned consent record before any money moves. Returns
    `reservationId` **and** a `reservationToken` — 32 random bytes returned once to the caller;
    only `sha256(token)` is persisted in a new `slot_reservations.capability_hash` column, next
    to a new nullable `slot_reservations.user_id` set when the caller is signed in. It is the
    capability every later step must present; never logged, never placed in a URL. The existing
    `hold_token` column stays as the Redis lock owner and is **not** exposed to clients. The
    reservation also snapshots the price once — new `slot_reservations.price_cents` +
    `currency` copied from the event type at reserve time — and that snapshot is the **only**
    amount used by the booking row, the PaymentIntent, the fee computation and the confirmation
    checks; an expert changing the event-type price after a reservation never affects it).
  - `POST /payments/intent` (body `{ reservationId, reservationToken }`; the route resolves the
    reservation, requires `sha256(reservationToken) = capability_hash` **and**, when
    `slot_reservations.user_id` is set, the session `userId` to equal it — otherwise 404 (not
    403, to avoid confirming the id exists); one PaymentIntent per reservation (new unique
    nullable `slot_reservations.stripe_payment_intent_id`, Stripe idempotency key =
    `pi:<reservationId>`, so a race returns the same intent). The Stripe call is **never inside a
    database transaction** — it is a two-step, reconcilable sequence: **step 1 (tx A)** creates
    the durable booking identity — a `bookings` row with `status = pending_payment`,
    `reservation_id`, expert org, event type, times, `price_cents`/`currency` copied from the
    reservation snapshot — plus a `booking_payments` row with `status = intent_pending` and
    `stripe_idempotency_key = pi:<reservationId>`, and commits, so `bookingId` exists **before**
    Stripe is called; **step 2** creates the PaymentIntent outside any transaction: amount =
    reservation `price_cents`, currency = reservation `currency` (read from the snapshot, never a
    literal in the Stripe call; **launch is EUR-only** — D-02 — enforced by `CHECK (currency =
'EUR')` on `event_type_modes` and `event_types`, so the snapshot is where a later
    multi-currency decision plugs in without touching the payment path; `POST /bookings/confirm`
    compares the intent against that same snapshot), charged on the
    **platform** account — Stripe
    "separate charges and transfers" funds flow, so **no** `transfer_data` and **no**
    `application_fee_amount`; the platform fee from the `@eleva/billing` commission SSOT is
    stored in the ledger as `booking_payments.application_fee_cents` and the payout engine
    (Phase 6) later transfers `amount - fee` to the expert; `transfer_group = bookingId` (the
    same id the payout engine uses later), `payment_method_configuration = STRIPE_PMC_BOOKING`
    (a Payment Method Configuration owned by `infra/stripe/setup-payment-methods.ts` — the script
    dry-runs by default, creates or updates the configuration with `--apply`, and its first run in
    test mode before PR 04.2 is the check that the platform account has the `mb_way` capability
    active (MB WAY needs a PT-registered account and EUR) and that one configuration can hold
    `card` + `link` + `mb_way` together; if Stripe refuses, D-14 is re-opened before any funnel
    code assumes MB WAY; launch set
    per D-14: `card` incl. Apple Pay / Google Pay, `link`, `mb_way`; **Multibanco, SEPA Direct
    Debit, Klarna and every other delayed-notification method are off** — a reservation hold
    cannot outlive a payment that settles in days; `automatic_payment_methods` stays enabled so
    the configuration, not a hardcoded `payment_method_types` list, decides), metadata
    `reservationId`, `bookingId`, `expertOrgId`. Reservation-hold policy per method class
    (`packages/billing/src/server/payment-method-policy.ts`, tested): `synchronous` (card,
    wallets, Link) — the 5-minute hold is enough; `async_short` (MB WAY — the intent sits in
    `processing` until the member approves in the MB WAY app) — the reservation's `expires_at`
    is extended to `now() + 10 min` when the intent enters `processing`, the expiry sweep **never
    cancels a reservation whose intent is `processing`**, and `payment_intent.payment_failed` /
    `payment_intent.canceled` release the slot; `excluded` — rejected by the configuration.
    **Step 3 (tx B)** writes the intent id to
    `booking_payments` (status `requires_payment`) and
    `slot_reservations.stripe_payment_intent_id`. If step 2 times out or step 3 fails, the row
    stays `intent_pending`; the next call for the same reservation (and the
    `slot-reservation-expiry` sweep) re-issues the **same** idempotency key, so Stripe returns
    the existing intent instead of creating an orphan, and the sweep finalizes or cancels it —
    no PaymentIntent can exist without a `booking_payments` row that owns its idempotency key.
    Pending bookings whose reservation expires are set to `cancelled` by the existing
    `slot-reservation-expiry` workflow (which also cancels a still-cancelable intent).
    Destination charges are rejected because payouts are delayed until eligibility (Phase 6).
  - Confirmation is one domain function, `confirmBookingPayment({ reservationId,
paymentIntentId })` in `@eleva/scheduling`, reached by **two separate entry points that
    never share a route**: (a) the Stripe webhook handler for `payment_intent.succeeded`
    (`/webhooks/stripe`, trusted only after `constructEvent` signature verification, takes ids
    from the event) and (b) the public `POST /bookings/confirm` (client return) whose body is
    `{ reservationId, reservationToken, paymentIntentId }` with `reservationToken` **required
    by the Zod schema** and validated exactly like `/payments/intent` — there is no tokenless
    branch on the public route. The domain function binds the PaymentIntent to the reservation
    before anything else: retrieve it from
    Stripe and require `status = succeeded`, `metadata.reservationId === reservationId`,
    `amount` and `currency` equal to the reservation price, and `stripe_payment_intent_id` not
    already bound to a _different_ reservation (unique) — any mismatch -> 409 `PAYMENT_MISMATCH`,
    audited. Idempotent for the same reservation: webhook and client-return both call the same
    domain function, so a retry whose intent is already bound to this reservation returns the
    existing booking (200, `alreadyConfirmed: true`; first confirmation 201) instead of failing; the bind + status flip runs in one transaction and
    a unique-violation race is caught and resolved by re-reading the existing booking; only then
    moves the pending booking to `confirmed` (and the reservation to `converted`). Guest
    activation is **not** in that transaction: the commit also inserts a
    `domain_events_outbox` row `booking.guest_activation_required` (idempotency key
    `booking:<id>:guest-activation`), and the subscriber creates the Better Auth user with
    `emailVerified=false`, sends the magic-link activation, links the booking to the new
    member's personal Space (buyer org) and, in that same transaction, re-keys the funnel's
    `consents` rows from `guest_email_hash` to `user_id` (idempotent `UPDATE ... WHERE
    guest_email_hash = $h AND user_id IS NULL`) so `GET /me/consents` (Phase 5) returns them —
    with retries — a Better Auth or e-mail outage can never
    leave a paid, confirmed booking without an activation path. Until Phase 8 ships the
    publisher, Phase 4 ships the outbox tables + a minimal QStash-triggered publisher for this one
    event, which Phases 7, 8 and 9 extend with their own event types and subscribers. The outbox
    is **per subscriber from day one**: `domain_events_outbox` holds the event, and
    `domain_event_deliveries` (`event_id`, `subscriber_id`, `status pending|succeeded|failed|dead`,
    `attempts`, `claimed_at`, `completed_at`, `last_error`, unique `(event_id, subscriber_id)`)
    holds one row per registered subscriber; an event is `published_at` only when every required
    subscriber is `succeeded`, and a failing subscriber never blocks or re-runs a healthy one.)
  - `POST /bookings/[id]/cancel`, `POST /bookings/[id]/reschedule` with rules from
    `scheduling-booking-spec.md` (notice windows, 100% refund on expert conflict).
- `packages/db` **offer model** (SSOT: `scheduling-booking-spec.md` sections Event Type, Delivery
  Mode, Private Booking Link, Location, Expert Practice Scope): `expert_profiles` gains
  `practice_country`, `service_countries char(2)[]`, `languages text[]`, `worldwide_remote`,
  `accepting_bookings`; the existing `expert_practice_locations` becomes **the** Location table
  (adds `line2`, `region`, `timezone`, `instructions` jsonb, `active`; the per-event-type
  `event_locations` table is dropped); the existing `schedules` / `availability_rules` /
  `date_overrides` stay as they are (already schedule-parented); `event_types` gains `kind`
  (`clinical|non_clinical`), `visibility` (`public|unlisted|private`) and **loses**
  `schedule_id`, `session_mode`, `worldwide_mode`, `languages`, which move to the new
  `event_type_modes` (`mode online|phone|in_person`, `location_id` -> `expert_practice_locations`,
  `schedule_id`, price/duration
  overrides, `country_scope_type worldwide|list`, `country_scope_codes char(2)[]`, `languages`,
  `label` jsonb, `sort_order`, `active`; CHECK: `in_person <=> location_id not null`); new
  `booking_links` (`token_hash` unique, `event_type_id`, optional `event_type_mode_id`,
  `schedule_id`, `recipient_email`, `price_cents`, `expires_at`, `max_uses`, `use_count`,
  `revoked_at`); `calendar_feed_tokens` (per expert, hashed, revocable); **`public_handles`**
  (`handle citext` PK, `owner_kind expert|clinic`, `owner_id`, `created_at`; backfilled from
  `expert_profiles.username`, reserved names from `@eleva/config` rejected by a trigger) — the
  one namespace every public `/[handle]` URL resolves through, created **here** because Phase 4B
  onboarding writes to it and Phase 11 only adds clinic owners. Localized text columns use the
  `LocalizedText` / `LocalizedRichText` JSONB contracts from `packages/db/src/schema/main/shared.ts`
  (one row, one column, keyed by the `Locale` union — never per-locale rows or suffix columns;
  `event_types.title`, `label`, `instructions` here; rich text arrives with `@eleva/editor` in 4B;
  PR 04.1 deletes the duplicate `LocalizedString` in `expert-categories.ts` that Phase 1 marked and
  repoints its users to `LocalizedText`).
  All tenant tables carry
  `org_id` + RLS + audit unions and declare their **RLS policy class** (Phase 1: `tenant-owned`,
  `dual-organization`, `owner-user-visible`, `participant-visible`, `staff-only`, `public-read`,
  `service-only`) — `bookings` is `dual-organization`, `public_handles` and `expert_profiles`
  public columns are `public-read`. The Phase 4B expert UI edits these tables; Phase 4 ships them with
  a seed (`packages/db/src/seed/offer-fixtures.ts`) that encodes the two reference offers from the
  spec — _Quick chat_ (worldwide, 4 languages, online on schedule A, phone on schedule B limited to
  EU countries) and _Physiotherapy_ (first visit online; follow-up in person at three locations
  with three schedules and two prices) — used by the engine tests, the E2E and the explorer demo.
- `packages/db`: `bookings` finalize fields (`status` enum, `guest_email`, `guest_phone`
  (E.164, required when the mode is `phone`), `buyer_org_id`, `event_type_mode_id` NOT NULL +
  snapshots `mode`, `location_id`, `language`, `member_country`,
  `expert_org_id`, `event_type_id`, `start_at`, `end_at`, `timezone`, `price_cents`,
  `currency`, `expert_user_id` (assigned expert, from the event type's `expert_profiles.user_id`;
  Phase 9 authorizes the join with it), `reservation_id` **unique** — the booking identity is keyed by the reservation,
  so concurrent `/payments/intent` calls converge on one row via `ON CONFLICT DO NOTHING` +
  re-read — `cancellation_reason`), `booking_payments` (unique `booking_id`, payment intent id,
  status, amount, fee, transfer group), `slot_reservations` additions (`capability_hash`,
  nullable `user_id`, nullable unique `stripe_payment_intent_id`, `expert_user_id`, `status`
  gains `converted|released`, the `btree_gist` exclusion constraint described under
  `/bookings/reserve`), **`consents`** (`id`, `subject_kind user|guest`, `user_id` nullable,
  `guest_email_hash` nullable (keyed HMAC), `kind` from `CONSENT_KINDS`, `document_version`,
  `locale`, `source funnel|account|import`, `reservation_id` nullable, `booking_id` nullable,
  `granted_at`, `withdrawn_at` nullable; **no** IP or user agent unless the DPO approves a keyed
  hash in `decision-log.md` — default off; RLS class `owner-user-visible`, staff read for
  DSAR), indexes, RLS for both orgs (expert org and buyer org can read).
- `@eleva/scheduling`: `resolveOffer({ eventTypeModeId, linkToken? })` -> `ResolvedOffer`
  (`{ mode, scheduleId, priceCents, durationMinutes, bookingLinkId? }`; validates the link and
  picks the link's schedule override or the mode's schedule) consumed by both
  `getAvailableSlots(resolved, { from, to, timezone })` and `reserveSlot(resolved, …)` so slots
  and reservations never disagree; slots combine the **resolved** schedule (availability rules,
  date overrides), the expert's existing
  bookings across **all** modes and event types, buffers (10 min before default), minimum notice
  (24h default), slot interval (30 min default), booking window (60 days default), timezone
  conversion under **one canonical time model**: instants are `timestamptz` (UTC), schedule
  rules are local wall-clock times plus an IANA zone on the schedule, conversion happens only at
  the engine boundary, DST gaps and folds have fixed-date tests, and a numeric UTC offset is never
  used to infer a zone; external busy-time provider interface fed by `@eleva/calendar` (every connected
  calendar with `use_for_busy`); `assertModeBookable()` and the offer invariants from the spec
  (every explicit scope list is a non-empty subset of `service_countries` for both kinds,
  worldwide only for `non_clinical` + `worldwide_remote`, in-person scope = location country) as
  pure functions reused by the Phase 4B
  editor validation and by the API.
- `apps/web`:
  - `/[locale]/experts`, `/[locale]/experts/[category]` explorer (filters, cards, pagination, SEO).
  - `/[locale]/[username]` public profile (experts and clinics share the namespace; reserved
    usernames from `@eleva/config`).
  - `/[locale]/[username]/[eventSlug]` booking funnel: step 0 "How do you want to meet?" (mode
    cards — video / phone / each location with map pin and address, price and duration per card;
    language chips; "Where are you?" country select pre-filled from the geo header; cards that are
    not bookable for that country/language are shown disabled with the reason; the step is
    auto-skipped when exactly one mode is bookable), step 1 slot picker (month/week view,
    timezone selector, `Intl` based, slots of the chosen mode), step 2 details (name, email, phone
    — required for phone mode, optional otherwise — consent
    checkboxes: terms, privacy, health-data processing), step 3 payment (Stripe Payment Element,
    Dynamic Payment Methods: card, MB WAY, wallets; Multibanco excluded), step 4 confirmation
    (ICS download with the location address or "video link follows"/"the expert will call
    you" line, "create your account" CTA using the magic link already sent).
  - `/[locale]/book/[token]` private-link funnel: same components, driven by
    `GET /public/booking-links/[token]`; shows the personal note, honours the pinned mode, price
    override and schedule override; works when the agenda is closed.
  - Marketing/legal/trust: `/about`, `/become-expert`, `/for-clinics`, `/legal/terms`,
    `/legal/privacy`, `/legal/health-data`, `/trust/security`, `/trust/ers` with ERS-compliant copy
    ported from the MVP MDX (`_context/clone-repo/eleva-care-app/content/**`) — no claims of
    diagnosis, "members" not "patients".
  - SEO: metadata per route, `sitemap.ts`, `robots.ts`, OG images (`opengraph-image.tsx`),
    JSON-LD `Person`/`MedicalBusiness` where accurate, hreflang for `pt/en/es` + `x-default`.
    **`pt-BR` is retired (D-01)**: `apps/web/src/proxy.ts` answers `/pt-BR/*` with a 301 to
    `/pt/*` (query preserved) so indexed MVP URLs keep working; no `pt-BR` message files; the
    `Locale` union in `@eleva/config` is `pt | en | es`. Public URLs have **one shape**,
    locale-prefixed (`/[locale]/[handle]`, `/[locale]/[handle]/[eventSlug]`); the same proxy
    301s an unprefixed `/[handle]...` to the negotiated default locale (`ELEVA_LOCALE` cookie,
    then `Accept-Language`, then `pt`). `fr` is **not** added now (no content,
    experts, legal pages or reviewer) — adding it later is message files plus a native reviewer,
    not architecture.
  - **Public-site parity (D-10)** — every surface of the live MVP site has a disposition, tested
    by `e2e/legacy-urls.spec.ts` (status code + target for each row):

    | MVP surface                                                   | v3 disposition                                                                                                                                  |
    | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
    | `/{locale}/{username}` and `/{locale}/{username}/{eventSlug}` | **Preserve** — same path shape via `public_handles`; Phase 14 migration test asserts every MVP expert URL resolves                              |
    | `/pt-BR/*`                                                    | **Redirect** 301 → `/pt/*`                                                                                                                      |
    | Health quiz                                                   | **Retire** — 301 to `/{locale}/experts`; not rebuilt in v3 launch scope (Phase 16 candidate if product asks)                                    |
    | Community links                                               | **Preserve as external links** in the footer (no v3 route)                                                                                      |
    | Help Center                                                   | **Replace** → `apps/docs` guides at `/docs/guides/*`; MVP help URLs 301 to the closest guide, else `/docs`                                      |
    | Contact                                                       | **Migrate** → `/{locale}/contact` (Resend-backed form, BotID, rate limited; API route in `apps/api`)                                            |
    | Cookie policy, payment policies, expert agreement             | **Migrate** as versioned legal pages under `/{locale}/legal/*`; their versions are the `CONSENT_DOCUMENTS` versions the funnel records          |
    | Trust and compliance claims                                   | **Rewrite with evidence** — `/trust/*` copy only states what Phase 13 evidence supports (owner, approver, evidence link, review date per claim) |

- `@eleva/api-client`: typed calls for all new endpoints; `@eleva/ui`: `SlotPicker`,
  `TimezoneSelect`, `PriceTag`, `ConsentCheckbox`, `BookingSummary`.
- Playwright `e2e/booking.spec.ts` (Stripe test mode with `4242` card).

Out: payouts/transfers (Phase 6), emails beyond stubs (Phase 8), video (Phase 9).

## Deliverables

1. API routes above with OpenAPI registration and `@eleva/api-client` methods.
2. DB migrations for the offer model (practice scope, locations, schedules, delivery modes,
   booking links, feed tokens), `public_handles`, `consents`, the `slot_reservations` exclusion
   constraint, `domain_events_outbox` + `domain_event_deliveries`, and bookings/booking_payments;
   RLS policies with declared policy classes and isolation test extension; `offer-fixtures.ts` seed.
3. `@eleva/scheduling` availability engine per mode + offer invariants + tests (DST, timezone
   edges, buffers, overrides, cross-mode busy time, country/language gating, link overrides).
4. `apps/web` pages, components, messages for `pt/en/es`; `pt-BR` 301 redirects; parity table
   redirects; `e2e/legacy-urls.spec.ts`.
5. Stripe Payment Element integration (client `@stripe/stripe-js` only via `@eleva/billing/client`);
   `infra/stripe/setup-payment-methods.ts` creating/updating the launch Payment Method
   Configuration (dry-run by default, `-- --apply`); `payment-method-policy.ts` hold rules.
6. Concurrency test: 100 parallel `POST /bookings/reserve` against the same slot -> one 201, rest
   409 — with Redis **and** with the lock disabled (constraint is the boundary).
7. `e2e/booking.spec.ts`.
8. Security moved forward from Phase 13 (review finding 6.2): `pnpm check:route-guards` (every
   `apps/api` route declares auth model, rate-limit class and BotID class; fails CI on a missing
   declaration) and two staging synthetic checks (`/public/experts/.../slots` and a test-mode
   `POST /payments/intent`) alerting to the on-call channel.

## Acceptance criteria

- [ ] Explorer lists seeded experts with working filters and pagination; profile renders in
      `pt/en/es`.
- [ ] Slot picker shows correct slots for an expert in `Europe/Lisbon` viewed from
      `America/Sao_Paulo`, honoring buffers, min notice, overrides and existing bookings.
- [ ] Offer fixtures: _Quick chat_ shows video + phone cards to a visitor in Portugal, only the
      video card to a visitor in Brazil (phone scope = EU), and hides both for a language the
      expert does not offer; phone and video slots come from different schedules; a phone booking
      blocks the overlapping video slot. _Physiotherapy_ follow-up shows three location cards with
      their own prices and schedules; a clinical mode with `worldwide` scope is rejected by the
      invariant test.
- [ ] A private booking link books a slot outside the public schedule for an event type with
      `visibility = private` while the profile has `accepting_bookings = false`; the link is
      exhausted after `max_uses` and a revoked link returns 404.
- [ ] Reserve -> pay (card 4242, MB WAY test) -> confirmation page; `bookings.status = confirmed`,
      `booking_payments.status = succeeded`, `audit_outbox` rows for reserve/confirm.
- [ ] Guest booking creates a Better Auth user with a pending magic link; second booking with the
      same email reuses the user.
- [ ] Concurrency test passes with and without the Redis lock; expired reservations are released
      by the existing `slot-reservation-expiry` workflow; a reservation whose MB WAY intent is
      `processing` is **not** expired by the sweep.
- [ ] Every confirmed booking has three `consents` rows (`terms`, `privacy`,
      `health_data_processing`) with the versions current at reserve time; a reserve body with a
      stale version is rejected 422 `CONSENT_VERSION_OUTDATED`.
- [ ] `/pt-BR/experts` -> 301 `/pt/experts`; every parity-table row passes `e2e/legacy-urls.spec.ts`.
- [ ] `pnpm check:route-guards` is green and wired into CI.
- [ ] Every browser-originated public POST route (`/bookings/reserve`, `/payments/intent`,
      `/bookings/confirm`, cancel/reschedule) has BotID + rate limit; `/webhooks/stripe` has
      **no** BotID and is guarded by signature verification only (BotID would reject Stripe
      deliveries — see Phase 13 exemption classes); every route registered in OpenAPI;
      api-client typechecks.
- [ ] `check:i18n-parity` green; Lighthouse (mobile) on profile page >= 90 performance on staging.

## Tests

- vitest: availability engine (DST spring-forward/fall-back, overrides, buffers), commission
  application, reserve/confirm state machine, reserve concurrency (existing test extended to HTTP
  level with `undici` against a local server).
- Playwright: `booking.spec.ts` (Stripe test card), explorer filters.

## Docs to update

- `scheduling-booking-spec.md` (final API, exclusion constraint, time model),
  `payments-payouts-spec.md` (intent creation, fee at charge time, payment-method policy, EUR-only),
  `api-contract-spec.md`, `content-seo-spec.md` (parity table, hreflang),
  `search-and-discovery-spec.md`, `decision-log.md` (D-01 `pt-BR`, D-02 EUR-only, D-10 parity,
  D-14 payment methods — the entry-gate approvals are recorded there before PR 04.2 opens).

## Local references

- `packages/scheduling/src/*` (`reserve-slot.ts`, `availability.ts`, `booking-rules.ts`,
  `timezone.ts`), `packages/workflows/src/scheduling/slot-reservation-expiry.ts`.
- `packages/billing/src/server/{commission,connect,client}.ts`, `packages/billing/src/client/**`.
- `packages/db/src/schema/main/{bookings,event-types,event-locations,schedules,expert-integrations,expert-profiles,expert-listings,expert-categories}.ts`
  (existing `schedules`/`availability_rules`/`date_overrides`, `expert_practice_locations`,
  `calendar_busy_sources`/`calendar_destinations` are reused by the offer model, not replaced).
- `apps/api/src/lib/{rate-limit,bot-protection,openapi,auth}.ts`, existing `experts/*` routes as
  patterns.
- `apps/web/src/app/**`, `apps/web/src/proxy.ts`, `packages/config/src/{routing,reserved-usernames,i18n}.ts`.
- MVP funnel for parity: `_context/clone-repo/eleva-care-app/app/[locale]/(public)/**`,
  `_context/clone-repo/eleva-care-app/components/organisms/forms/MeetingForm.tsx`,
  `_context/clone-repo/eleva-care-app/server/actions/meetings.ts`, ERS content under
  `_context/clone-repo/eleva-care-app/content/**` and `.cursor/rules/ers-content-compliance.mdc`.
- `docs/eleva-v3/{scheduling-booking-spec,payments-payouts-spec,search-and-discovery-spec,content-seo-spec}.md`.

## External docs

- Stripe `/websites/stripe`: Payment Element, Dynamic Payment Methods, Payment Method
  Configurations (`payment_method_configuration` on the PaymentIntent), MB WAY (asynchronous
  confirmation, `processing` status), Connect "separate charges and transfers" funds flow
  (platform charge, `transfer_group`, later `transfers.create` with `source_transaction`),
  idempotency keys.
- PostgreSQL exclusion constraints with `btree_gist` (`/websites/postgresql`) and Drizzle
  `/drizzle-team/drizzle-orm` for expression indexes / custom SQL in migrations.
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
(the directory containing pnpm-workspace.yaml). Work autonomously and finish the phase end to end.

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

Workflow (mandatory) — this is the outer loop; the "PHASE 4 TASK" section further down is
what you implement at the "Implement the deliverables" step. Read the whole prompt before the
first command; run the checks and both review loops only AFTER the task work exists:
- git checkout main && git pull --ff-only && git checkout -b phase-04.1/public-api-and-explorer
- Second PR (opened after the first merges): phase-04.2/booking-funnel-payment. Each PR: <= 30 files / 400 lines where possible; split above 60 / 800 and always before 100 reviewable files.
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build &&
  pnpm check:i18n-parity
- Run: pnpm review  (CodeRabbit CLI on uncommitted changes) -> fix all findings -> repeat until clean
  or the review cap is reached (README section 4 rule 4: max 3 rounds, zero Critical/Major left,
  remaining Minor/Trivial listed in the PR body "Deferred findings" table with a reason each).
- Commit with Conventional Commits. Run: pnpm review:branch -> fix -> repeat until clean or
  the cap (max 2 rounds, same exit rule).
- git push -u origin HEAD && gh pr create --base main (PR body template README section 8).
- Loop on CodeRabbit GitHub App comments + CI until zero unresolved and all green
  (after 2 App rounds escalate leftovers to the reviewer — README section 4 rule 6); request
  approval from @rodrigobarona; gh pr merge --squash --delete-branch.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for every app's required locales (pt/en/es; apps/admin
pt/en only — decision-log staff-only exception), cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 4 TASK — Public marketplace and booking funnel with payment.

PR 04.1 — data, scheduling engine, public API, explorer + profile:
0. packages/db OFFER MODEL (SSOT docs/eleva-v3/scheduling-booking-spec.md, sections "Event Type",
   "Delivery Mode", "Private Booking Link", "Location", "Expert Practice Scope"; the expert-facing
   editors ship in Phase 4B, this PR ships the tables, invariants, seed and public reads):
   expert_profiles + practice_country char(2) NOT NULL, service_countries char(2)[] NOT NULL
   (CHECK contains practice_country), languages text[] NOT NULL (CHECK cardinality >= 1),
   worldwide_remote bool default false, accepting_bookings bool default true;
   expert_practice_locations (existing, packages/db/src/schema/main/event-locations.ts) is THE
   location table: add line2, region, timezone, instructions jsonb localized, active; DROP the
   per-event-type event_locations table (its rows fold into modes); schedules, availability_rules,
   date_overrides (existing, schedules.ts) are already schedule-parented — only add the partial
   unique index "exactly one is_default per expert"; event_types + kind enum
   clinical|non_clinical NOT NULL, visibility enum public|unlisted|private default public; DROP
   schedule_id, session_mode, worldwide_mode, languages after moving them into event_type_modes
   (data migration: one mode per existing event type from its old columns) — event_type_modes
   (id, org_id, event_type_id, mode enum online|phone|in_person, location_id nullable FK
   expert_practice_locations, schedule_id FK schedules NOT NULL, price_cents nullable,
   currency nullable, duration_minutes nullable, country_scope_type enum worldwide|list,
   country_scope_codes char(2)[] default '{}', languages text[] NOT NULL, label jsonb nullable,
   sort_order int, active bool; CHECK (mode = 'in_person') = (location_id IS NOT NULL); CHECK
   (country_scope_type = 'worldwide' AND cardinality(country_scope_codes) = 0) OR
   (country_scope_type = 'list' AND cardinality(country_scope_codes) >= 1) — an empty explicit
   list is rejected, and offer-invariants tests assert it); every published event type
   must have >= 1 active mode (enforced in @eleva/scheduling publishEventType, Phase 4B calls it);
   booking_links (id, org_id, event_type_id, event_type_mode_id nullable, schedule_id nullable,
   token_hash char(64) unique, recipient_email nullable, price_cents nullable, note, expires_at
   timestamptz NOT NULL (the UI offers 7/30/90 days, default 30 — no never-expiring links),
   max_uses int NOT NULL default 1 CHECK (max_uses >= 1) (no unlimited links; the expert creates
   another link instead), use_count int NOT NULL default 0 CHECK (use_count >= 0), created_by,
   revoked_at); calendar_feed_tokens
   (id, org_id, expert_profile_id, token_hash unique, created_at, revoked_at); public_handles
   (handle citext PK, owner_kind enum expert|clinic, owner_id uuid, created_at; backfill one row
   per expert_profiles.username; trigger rejects RESERVED_USERNAMES from @eleva/config; every
   public /[handle] route resolves through it — Phase 4B onboarding claims handles here and
   Phase 11 adds clinic owners, neither creates the table). Currency: CHECK (currency = 'EUR') on
   event_types and event_type_modes (D-02 EUR-only launch; lift the CHECK, never the snapshot
   design, when multi-currency is approved). Localized columns (title, label, instructions) are
   single jsonb columns typed LocalizedText from packages/db/src/schema/main/shared.ts, keyed by
   the Locale union — never per-locale rows or *_pt/*_en suffix columns; delete the duplicate
   LocalizedString type in expert-categories.ts and repoint its users to LocalizedText. RLS on every table
   by org_id with the policy class declared in the migration header comment and covered by the
   class test suite from Phase 1 (public_handles: public-read; expert_profiles: tenant-owned +
   public-read view); audit unions (expert_location, schedule, event_type_mode, booking_link:
   created|updated|deleted; event_type: published|unpublished; public_handle: claimed|released).
   Seed
   packages/db/src/seed/offer-fixtures.ts with the two reference offers: "Quick chat" (kind
   non_clinical, worldwide_remote expert, 4 languages pt/en/es/fr; mode online worldwide on
   schedule "Online" + mode phone with country_scope_codes = EU list on schedule "Phone") and
   "Physiotherapy" (kind clinical, service_countries [PT, ES]; event type "First visit" with one
   online mode scoped [PT, ES]; event type "Follow-up" with three in_person modes at three
   expert_practice_locations — Lisboa, Porto, Madrid — each on its own schedule, Madrid priced
   higher).
   Tests: invariant functions in @eleva/scheduling (offer-invariants.ts): clinical + worldwide ->
   rejected; clinical or non_clinical explicit scope outside service_countries -> rejected;
   explicit scope with an empty list -> rejected; in_person scope != location country ->
   rejected; non_clinical worldwide without worldwide_remote -> rejected; languages not subset of
   profile languages -> rejected.
1. packages/db: finalize bookings (id, reservation_id UNIQUE — one durable booking identity per
   reservation: tx A of /payments/intent uses INSERT ... ON CONFLICT (reservation_id) DO NOTHING
   and re-reads the winner, so two concurrent calls share one bookingId and the intent's
   metadata.bookingId/transfer_group can only point at that row; booking_payments.booking_id is
   UNIQUE for the same reason; test: two parallel /payments/intent calls for one reservation ->
   one bookings row, one booking_payments row, one intent id — expert_org_id, buyer_org_id
   nullable until activation, expert_user_id FK auth.user NOT NULL — the assigned expert, set at
   reserve time from the event type's owning expert_profiles.user_id; it is the only identity the
   Phase 9 join authorization accepts (never expert_org_id membership) — guest_email, guest_name,
   guest_phone nullable (E.164; required by Zod when the mode is phone), member_user_id nullable,
   event_type_id, event_type_mode_id NOT NULL FK, mode snapshot, location_id snapshot nullable,
   language (BCP-47), member_country char(2), booking_link_id nullable, start_at, end_at,
   timezone, price_cents, currency, status enum reserved|pending_payment|confirmed|cancelled|
   completed|no_show|refunded, cancellation_reason, cancelled_by, created_at, updated_at) and
   booking_payments (id, booking_id, stripe_payment_intent_id unique, stripe_charge_id, status,
   amount_cents, application_fee_cents, transfer_group, payment_method_type, paid_at,
   refunded_cents, created_at); extend slot_reservations with capability_hash (char(64), not
   null), user_id (nullable FK auth.user), stripe_payment_intent_id (nullable, unique),
   expert_user_id NOT NULL, status values converted|released|expired added, and the FINAL slot
   consistency boundary: CREATE EXTENSION IF NOT EXISTS btree_gist; ALTER TABLE slot_reservations
   ADD CONSTRAINT slot_reservations_no_overlap EXCLUDE USING gist (expert_user_id WITH =,
   tstzrange(start_at, end_at, '[)') WITH &&) WHERE (status IN ('reserved', 'converted')).
   reserveSlot maps SQLSTATE 23P01 to BookingError SLOT_TAKEN (409); confirm keeps the
   reservation in converted for the life of the booking; cancel/expiry set released|expired so
   the row leaves the constraint; reschedule UPDATEs start_at/end_at on the SAME reservation row
   under FOR UPDATE so the constraint re-checks the new window (23P01 -> 409 SLOT_TAKEN, booking
   unchanged) and bookings.reservation_id never changes. Redis stays as the fast path only. Also
   create consents (id, subject_kind enum user|guest, user_id nullable FK auth.user,
   guest_email_hash char(64) nullable — HMAC-SHA256 with CONSENT_HASH_KEY, kind from
   CONSENT_KINDS in @eleva/compliance, document_version text, locale, source enum
   funnel|account|import, reservation_id nullable FK, booking_id nullable FK, granted_at,
   withdrawn_at nullable; no ip/user_agent columns unless decision-log records DPO approval).
   @eleva/compliance exports CONSENT_DOCUMENTS = { [kind]: { version, urls: Record<Locale,
   string> } } — the version strings are the legal-approved ids from the entry gate. RLS:
   bookings — expert org and buyer org may read (dual-organization class); consents —
   owner-user-visible + staff read; only API (service role via
   withOrgContext of the expert org) writes. Migration + rls-isolation test extension. Extend
   @eleva/audit entity/action unions (booking: reserved|confirmed|cancelled|rescheduled;
   booking_payment: created|succeeded|failed|refunded; consent: granted|withdrawn).
2. @eleva/scheduling: resolveOffer({ expertOrgId, eventTypeModeId, linkToken? }) -> ResolvedOffer
   { mode, scheduleId (the booking link's schedule_id override when present, else the mode's),
   priceCents, durationMinutes, bookingLinkId? } after validating the link (hash, revoked_at,
   expires_at, use_count < max_uses, recipient lock); getAvailableSlots(resolved, { from, to,
   viewerTz, busySources }) and reserveSlot(resolved, …) both take that object — one resolution
   per request, identical schedule/price/duration for slots and reservation; slots merge
   availability_rules, date_overrides, the expert's existing
   bookings ACROSS ALL modes and event types, before/after buffers (default 10 min before),
   minimum notice (default 24h), slot interval (default 30 min), booking window (default 60 days),
   mode duration override and external busy intervals (interface BusyTimeProvider implemented in
   @eleva/calendar over every enabled calendar_busy_sources row, 5-minute cache in Upstash
   Redis). One time model: instants are UTC timestamptz, schedule rules are local wall-clock +
   the schedule's IANA zone, conversion only at the engine boundary (packages/scheduling/src/
   timezone.ts), DST gap/fold tests on fixed dates, never derive a zone from a numeric offset.
   assertModeBookable(mode, memberCountry, language) -> typed BookingError
   MODE_NOT_AVAILABLE_IN_COUNTRY | MODE_LANGUAGE_MISMATCH | MODE_INACTIVE. Tests: DST transitions
   (Europe/Lisbon 2026-03-29 and 2026-10-25), override closes a day, buffer prevents adjacent
   slot, viewer in America/Sao_Paulo sees converted times; fixtures: Quick-chat phone slots come
   from schedule "Phone" and video slots from "Online"; a confirmed phone booking removes the
   overlapping video slot; visitor country BR -> phone mode not bookable, video bookable; language
   "de" -> both rejected; Physiotherapy follow-up Madrid slots differ from Lisboa slots and carry
   the Madrid price; a link with schedule override yields slots on a day the public schedule
   closes.
3. apps/api routes (Zod bodies/queries, OpenAPI registration, rate limit, requireApiAuth optional
   for public GETs, BotID on every browser-originated public POST — /webhooks/stripe is exempt
   because it is authenticated by Stripe signature verification, see acceptance criteria): GET
   /public/experts (filters category, language, minPrice,
   maxPrice, availableWithinDays, sort relevance|price|rating; cursor pagination; use cache with
   cacheTag("public-experts") revalidated by profile/event-type mutations; language and country
   filters use expert_profiles.languages / service_countries), GET /public/experts/[username]
   (includes languages, service countries and each event type's bookable modes), GET
   /public/experts/[username]/event-types/[slug] (modes with mode, location summary, price,
   duration, country_scope, languages, label), GET /public/experts/[username]/event-types/[slug]/
   slots?modeId&from&to&tz[&linkToken], GET /public/booking-links/[token] (sha256 lookup; 404 for
   unknown, revoked, expired or exhausted — identical body for all four). Reserved usernames from
   @eleva/config. Update @eleva/api-client.
4. apps/web: /[locale]/experts and /[locale]/experts/[category] (filter sidebar incl. language,
   "available in my country" and "video / phone / in person" facets, cards with avatar/price/next
   slot, pagination), /[locale]/[username] profile (bio, categories, languages, countries served,
   event types with price range, duration and mode icons, next 3 slots, trust badges), SEO
   metadata, sitemap.ts,
   robots.ts, opengraph-image.tsx, JSON-LD, hreflang pt/en/es + x-default. Messages in pt/en/es
   only: pt-BR is RETIRED (D-01) — apps/web/src/proxy.ts 301s /pt-BR/* to /pt/* preserving the
   query string, no pt-BR message files, Locale union in @eleva/config = pt | en | es; do not add
   fr. Ship the public-site parity table from this phase file: 301 the MVP health quiz to
   /[locale]/experts, community as external footer links, Help Center URLs to apps/docs guides,
   /[locale]/contact form (API route in apps/api with BotID + rate limit, sends through
   @eleva/notifications when Phase 8 exists, else a Resend stub in packages/notifications),
   legal pages /legal/cookies, /legal/payments, /legal/expert-agreement as versioned documents;
   e2e/legacy-urls.spec.ts asserts status + Location for every row. Copy: "members", never
   "patients"; ERS-compliant wording per
   _context/clone-repo/eleva-care-app/.cursor/rules/ers-content-compliance.mdc.
   Security forward-pull (review 6.2): scripts/check-route-guards.mjs walks apps/api/src/app/**/
   route.ts and fails when a handler lacks the exported ROUTE_POLICY = { auth, rateLimit, botId }
   declaration (add the declaration to every existing route in this PR); wire it as
   pnpm check:route-guards in CI next to check:api-first-actions.

PR 04.2 — funnel + payment + marketing/legal:
5. apps/api: POST /bookings/reserve (guest {email,name,phone?} or session; body also carries
   eventTypeModeId, language, memberCountry and optional linkToken; runs assertModeBookable
   BEFORE the slot lock -> 422 MODE_NOT_AVAILABLE_IN_COUNTRY | MODE_LANGUAGE_MISMATCH; when a
   linkToken is present the link is the credential for the whole private flow. Ordering: (a)
   validate the link read-only (token_hash = sha256(token), revoked_at IS NULL, expires_at >
   now(), use_count < max_uses, recipient match) -> 404 on any failure (same body as a bad
   link, never reveal which check failed); (b) acquire the Redis slot lock (reserveSlot); (c)
   ONLY THEN, inside the single durable reservation transaction that INSERTs slot_reservations,
   claim the use atomically with the conditional `UPDATE booking_links SET use_count =
   use_count + 1 WHERE id = :id AND revoked_at IS NULL AND expires_at > now() AND use_count <
   max_uses AND (recipient_email IS NULL OR recipient_email = :email) RETURNING id` — no row =>
   the transaction rolls back, the slot lock is released and the caller gets 404. The use and the
   reservation therefore commit or fail together: a lost lock race or a DB error never consumes
   a use without a reservation to compensate it. The reservation-expiry sweep and reservation
   cancel decrement use_count for unconfirmed reservations that hold a booking_link_id (never
   below 0); test: lock acquisition fails after link validation -> use_count unchanged;
   /payments/intent and /bookings/confirm re-check revoked_at on the stored booking_link_id and
   reject with 404 when revoked meanwhile; snapshots
   mode, location_id, language, member_country, booking_link_id and the link price override onto
   the reservation/booking; tests: two concurrent reserves on a max_uses=1 link -> exactly one
   201 and one 404; expired unconfirmed reservation releases the use and a later reserve succeeds;
   calls reserveSlot with 5-min
   TTL — the Redis lock is the fast path, the slot_reservations exclusion constraint (PR 04.1)
   is the boundary: a 23P01 inside the reservation transaction -> 409 SLOT_TAKEN, lock released;
   the body REQUIRES consents: [{ kind, version }] for terms, privacy and health_data_processing
   with version === CONSENT_DOCUMENTS[kind].version (else 422 CONSENT_VERSION_OUTDATED) and the
   reservation transaction inserts the three consents rows (subject user or guest_email_hash,
   locale, source funnel, reservation_id); confirm later sets booking_id on them (test: a
   confirmed booking always has its three consent rows; stale version -> 422 and no
   reservation); generates a 32-byte random reservationToken and persists only sha256(token) in a new
   slot_reservations.capability_hash column (migration in @eleva/db; also add nullable user_id set
   from the session when signed in, nullable unique stripe_payment_intent_id, and price_cents +
   currency snapshotted from the event type at reserve time — the single immutable amount for the
   booking row, the PaymentIntent, the fee and the confirmation checks; a later event-type price
   change never touches an existing reservation — test it); returns
   { reservationId, reservationToken, expiresAt }; 409 on conflict; never log the token or place it
   in a URL; the existing hold_token stays internal to the Redis lock and is never returned),
   POST /payments/intent ({ reservationId, reservationToken }) — first authorize:
   sha256(reservationToken) must equal capability_hash AND, if slot_reservations.user_id is set,
   the session userId must equal it; any failure -> 404 (not 403). One intent per reservation via
   the unique stripe_payment_intent_id, so a concurrent duplicate returns the same intent. NEVER
   call Stripe inside a database transaction — use the two-step reconcilable sequence: tx A
   inserts the bookings row with status pending_payment (reservation_id, expert_org_id,
   event_type_id, start_at/end_at, timezone, price_cents, currency copied from the reservation
   snapshot) and a booking_payments row with status intent_pending and stripe_idempotency_key =
   "pi:" + reservationId, then COMMITS so bookingId exists before Stripe is called; step 2 (no
   transaction) creates the Stripe PaymentIntent via @eleva/billing with that idempotency key:
   amount = reservation price_cents,
   currency = reservation currency (read from the snapshot, never a literal; EUR-only at launch is
   enforced by the DB CHECK from PR 04.1, not by this call), automatic_payment_methods enabled
   plus payment_method_configuration = env STRIPE_PMC_BOOKING (never hardcode
   payment_method_types): add infra/stripe/setup-payment-methods.ts (dry-run by default,
   -- --apply) that creates/updates the "eleva-booking" Payment Method Configuration with card
   (Apple Pay, Google Pay), link and mb_way ON and every other method OFF, prints the pmc_ id
   for the env; add packages/billing/src/server/payment-method-policy.ts classifying
   payment_method_type into synchronous (card, link, wallets) | async_short (mb_way) | excluded
   with tests; on payment_intent.processing for an async_short method extend
   slot_reservations.expires_at to now() + 10 min and make the slot-reservation-expiry sweep skip
   reservations whose intent is processing (payment_intent.payment_failed / canceled release
   the slot); test: sweep does not cancel a processing MB WAY reservation, does cancel an idle one;
   charged on the platform account (separate charges and transfers: NO transfer_data and NO
   application_fee_amount — the payout engine in Phase 6 transfers amount - fee after eligibility),
   platform fee computed by the commission SSOT (packages/billing/src/server/commission.ts — make
   it the single function used everywhere) and stored as booking_payments.application_fee_cents +
   applied_commission_bps, transfer_group = bookingId (the pending booking id), metadata
   { reservationId, bookingId, expertOrgId }; tx B persists the intent id in booking_payments
   (status requires_payment) and slot_reservations.stripe_payment_intent_id. If step 2 times out
   or tx B fails the row stays intent_pending and the next call for the same reservation re-sends
   the SAME idempotency key so Stripe returns the existing intent (no orphan); the existing
   slot-reservation-expiry workflow must reconcile intent_pending rows (retrieve by idempotency
   key via a Stripe search on metadata.reservationId; finalize or cancel) and cancel
   pending_payment bookings whose reservation expired (cancelling the intent if still cancelable).
   Tests: Stripe timeout after creation -> retry returns the same intent id and tx B completes;
   tx B failure -> sweep finalizes; no row -> no intent.
   Confirmation: implement confirmBookingPayment({ reservationId, paymentIntentId }) in
   @eleva/scheduling and expose it through TWO entry points that do not share a route: (a) the
   /webhooks/stripe handler for payment_intent.succeeded calls it after constructEvent signature
   verification using ids from the event metadata; (b) public POST /bookings/confirm
   ({ reservationId, reservationToken, paymentIntentId }) with reservationToken REQUIRED in the Zod
   schema (no optional/tokenless branch) and authorized exactly like /payments/intent. The domain
   function retrieves the intent from Stripe and requires status succeeded AND
   metadata.reservationId === reservationId AND amount/currency equal to the reservation price
   AND the intent id not bound to a different reservation (unique index on
   booking_payments.stripe_payment_intent_id); any mismatch -> 409 PAYMENT_MISMATCH (audited) so a
   valid intent cannot be replayed against another reservation. Same-reservation retries are
   idempotent: if booking_payments already holds this intent for this reservationId and the
   booking is confirmed, return it with 200 and `alreadyConfirmed: true` (first confirmation returns
   201; both entry points reach the same function, and Stripe redelivers webhooks). Do the bind + pending_payment -> confirmed flip (and reservation ->
   converted — the booking-link use was already claimed at reserve time, confirm does not
   increment it again) in a single
   transaction; on a unique-violation race (two concurrent confirms for the same
   reservation) catch the constraint error, re-read the booking and return it — never surface the
   constraint error. Status codes (review 6.5): the call that performs the flip returns 201; any
   call that finds the booking already confirmed returns 200 with alreadyConfirmed: true; the
   webhook path returns its own 200 acknowledgement regardless. Test: sequential double confirm
   -> 201 then 200, same bookingId; concurrent double confirm -> exactly one 201 and one 200, one
   booking row; confirm with an intent bound to another reservation ->
   409; POST /bookings/confirm without reservationToken -> 400 from Zod. Guest activation is
   durable, not inline: in the same transaction as the flip insert a domain_events_outbox row
   booking.guest_activation_required (idempotency key booking:<id>:guest-activation). This phase
   OWNS the transactional outbox that Phases 7, 8 and 9 later extend: migrations
   domain_events_outbox (id, type, payload jsonb, idempotency_key unique, created_at,
   published_at nullable) and domain_event_deliveries (event_id FK, subscriber_id text, status
   enum pending|succeeded|failed|dead, attempts int, claimed_at, completed_at, last_error,
   UNIQUE (event_id, subscriber_id)) — one delivery row per subscriber registered for the event
   type, inserted with the event; emitDomainEvent(tx, event) in
   packages/workflows/src/domain-events.ts (typed union of event names + payloads, starting with
   booking.guest_activation_required; INSERT inside the caller's Drizzle transaction, never from
   after() alone), and POST /workflows/domain-events-publisher (QStash Receiver.verify, scheduled
   every minute and kicked best-effort from after() after commit; claims pending deliveries FOR
   UPDATE SKIP LOCKED, runs each subscriber independently, marks the delivery succeeded|failed
   with attempts + last_error, dead-letters a delivery after 10 attempts, and sets the event's
   published_at only when every delivery is succeeded — a failing subscriber never re-runs a
   healthy one; test: two subscribers, one throws -> the other's delivery is succeeded once, the
   failing one retries alone); the subscriber creates the guest's Better Auth user if missing
   (auth.api.signUpEmail is not appropriate for passwordless: use magicLink sendMagicLink with a
   callback to /account/activate), links the booking to the member's personal Space and re-keys
   the guest consents rows (UPDATE consents SET user_id = $userId, subject_kind = 'user' WHERE
   guest_email_hash = $hash AND user_id IS NULL) in the same transaction — idempotent on user
   email + booking id (test: after activation GET /me/consents returns the three funnel rows). Test: subscriber failure -> booking stays confirmed,
   outbox row retried, single user created after 3 attempts. POST /bookings/[id]/cancel and /reschedule enforcing
   scheduling-booking-spec.md rules (member cancel >= 24h full refund; < 24h per policy; expert
   cancel always 100% refund; reschedule = same reservation row re-timed under the exclusion
   constraint, test: reschedule vs concurrent reserve on the target window -> one winner).
   Refund execution itself is Phase 6 — here only record the intent
   (booking_payments.status = refund_pending) and emit audit. Also handle
   payment_intent.succeeded / payment_intent.payment_failed in packages/billing/src/server/
   webhook.ts to confirm/fail the booking (two-file contract: also add the events to
   infra/stripe/setup-webhooks.ts and re-run
   pnpm stripe:setup:webhooks -- --url "https://api.dev.eleva.care/webhooks/stripe" --apply
   against the staging Stripe account; production is re-run in Phase 15).
6. apps/web /[locale]/[username]/[eventSlug]: funnel with a step 0 "How do you want to meet?"
   (ModeCards from @eleva/ui: one card per mode — video, phone, or each location with name, city
   and a static map thumbnail — showing that mode's price and duration; LanguageChips; a "Where
   are you?" CountrySelect pre-filled from the Vercel geo header and always editable; cards that
   fail assertModeBookable for the chosen country/language render disabled with the reason and a
   hint to the alternatives; the step is skipped automatically when exactly one mode is bookable),
   then SlotPicker with month/week view and TimezoneSelect for the chosen mode; details form with
   Zod (phone required for phone mode, E.164 with country prefix from memberCountry) + consent
   checkboxes for terms, privacy and
   health_data_processing (kinds from the @eleva/compliance CONSENT_KINDS const, each checkbox
   linking the versioned legal page from CONSENT_DOCUMENTS; the versions travel in the reserve
   body and land in the consents table created in PR 04.1 — Phase 5 adds the member-facing
   view/withdraw UI on top); Payment step using Stripe Payment Element from @eleva/billing/client with
   Dynamic Payment Methods; confirmation with ICS download from @eleva/calendar ics-generator and
   CTA to activate the account; the confirmation and the ICS carry the location address for
   in_person, "the expert will call <masked phone>" for phone, "video link arrives before the
   session" for online). Reservation countdown visible; expired -> restart. Also
   /[locale]/book/[token]: the same funnel driven by GET /public/booking-links/[token] (pinned
   mode preselected, price override shown as "special price", personal note shown, works with a
   closed agenda). Components in @eleva/ui (ModeCards, LanguageChips, CountrySelect, SlotPicker,
   TimezoneSelect, PriceTag, ConsentCheckbox, BookingSummary) — design them (README section 4 rule
   10): mode cards are the first thing a member sees, they must feel like a choice, not a form.
7. Marketing/legal/trust pages: /about, /become-expert, /for-clinics, /legal/terms,
   /legal/privacy, /legal/health-data, /trust/security, /trust/ers, ported from the MVP MDX with
   ERS-compliant copy in pt/en/es. Footer + header navigation in apps/web.
8. Tests: HTTP-level concurrency test (100 parallel reserve calls -> one 201, 99 409) in
   apps/api, run twice — with Redis and with SCHEDULING_DISABLE_REDIS_LOCK=1 (test-only env,
   refused when NODE_ENV=production) so the exclusion constraint is proven to be the boundary;
   state machine tests; e2e/booking.spec.ts with Stripe test card 4242 and a seeded expert
   (extend db:seed:demo if needed); e2e/legacy-urls.spec.ts for the parity table. Synthetic
   checks: two Vercel cron or Checkly-style probes on staging (slots GET, test-mode
   /payments/intent) posting failures to the on-call channel (@eleva/observability helper).
9. Docs: scheduling-booking-spec.md (exclusion constraint, time model), payments-payouts-spec.md
   (fee at charge time, payment-method policy, EUR-only), api-contract-spec.md,
   content-seo-spec.md (parity table), search-and-discovery-spec.md, decision-log.md (confirm the
   entry-gate entries D-01, D-02, D-10, D-14 exist before opening this PR; add what changed).

Acceptance (paste evidence): explorer + profile in pt/en/es; slot correctness tests incl. DST and
the offer fixtures (mode-specific schedules, cross-mode busy time, country/language gating, link
schedule override); offer invariants rejected in tests; private link books with a closed agenda and
exhausts after max_uses; reserve -> pay -> confirm flow with DB rows, three consents rows and audit
rows; guest user + magic link created; concurrency test passes with and without Redis; pt-BR 301
and parity redirects pass; check:route-guards green; BotID + rate limit on every POST; OpenAPI +
api-client updated; i18n parity green; Lighthouse mobile performance >= 90 on the profile page
(staging).

Report: endpoints added, migrations, tests, CodeRabbit CLI counts, PR URLs, Stripe webhook events
added, anything deferred.
```
