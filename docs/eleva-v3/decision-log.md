# Eleva.care v3 Decision Log

Status: Living

## Purpose

This document is the lightweight companion to the ADR system.

Use it to track:

- notable decisions that do not yet justify a full ADR
- temporary decisions that need later confirmation
- decision status changes that should stay visible to the team

## How To Use This Log

Each entry should include:

- date
- decision summary
- owner
- status
- related docs or ADRs
- next review date if the decision is provisional

## Status Values

- `proposed`
- `active`
- `needs-review`
- `superseded`

## Current Entries

### 2026-10-31: Home editorial refresh on staging (active)

- Decision: rework `MarketingHome` around photography, taking structure (not
  artwork or copy) from a Dribbble concept. Hero gets two linked tiles
  (desktop only), trust points become a slim bar, a board of advisors section
  follows the hero, and specialty pills sit above the care cards.
- Advisors stand in for live experts because staging only has fixtures without
  photos. They are labelled as advisors and link to `/about#advisors`; they are
  not presented as bookable.
- Polish pass: scroll reveals (CSS only, off for reduced motion), an advisor
  quote band, and the hero video on `lg` and up only, so phones get the poster.
  Fraunces is now preloaded to stop the hero shifting on font swap.
- Out of scope, follow-ups: live expert cards once real profiles with photos
  exist; member testimonials (no data, needs consent and legal review).
  Founder has not yet signed this off for production.
- Owner: founder + engineering.
- Status: `active`.
- Related: [`brand-book/art-direction.md`](./brand-book/art-direction.md),
  [`brand-book/messaging-framework.md`](./brand-book/messaging-framework.md).

### 2026-10-31: Cloudflare R2 replaces Vercel Blob (active)

- Decision (founder, 2026-10-31): R2 is the only object store, because the production Vercel team
  (Enterprise) has no Blob. Two EU jurisdiction buckets with separate credentials. Full record in
  [ADR-025](./adrs/ADR-025-r2-object-storage.md), which amends ADR-024.
- Shipped on `feat/r2-storage`: `@eleva/storage` backend, `POST /storage/upload` (replaces
  `POST /blob/upload`), `/sessions/{bookingId}/documents/upload-token` now returns a presigned PUT,
  size and type checks in the routes that record an object, `@eleva/config/media-host`, keys in
  `library.json`, CSP, boundary lint, and `infra/storage/migrate-blob-to-r2.ts`.
- **Not proven against real R2.** No Cloudflare credentials exist yet. Evidence is unit tests and a
  local MinIO run of `packages/storage/src/r2.integration.test.ts`. Re-run that suite against the
  real buckets with `R2_INTEGRATION=1` before the production migration. Not proven at all: bucket
  CORS from a real browser, EU endpoint behaviour, custom-domain caching, and the migration script
  against production Blob or a real database.
- Open items:
  - D-08 keeps its decision, but its "private Blob store" wording must be revisited before 16.8.
  - Cloudflare's DPA (v6.3) must be accepted in the company's name. A DPF listing is not claimed
    because it was not verified.
  - The sub-processor change was written into the trust pages with `lastUpdated: 2026-10-31`.
    `CONSENT_DOCUMENT_VERSION` stays `2026-10-29`; whether this change needs a bump, and the 30-day
    notice the DPA promises experts, is a founder and DPO decision.
  - Session document **bytes are not application-encrypted**; only `metadata_encrypted` is. The
    DPIA, fact sheet and privacy notice were corrected on 2026-10-31. Adding application-layer
    encryption for files stays open.
- Follow-ups, not built: a sweep for uploads never recorded; signing `Content-Length` once tested
  on real R2; renaming `blob_pathname` and
  `blob_url`; retiring `sessionDocumentsBlobFailures` and `blobFailures` counter names; Academy HLS.

### 2026-10-30: Licence verification before public listing (active)

- Implements item 4 of the 2026-10-29 "Launch legal posture" entry and supersedes the activation rule of 2026-10-20 "Expert setup wizard v3 and activation rule".
- Shipped in PR 1 (`feat(db,api,expert)`):
  - Migration `0071_become_partner_applications` recreates `become_partner_applications`
    (one open application per profile) and adds `professional_body`, `licence_number`,
    `ers_registration_number` to `expert_profiles`. RLS lets the expert org file or refile a
    pending, unreviewed row only; decisions and deletes are staff-only (`eleva.platform_admin`).
    A DB CHECK refuses an `approved` row without reviewer, `reviewed_at` and every
    `LICENCE_CHECKLIST_ITEMS` check (the licence verification record).
  - Professional bodies SSOT: `@eleva/config/professional-bodies` (seven Ordens, official
    names, official sites) plus the staff checklist ids.
  - Setup Practice step collects body, licence number and ERS number. Finishing setup on an
    `approved` profile files a `pending` application and keeps the profile `approved` (not
    listed). `409 LICENCE_REQUIRED` when the licence is missing.
  - `GET|POST /expert/profile/licence-application`: experts read their status and resubmit after
    `needs_changes` / `rejected`. Active profiles without an approved application submit here too
    and stay active while staff check. A verified licence is locked (`409 LICENCE_LOCKED`).
  - `/{org}/licence` shows the state (pending, needs changes, rejected, unverified, verified); the
    dashboard shows a prompt until verified. Finished `approved` experts can use the dashboard
    to prepare services; they are not public until `active`.
- Shipped in PR 2 (staff review):
  - `GET /admin/partners`, `GET /admin/partners/{expertProfileId}` and
    `POST /admin/partners/{expertProfileId}/decision` (capability `applications:review`, the
    staff bundle; decisions need a revocable session). `apps/admin` `/partners` is the queue
    and the detail view.
  - The queue lists `pending` and `needs_changes` applications plus `active` profiles with no
    approved application ("Needs verification").
  - Approve needs every checklist item, records the verification, copies the checked licence
    onto the profile and moves `approved` to `active`. `active` stays active and `suspended`
    stays paused. Needs changes and reject need a reason. Needs changes leaves the profile
    status alone; reject moves `active` back to `approved`, which unlists it.
  - Decisions are refused when the expert refiled after staff loaded the page (`409
APPLICATION_CHANGED`) and when staff would decide their own application (`403 SELF_REVIEW`).
  - The expert gets an email on each decision: Lane 1 kinds `partner.approved`,
    `partner.needs_changes`, `partner.rejected` (migration `0072_partner_decision_kinds`).
- No migration suspends or downgrades anyone: profiles already `active` stay active until staff
  decide. Rejection unlists an `active` profile straight away, because the public terms promise
  that a registration Eleva cannot confirm stops accepting bookings. Bookings already made stay
  in place; support handles them. A later approval lists the expert again.
- Out of scope (open follow-ups, not shipped):
  - Public profile display of licence number, Ordem and ERS number (ERS Regulation 1058/2016).
  - Licence evidence upload to the private Blob store (`licence_evidence_blob_key`).
  - Phase 12 staff hardening on these routes: mandatory 2FA, fresh step-up, dual control for
    partner approval of a clinical specialty, staff-role route matrix, `e2e/admin.spec.ts`.
  - Decision history in the staff view (the view shows the latest application; older decisions
    stay in the table and the audit trail).
  - Exact public-register search URLs per Ordem (the SSOT links each Ordem's official site).
  - Founder confirmation of the "usually within 2 working days" copy.
  - Retiring the free-text `license_scope` column (the wizard no longer writes it).
- Owner: founder (rule), engineering (implementation). Status: `active`.
- Related: `docs/eleva-v3/execution-plan/phases/12-admin-console.md` deliverable 3,
  `apps/api/src/app/expert/profile/steps/[step]/complete/route.ts`.

### 2026-10-30: Legal pack — provisional rules, corrections and open decisions (proposed)

- Summary: `docs/eleva-v3/legal/` holds internal drafts for a Portuguese lawyer and the external
  DPO. Nothing here is legal sign-off. This entry adds to the 2026-10-29 "Launch legal posture"
  entry and does not repeat it.
- Corrections to the 2026-10-29 entry:
  - ERS registration is DL 126/2014 art. 26 and ERS Regulamento 66/2015. DL 127/2014 is licensing.
  - The DPO advises and monitors (GDPR art. 39). Eleva takes the decisions as controller, so AUD-028
    and AUD-029 close on Eleva's decision with the DPO's advice on record.
  - The DPO's contact details must be published and given to the CNPD (art. 37(7)). The name need
    not be published.
- Provisional rules until the lawyer and DPO have reviewed them:
  - Breach: every health-data breach is S3 or S4 unless exception E1 (ciphertext only, keys safe) or
    E2 (contained disclosure to a trusted recipient) is evidenced. Reclassification does not reset
    the art. 33 clock. The register is kept 5 years, as a proposal with no statutory period. See
    [`legal/breach-response.md`](./legal/breach-response.md).
  - Contact: `privacy@eleva.care` is the proposed single interim and published data protection
    contact, routed to the DPO after the appointment.
- Handoffs to the public pages (not changed by the legal pack):
  - Replace `dpo@eleva.care` and its DPO label in the DPA, security, privacy and expert-agreement
    pages. Founder input needed: is that address monitored, and by whom?
  - Replace "digital health platform" and "telemedicine" wording in the DPA, expert agreement and
    `/trust/ers` (all three locales). Risk analysis: [`legal/ers-position.md`](./legal/ers-position.md) §4.
- Open decisions:
  - **D-07 route.** Production clinical video on Daily stays blocked until D-07 is signed. D-07 as
    written means a HIPAA-enabled plan and a BAA, while the 2026-10-12 entry says HIPAA is not an EU
    launch priority. The founder must either sign D-07 or supersede it with a decision for standard
    Daily (not HIPAA, recording off) stating scope and conditions. See
    [`legal/dpia.md`](./legal/dpia.md) §2.6.
  - **D-12-A intake.** `eraseMemberClinicalRecords` deletes every intake today. Decide whether an
    intake is kept with the clinical record once a session has taken place. See
    [`legal/positions-d06-d11-d12.md`](./legal/positions-d06-d11-d12.md).
  - **R12 access logging.** Decide what Lei 58/2019 art. 29(6)–(7) requires. The DPIA conclusion
    stays open until each required control is implemented and verified.
  - **DPA acceptance.** Define the DPA version (shared with `CONSENT_DOCUMENT_VERSION` or its own)
    and how experts and clinics accept it. See
    [`legal/experts-dpa-checklist.md`](./legal/experts-dpa-checklist.md).
- Engineering follow-up: refunds read the current tier table, not `cancellation_policy_version`.
  Add versioned rules and a policy-version test before any tier edit ships.
- Owner: founder. Status: `proposed`.
- Related: D-06, D-07, D-11, D-12, AUD-028, AUD-029, [`legal/README.md`](./legal/README.md).
- Next review: 2026-11-16 (with the Daily DPF recheck), or at the DPO's appointment if sooner.

### 2026-10-29: Launch legal posture — intermediary, external DPO, D-06 balanced, regulated experts only (active)

- Decisions (founder, 2026-10-29):
  1. **Intermediary only.** Búzios e Tartarugas, Lda does not deliver care. Experts are independent,
     hold their own ERS registration and bill members. Eleva does not register with ERS as a
     provider (DL 127/2014). If Eleva ever employs or contracts clinicians who deliver sessions
     under its name, it must register first.
  2. **External DPO.** Eleva appoints an external DPO service (GDPR art. 37(1)(c), large-scale
     health data). The DPO is named in the privacy notice and notified to the CNPD, and signs off
     AUD-028 (retention) and AUD-029 (AI-processing copy).
  3. **D-06 balanced policy.** A member no-show counts as a late cancellation under the service's
     tier (usually no refund). An expert no-show or expert cancellation refunds 100% to the member,
     including Eleva's fee, and offers a rebook. Chargebacks: when the session was not delivered,
     the amount is recovered from the expert's transfer; when it was delivered, Eleva contests with
     the join and attendance logs.
  4. **Regulated professionals only at launch.** Only experts with a licence verified against their
     professional body (Ordem dos Médicos, Psicólogos, Nutricionistas, Fisioterapeutas, Enfermeiros,
     and so on) may sell. Non-regulated wellness practitioners are out of scope for launch.
- Consequences for engineering:
  - Setup completion must stop moving profiles straight to `active` (2026-10-20 "Expert setup
    wizard v3 and activation rule"). A profile stays `approved` until staff verify the licence.
    `become_partner_applications` was dropped in migration 0013 and must be recreated (Phase 12
    deliverable, corrected 2026-10-29).
  - Expert cancellation and expert/member no-show handling are not built. They are open work that
    must follow item 3.
- Legal drafting from these decisions is tracked in `docs/eleva-v3/legal/`. It must be reviewed by a
  Portuguese lawyer or the appointed DPO before reliance.
- Owner: founder. Status: `active`.
- Related: D-06, D-11, D-12, [`legal/fact-sheet.md`](./legal/fact-sheet.md) "Open founder inputs".

### 2026-10-29: Legal pages for the launch posture (active)

- Decision (founder): Eleva is an intermediary only; experts are independent,
  hold their own ERS registration and invoice members from their own
  certified software. Only regulated health professionals whose licence
  Eleva has verified with their Ordem may sell at launch. An external DPO is
  being appointed (no name yet; `privacy@eleva.care` meanwhile). D-06
  balanced policy: member no-show = cancellation at session start under the
  service tier (no refund in all three tiers); expert cancellation or no-show
  = 100% refund including Eleva's fee plus a rebook offer; chargebacks on
  undelivered sessions are recovered from the expert's payout, delivered
  sessions are contested with join/attendance logs. Promotion codes are
  Eleva-funded and never reduce the expert's share. Paid bookings use Stripe
  Checkout; Eleva collects the member's optional NIF for the expert's invoice
  and does not invoice the session.
- Change: rewrote `expert-agreement`, `terms`, `payments`, `privacy` and
  `trust/ers`, and revised `ai-processing`, `trust/dpa` (Art. 28 terms and
  vendor list) and `trust/sub-processors`, in pt/en/es; bumped `CONSENT_DOCUMENT_VERSION` to
  **`2026-10-29`**.
- Out of scope (not shipped by this change): automated expert-cancel and
  no-show refund flows, a no-show time threshold, the external DPO
  appointment itself, lawyer review of the new text, an ERS number field on
  expert profiles (the agreement requires it to be displayed; the product has
  no field yet), and automatic issuance of the service-fee invoice to experts:
  the invoice is a contract term in the agreement, but `issueInvoice()` stays
  closed and AUD-007 stays waived.
- Owner: founder (policy) + engineering (content).
- Status: `active` — working pre-launch. D-06 finance + legal re-sign is still
  pending (not waived); the published text lists points for lawyer review in
  the PR.
- Related: D-06, D-10, [`legal/fact-sheet.md`](./legal/fact-sheet.md).

### 2026-10-24: Publish consent documents (D-10 switch) (active)

- Decision (founder): publish the legal/trust consent set. Set
  `CONSENT_DOCUMENT_VERSION` in `@eleva/compliance` from `dev-2026-09-09` to
  **`2026-10-24`** so production (`VERCEL_ENV=production`) can accept funnel
  consents on `POST /bookings/reserve`. Remove legal/trust fallback draft
  banners and replace the public footer draft note with a neutral document
  version line. Marketing landing draft banners (`/become-expert`,
  `/for-clinics`, `/contact`) stay unchanged.
- Unblocks: production booking reserve that previously 500'd with
  `cannot accept production consent`.
- Owner: founder (publication approval) + engineering (switch).
- Status: `active`.
- Related: D-10, [`legal/fact-sheet.md`](./legal/fact-sheet.md) §6,
  [`audits/consent-inth-manual-checklist.md`](./audits/consent-inth-manual-checklist.md).

### 2026-10-23: Better Auth rate-limit Redis TTL + Vercel IP headers (active)

- Decision: `secondaryStorage.increment` must `INCR` + `EXPIRE key ttl NX` so
  Better Auth’s 3/10s `/sign-in*` window resets; configure
  `advanced.ipAddress.ipAddressHeaders` to prefer `x-vercel-forwarded-for` /
  `x-real-ip` before multi-hop `x-forwarded-for` (avoids shared
  `no-trusted-ip` bucket). Stuck keys without TTL need a one-shot Redis delete
  (`pnpm clear:better-auth-rate-limits`).
- Symptom fixed: permanent `429` on `POST /auth/sign-in/social` (Google login).
- Related: [`packages/auth/src/server/secondary-storage.ts`](../../packages/auth/src/server/secondary-storage.ts),
  [`operator-tasks/google-oauth-setup.md`](./operator-tasks/google-oauth-setup.md).
- Status: `active`.

### 2026-10-23: Better Auth i18n error messages (active)

- Decision: add server-only `@better-auth/i18n` to `@eleva/auth` with built-in
  translations for Eleva launch locales `en` / `es` / `pt` only.
- Detection (priority): `ELEVA_LOCALE` cookie → session `user.locale` →
  `Accept-Language` header; `defaultLocale: "en"`.
- UI: account login/signup keep Eleva next-intl product copy for mapped codes
  (`INVALID_EMAIL_OR_PASSWORD`, `EMAIL_NOT_VERIFIED`, rate-limit); unmapped codes
  and settings/2FA surfaces use the plugin-translated `message`.
- Out of scope: client i18n plugin; schema migration; full UI chrome (next-intl).
- Related: [ADR-017](./adrs/ADR-017-better-auth-identity.md) amendment 2026-10-23
  (i18n); pairs with marketing→auth `ELEVA_LOCALE` persistence.
- Status: `active`.

### 2026-10-23: Google implicit account linking (active)

- Decision: enable Better Auth implicit link-on-sign-in for Google
  (`accountLinking.disableImplicitLinking: false`, `requireLocalEmailVerified: false`,
  keep `enabled: true` and `trustedProviders: ["google"]`). Same verified e-mail Google
  OAuth attaches to an existing Eleva user (password / magic-link / passkey / unverified
  guest) and opens a session instead of `account_not_linked`.
- Also: `account.storeStateStrategy: "cookie"` so OAuth PKCE/state survives Fluid
  multi-region without Redis verification lookup; staging cookie domain defaults to
  `.dev.eleva.care` (never share `.eleva.care` with prod).
- Rationale: recovery UX when the member does not remember password / link / passkey;
  BA’s default `requireLocalEmailVerified: true` still returned `account_not_linked` for
  guest-activation rows; cookie state matches Better Auth guidance for reliable callbacks
  ([users-accounts § account linking](https://www.better-auth.com/docs/concepts/users-accounts#account-linking),
  [options § storeStateStrategy](https://www.better-auth.com/docs/reference/options#account)).
- Trade-off: softens ADR-017’s prior “no implicit link” + local-email-verified gate.
  Mitigation: Google-verified e-mail + Google is the only trusted social provider; no
  `allowDifferentEmails`; successful link sets `emailVerified` from the IdP claim.
- Explicit `linkSocial()` unchanged for calendar scopes / settings.
- Related: [ADR-017](./adrs/ADR-017-better-auth-identity.md) amendment 2026-10-23;
  [`operator-tasks/google-oauth-setup.md`](./operator-tasks/google-oauth-setup.md).
- Status: `active`.

### 2026-10-21: Dev-prod evidence exception (active, operator-gated)

- Decision (founder-approved engineering exception):
  - Phase **06** (Stripe test-mode pay → transfer → payout + AUD-001 cancellation refunds),
    **09** (two-browser Eleva grant join + Daily `meeting.*` / `participant.*` webhooks), and
    **04** guest funnel evidence may run on **production hostnames** (`eleva.care`, `api.eleva.care`)
    while the product remains in pre-launch configuration.
  - **Stripe test keys only** — abort if production env exposes live `sk_live_*`.
  - **Seeded expert only** — `fisiomota` / `first-visit` / €60; no real members or PHI in notes.
  - **Daily standard, recording off, not HIPAA** — unchanged from Phase 09 posture.
  - **BotID** — prod may stay `off` (AUD-017); record observed state in the runbook row.
  - **Capture** — redacted join URLs, Stripe object ids, Daily webhook delivery ids in
    [`audits/staging-evidence-runbook-2026-10.md`](./audits/staging-evidence-runbook-2026-10.md);
    stamp audit rows **dev-prod PASS** with date, not “production ready”.
- Blockers (stop and ask): live Stripe keys, missing `DAILY_WEBHOOK_SECRET`, BotID blocking guest funnel without test bypass, or founder revokes the exception.
- Status: `active` — engineering may run; human evidence rows stay **PENDING** until operator runs complete.

### 2026-10-22: API security hardening D1–D3 (active)

- `pnpm check:route-guards` now enforces `ROUTE_POLICY` instead of only checking it exists:
  `rateLimit: true` needs a reachable `applyRateLimit(`, `botId: true` a reachable `checkBot(`, and a
  mutating public/session route a reachable Zod parse or `withAudit`/`withPlatformAudit` (route file or
  two local import hops; Better Auth's catch-all is the only exemption).
- Money and privacy mutations (refunds, payout approve/hold/release, platform-fee invoicing, accounting
  connect/disconnect, Stripe Connect/identity/account-session, billing checkout/subscribe/portal, account
  deletion, DSAR, cancel-deletion) reject non-revocable JWT bearers (`403 jwt-not-revocable`) via
  `requirePrivilegedApiAuth` / `requireRevocableApiCapability`.
- Rate limiting fails closed (`503 rate_limit_unavailable`) for the `public`, `publicSsr` and `webhook`
  tiers on Vercel production/preview when Redis is missing or erroring; authenticated tiers, local dev
  and CI keep the permissive default.
- `Idempotency-Key` (8–128 chars) is honoured on `POST /bookings/reserve`, `/bookings/confirm` and
  `/payments/intent` (Redis, per-actor, 1 h replay of 2xx only, `Idempotent-Replayed: true`) and
  documented in OpenAPI alongside the existing refund key.
- Out of scope / follow-up: the `withApiRoute(policy, handler)` wrapper is deferred until a route family
  needs it (the CI check already enforces the behaviour); web booking client does not send keys yet.
- Status: `active`.

### 2026-10-22: Phase 10 close-out — record DTO and PHI lint (active)

- Decision: keep the shipped plain DTO (`SessionRecordView`, mapped from `Decrypted<T>` inside
  `@eleva/records` and validated by the `@eleva/api-client` response schemas registered in OpenAPI)
  instead of introducing a second `toRecordResponse(decrypted, viewer)` indirection. The spec
  wording in `execution-plan/phases/10-records-crm-ai.md` now names the real mapper.
- Enforcement: instead of a type-blind ESLint rule on `NextResponse.json`, apps cannot import
  `Decrypted`/`isDecrypted` or `decryptForOrg`/`decryptRecordFields`/`decryptOAuthToken`
  (`packages/eslint-config/boundaries.js`), so a `Decrypted` value cannot be constructed in a route
  handler. `.reveal()` stays banned outside the domain packages.
- Drift guard: `packages/records/src/ai-draft-redaction.test.ts` fails when a key of
  `SessionReportDraftSchema` is not scrubbed by the Sentry/logger key list.
- Status: `active`; Phase 10 stays open for DPO/legal sign-off (AUD-028/029).

### 2026-10-22: Content migration engineering status (active)

- Decision (engineering progress on branch `feat/content-legal-mdx` / PR #263):
  - **Shipped on main path:** `@eleva/content` MDX (legal, trust, evidence, help en/pt/es);
    headless Fumadocs in `apps/docs` (hub, portals, search index, `llms.txt`, help redirects);
    `@eleva/site-chrome` mega menu/mobile nav, docs marketing strip, **shared
    `PublicSiteFooter`** on web + docs; landing JSON for become-expert, for-clinics,
    about, history; pillar pages `/newsletter`, `/podcast`, `/community` with
    `ConsentGate` for Beehiiv embeds; `@eleva/consent` (c15t/Inth) on all
    user-facing apps with Eleva theme + `ELEVA_LOCALE` on `resolveConsent`;
    content vitest + Playwright smoke (legal metadata, docs, pillars).
  - **Still open before “content plan closed”:** founder fields on fact sheet
    (share capital, registry, DPO name, RAL, ERS); native review of AI-drafted
    help copy; **manual Inth five-journey verification** on a production build;
    Beehiiv/podcast production URLs in `@eleva/config/editorial-pillars`;
    full **SiteHeader** on docs (auth + i18n `Link` stay web-only today);
    `CONSENT_DOCUMENT_VERSION` publication switch after legal/DPO sign-off.
  - **Fact sheet SSOT:** `docs/eleva-v3/legal/fact-sheet.md` (restored in repo
    2026-10-22; vitest cross-checks sub-processors names).
  - **Media: Mux dropped.** Marketing video + posters ship from the **public Vercel
    Blob** store via `@eleva/storage`/`@eleva/media` (native `<video>`, no third-party
    player); see the 2026-10-22 amendment in
    [ADR-024](./adrs/ADR-024-marketing-media-library.md) (supersedes the Mux choice).
    CSP gained `media-src https://*.public.blob.vercel-storage.com` (`img-src` does not
    cover `<video>`).
  - **Build/runtime fixes landed with the migration:** `withElevaConsentManifest` must be the
    **outermost** `next.config` wrapper (it returns an async function that
    `withMDX`/`withNextIntl`/`withBotId` would otherwise spread, dropping Turbopack MDX
    rules and `images`); `pretypecheck: fumadocs-mdx` for generated `.source`; shared
    Zod frontmatter schemas with `Date` normalisation for `lastUpdated`; docs default-locale
    (`en`) help URLs are served unprefixed via `beforeFiles` rewrites while `pt`/`es`
    stay prefixed; CI build runs with `--concurrency=2`. The CI **Build** job has also been
    cancelled on `main` (infra, not caused by this PR).
  - Not changed: `CONSENT_DOCUMENT_VERSION` stays at its working pre-launch value;
    landing/legal draft banners stay until founder/DPO review.
- Owner: engineering + founder (legal fields, pillars URLs). Status: `active`.
- Related: content migration plan, [`consent-inth-manual-checklist.md`](./audits/consent-inth-manual-checklist.md).

### 2026-10-21: Content approach, no blog, four public pillars (active)

- Decision (founder + engineering):
  - **Long-form content is Git-versioned MDX** in `@eleva/content`
    (legal, trust, evidence-based care, help center), read with headless
    Fumadocs (`fumadocs-core` + `fumadocs-mdx`). All UI comes from
    `@eleva/ui` (React Aria); Fumadocs UI is not used because it depends
    on Radix (ADR-023 boundary).
  - **Landing pages stay TSX on v3 blocks** with copy in next-intl JSON
    (`apps/web/messages/*.json`). The old repo's MDX landing pages full of
    bespoke section components are not ported as MDX.
  - **CMS later, not now.** Every content type has a Zod frontmatter
    schema and is read through a small loader interface
    (`getDocument`, `listDocuments`, `getTree`). A future Sanity/Payload
    migration swaps the loader, not the pages.
  - **No blog.** The editorial channel is the Femme Focus newsletter by
    Eleva on Beehiiv. The public site has four pillars: Eleva as a care
    marketplace and clinics, Academy, newsletter and community (Beehiiv),
    and the "Just Between Us... and Science" podcast sponsorship. They are
    grouped in one "Learn & community" mega dropdown and the footer.
  - **`/community` changes disposition** from 404 (D-10, 2026-09-10) to a
    landing page that links out to the Beehiiv community.
  - Legal and trust documents are written as final text in en/pt/es from
    a sourced fact sheet (`docs/eleva-v3/legal/fact-sheet.md`). Publication
    stays behind one switch: `CONSENT_DOCUMENT_VERSION` in
    `@eleva/compliance` moves from `dev-2026-09-09` to the publication date
    only after founder review.
  - Cookie consent uses c15t hosted on Inth (organization `eleva`,
    project `eleva-care`, runtime region Europe/Frankfurt), strict opt-in:
    no optional requests before a choice.
- Owner: founder (content, pillars), engineering (implementation).
  Status: `active`.
- Out of scope (follow-ups, not shipped):
  - Headless CMS adoption.
  - Showing latest Beehiiv issues on-site via a cached `GET` in `apps/api`
    (Beehiiv API v2).
  - Legal/DPO sign-off of the legal set; the version switch above.
  - Native-speaker review of AI-drafted help locales.
- Related: [`content-seo-spec.md`](./content-seo-spec.md),
  ADR-023, D-10.

### 2026-10-20: Phase 10 retention sweep + AI legal notice (active)

- Decision (engineering, AUD-028 / AUD-029):
  - `POST /workflows/retention-sweep` runs `runRetentionSweep`: unpublished
    `ai_draft` (90d), `session_documents` (private Blob delete then row;
    working pre-launch **7×365d**), and `notification_deliveries` (365d).
    Blob delete failures increment `retention_sweep_attempts` (max 3) on
    migration **0069**.
  - Optional `ai_processing` consent links to versioned draft
    `/legal/ai-processing` (`AI_PROCESSING_CONSENT_DOCUMENT`, same
    `CONSENT_DOCUMENT_VERSION` as funnel consents). **Not DPO/legal
    production text.**
- Owner: engineering. Status: `active` (working pre-launch).
- Next review: DPO final retention periods + legal sign-off on AI copy before
  go-live; QStash schedule apply on staging only when operator chooses.
- Related: `docs/eleva-v3/data-retention-export-matrix.md`,
  `docs/eleva-v3/audits/2026-10-phases-01-10-audit.md` (AUD-028, AUD-029).

### 2026-10-20: Operational audit exemptions and null-org deliveries (active)

- Decision (engineering, AUD-037):
  - Room-create leases, capacity retry flags, notification claim/lease
    rows, webhook receipts and in-app inbox rows skip `withAudit`. They are
    retry and concurrency state; the business transition each supports is
    audited. The list lives in `packages/audit/README.md` (Operational
    Exemptions).
  - Notification deliveries with `org_id` NULL (password reset, e-mail
    verification, guest booking mail) now audit through
    `ELEVA_PLATFORM_AUDIT_ORG_ID` (`resolveNotificationAuditOrgId` in
    `@eleva/audit`, `recordNotificationDeliveryAudit` in `@eleva/notifications`)
    on send completion, Resend webhooks, and Twilio status callbacks. Payload
    marks `platformScoped: true` and `recipientUserId` when the delivery row
    has no tenant org. Without the env var, behaviour matches the previous
    skip (local dev only — set the platform org in staging/production).
  - `audit_outbox.org_id` stays NOT NULL; no separate outbox table.
- Owner: engineering. Status: `active`.
- Next review: Phase 13 compliance hardening, before launch.
- Related: AUD-037 in `docs/eleva-v3/audits/2026-10-phases-01-10-audit.md`,
  `packages/notifications/src/handle-resend-webhook.ts`.

### 2026-10-20: CRM contacts reuse booking history (proposed)

- Decision (engineering, Phase 10.2c):
  - `crm_contacts` holds only the relationship layer: lifecycle stage
    (`lead|active|dormant|churned`), tags, and for manual leads a name plus
    encrypted email/phone. Session history, last session and upcoming
    sessions are read from `bookings` at query time; there is no
    `last_session_at` column to keep in sync (crm-spec: "CRM should not
    reinvent booking state").
  - Member contacts are created when the expert first acts on that member
    (stage, tag or follow-up), not from booking domain events. The members
    list stays the booking-derived view.
  - `crm_follow_ups.note_encrypted` is ciphertext; `notified_at` lets the
    due-reminder job notify once. Failed sends increment
    `notify_attempts` (cap 5) so a poison author cannot occupy the
    500-row hourly scan; preference-disabled in-app (empty deliveries)
    is terminal. Held deliveries stay retryable.
  - The due sweep runs under `withPlatformAdminContext`. `crm_follow_ups`
    is in `ADMIN_BYPASS_TABLES`: tenant isolation stays the class; the
    policy also allows `eleva.platform_admin = 'true'` on USING and WITH
    CHECK so the job can list ids/routing across orgs and stamp
    `notified_at` / `notify_attempts`. The sweep never selects
    `note_encrypted`. Ciphertext is still readable to any other
    platform-admin caller; plaintext needs the org DEK. Same hatch as
    billing webhook tables — not a new RLS class.
  - Account deletion deletes the member's contact rows and their follow-ups
    (Phase 10 spec). Manual leads are the expert's own records and are not
    matched by email.
- Out of scope for the first slice: segments, suggested appointments,
  Resend audiences, org-wide CRM views (crm-spec "Deferred").

### 2026-10-20: Record templates ship as plain text (proposed)

- Decision (engineering, Phase 10.1f):
  - Template bodies are plain text with `{{member.firstName}}`,
    `{{session.date}}` and `{{expert.name}}` placeholders, not Plate JSON.
    The notes and report editors are still plain textareas, so ADR-023
    does not apply to record templates until those editors move to Plate;
    the migration then converts bodies in place.
  - The Eleva starter set is code constants
    (`@eleva/records` `STARTER_RECORD_TEMPLATES`) that experts copy into
    their library, not seeded rows, so starters stay versioned with the
    code and no org owns platform content.
  - "Start from" and "Save as template" are in the report composer only;
    the in-call notes panel gets them later. "Save as template" refuses
    40+ character sentences copied verbatim from that session's records.
  - The scrubber checks the member's name, e-mail, phone and session
    date/time. Date of birth and location are not checked because bookings
    do not store them.
- Compatibility: the scrubber and placeholder model carry over unchanged
  when bodies become Plate JSON.
- Owner: engineering. Status: `proposed`.
- Next review: when the notes/report editors adopt Plate.
- Related: `docs/eleva-v3/adrs/ADR-023-plate-rich-text-editor.md`,
  10.1f note in `docs/eleva-v3/audits/2026-10-phases-01-10-audit.md`,
  migration `0063_record_templates`.

### 2026-10-20: Session-record retention on account deletion and AI drafts (proposed)

- Decision (engineering, under the D-11 and D-12 working decisions):
  - Unpublished `ai_draft` records are deleted 90 days after their last
    update by the daily retention sweep (`POST /workflows/retention-sweep`).
  - When a member's account deletion comes due, records the member wrote
    are hard-deleted. That includes the booking-form `intake`, which is
    stored with the expert as `created_by`.
  - Records an expert wrote about the member stay under the clinical
    retention exception. `member_user_id` is replaced by an HMAC tombstone
    (`subject_pseudonym`, migration 0062), the same token D-12 uses for
    consents. They have no scheduled hard delete until the DPO sets the
    statutory clinical period; no number is assumed.
- Compatibility: D-12 already erases account data and keeps legally
  required rows pseudonymised; this applies the same rule to `records`.
  D-11 author-only reads are unchanged. Open question for the DPO: whether
  an intake the expert relied on should be kept as part of the clinical
  record instead of deleted.
- Owner: engineering. Status: `proposed` (needs DPO review).
- Next review: 2026-10-27.
- Related: AUD-028 and AUD-030 in
  `docs/eleva-v3/audits/2026-10-phases-01-10-audit.md`,
  `docs/eleva-v3/data-retention-export-matrix.md`,
  `packages/compliance/src/retention.ts`.

### 2026-10-20: AI processing consent and author-only record reads (proposed)

- Decision (engineering, under the D-11 working decision):
  - `ai_processing` is a consent kind (migration 0060). It is off unless the
    member grants it from Privacy, and withdrawal closes every active row,
    including booking-scoped ones. `hasActiveAiProcessingConsent` in
    `@eleva/compliance` is the check Phase 10.2b must run before any AI draft.
  - Expert records are readable by their author only (AUD-031, migration
    0061). The booking-expert read clause is removed from `records`. It stays
    on `session_documents`, because members upload files their expert must
    read.
- Out of scope: the join-page consent banner, a booking-form checkbox and
  versioned legal text for `ai_processing`; AI drafting stays fail-closed.
- Owner: engineering. Status: `proposed` (consent copy is a draft, not
  DPO-approved).
- Next review: 2026-10-27 (DPO/legal review of the consent copy).
- Related: D-11 (working pre-launch, now author-only SELECT for expert
  records), migrations `0060_ai_processing_consent` and
  `0061_records_author_only_select`, AUD-029 and AUD-031 in
  `docs/eleva-v3/audits/2026-10-phases-01-10-audit.md`,
  `packages/compliance/src/member-consents.ts`,
  `packages/db/src/rls/policies.ts`.

### 2026-10-20: Expert setup wizard v3 and activation rule (proposed)

- Decision (engineering, for founder review): `/{org}/setup` uses the v3
  design (sticky stepper aside, one goal per step, localized en/pt/es) and its
  last step is a summary that finishes setup instead of the old schedule form,
  which never saved its fields. The default weekly schedule is still created
  when that step completes and is edited later under Schedules.
  - Activation: completing the last step moves a self-service profile from
    `approved` to `active` (listed in the marketplace). Before this change
    nothing set `active`, so experts stayed in setup forever.
  - The last step requires practice and invoicing as before, plus a verified
    or processing Stripe Identity check when `ff.expert_identity_verification`
    is on (`409 IDENTITY_REQUIRED`). Paid offers still need Connect at publish.
  - Stripe Identity loads through `@eleva/billing/embedded`
    (`verifyElevaIdentity`), not a direct `@stripe/stripe-js` import.
- After setup, Finance > Invoicing (`/{org}/finance/invoicing`) shows the
  method, reconnects an expired TOConline link, and disconnects or changes it
  through the same picker. OAuth callbacks that land on `/setup` after
  onboarding are forwarded there.
- Out of scope: an admin review gate before `active`.
- Superseded 2026-10-30: setup completion no longer activates; see "Licence verification
  before public listing".
- Owner: engineering. Status: `proposed`.
- Next review: 2026-10-27 (founder sign-off on the approved-to-active rule).
- Related: `apps/api/src/app/expert/profile/steps/[step]/complete/route.ts`,
  `apps/expert/src/app/[orgSlug]/setup/`.

### 2026-10-20: Identifier-first sign-in and sign-up (accepted)

- Decision (founder feedback): `/login` and `/signup` ask for one thing at a
  time. Step 1 is Continue with Google or an email; step 2 is the password or
  an emailed sign-in link (sign-up: name, password, consent); step 3 is the
  "check your inbox" screen with Gmail/Outlook shortcuts and a 30-second
  resend cooldown.
  - No account lookup between steps, so the form never reveals whether an
    email is registered (one generic credential error).
  - Passkeys: browser autofill on the email field (`username webauthn`) plus a
    quiet "Sign in with a passkey" button.
  - Google button follows Google's branding guidelines (white pill, `#747775`
    border, standard G mark, Google Sans Medium vendored in `@eleva/ui`,
    lazy-loaded). Shared as `@eleva/ui/components/google-sign-in-button`.
  - Brand panel is CSS-only (drifting gradients, dot texture, rotating care
    area word, real value points) to keep the page light; motion respects
    `prefers-reduced-motion`.
- Out of scope: enterprise SSO (no Better Auth SSO plugin configured yet;
  needs a product decision), Apple sign-in, and showing the Google step to
  experts with a different default.
- Owner: founder, engineering. Status: `accepted`.
- Related: ADR-017, `packages/auth/src/client.ts`,
  `@eleva/ui/components/google-sign-in-button`.

### 2026-10-20: Public header menus and marketing blocks (accepted)

- Decision (founder feedback): the public header groups its links into three
  menus in the style of dub.co and resend.com, and the weak marketing blocks
  get stronger visuals.
  - Menus: Find care (the four care areas with photos, plus Browse all
    experts), For professionals (Become an expert, For clinics) and Company
    (About, Our story, Contact). Each desktop panel has a photo card; below
    `lg` the same links sit in a side sheet. SSOT:
    `apps/web/src/lib/public-site-nav.ts` and `apps/web/src/lib/care-areas.ts`.
  - Trust strip: one panel with hairline dividers and solid teal duotone icon
    tiles.
  - About facts: each count is derived from the list it describes (meeting
    modes, launch locales, care areas), so numbers cannot drift from content.
  - The Our story and Experts CTA bands now carry a photo like the others.
- Out of scope: help center and evidence entries in the menus (pages not
  built yet); trust pages stay out of the nav until legal sign-off.
- Owner: founder, engineering. Status: `accepted`.

### 2026-10-20: Email header logo and corner radius (accepted)

- Decision (founder feedback): emails show the white logo PNG in the teal
  header instead of a "Eleva Care" text wordmark, and drop pill shapes.
  - Logo: `https://eleva.care/eleva-logo-white.png` at 160×32, served from
    `apps/web/public` so the URL survives the v3 web cutover. PNG only (Gmail
    and Outlook strip SVG), always an absolute production URL.
  - Shapes: buttons 8px (primary teal fill, secondary 2px teal outline),
    message card 12px, details card 8px.
- Spec: [`brand-book/email-system.md`](./brand-book/email-system.md).
- Owner: founder, engineering. Status: `accepted`.

### 2026-10-19: Expert profile and booking UX direction (proposed)

- Decision: redesign the public expert profile and the booking flow per
  [`expert-profile-booking-ux-spec.md`](./expert-profile-booking-ux-spec.md).
  - Layout: two columns (portrait and bio left, sticky service cards right),
    in the intro.co / old eleva-care-app direction but a clear step up.
  - New expert content: rich bio (ADR-023), social links (https only, host
    checked per network), credentials, and per-service "What's included",
    "What to expect" and "Example questions".
  - Trust: no stars, counts or badges until real data exists; post-session
    reviews are a later slice.
  - Booking flow keeps its steps but always shows them, with the exact date,
    time zone and cancellation deadline as a date in the summary.
- Slice 1 (data and API) adds migration 0059, the api-client schemas and the
  expert/public endpoints. Expert editing pages, the profile redesign and the
  booking flow pass follow as separate PRs.
- Slice 2 (expert editing) adds the expert Public profile page and a Details
  tab in the service editor.
  - Portraits go to the public Blob store under `expert/portrait/<userId>/`.
    The upload route and `PATCH /expert/profile` only accept the uploader's
    own folder, and a replaced portrait is deleted only from that folder. The
    account avatar (`user.image`) is never used as the public portrait.
  - Bio translation runs through `POST /ai/editor` and is saved as an
    `ai_draft` the expert reviews. Prompts name European Portuguese and
    Spanish from Spain.
- Out of scope (not shipped): session packs and monthly plans (a later phase
  once the founder sets commercial terms; nothing is built or shown), reviews.
- Owner: founder (review), engineering. Status: `proposed`. Next review:
  founder walkthrough once the profile redesign slice is on main.

### 2026-10-19: Brand v3 rollout — member and expert app slices (proposed)

- Decision: signed-in apps follow the web rollout, one surface per PR,
  checked locally against a Neon dev branch (`dev-local-v3-redesign`),
  never the production branch.
  - Member app (#192): Space home with the next session featured, sessions,
    booking detail with a manage aside, payments list, v3 `PageHeader`,
    `EmptyState` and `SettingsFieldset` (shared by every app's settings).
  - Expert app: practice dashboard (week stats, booking requests with
    accept/decline in place, next 14 days, shortcuts) and the services list.
    Expert copy now says "Services" instead of "Event Types".
  - `StatusPill`, `DateTile` and `bookingDateParts` live in `@eleva/ui`;
    public profile and explorer URL helpers live in `@eleva/config/env`.
  - Expert follow-up slices, each its own PR: schedule editor (#194),
    finance (#195), calendar week view (#196), integrations (#197),
    connected calendars (#198), member invoices (#199) and the service
    editor shell with a localized basics/policies form (#200). Layout and
    copy only; booking, Stripe, calendar OAuth and invoicing behaviour is
    unchanged, and `issueInvoice()` stays closed.
  - Bug fix (#195): the expert layout, setup and account billing read
    `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, which no env file defines, so
    Stripe embedded components never mounted. They now read the canonical
    `STRIPE_PUBLISHABLE_KEY` via `env()`. Finance no longer bounces experts
    without a Stripe account to setup; it offers payouts setup in place
    (or an "unavailable" notice when Stripe is not configured).
- Out of scope, follow-ups (not shipped):
  - Invoicing can only be configured during onboarding; there is no
    post-onboarding invoicing settings page yet.
  - The connected-calendar account cards and the invoices table were only
    checked in their empty states locally (no OAuth account or invoice rows
    on the dev branch).
  - Account, team, academy and admin apps are not restyled yet.
- Addendum 2026-10-20 (founder loopback, **unproven**): connected-calendar
  cards and the invoices table were reviewed **empty only** on the Neon
  dev branch — no Google/Microsoft OAuth row and no invoice rows; no
  Connect, save or payouts buttons were pressed. Local `.env.local` still
  targets the dev branch (switch back to production when signed-in app
  review finishes; dev branch deletion is a separate founder call).
  Expert setup/onboarding wizard v3 layout merged (#246) — layout and copy
  only; founder walkthrough **unproven**. Account app v3 polish in progress
  (`feat/account-brand-v3`: auth headings, workspace create shell, org
  `EmptyState`, card tokens). Next rollout: team, academy and admin.
  CodeRabbit CLI was ~0.7.6 vs 0.9.0 with ~3 reviews/h
  on the Hobby allowance, pacing merge batches — not a merge gate; Vercel
  Hobby deploy quota failures are likewise not merge gates.
  - The dashboard has no earnings stat: finance reads stay on the finance
    page until payouts are proven end to end.
- Owner: founder (review), engineering (rollout). Status: `proposed`.

### 2026-10-19: Brand v3 rollout — public web and email slices (proposed)

- Decision: brand v3 rolls out one surface per PR. Shipped as PRs (each
  still `proposed` until the founder reviews a preview deploy):
  - Web: home (#184, merged), docs blocks gallery (#190), about, history,
    expert, clinic and contact pages (#187), experts explorer and public
    profile with the `ExpertCard` block (#188), booking funnel (#189,
    visual only).
  - Email: v3 theme tokens, serif headings, pill buttons (#191).
- Copy honesty: "verified" claims are removed from the explorer and
  profile because there is no credential-verification schema. The official
  "independent, licensed experts" wording and the advisor list stay
  pending founder review.
- Out of scope, follow-ups (not shipped):
  - Authenticated apps: see the member and expert app slices entry above.
  - Email header logo: no public URL serves the logo PNG, so the header
    keeps the text wordmark.
  - Email copy: the footer says "active account" for guest bookings, and the
    member join hint shows the "standard Daily, not HIPAA" line.
  - Booking inputs lack accessible names (Field/FieldLabel association), and
    the header login `LinkButton` has a hydration warning.
  - Decide whether to keep the `VerifiedBadge` kit primitive.
- Owner: founder (review), engineering (rollout). Status: `proposed`.

### 2026-10-19: Brand v3 warm editorial (proposed)

- Decision: the founder chose a brand evolution (option B) for the premium
  redesign. `brand-book/v3/README.md` proposes warm sand surfaces (new
  `sand` scale), Fraunces display and headings in place of Lora, fluid display
  type steps, a 0.75rem base radius, warm-tinted shadows and motion tokens.
  All v2 colour scales stay unchanged, and every text pair passes WCAG AA
  (`v3/tokens.json`).
- The logo, wordmark and name are unchanged, and dark mode keeps the v2
  surfaces.
- Rollout: tokens merge to `main` with the kit. Vercel deploys are manual, so
  the founder reviews the v3 preview before any production deploy. Until then
  this stays `proposed`, not founder-approved.
- Owner: founder (approval), engineering (kit). Status: `proposed`.

### 2026-10-13: Remaining 2026 ELEVA FTs issued (18–90)

- Decision: Operator batch issued the remaining 2026 platform-fee FTs
  on the proven fluid path (previous-API header → line → `status: 1` →
  AT → v1 Recibo with `lines` → email). **73** documents: **FT ELEVA/18**
  (id 227) through **FT ELEVA/90** (id 299), each with matching
  `RC ELEVA/{n}`, AT `communication_status=success`, and email to the
  cliente mailbox. Two 2026-03-04 sessions were dated **2026-03-09**
  (series floor after ELEVA/17). Julio
  `py_3ULl0LK5Ap4Um3Sp18JmkZuB` session **2026-12-17** is deferred —
  no future-dated FT. `issueInvoice()` stays closed. No v1 FT POST.
- Owner: founder (Rodrigo Barona)
- Status: `active`
- Related: worksheet
  `~/Documents/eleva-2026-commission-report.html`, progress
  `~/Documents/eleva-2026-issue-progress.json`,
  `docs/eleva-v3/toconline-platform-fee-issuance-flow.md`
- Next review: issue Julio’s 2026-12-17 session on that day.

### 2026-10-13: Recibo closes every ELEVA FT (fluid live path)

- Decision: A finalized FT with no Recibo stays **red** in the TOC list
  (`status: 1`, `pending_total` unpaid). Green is settled AR
  (`status: 3`, `pending_total: 0`, `receipts_ids` set) — not AT or
  email. Live path is now one sequence: previous-API FT header → line →
  `status: 1` → AT → **v1 Recibo with `lines`** (RC ELEVA series 303,
  DDA, `receivable_type: Document`, `received_value` = gross) → email
  the FT. v1 **FT** POST stays banned. `issueInvoice()` stays closed.
  Catch-up 2026-10-13: **RC ELEVA/16** id 126 settled FT 225;
  **RC ELEVA/17** id 127 settled FT 226.
- Owner: founder (Rodrigo Barona)
- Status: `active`
- Related: `docs/eleva-v3/toconline-platform-fee-issuance-flow.md`
- Next review: Julio 2026-12-17 session still deferred.

### 2026-10-13: FT ELEVA/17 issued to Raquel (cliente 21)

- Decision: The charge skipped yesterday for missing NIF,
  `ch_3T42zSK5Ap4Um3Sp0dNJkBPv`, is now **FT ELEVA/17** (TOC id 226,
  line 227, date 2026-03-09 session day, €10,50 = 8,54 + 1,96 IVA).
  Settled **RC ELEVA/17** (id 127). Previous-API live path: header →
  line → `status: 1` → AT PATCH `communication_status=success` → Recibo
  → email to the cliente's invoice mailbox. Cliente **21**. Do not
  re-issue. `issueInvoice()` stays closed. Raquel’s second 2026 charge
  (`ch_3TzD4PK5Ap4Um3Sp1jBivgx9`, session 2026-08-17) is still unissued.
- Owner: founder (Rodrigo Barona)
- Status: `active`
- Related: worksheet
  `~/Documents/eleva-2026-commission-report.html`, sidecar
  `~/Documents/eleva-2026-toc-raquel-ch_3T42zS.json`
- Next review: remaining ELEVA FTs still unissued.

### 2026-10-13: Madalena is a founder-confirmed individual Cliente

- Decision: A founder-confirmed personal NIF (checksum valid, natural
  person; value kept in the restricted invoicing sidecar, not here) is
  now live TOConline Cliente **23**, Patricia-style (short
  `business_name`, Identity legal name on the fiscal card, street on
  `main_address` 155, invoice mailbox on related `email_addresses` 107
  from the expert's Connect account). Same digits as the earlier
  Checkout guest/payer tax ID field — founder confirmation is now the
  expert invoicing source of truth; do not treat Checkout
  `tax_id_collection` as expert NIF in general. Reuse id 23; do not
  create a duplicate. No FTs issued in this slice.
  `issueInvoice()` stays closed. 2026 worksheet Clientes: Patricia 17,
  Bee 18, Raquel 21, Jessica 22, Madalena 23.
- Owner: founder (Rodrigo Barona)
- Status: `active`
- Related: worksheet
  `~/Documents/eleva-2026-commission-report.html`, sidecar
  `~/Documents/eleva-2026-toconline-customers.json`
- Next review: remaining ELEVA FTs still unissued.

### 2026-10-13: Paid bookings charge via Checkout Sessions Elements

- Decision: Charge paid bookings with Stripe Checkout Sessions
  (`mode: payment`, `ui_mode: elements`) so Adaptive Pricing, automatic
  tax, promo codes, tax ID, and billing address stay on Stripe objects.
  Confirm still happens on `payment_intent.succeeded`.
  `checkout.session.completed` only enriches Customer / tax / address /
  discount / CS ids. Instant Book vs Request stays in `flipPaidBooking`.
  Amount matching, application fee, and Instant Book decline/expiry
  refunds use the **charged** total (`session.amount_total` /
  PaymentIntent amount), not the reservation list price when a promo
  applied. Signed-in members keep the member-or-guest bookability gate
  (not forced through `funnel.guest`). Schema `0058` and the helper are
  additive; the live pay path flips in a follow-up.
- Amendment 2026-10-29 (founder + legal review, server slice). **Supersedes** the original
  entry's Adaptive Pricing, automatic tax, Stripe invoice and "fee on the charged total" points
  above; where they conflict, this amendment wins:
  - **No `automatic_tax`, no `invoice_creation`, no `tax_behavior`.** Eleva intermediates a
    healthcare service the expert sells and invoices from certified software (Tier 2). A Stripe
    invoice from Eleva's account, or Stripe Tax computing VAT on the session, would present Eleva as
    the seller and could charge VAT on a CIVA art. 9 exempt service.
  - **No Adaptive Pricing** for the EUR-only launch (D-02), so the PaymentIntent amount is always the
    EUR session total.
  - **Promotion codes are Eleva-funded** (founder 2026-10-29). Commission and the expert transfer
    use the list price (`amount_cents + discount_cents`); `booking_payments.amount_cents` becomes
    what the member paid, which bounds refunds. When the expert's share exceeds the charge, the
    transfer omits `source_transaction` and is funded from Eleva's balance.
  - **Promotion codes are validated server-side**, never `allow_promotion_codes` (which accepts
    any active code in the account, subscription coupons included). A code applies to bookings
    only when the Stripe promotion code or its coupon has `metadata.eleva_scope = booking`, the
    coupon is valid, not 100% off (a zero-total session cannot confirm) and EUR when amount-off.
    A different code expires the open session and creates a new one (`422 PROMO_INVALID`
    otherwise). **Operator rule:** create booking codes in Stripe with
    `metadata.eleva_scope=booking`.
  - Session expiry is the reservation's creation + 60 min (Stripe needs 30 min-24 h from the
    session's own creation); the hold-expiry sweep closes it far earlier.
  - Confirm accepts a discounted intent only when the session subtotal is the list price and the
    intent amount is the session total. The member's NIF, business name and billing address are
    copied from the session.
  - `POST /payments/checkout-session` is live; the public confirm accepts `checkoutSessionId`
    after a token + bound-session check (no Stripe call before authorization). The hold-expiry
    sweep reads the session and expires it when nobody started paying.
  - **No Stripe tax ID collection.** The member's NIF stays on Eleva's funnel field (stored as
    `bookings.buyer_tax_id` for the expert's invoice). Stripe's tax ID UI is business-oriented
    (requires a business name, validates VAT numbers against VIES) and a private member's NIF is
    not a VAT number. Confirm still copies a tax ID if a session ever carries one. This replaces
    the earlier preference to collect the member's NIF through Stripe `tax_id_collection`.
  - Accountant to confirm the bookkeeping of an Eleva-funded discount (third-party-funded
    voucher on the expert's invoice; marketing cost for Eleva).
  - **Two payment surfaces, one per caller (2026-10-29).** The browser funnel uses Checkout
    Sessions (#283). `POST /payments/intent` stays as the **API-only** path for agents and M2M
    callers, the daily booking probe and the API-level smokes (request-to-book, cancellation
    refunds), which cannot run Stripe Elements; it has no promotion codes. A hold can only ever
    have one of the two (`unavailable` otherwise).
- Owner: engineering
- Status: `active`
- Related: Phase 04.2 payments, Instant Book 2026-10-13, Stripe Checkout
- Next review: before launch, with the first live (non-test) Stripe run.

### 2026-10-13: Instant Book vs Request to book (Airbnb-style)

- Decision: Keep `event_types.requires_approval` (default false = Instant
  Book). Snapshot onto the reservation and booking. Request mode parks
  after pay/free confirm in `awaiting_confirmation` — no session, guest
  activation, `booking.confirmed`, or Connect transfer until the expert
  accepts. Response window is 24 hours or session start if sooner
  (`approvalDeadlineAt`). Capture payment now; decline, expiry, or member
  cancel of a pending request refunds 100% and frees the slot.
  Cancellation policy applies only after confirmed. Transfer is blocked
  with `booking_not_confirmed`. Out of v1: guest requirements, pre-booking
  questions, approve first N, per-mode/date, search ranking, expert cancel
  of a confirmed booking.
- 2026-10-20 addendum (AUD-046): Instant Book offers may set
  `instant_book_lead_minutes` (presets 2/12/24/48 h, max 7 days). A slot
  that starts sooner than that is snapshotted as Request to book;
  `slotRequiresApproval()` in `@eleva/config/booking-settings` decides for
  both reserve and the funnel copy.
- Owner: engineering
- Status: `active`
- Related: Phase 10.1 booking settings, cancellation-policy snapshot pattern
- Next review: after expert calendar Accept/Decline is in use.

### 2026-10-13: Session documents use the private Blob store (10.1)

- Decision: Booking documents persist in `session_documents` with
  envelope-encrypted filename metadata and bytes in the **private**
  Vercel Blob store (`BLOB_PRIVATE_READ_WRITE_TOKEN`). Pathname prefix
  is `records/<expertOrgId>/<memberUserId>/<actorUserId>/` (guest
  bookings use `guest-<bookingId>`). Client upload mints a token via
  `POST /sessions/{bookingId}/documents/upload-token`; metadata is
  committed with JSON `POST .../documents` (not form-data). Download is
  a 15-minute Eleva grant, audited, streamed by the API — never a raw
  private Blob URL. D-11: uploader-only writes/deletes (expert or
  member; member uploads are always `scope=shared`); author and
  assigned-expert reads; member reads `scope=shared` only. Clinic-shared
  read is compiled but inactive (`clinic_shared_records` default off,
  member opt-out honoured, `scope=shared` only). Member-account erasure
  deletes member-uploaded and shared documents (Blob then row) and
  clears `member_user_id` on remaining expert-only files (D-12).
  Cloud recording/S3 stays 16.8. Not HIPAA.
- Owner: engineering
- Status: `active`
- Related: Phase 10.1, D-07, D-11, ADR-009
- Next review: DPO re-sign before production clinical records.

### 2026-10-12: HIPAA is not an EU launch priority; session records open on standard Daily

- Decision: Eleva is **EU-first**. Founder: HIPAA/BAA is nice-to-have, not a
  launch blocker. **D-07 stays deferred.** Product stays **standard Daily,
  recording off, not HIPAA** — no BAA claim, no `sessions.eleva.care`
  CNAME. Phase **10.1** may store encrypted session artifacts on the
  member record for that booking: (1) member intake / pre-agenda from the
  booking form, (2) expert in-call notes that must not be lost on
  refresh or leave, (3) a **live** Daily transcript (raw) and later an AI
  summary draft, (4) an unpublished **internal report** the expert writes
  for themselves (notes, suggestions, recommendations) — never member-
  visible; distinct from Phase 10.2 published `report`. This is **not** Phase 16.8 cloud recording or the D-08
  S3 landing zone. Live transcript uses Daily `startTranscription` /
  `transcription-message` (Deepgram), with `enable_recording: false`.
  D-11 is a **working pre-launch** decision (author-only reads now;
  clinic share stays Phase 11). DPO/legal re-sign before production PHI.
  AI summary stays fail-closed until a zero-retention model is on
  `APPROVED_MODELS` (ADR-009).
- Owner: founder (Rodrigo Barona)
- Status: `active`
- Related: D-07, D-08, D-11, ADR-009, Phase 10.1, 16.8
- Next review: DPO re-sign before production clinical records.

### 2026-10-12: Local Eleva two-browser join PASS

- Decision: Local Eleva join is **PASS** (Chrome signed-in expert +
  Safari unsigned guest `/join/{id}?g=`, same private room, live chat).
  That is **not** the Phase 09 staging exit gate. Staging Daily webhook
  subscribe (`meeting.started`/`ended` → `sessions.status`) remains
  leftover. Not HIPAA.
- Owner: engineering
- Status: `active`
- Related: Phase 09.7, spike `09-daily-account.md`
- Next review: staging webhook + staging two-browser.

### 2026-10-12: ELEVA/16 AT Comunicação failed — Finanças password invalid

- Decision: Founder asked to Comunicar FT ELEVA/16. Proven method is
  `PATCH /api/send_document_at_webservice` with
  `document_type: sales_document` (POST is 404). Omitting Finanças
  credentials uses TOC’s stored sujeito-passivo password. AT rejected it:
  `A palavra-chave do sujeito passivo não é válida`. Document 225 is
  `communication_status=error` (`communication_code_source=webservice`).
  FT stays issued and emailed; it is **not** communicated. Retry only
  after the Portal das Finanças password is updated in TOC or supplied as
  gitignored `TOCONLINE_AT_USERNAME` / `TOCONLINE_AT_PASSWORD` (API wants
  password base64). Do not invent the password. `issueInvoice()` stays
  closed.
- Owner: founder (Rodrigo Barona)
- Status: `needs-review`
- Related: FT ELEVA/16, issuance-flow SSOT
- Next review: retry PATCH after password refresh.

### 2026-10-12: v3 TOC issuer = previous API, no review, AT then email

- Decision: Live path for Eleva v3 Tier 1 FTs is the **previous
  JSON:API**, not v1 auto-finalize. Product does **not** queue rascunhos
  for founder review. One workflow: header (`status: 0` internal only) →
  line → immediately `PATCH status: 1` → Comunicar AT → email.
  Operator ELEVA/16 paused for learning; that pause is not UX. Series
  prefix **`ELEVA`** (`FT ELEVA/{n}`). AT API still unproven (needs
  encrypted Portal das Finanças credentials). `issueInvoice()` stays
  closed until remaining fiscal params + those credentials. SSOT:
  `docs/eleva-v3/toconline-platform-fee-issuance-flow.md`.
- Owner: founder (Rodrigo Barona)
- Status: `active`
- Related: ADR-013, phase 07, `.cursor/rules/toconline-integration.mdc`
- Next review: first automated previous-API issue after the gate opens.

### 2026-10-12: FT ELEVA/16 finalized and emailed to Patricia

- Decision: After founder review of draft 225, previous-API
  `PATCH status: 1` finalized it as **FT ELEVA/16** (date 2026-03-06,
  €10,50, cliente 17, worksheet charge id on file). Internal rascunho
  notes were cleared so they do not print. Email
  `PATCH /api/email/document/225` returned `success: true` to the
  cliente-17 mailbox. AT `communication_status` is still
  **unsent** — API Comunicação needs Portal das Finanças credentials
  (not in env; operator-gated). Comunicar in TOC UI. Do not re-issue.
  `issueInvoice()` stays closed.
- Owner: founder (Rodrigo Barona)
- Status: `active`
- Related: 2026 commission worksheet card for this session
- Next review: founder confirms inbox + AT communication in TOC.

### 2026-10-12: Next Patricia FT saved as TOConline draft 225

- Decision: Chronological next Stripe charge is Raquel
  (worksheet charge id on file) — skipped, no NIF/cliente. Next ready
  Patricia charge is the 2026-02-27 payment (paid 2026-02-27,
  session **2026-03-06**, commission €10,50). Created as previous-API
  draft only: `POST /api/commercial_sales_documents` id **225**,
  `status: 0`, `document_no` null (ELEVA number not consumed),
  `communication_status=unsent`, not emailed. Cliente 17, tax NOR 23%
  id 1, service item 5, VAT-inclusive 8,54 + 1,96. Do **not** POST v1
  (auto-finalizes). **Superseded the same day:** founder approved;
  finalized as FT ELEVA/16 and emailed.
- Owner: founder (Rodrigo Barona)
- Status: `superseded`
- Related: 2026 commission worksheet card for this session
- Next review: n/a — see FT ELEVA/16 entry.

### 2026-10-12: TOConline invoice email is related email_addresses, not attributes.email

- Decision: Cliente **17** (Patricia) and **18** (the Bee company)
  have empty `customers.attributes.email`. The mailbox
  is on JSON:API `relationships.main_email_address` /
  `email_addresses` (Patricia id 62 primary; Bee id 63 primary).
  GET with `include=email_addresses,main_email_address`.
  `PATCH /api/email/document` `to_email` should use those addresses.
  Do not treat a null attribute as “no email on the cliente”.
  `issueInvoice()` stays closed.
- Owner: founder (Rodrigo Barona)
- Status: `active`
- Related: TOConline “Clientes, Morada e E-mail”, worksheet fiscal cards
- Next review: first remaining FT email send using these mailboxes.

### 2026-10-12: Remaining ELEVA FT date = session day

- Decision: For unissued commission FTs, TOConline `date` (data de
  emissão) is the **session day** (meeting start, Lisbon calendar date),
  not the day the operator types the FT and not the Stripe `created`
  timestamp. That keeps the ELEVA series in session order (Airbnb-style
  invoice date = reservation day). Pack purchases use the pack-acquired
  day. FT ELEVA/1–15 already issued on 2026-02-23 stay locked — do not
  re-issue to backdate. IVA period follows document date; confirm with
  the accountant if a closed period would be hit. `issueInvoice()` stays
  closed.
- Owner: founder (Rodrigo Barona)
- Status: `active`
- Related: D-03, worksheet invoice-date field, payments-payouts-spec
  line item `date`
- Next review: first remaining Patricia FT (session 2026-02-27) if typed
  with that date.

### 2026-10-12: Existing ELEVA FTs mapped to 2026 Stripe charges

- Decision: GET-only `filter[customer_id]` on sales documents. Patricia
  (cliente 17) already has **FT ELEVA/1–13** (issued 2026-02-23,
  €10,50 each, AT `communication_status=success`). All 13 map to 2026
  destination charges via the PaymentIntent stem in the line;
  ELEVA/5 had a placeholder PI id and was
  matched by session 2026-01-29 15:00 UTC + amount. Bee (cliente 18)
  has **FT ELEVA/14–15** for **2025** sessions (€13,50 / €11,25) — not
  among Julio’s four 2026 worksheet charges. Do not re-issue any of
  these 15. `issueInvoice()` stays closed.
- Owner: founder (Rodrigo Barona)
- Status: `active`
- Related: worksheet
  `~/Documents/eleva-2026-commission-report.html`,
  `~/Documents/eleva-2026-toconline-ft-map.json`
- Next review: remaining 66 Patricia + 4 Julio 2026 FTs still unissued.

### 2026-10-12: TOConline Clientes ids for 2026 ELEVA-FEE worksheets

- Decision: Live `GET /api/customers` on Eleva’s TOConline company
  (no FT POST) found the two clientes already created for commission
  FTs. Reuse these ids; do not create a second customer per expert.
  - Patrícia / personal NIF on file → TOConline `customer_id` **17**,
    business name shorter than the Identity legal name. Stripe Connect
    account id is in `internal_observations`.
  - Julio’s company / company NIF on file → TOConline `customer_id` **18**,
    company business name, contact name Julio. Stripe Connect
    account id is in `internal_observations`.
    Raquel, Jessica, and Madalena are not in Clientes yet. `issueInvoice()`
    stays closed.
- Owner: founder (Rodrigo Barona)
- Status: `active`
- Related: D-03, worksheet
  `~/Documents/eleva-2026-commission-report.html`, sidecar
  `~/Documents/eleva-2026-toconline-customers.json`
- Next review: when remaining expert NIFs exist and those clientes are
  created; snapshot `customer_id` onto `platform_fee_invoices` in 07.3.

### 2026-10-12: Commission FT description is platform service fee + member, not Stripe id

- Decision: The Eleva commission line is a **platform service fee**
  (same role as Airbnb’s “taxas pela utilização da plataforma online”),
  not the clinical session itself. Experts do not know Stripe
  `ch_` / `py_` ids; they know the member. Manual 2026 ELEVA-FEE
  worksheets (and future `issuePlatformFeeInvoice`) use Portuguese
  copy with **minimised PII**: first given name in full, later name
  tokens as `{initial}***` (particles `da`/`de`/`do` kept), email
  local-part truncated to 2 characters + `***@domain`. Example:
  `Taxa de serviço da plataforma Eleva relativa à sessão com Inês G*** S*** (in***@hotmail.com) efetuada no dia 2026-01-21`
  (packs: pack / adquirido). Source remains charge
  `metadata.meeting`; the FT must not reprint the full name or
  mailbox. Stripe payment id stays `external_reference` only.
  Airbnb’s sample 0% reverse-charge IVA is **not** Eleva’s D-03 23%
  working example. `issueInvoice()` stays closed.
- Owner: founder (Rodrigo Barona)
- Status: `active`
- Related: D-03, `payments-payouts-spec.md` line item,
  `07-invoicing-toconline.md` Tier 1 description
- Next review: when live FT POST opens; confirm TOConline line-length
  and whether accountant prefers dropping email entirely.

### 2026-10-12: Platform commission FT customer is invoicing entity, not Identity

- Decision: Stripe Identity / Connect KYC identifies the **natural
  person**. The TOConline customer on Eleva commission FTs
  (`customer_business_name`, `customer_tax_registration_number`,
  address) is the **invoicing entity** the expert taxes under — either
  a personal NIF (ENI / natural person, typically 1–3…) or a company
  denomination + NIF (Unipessoal Lda and similar, typically 5…). An
  expert can have **both** on file; only one is the default FT
  customer. Julio is the Identity person;
  commission invoices go to **the Bee company** /
  company NIF and registered address on file — not his personal NIF.
  v3 still has a single
  `expert_profiles.nif` and does **not** yet store personal vs company
  identities (unbuilt). Manual 2026 ELEVA-FEE worksheets follow this
  split; `issueInvoice()` stays closed.
- Owner: founder (Rodrigo Barona)
- Status: `active`
- Related: D-03, `payments-payouts-spec.md` recipient
  (“professional legal name or denomination”), ADR-013,
  `expert_profiles.nif`,
  [`execution-plan/phases/07-invoicing-toconline.md`](./execution-plan/phases/07-invoicing-toconline.md)
  PR 07.3
- Next review: when PR 07.3 (expert billing profile + invoice mailbox)
  ships; do not treat the single `expert_profiles.nif` as this model.

### 2026-10-08: Guest confirm sends one booking mail; magic-link only on sign-in

- Decision: After a guest books, `guest-activation` still provisions an
  unverified Better Auth user, a personal Space, `memberUserId`, and
  re-keys consents. It does **not** send Better Auth's "Sign in to Eleva
  Care" magic-link email. Join stays on the confirmation mail (grant +
  `.ics`). Optional account creation is a durable
  `{GATEWAY}/signup?claim=1&name=&email=`
  CTA on member/guest `booking.confirmed` only — never a magic token in
  that mail (tokens expire in minutes; people keep confirmation emails
  for weeks). Magic-link is sent only when the member asks to sign in
  (`/login`, `/signup`, or `POST /auth/sign-in/magic-link`).
- Owner: engineering
- Status: `active`
- Related: Phase 09 guest join grant, thank-you UX
- Next review: after guest book → inbox (one mail) + thank-you CTA check.

### 2026-10-08: Guest join via signed Eleva grant in email and ICS

- Decision: Members can book without an account, so confirmation and
  1h-reminder emails (and ICS `URL`/`LOCATION`) mint a signed Eleva join
  grant at `/join/{bookingId}?g=`. The grant is HS256 (HKDF from
  `BETTER_AUTH_SECRET`), purpose `session-join`, role-bound
  (`member`|`expert`), exp = `endsAt + 30m`. Possession of a valid grant
  joins that role and ignores any session cookie. Guest bookings with no
  `memberUserId` mint Daily as `guest:{bookingId}` (audit actor null);
  never map `guestEmail` onto an existing account. A leaked grant can
  evict the real participant (`enforce_unique_user_ids`, last-join-wins);
  grants are bearer secrets. Daily meeting tokens
  stay in the POST JSON body only — never in URLs. In-app session CTAs
  stay cookie-based. Public grant POST uses BotID + `RATE_LIMITS.public`.
  Gateway first-segment `join` is reserved. Out of scope: overtime UI,
  Phase 10 notes, recording/transcripts, `sessions.eleva.care` CNAME.
- Owner: engineering
- Status: `active`
- Related: Phase 09, scheduling-booking-spec sessions section
- Next review: after local two-browser grant join.

### 2026-10-08: 09.0 standard Daily live probe PASS; Eleva join leftover

- Decision: The 09.0 account probe is **PASS** on standard Daily
  (`elevacare.daily.co`, recording off, **not HIPAA**). Evidence: REST
  `POST /rooms` for `eleva-97fc22a0-583d-424a-9dc7-c7742167192f`, paid
  quota 100k rooms, two browsers on the Daily Prebuilt mint URL, Daily
  session analytics Ended (2 participants, 8 min). Room contract now
  includes `enforce_unique_user_ids`. `DAILY_WEBHOOK_SECRET` is on Vercel
  `elevacare-api` (2026-10-08); Daily `GET /webhooks` is still empty until
  `elevacare-api` is redeployed and the staging webhook is created. Do
  **not** stamp the Phase 09 exit gate: Eleva join pages
  (`/expert/sessions/{id}/join` + `/{org}/sessions/{id}/join`) remain
  leftover. Do not
  delete the probe until the founder says so. Overtime / “coming to the
  end” warning is agreed, not built. D-07 stays deferred.
- Owner: engineering
- Status: `active`
- Related: ADR-018, spike `09-daily-account.md`, Phase 09
- Next review: after staging webhook + Eleva two-browser join.

### 2026-10-08: Phase 09 engineering closed on standard Daily, exit gate unproven

- Decision: Phase 09 slices 09.1–09.6.3 are on main (PRs #163–#170 plus this
  exit-gate stamp). Product is **standard Daily, recording off, not HIPAA**.
  Join Permissions-Policy is on `/sessions/.../join`. Meeting-token JWTs are
  redacted in observability and blocked by `pnpm check:no-phi-logs`. Do **not**
  stamp the phase exit gate as proven: the 09.0 Daily Prebuilt probe is
  PASS (see the 2026-10-08 addendum), Eleva two-browser join is still an
  operator leftover, and the
  delayed `ended + 2 min` `finalizeAttendance` job was never built (attendance
  SSOT remains `meeting.ended` plus the join-window sweep). D-07 stays
  deferred.
- Owner: engineering
- Status: `active`
- Related: ADR-018, spike `09-daily-account.md`, Phase 09.6
- Next review: after the first live room and a two-browser staging call.

### 2026-10-08: Daily webhook processed_at commits with the session write

- Decision: Phase 09.6.3b locks `daily_webhook_events` `FOR UPDATE` inside the
  same `withPlatformAudit` transaction as the session status/history write and
  stamps `processed_at` there. Insert-on-conflict still claims the event id so
  Daily retries can resume after a crash; a second apply that finds
  `processed_at` already set returns `{ status: "duplicate" }` without a second
  `ctx.emit`. Ignore paths (missing room, unknown room, session gone) still
  mark processed outside the session write because they do not mutate
  `sessions`.
- Owner: engineering
- Status: `active`
- Related: ADR-018, 2026-10-07 attendance SSOT, Phase 09.6
- Next review: if Daily delivers concurrent retries faster than the lock wait.

### 2026-10-08: Eject a revoked participant before shrinking Daily room capacity

- Decision: Phase 09.6.3a ejects+bans the revoked user, then updates
  `max_participants`. Shrinking the room first can leave a still-present
  revoked participant occupying the last slot. A retryable Daily eject
  failure does not shrink the room; `video-eject-retry` finishes eject
  then repairs capacity.
- Owner: engineering
- Status: `active`
- Related: ADR-018, two-phase revoke in Phase 09 Scope
- Next review: if Daily exposes a single eject+update room API.

### 2026-10-08: Attendance fallback after the join window closes when Daily is silent

- Decision: Phase 09.6.1 adds QStash `POST /workflows/video-attendance-sweep`
  (`*/15 * * * *`). Sessions still `scheduled`/`live`/`room_unresolved` with
  null `attendance` whose Eleva join window has closed (`endsAt + 30m`,
  `JOIN_TRAIL_MS`) are finalized from participant history (empty history →
  `nobody` / `no_show`). The phase prompt said `end_at + 15 min`; that would
  410 a still-open join. Fallback waits for the same trail as join/token
  `exp`. `meeting.ended` remains the happy path (09.3). Late participant
  events may still flip `no_show → ended`. Never flip `ended` back to
  `no_show`. No-show policy (refund/keep) stays out of Phase 09. The delayed
  `ended + 2 min` `finalizeAttendance` job is still not this slice.
- Owner: engineering
- Status: `active`
- Related: 2026-10-07 attendance SSOT, ADR-018, Phase 09.6
- Next review: if Daily webhooks prove reliable enough to drop the sweep.

### 2026-10-08: Payment-fail and full refund before startAt cancel the session

- Decision: Phase 09.5 cancels `sessions.status` and deletes the Daily room
  when `payment.failed` or a **full** `refund.succeeded` occurs **before**
  `startAt` (compared using the Stripe event time, not delivery time). Partial
  refunds and the same events after `startAt` leave the session intact. The
  room sweep does not recreate a room for a cancelled session. Booking
  `cancelled` still deletes the room.
- Owner: engineering
- Status: `active`
- Related: ADR-018, `scheduling-booking-spec.md`, Phase 09.5
- Next review: when D-07 HIPAA Daily is signed (room-name and recording rules
  change); this payment↔session rule stays.

### 2026-10-07: Session attendance finalizes on meeting.ended, then corrects

- Decision: Phase 09.3 writes `attendance` and `ended|no_show` on
  `meeting.ended` instead of scheduling `finalizeAttendance` at `ended + 2 min`.
  Late `participant.joined` / `participant.left` events still append history and
  may flip `no_show → ended` (`session.attendance_corrected`). They never flip
  `ended` back to `no_show`. No-show **policy** (refund/keep) stays out of
  Phase 09. Follow-ups (not this PR): QStash `finalizeAttendance` at
  `ended + 2 min`, and the `end_at + 15 min` fallback sweep when Daily sent
  nothing. Those land with 09.6 evidence.
- Owner: engineering. Status: `active`.
- Reference: [`execution-plan/phases/09-video-daily.md`](./execution-plan/phases/09-video-daily.md),
  [ADR-018](./adrs/ADR-018-daily-video-only.md)

### 2026-10-07: Founder defers D-07 BAA/HIPAA; Phase 09 opens on standard Daily

- Decision: the founder will show the running product to accounting and legal and does
  **not** want a Daily BAA or a HIPAA programme for now. Phase 09 engineering may
  proceed on a **standard (non-HIPAA) Daily** domain with recording off. D-07 is
  **deferred**, not signed. Stamp **not HIPAA**. Never claim BAA/DPA executed or
  that D-07 closed.
- This waiver unblocks Phase 09 **video engineering only**. It does **not** name
  FT POST, Comunicação, or `invoice.issued`. Those stay closed.
  `issueInvoice()` stays unconditionally closed. D-06, D-12 and Twilio IE1 stay
  open. Legal and trust pages stay draft-bannered.
- Production go-live that claims HIPAA or processes PHI on Daily still needs
  D-07 (founder + DPO, executed BAA/DPA, HIPAA domain) later. Until then,
  rooms use deterministic names (`eleva-{bookingId}`), not the HIPAA random-name
  fingerprint path.
- Owner: founder. Status: `active`.
- Reference: [`spikes/09-daily-account.md`](./spikes/09-daily-account.md),
  [`audits/2026-10-phase-09-readiness.md`](./audits/2026-10-phase-09-readiness.md),
  [ADR-018](./adrs/ADR-018-daily-video-only.md)

### 2026-10-07: Leftovers stay TODOs, not demo or Phase 09 blockers

- Decision: the founder will show the running product to accounting, legal
  and other stakeholders with honest notes. Staging W3, live pay→transfer→payout,
  D-06/D-12, tax issuance, Twilio IE1, the Daily account probe, and waived 04B
  UX are **TODOs**. They do **not** block Phase 09 engineering or a demo.
- Still closed by design (not TODOs to “just finish”): `issueInvoice()`,
  FT POST / Comunicação / `invoice.issued`, production PHI-video without D-07,
  expert cancel / no-show / custom policies.
- Owner: founder. Status: `active`.
- Reference: [`audits/2026-10-phase-09-readiness.md`](./audits/2026-10-phase-09-readiness.md)
  “Stakeholder leftovers”.

### 2026-10-07: Phases 01–08 production pass closeout

- Decision: the production pass (audit fixes, brand v2, UX inventory, evidence) is closed on
  `main`. Phase 09 video engineering later opened the same day under the
  standard-Daily waiver above; tax/issuance gates stayed closed. D-07 remains
  deferred (not signed). FT POST / Comunicação / `invoice.issued`, D-06,
  D-12 and Twilio IE1 stay open; the Phase 04B waiver stays waived/unproven.
- Evidence is loopback only (never Production): auth, member, member:stripe, cancellation
  smoke, phase06, axe a11y and Lighthouse pass. Staging W3 smokes and staging Stripe
  test-mode payouts were not run.
- AUD-025 (cancel/reschedule never freed paid slots) was found during the member e2e run
  and fixed in #154 with migration `0050`. Operator: run migrations `0049` and `0050` on
  staging, then production, before the next `apps/api` deploy.
- Follow-ups recorded, not shipped: dark mode on `apps/web` (light-only today), UX-009
  inline field errors, the 3 Phase 04B builder fixtures that need an expert session.
- Owner: engineering (code), operator (migrations, staging evidence). Status: `active`.
- Reference: [`audits/2026-10-phase-09-readiness.md`](./audits/2026-10-phase-09-readiness.md),
  [`audits/2026-09-phases-01-08-audit.md`](./audits/2026-09-phases-01-08-audit.md),
  [`audits/2026-10-ux-inventory.md`](./audits/2026-10-ux-inventory.md)

### 2026-10-06: BotID rollout is staged, production stays off (AUD-017)

- Decision: BotID is installed but gated by `BOTID_MODE` (`off` by default,
  then `monitor`, then `enforce`). Enforcement applies only to the booking
  funnel routes (reserve, confirm, payment intent); other routes that call
  `checkBot()` are also called server-to-server and stay monitor-only. In
  enforce mode a failed check counts as a bot.
- `extraAllowedHosts` alone cannot fix the cross-origin funnel: the BotID
  client (1.5.11) never signs cross-origin requests. The funnel therefore
  moves to a flagged same-origin `/api/*` rewrite on the gateway.
- Promotion gate (founder, 2026-10-06): staging must show two networks give
  two different rate-limit keys, the key matches Vercel's forwarded client IP,
  and BotID blocks a scripted request while real bookings pass. Runbook:
  `operator-tasks/botid-staging-validation.md`. Production stays `off` until
  then.
- Owner: engineering (code), operator (staging evidence). Status: `active`.

### 2026-10-06: Staff refunds above the dual-control threshold fail closed (AUD-022)

- Decision: a human staff refund acting for the platform above
  `ADMIN_DUAL_CONTROL_REFUND_CENTS` (200 EUR) returns `409 DUAL_CONTROL_REQUIRED`.
  The second-approver flow (`admin_action_requests`) is Phase 12, so until it ships
  there is no way to approve these refunds in-product. The automated cancellation
  refund sweep (no actor) and expert refunds in their own org are not gated.
- Members now see their expert invoice status (and number once issued) on the session
  detail. `issueInvoice()` stays closed, so rows read "Being prepared" until issuance
  opens.
- The AUD-022 "team app has no notifications page" item was stale: `/[orgSlug]/admin/notifications`
  shipped in #89. The Moloni adapter stays a disabled stub (backlog).
- Owner: engineering. Status: `active`. Revisit when Phase 12 dual control lands.

### 2026-10-06: Brand v2 evolution board approved

- Decision: the founder approved `brand-book/v2/README.md` as proposed. Teal
  `#006D77` (teal-700) and coral `#E29578` (coral-400) stay exact and anchor
  11-step OKLCH scales. `--secondary` becomes soft coral (coral-100 fill,
  coral-800 text). Product-app page titles (h1) use Lora; all other UI uses
  DM Sans, with IBM Plex Mono for data.
- Brand evolution, not a rebrand: logo, wordmark and name are unchanged. The
  only logo change is vectorising the PNG mark.
- Next: the kit PR maps these tokens into `@eleva/ui/globals.css`.
- Owner: founder (approval), engineering (kit). Status: `active`.

### 2026-10-06: Quiet hours silence non-urgent SMS (AUD-004)

- Decision: `sendNotification` reads the member's stored quiet hours and
  evaluates them in the stored timezone (UTC when missing or invalid). Inside
  the window, non-urgent kinds skip the SMS channel; email and in-app still
  deliver immediately, as the notifications spec requires. Urgent kinds
  (`booking.reminder_1h`, `payment.failed`) bypass quiet hours. Windows may
  wrap midnight; an equal start and end means no window.
- Pulled forward from Phase 13 at the founder's request (production pass,
  2026-10). Implements AUD-004 in
  `audits/2026-09-phases-01-08-audit.md` and the quiet-hours rule in
  `notifications-spec.md` (preferences section).
- Out of scope (follow-up): deferring the skipped SMS to the end of the
  window. Today it is skipped, not queued; the email and in-app copies are
  the record. Push does not exist yet.
- Owner: engineering. Status: `active`.

### 2026-09-26: Per-service cancellation policies (D-06 refund rules)

- Decision: each service (event type) carries one of three Airbnb-style
  presets. The member's refund is a percentage of what they paid, and the
  expert's payout and Eleva's commission shrink in proportion (no separate
  fee split).
  - **Flexible** (default): 100% until 24 h before the session, then 0%.
  - **Moderate**: 100% until 48 h before, 50% from 48 h to 24 h, then 0%.
  - **Strict**: 100% until 7 days before, 50% from 7 days to 48 h, then 0%.
  - A cancel exactly on a boundary gets the higher refund (at exactly 48 h,
    Moderate refunds 100%).
  - **Grace period:** 100% for 24 h after booking, as long as the session is
    at least 48 h away.
  - **Always 100%:** expert cancel, account deletion, hold expiry and staff
    override. Expert cancel does not exist in code yet; when it lands it must
    refund in full.
- Mechanics: the booking snapshots the policy and `cancellation_policy_version`
  at booking time, taken from the hold, which records the policy shown to the
  member before payment (same transaction as the funnel consents). A later
  change by the expert never affects existing bookings, and a reserve that
  sends a stale policy gets `409 POLICY_CHANGED`. Member cancel stores the
  refund target in `booking_payments.refund_due_cents`; the refund sweep
  refunds only that amount, and a partial refund before the transfer reduces
  the payout. The member can cancel any time before the session starts and
  sees the quote first (`GET /me/bookings/{id}/cancellation-quote`).
  Reschedule is allowed only while a cancel would still get a full refund.
- Owner: founder (product owner, working pre-launch)
- Status: active — working pre-launch. This fills in the cancellation-window
  part of D-06. It is **not** a finance/legal production sign-off, and it does
  not change the dispute or no-show parts of D-06.
- Review date: with the D-06 finance + legal re-sign before production.
- Reference: [`payments-payouts-spec.md`](./payments-payouts-spec.md) "Refunds",
  [`scheduling-booking-spec.md`](./scheduling-booking-spec.md) "Cancellation Rules",
  `packages/config/src/cancellation-policy.ts`
- **Out of scope (follow-ups):**
  - Expert-initiated cancel (always a 100% refund to the member; an expert penalty
    may apply later). No expert cancel path exists yet.
  - No-show policy (Phase 09 records attendance; D-06 then decides refund / keep /
    partial).
  - Discounted non-refundable option and custom policies beyond the three presets.
  - Legal review of the Strict preset for health services under Portuguese consumer
    and unfair-terms law. Policies must be shown clearly before payment; that review
    is part of the D-06 re-sign.

### 2026-09-25: Phases 01–08 audit triage (founder-approved pack)

- Decision: Founder approved the audit triage in
  [`audits/2026-09-phases-01-08-audit.md`](./audits/2026-09-phases-01-08-audit.md):
  - **Fix before Phase 09 implementation:** AUD-001 (cancel / deletion
    `refund_pending` never refunded; payout still transfers), AUD-008 (transfer
    idempotency remint), AUD-009 (payout created from full gross ignoring
    earlier refund/dispute), AUD-002 (public slots ignore external calendar
    busy), AUD-003 (hold-expiry sweep incomplete). AUD-013 (platform-fee row
    creation swallowed outside the ledger tx) rides in the billing PR.
  - **AUD-007 waived — transfers do not wait for an issued platform-fee
    invoice while `issueInvoice()` is closed.** Enforcing
    `platform_fee_invoices.status = 'issued'` before `transfers.create` today
    would freeze every payout. **Flip clause:** the PR that opens
    `issueInvoice()` / FT POST / `invoice.issued` must add the
    skip-transfer-until-issued check in `packages/billing/src/server/payouts.ts`
    in the same PR, with tests; the waiver ends when that PR merges.
  - **AUD-004 deferred** (quiet hours stored, not applied) to Phase 13. Phase 08
    exit wording "respecting quiet hours" is not met; stamp it deferred.
  - **AUD-006 deferred** (Stripe↔TOConline reconciliation compares
    `expert_invoices`, not platform-fee invoices minus credit notes) to the PR
    that opens issuance. Until then reconciliation mismatches are not a signal.
  - **Phase 09.0** (Daily account spike, docs/evidence only) may start as soon
    as D-07 (Daily HIPAA/BAA/DPA, founder + DPO) is in motion. This is a
    carve-out for the docs/evidence spike only and supersedes nothing else.
    Phase 09 implementation still needs all of: the fix pack above merged;
    FT POST / Comunicação / `invoice.issued` open, or a separate founder
    waiver naming all three; and D-07 signed by founder + DPO.
- Owner: founder (directive); stamped by engineering
- Status: active
- Related: [`execution-plan/phases/06-payments-payouts.md`](./execution-plan/phases/06-payments-payouts.md),
  [`07-invoicing-toconline.md`](./execution-plan/phases/07-invoicing-toconline.md),
  [`08-notifications-lane1.md`](./execution-plan/phases/08-notifications-lane1.md),
  [`09-video-daily.md`](./execution-plan/phases/09-video-daily.md)
- Next review: when the fix pack merges (stamp in the audit report), and when
  `issueInvoice()` opens (AUD-007 flip + AUD-006)

### 2026-09-25: Founder waives ALL Phase 04B human evidence

- Decision: Founder explicitly waived **all** Phase 04B human evidence for
  pre-Phase-09 closeout with intent “Waivo toda a evidência humana 04B”
  (2026-09-25). Waived items: design-pass screenshots (wizard/builder/calendar;
  light+dark; pt+en; 360+1280), multi-account calendar OAuth/busy
  (`use_for_busy`), destination-override live booking + revoke/reconnect,
  ICS→Apple Calendar subscribe proof, Connect UI→publish→funnel for net-new
  Quick chat / Physiotherapy, clinical publish-refusal UX next to fields, and
  private-link book-while-closed + revoke live UX. Engineering already on main
  stays as shipped; waiver closes the 04B **human** exit gate only — it does
  **not** claim those flows were operator-proven. **Not waived:** live FT POST,
  Comunicação, `issueInvoice()` / `invoice.issued` (Phase 07 hard gates).
  **Do not start Phase 09** — still blocked on those tax/issuance gates **and**
  on D-07 (Daily HIPAA/BAA/DPA founder+DPO sign-off). The 04B waiver does not
  close D-07.
- Owner: founder (directive); stamped by engineering
- Status: active
- Related: [`execution-plan/phases/04b-expert-offer-builder.md`](./execution-plan/phases/04b-expert-offer-builder.md),
  [`07-invoicing-toconline.md`](./execution-plan/phases/07-invoicing-toconline.md)
- Next review: only when Phase 07 hard gates open (or a separate founder waiver
  that explicitly names FT POST / Comunicação / `invoice.issued`) **and** D-07
  is signed (founder+DPO)

### 2026-09-24: Pre-Phase-09 evidence stamp (post-#109) + auth mailer Turbopack fix

- Decision: After `#109` (`pnpm i18n:draft` age gate) on main, attempt local
  `e2e/member.spec.ts` and stamp Phase 04B / 05–08 with founder evidence
  checklists (shipped engineering vs still-needed human/operator proof).
  Auth transactional mailer now lives on `globalThis` (and `/auth` ensures
  injection) so Turbopack instrumentation vs route graphs share one instance —
  fixes local signup/magic-link 500s ("mailer not injected"). Member prefs/DSAR
  and live Stripe remain **not green** this turn (Space settings `401
no-session` under local zone URLs; Stripe CLI key expired). Phase 07
  issuance stays closed. **Do not start Phase 09.**
- Owner: engineering
- Status: active
- Related: [`execution-plan/phases/04b-expert-offer-builder.md`](./execution-plan/phases/04b-expert-offer-builder.md),
  [`05-member-app.md`](./execution-plan/phases/05-member-app.md),
  [`06-payments-payouts.md`](./execution-plan/phases/06-payments-payouts.md),
  [`07-invoicing-toconline.md`](./execution-plan/phases/07-invoicing-toconline.md),
  [`08-notifications-lane1.md`](./execution-plan/phases/08-notifications-lane1.md)
- Next review: superseded for 04B human evidence by 2026-09-25 founder waiver;
  Phase 09 still blocked on Phase 07 tax/issuance gates

### 2026-09-24: Phase 04B `pnpm i18n:draft` + draft age gate

- Decision: Ship `@eleva/ai` `translateMessages`, root `pnpm i18n:draft` (writes
  `messages/<locale>.draft.json` envelopes `{ generatedAt, messages }` for keys
  missing vs `en`), and a 14-day draft age gate inside `check:i18n-parity`
  (age from `generatedAt`, not mtime — Git checkouts reset mtime). Re-runs
  merge new keys and preserve human edits / original `generatedAt`. Glossary
  SSOT is `packages/config/glossary.json` (members / Space / expert / Eleva) —
  not a separate `packages/i18n` package yet. Drafts never ship unreviewed.
- Owner: engineering
- Status: active
- Related: [`execution-plan/phases/04b-expert-offer-builder.md`](./execution-plan/phases/04b-expert-offer-builder.md),
  `#108` UI builder path
- Next review: Connect-ready UI-built funnel e2e, design pass, multi-account
  calendar busy evidence, member e2e / money-path honest stamps — or founder
  waiver before Phase 09

### 2026-09-24: Phase 04B UI-built offer fixture builder path

- Decision: Ship the minimal UI path for Quick chat / Physiotherapy fixtures:
  modes-panel country presets (EU ∩ service countries, Portugal only, all),
  inline named schedule + location create, and
  `createApiClient().ai.editorAssist` on event-type description. Parity
  ignores `*.draft.json`; `pnpm i18n:draft` shipped in a follow-up slice.
  Seeded public funnel remains the default e2e; `E2E_EXPERT_OFFER=1` covers
  builder affordances. Full UI→publish→funnel for net-new offers still needs a
  Connect-ready expert session — Phase 04B exit gate is **not** fully closed.
- Owner: engineering
- Status: active
- Related: [`execution-plan/phases/04b-expert-offer-builder.md`](./execution-plan/phases/04b-expert-offer-builder.md),
  `#107` Plate AI route
- Next review: Connect-ready UI-built funnel e2e, design pass, or founder
  waiver before Phase 09

### 2026-09-24: Phase 04B Plate AI editor assist route

- Decision: Ship `POST /ai/editor` + `@eleva/ai` `editorAssist` (streamText via
  Vercel AI Gateway, model pinned by `AI_GATEWAY_MODEL_EDITOR` +
  `assertApprovedModel`). Expert session + `expert:profile_edit`; org-owned
  `resource`/`resourceId` under org-scoped DB helpers; rate limit 30/h/org;
  context `clinical` rejected until Phase 10. Logs tokens/latency only.
- Owner: engineering
- Status: active
- Related: ADR-023, `phases/04b-expert-offer-builder.md`, `#106` destination
  overrides PR
- Next review: next 04B slice (UI-built Quick chat / Physiotherapy fixtures) or
  founder waiver of remaining acceptance items

### 2026-09-24: Phase 04B per-mode / per-event-type destination overrides

- Owner: engineering
- Status: active
- Summary: Nullable `destination_integration_id` +
  `destination_external_calendar_id` on `event_types` and
  `event_type_modes`. PATCH `/expert/event-types/[id]/destination` and
  `.../modes/[modeId]/destination`. Booking sync resolves mode >
  event type > expert default > ICS e-mail. Expert modes tab exposes
  override selects. Remaining 04B before Phase 09: Plate AI route,
  UI-built Quick chat / Physiotherapy fixtures.
- Related: [`execution-plan/phases/04b-expert-offer-builder.md`](./execution-plan/phases/04b-expert-offer-builder.md),
  [`calendar-integration-spec.md`](./calendar-integration-spec.md)
- Next review: next 04B slice or founder waiver of remaining acceptance items

### 2026-09-24: Phase 04B calendar busy + destination UI

- Owner: engineering
- Status: active
- Summary: Expert calendars page loads provider sub-calendars and wires
  existing busy-sources / destination APIs into the UI (checkboxes for
  conflict calendars, one destination radio per expert). Reconnect banner
  for error/expired accounts. Does **not** close Phase 04B exit gate:
  Eleva week view, ICS feed token routes, per-mode destination overrides,
  Plate AI route, and UI-built offer fixtures remain.
- Related: [`execution-plan/phases/04b-expert-offer-builder.md`](./execution-plan/phases/04b-expert-offer-builder.md),
  [`calendar-integration-spec.md`](./calendar-integration-spec.md)
- Next review: next 04B slice or founder waiver of remaining acceptance items

### 2026-09-24: Phase 04B services builder tabs (kind / policies / private links)

- Owner: engineering
- Status: active
- Summary: Expert event-type edit is a tabbed builder (Basics, Kind,
  Policies, Delivery modes, Private links). API gains `kind` /
  `visibility` on event-type create/update (kind changes re-check
  offer-invariants against active modes) and `/expert/booking-links`
  (list / create with one-time token / revoke). Closes backlog item (5)
  on the Phase 04B ordered list; exit gate still open for calendar
  polish, Plate AI route, and UI-built Quick chat / Physiotherapy
  fixtures.
- Related: [`execution-plan/phases/04b-expert-offer-builder.md`](./execution-plan/phases/04b-expert-offer-builder.md)
- Next review: next 04B slice or founder waiver of remaining acceptance items

### 2026-09-24: Self-host Eleva UI fonts via next/font/local

- Owner: engineering
- Status: active
- Summary: `@eleva/ui` brand fonts (Lora, DM Sans, IBM Plex Mono) now load
  through `next/font/local` with vendored latin WOFF2 files under
  `packages/ui/src/fonts/files/`, not `next/font/google`. Next.js 16.2
  Turbopack CI builds were flaking on GHA with
  `Can't resolve '@vercel/turbopack-next/internal/font/google/font'` /
  `next/font/google queries have exactly one entry` when parallel app
  builds fetched Google Fonts (seen on main after #98 and on #99). Local
  files remove the build-time network fetch so Turbopack no longer hits
  that path. CSS variable names (`--font-lora`, `--font-dm-sans`,
  `--font-ibm-plex-mono`) and `fontClassName` stay unchanged for app
  layouts. Do not switch back to `next/font/google` without verifying
  parallel Turbopack CI builds across all apps that import `@eleva/ui/fonts`.
- Related: `packages/ui/src/fonts.ts`, `packages/ui/src/fonts/README.md`
- Next review: if Next.js documents a stable Turbopack google-font fix
  and we want to drop vendored binaries

### 2026-09-24: Phase 04B onboarding Practice step

- Owner: engineering
- Status: active
- Summary: Add the expert onboarding **Practice** wizard step (practice
  country, service countries with legal helper, languages, licence scope,
  worldwide remote) wired to `PATCH /expert/practice`. Completing Practice
  requires `practice_country` + >= 1 language; completing schedule ensures a
  default schedule exists. Does **not** close the Phase 04B exit gate:
  services builder tabs (kind/policies/private links), calendar polish, Plate
  AI, and UI-built Quick chat / Physiotherapy remain open. Do not start Phase 09.
- Related: [`execution-plan/phases/04b-expert-offer-builder.md`](./execution-plan/phases/04b-expert-offer-builder.md)
- Next review: next 04B slice or founder waiver of remaining acceptance items

### 2026-09-24: Phase 04B modes panel + seeded offer e2e (partial exit)

- Owner: engineering
- Status: active
- Summary: Ship the event-type **delivery modes** panel (create / edit /
  deactivate via `/expert/event-types/.../modes`) and
  `e2e/expert-offer.spec.ts` asserting **seeded** fisiomota mode cards on the
  public funnel (`pnpm e2e:expert-offer` / included in `e2e:phase04`). This
  does **not** close the Phase 04B exit gate: UI-built Quick chat /
  Physiotherapy fixtures, private links tab, calendar polish, and Plate AI
  remain open (Practice step closed in a later 2026-09-24 slice). Do not start
  Phase 09.
- Related: [`execution-plan/phases/04b-expert-offer-builder.md`](./execution-plan/phases/04b-expert-offer-builder.md)
- Next review: next 04B slice or founder waiver of remaining acceptance items

### 2026-09-25: Phase 08 Twilio Virtual Phone SMS smoke (US1 Trial)

- Owner: engineering (loopback operator)
- Status: closed (channel smoke); IE1 credentials still open
- Summary: Loopback SMS to Twilio Virtual Phone `+18777804236` via
  `TWILIO_MESSAGING_SERVICE_SID` delivered (`SM8417964bd3affb356325af38530cb5d2`,
  status `delivered`) using the same `sendViaTwilio` client as
  `POST /me/phone/verify-start`. Account type Trial, **US1** Auth Token.
  `region=ie1`/`edge=dublin` with the US1 token returns Twilio `20003` —
  install an IE1 Auth Token (or API key) before claiming EU residency. Env
  typo `TWILIO_MESSAGE_SERVICE_SID` is ignored by code. **`invoice.issued` /
  `invoice.failed` stay off** `NOTIFICATION_KINDS`. No Phase 09 / FT POST.
- Related: [`execution-plan/phases/08-notifications-lane1.md`](./execution-plan/phases/08-notifications-lane1.md),
  [`integration-runbooks.md`](./integration-runbooks.md)
- Next review: when IE1 credentials land in env (Vercel + local)

### 2026-09-22: Phase 01–08 closeout before Phase 09 (resume 04B)

- Owner: engineering (founder directive)
- Status: active
- Summary: Before Phase 09, close remaining gaps for phases 01–08. Phase
  **04B** (`@eleva/editor`, expert offer builder, `e2e/expert-offer.spec.ts`)
  was deferred while 05–08 shipped and is now the first closable engineering
  backlog. Phase **05** needs local `e2e/member.spec.ts` execution evidence.
  Phase **06** money-path e2e stays Stripe test-mode / contract-level only
  (no live Stripe abuse). Phase **07** exit gate stays **blocked** (no live
  FT POST / Comunicação / `issueInvoice()`). Phase **08** may SMS-smoke with
  local Twilio; **`invoice.issued` stays off** `NOTIFICATION_KINDS` until
  invoicing opens. Do **not** invent DPO/legal sign-off. Phase 09 must not
  start until this closeout is reported.
- Clarification (2026-09-25): Phase **05** loopback evidence closed via `#113`.
  Phase **08** Virtual Phone SMS smoke closed (US1 Trial deliver); IE1 Auth
  Token still required for EU path. **04B human evidence waived** by founder
  2026-09-25 (“Waivo toda a evidência humana 04B”). Remaining pre-Phase-09
  blockers: hard-blocked **07** FT POST / Comunicação / `invoice.issued`,
  **and** D-07 (Daily HIPAA/BAA/DPA founder+DPO sign-off) — the 04B waiver
  closes neither. Do **not** start Phase 09 until both are satisfied.
- Related: [`execution-plan/phases/04b-expert-offer-builder.md`](./execution-plan/phases/04b-expert-offer-builder.md),
  ADR-023
- Next review: when Phase 07 hard gates open (do not start Phase 09 before then)
- Clarification (same day): ADR-023 storage field is **`json`** (not `value`). The phase
  prompt's `{ value, html, text }` spelling is corrected to match the ADR.

### 2026-09-22: Lane 2 marketing stub (sync + triggerAutomation)

- Owner: engineering
- Status: active
- Summary: Phase 08 Lane 2 stub lands `syncMarketingContact` and
  `triggerAutomation` in `@eleva/notifications`. Sync upserts only
  email / first name / locale into Resend Contacts when account-scope
  `marketing` consent is active, and deletes the contact on withdraw.
  `PUT /me/consents` awaits sync for `kind=marketing` (502 on Resend
  failure so the idempotent PUT can be retried). Optional segment
  targeting uses `RESEND_MARKETING_SEGMENT_ID` (preferred) or legacy
  `RESEND_AUDIENCE_ID`. `triggerAutomation` derives first_name/locale
  from the Neon user row; callers may only pass closed `plan_tier` and
  `generic_booking_count`. Per-user in-process lock serializes sync.
  `invoice.issued` / `invoice.failed` stay off the union.
- Reference: `packages/notifications/src/sync-marketing-contact.ts`,
  `packages/notifications/src/trigger-automation.ts`,
  `apps/api/src/app/me/consents/route.ts`
- Next review date: when Lane 2 domain fan-out (welcome / re-engagement)
  is wired in a later phase

### 2026-09-22: Resend delivery webhooks update deliveries and suppressions

- Owner: engineering
- Status: active
- Summary: `POST /webhooks/resend` verifies Svix headers with
  `RESEND_WEBHOOK_SECRET`. Handled events: `email.delivered`,
  `email.bounced`, `email.complained`. Rows match on `tags.deliveryId`
  then `provider_id`. Permanent (`Permanent`) bounces and complaints
  upsert `email_suppressions` (`hard_bounce` / `complaint`); transient
  bounces update the delivery row only. Canonical URL is
  `/webhooks/resend` (not `/resend/events`). Lane 2 marketing stub
  shipped in a follow-up PR the same day. `invoice.issued` stays off
  the union.
- Reference: `packages/notifications/src/handle-resend-webhook.ts`,
  `apps/api/src/app/webhooks/resend/route.ts`
- Next review date: when email.suppressed webhook handling is added

### 2026-09-21: In-app inbox polls via SWR (30s)

- Owner: engineering
- Status: active
- Summary: Phase 08 inbox (NavBell + `/notifications` pages) uses SWR
  polling every 30 seconds against `GET /notifications` instead of
  `LISTEN/NOTIFY` realtime. RLS still scopes rows to the session user
  and active org. Cache keys include `orgSlug` / `inboxUrl` so a
  workspace switch does not flash another org's titles. Inbox rows
  use `title` / `body` / `href` / `data` (not the earlier
  `payload` / `link` sketch).
- Related: `docs/eleva-v3/notifications-spec.md`, ADR-006
- Next review: if inbox volume or unread latency needs push/realtime

### 2026-09-21: Twilio EU SMS for Lane 1 (verified phone only)

- Owner: engineering
- Status: active
- Summary: Lane 1 SMS uses Twilio Programmable Messaging with region
  `ie1` / edge `dublin` and `TWILIO_MESSAGING_SERVICE_SID`. A member
  gets SMS only after `POST /me/phone/verify-start` + `verify-confirm`
  (6-digit OTP, 10 min, hashed) and when the category SMS preference
  is on. StatusCallback is `POST /webhooks/twilio/status`; the
  signature URL is rebuilt from server-only `API_URL` plus the raw
  query string (never re-encoded). SMS is at-least-once: adopt by
  `sha256(body) === sms_body_hash` before a re-send. `invoice.issued`
  stays off `NOTIFICATION_KINDS`. No live FT / Comunicação.
- Reference: `packages/notifications/src/send-sms.ts`,
  `docs/eleva-v3/execution-plan/phases/08-notifications-lane1.md`
- Next review date: when inbox API + bell land

### 2026-09-21: Booking reminders use QStash notBefore (Phase 08 exception)

- Owner: engineering
- Status: active
- Summary: Phase 08 schedules T-24h and T-1h reminders as delayed
  QStash messages (`notBefore`, dedup `bookingId:kind:startsAt`) on
  `booking.confirmed` and `booking.rescheduled`. The handler
  `POST /workflows/booking-reminder` re-checks that the booking is
  still `confirmed` or `rescheduled` and that `startsAt` still matches;
  cancel does not delete the QStash message. This is a documented
  exception to ADR-007's "QStash is cron-only" wording: the Phase 08
  plan names QStash `notBefore` for per-booking reminders, and Vercel
  Workflows DevKit is not used for this delay. Recurring ops stay on
  QStash cron. `invoice.issued` stays off the union.
- Reference: `packages/workflows/src/notifications/reminders.ts`,
  ADR-007, `docs/eleva-v3/execution-plan/phases/08-notifications-lane1.md`
- Next review date: Phase 09 video join-link reminder copy

### 2026-09-21: Payment and payout mail fan out through sendNotification

- Owner: engineering
- Status: active
- Summary: `payment.failed` emits from `markBookingPaymentFailed`.
  `payment.receipt` emits on Stripe `payment_intent.succeeded` after the
  booking payment row is updated. `payout.approval_required` emits when a
  payout state is created above the staff threshold. `payout.paid` emits
  from `markPayoutPaidOut`. Billing and scheduling mirror the outbox
  insert because they cannot import `@eleva/workflows`. Recipients:
  member (or guest email) for payment kinds, expert-org operators for
  `payout.paid`, Better Auth `platform_admin` / `staff_finance` for
  `payout.approval_required`. `invoice.issued` stays off the union.
- Reference: `packages/notifications/src/send-payment-payout-notification.ts`,
  `packages/billing/src/emit-domain-event.ts`
- Next review date: when inbox API + bell land

### 2026-09-21: Booking confirm/cancel/reschedule fan out through sendNotification

- Owner: engineering
- Status: active
- Summary: `confirmBookingPayment`, `cancelMemberBooking`, and
  `rescheduleMemberBooking` emit `booking.confirmed` /
  `booking.cancelled` / `booking.rescheduled` on the domain-events
  outbox (same tx as the booking write). The `send-notification`
  subscriber loads the booking and calls `sendNotification` for the
  member (or guest email) and the expert with the same idempotency
  key. Reschedule keys include `bookings.schedule_revision` so an
  A→B→A→B sequence does not reuse the first outbox row; the revision
  increments in the same transaction as the slot write. Delayed
  reschedule events skip unless `payload.scheduleRevision` matches
  the booking row. Cancel/reschedule updates also lock `starts_at`
  so a concurrent slot change cannot emit the previous time. Direct Resend
  ICS mail is a no-op so those emails are not sent twice; ICS
  attachments stay a later slice. `invoice.issued` / `invoice.failed`
  stay off the union.
- Reference: `packages/notifications/src/send-booking-notification.ts`,
  `packages/scheduling/src/emit-domain-event.ts`
- Next review date: when inbox API + bell land

### 2026-09-18: Better Auth mail goes through sendNotification

- Owner: engineering
- Status: active
- Summary: Better Auth callbacks (verify, reset, magic link, 2FA OTP,
  org invitation) call an injected `AuthTransactionalMailer`. Verify,
  reset, and magic-link persist e2e URLs in `@eleva/auth`; OTP and org
  invitation do not. `apps/api` instrumentation constructs
  `createAuthMailer()` from `@eleva/notifications`. There is no import
  edge between `@eleva/auth` and `@eleva/notifications`. `@eleva/email`
  is renderer-only (no `resend`). `invoice.issued` stays off the union.
- Reference: `packages/notifications/src/auth-mailer.ts`,
  `apps/api/src/instrumentation.ts`
- Next review date: booking fan-out landed 2026-09-21

### 2026-09-18: Phase 08.3 notification tables do not imply issued FTs

- Owner: engineering
- Status: superseded
- Summary: Lane 1 schema (`notifications`, `notification_deliveries`,
  `email_suppressions`, `phone_verifications`) and `NOTIFICATION_KINDS`
  land without `invoice.issued` / `invoice.failed`. Kind CHECKs and
  org-scope CHECKs keep the union honest. OTP `code_hash` is
  service-only. Delivery rows are claimed before any provider call.
  Closed-gate invoice emails remain the only live send path until
  `sendNotification` is wired.
- Reference: `packages/db/src/schema/main/notifications.ts`,
  `packages/notifications/src/kinds.ts`
- Next review date: superseded the same day by the sendNotification claim/lease entry

### 2026-09-18: sendNotification claims before provider and uses Resend idempotency

- Owner: engineering
- Status: active
- Summary: `sendNotification` inserts a `queued` delivery row with
  `lease_owner` + `claimed_at` before any provider call. Unique conflict
  returns `sent` as a no-op, or reclaims `queued` rows older than 60 s.
  Completion is CAS on `lease_owner` + `claimed_at`. Email uses Resend
  `Idempotency-Key` = delivery id (24 h) and `deliveryId` tags. The
  accepted Resend id is persisted on `provider_id` before CAS complete so
  a lost lease after 24 h does not list-scan. List/get tag adoption is
  the fallback for rows that never stored the id. In-app inserts are
  keyed by `data.deliveryId`. SMS is not sent
  in this slice. `invoice.issued` stays off the union.
- Reference: `packages/notifications/src/send-notification.ts`,
  `docs/eleva-v3/notifications-spec.md`
- Next review date: when Twilio SMS lands

### 2026-09-18: Closed-gate invoice emails go to expert-org operators

- Owner: engineering
- Status: active
- Summary: `send-notification` is registered for `invoice.blocked` /
  `invoice.skipped` / `invoice.pending`. It emails owner/admin members of
  `expertOrgId` (payment category, required) using `@eleva/email` closed-gate
  templates and Resend. Payloads with a document number or PDF are rejected.
  `invoice.issued` / `invoice.failed` stay off the union. No TOConline POST
  and `issueInvoice()` stays closed.
- Reference: `packages/notifications/src/send-closed-gate-invoice.ts`,
  `packages/workflows/src/subscribers/send-notification.ts`
- Next review date: when `issueInvoice()` is allowed to POST

### 2026-09-18: Phase 08 consumes closed-gate invoice events, not issued FTs

- Owner: engineering
- Status: active
- Summary: Live FT issuance is still closed (`issueInvoice()` and v1 POST
  stay shut). Phase 08.1 therefore emits domain events only when
  `platform_fee_invoices` persist as `blocked`, `skipped`, or `pending`
  (`invoice.blocked` | `invoice.skipped` | `invoice.pending`). Payloads
  keep `number` and `pdfUrl` null. `invoice.issued` / `invoice.failed` /
  `invoice.credited` stay off the union until a real document exists.
  Outbox deliveries use `send-notification`. Diagnostic logging is not a
  delivery and must not mark the event succeeded without sending.
- Reference: `packages/accounting/src/platform-fee-events.ts`,
  `packages/workflows/src/domain-events.ts`, D-09
- Next review date: when `issueInvoice()` is allowed to POST

### 2026-09-18: 07.1 issuePlatformFeeInvoice is closed-gate

- Owner: engineering
- Status: active
- Summary: Payment-success (`payment_intent.succeeded`) calls
  `issuePlatformFeeInvoice`, which classifies IVA with the conservative
  matrix from #76, runs GET-only tax lookups when a lookup client is
  supplied, and records `blocked`, `skipped`, or retryable `pending` on
  `platform_fee_invoices`. When `ff.toconline_invoicing_enabled` is off, or
  `paidAt` is missing, it returns skipped with no row so a later replay can
  still write. Issuable PT territorial / reverse-charge rows stay
  `pending` with `iva_lookup_unavailable` (ivaRateBps 0 until GET `/taxes`
  succeeds) so a later replay can still classify. Classifier skips
  (`eu_unclassified`, extra-EU, VIES fail-closed, zero fee) persist
  `skipped`. Credit notes are
  originated only when `creditNoteAllocation.platformFeeGross > 0`
  (commission reduction / Manolo 2026-09-15) — a member refund without a
  commission reduction does not create an Eleva NC. Each commission-reducing
  refund records its own blocked NC keyed by `booking_refund_id` so later
  partial refunds are not dropped. `issueInvoice()` and
  v1 `POST /api/v1/commercial_sales_documents` stay unconditionally
  closed. No Comunicar TEST. AT stays `operator_gated`.
- Reference: `packages/accounting/src/platform-fee-issue.ts`, D-03, D-09,
  07.2.1 issuance-gate
- Next review date: remaining Manolo confirmation of live tax
  codes/rates/legal mentions before production issuance

### 2026-09-17: 07.1 IVA matrix is conservative classifiers + GET lookups

- Owner: engineering
- Status: active
- Summary: `classifyIvaRegime` / `resolveIvaLookups` may encode the
  accountant 2026-09-15 conditions in code. PT territorial rates come from
  `GET /api/taxes` (NOR + the expert's `tax_country_region`, including
  `PT-AC` / `PT-MA`), not a hardcoded production rate. EU reverse
  charge requires a VAT number, a valid VIES result, **and** an explicit
  legal-requirement flag, then ISE + exemption code M07 lookup. EU without
  valid VIES is `eu_unclassified` (not auto-consumer). Extra-EU is
  `extra_eu_unclassified` (not indiscriminate zero-rate / not M99). VIES
  downtime fail-closes and is not cached. A 24h VIES cache helper exists
  for engineering; it does **not** supersede D-03 — intra-EU issuance
  stays blocked until the accountant specifically validates 24h reuse +
  downtime (`reverseChargeLegalReqsMet` must stay false until then). OSS
  thresholds are not invented. Still no TOConline v1 POST and no AT
  Comunicação.
- Reference: `packages/accounting/src/core/iva-matrix.ts`,
  `@eleva/accounting/adapters` (`resolveIvaLookups`), ADR-013 (package
  already owns TOConline platform-fee and expert adapters), D-03, D-09
- Next review date: remaining Manolo confirmation of live tax codes/rates
  /legal mentions before production issuance

### 2026-09-17: Founder instruction — IVA/TOC matrix is implementable; 07.1 engineering unblocked

- Owner: founder (Rodrigo Barona)
- Status: active
- Summary: Remaining tax codes, rates, and legal mentions from
  [`payments-payouts-spec.md`](./payments-payouts-spec.md) plus the
  accountant 2026-09-15 Manolo (MB) **Aprovado com condições** may now be
  **implemented in code** so Phase 07.1 engineering can start (schema,
  tax lookups, `issuePlatformFeeInvoice` orchestration, credit notes on
  commission reduction). This is **not** DPO/legal production sign-off and
  **not** permission to Comunicar TEST or to issue fictitious finalized
  documents. AT Comunicação stays operator-gated. TOConline v1
  `POST /api/v1/commercial_sales_documents` auto-finalizes;
  `issueInvoice()` / `assertV1SalesDocumentPostAllowed()` stay
  **unconditionally closed**. Do not treat
  `TOCONLINE_ALLOW_V1_AUTO_FINALIZE`, a TEST prefix, or 07.1 scaffolding
  as permission to POST.
  Accountant conditions still bind the code: EU without a valid VIES NIF
  is **not** auto-classified as consumer; extra-EU is **not** an
  indiscriminate zero-rate; VIES 24h reuse + downtime must fail closed
  or queue — do not invent OSS thresholds. Prefer mapping, GET `/taxes`
  lookups, and dry-run over creating finalized FTs. Do not Comunicar
  TEST FT/NC. Do not use ELEVA production series to simulate.
- Reference: D-03, D-09, 2026-09-15 accountant entry,
  [`accountant-approval-2026-09-15.md`](./accountant-approval-2026-09-15.md),
  [`execution-plan/phases/07-invoicing-toconline.md`](./execution-plan/phases/07-invoicing-toconline.md)
- Next review date: ELEVA series communication and remaining Manolo
  confirmation of live tax codes/rates/legal mentions before production
  issuance

### 2026-09-17: 07.1 platform_fee_invoices schema lands closed-gate

- Owner: engineering
- Status: active
- Summary: Schema + RLS for `platform_fee_invoices`,
  `platform_fee_credit_notes`, and `clinic_saas_invoices`. Staff
  `GET /invoicing/platform-fee` lists rows by Lisbon month. No TOConline
  v1 POST and no AT Comunicação. `at_status` defaults to `operator_gated`.
  `iva_regime` is a conservative classifier (`eu_unclassified`,
  `extra_eu_unclassified`, `vies_unavailable`) — not a signed automatic
  table and not auto-consumer / indiscriminate zero-rate. Credit-note
  reason is `commission_reduction` only. D-09 `legacy` / `legacy_missing`
  exist so pre-cutover rows are never reissued. Platform-admin read/write
  bypass matches `expert_invoices` so webhooks can insert without an
  expert session. Live issuance stays closed.
- Reference: `packages/db/src/schema/main/platform-fee-invoices.ts`,
  D-03, D-09, 07.2.1 issuance-gate
- Next review date: 07.1 tax-matrix + `issuePlatformFeeInvoice` slices;
  still refuse v1 POST

### 2026-09-17: Reconciliation status is existence-only; invoices load independently

- Owner: engineering
- Status: active
- Summary: Follow-up to 07.2.6. While the v1 issuance gate is closed,
  `accounting_reconciliation_runs.status` is `mismatch` only when a paid
  booking lacks an invoice row or an invoice has no paid booking in the
  month (`missingInvoiceCount` / `extraInvoiceCount`). Amount differences
  and `mismatchBps` stay informational. `loadLedgers` queries
  `expert_invoices` by Lisbon `createdAt` independently of paid booking
  IDs, so invoice-only months cannot report as matched. Invoice totals
  include extras. Pending, failed, and blocked rows are not mismatches.
  Tier 1 `platform_fee_invoices` comparison stays skipped until 07.1. No
  FT POST and `issueInvoice()` stays closed.
- Reference: `packages/accounting/src/reconciliation.ts`, 07.2.6 entry,
  D-03, D-09, D-18
- Next review date: 07.1 engineering unblocked 2026-09-17; live POST still gated

### 2026-09-17: Phase 07.2.6 Stripe vs expert_invoices reconciliation does not issue

- Owner: engineering
- Status: active
- Summary: `POST /workflows/stripe-toconline-reconciliation` (QStash monthly,
  1st 04:00 UTC) compares paid `booking_payments` to `expert_invoices` for the
  previous Lisbon calendar month. It persists `accounting_reconciliation_runs`
  and staff can read via `GET /accounting/reconciliation`. Coverage is invoice
  **row existence** (pending/failed/blocked is not a mismatch while the v1
  gate is closed). The job must not POST `/api/v1/commercial_sales_documents`,
  never Comunicar TEST, and never use ELEVA to simulate. Tier 1
  `platform_fee_invoices` comparison is skipped until 07.1.
- Reference: `reconciliation.ts`, D-03, D-09, D-18, 07.2.1 issuance-gate entry
- Next review date: 07.1 engineering unblocked 2026-09-17; live POST still gated

### 2026-09-17: Phase 07.2.5 retry + operator stub stay behind the closed gate

- Owner: engineering
- Status: active
- Summary: `POST /workflows/invoicing-retry` (QStash every 30 min) re-dispatches
  **failed** expert invoices through `retryExpertInvoice` / `issueInvoice()`.
  The v1 auto-finalize gate stays closed: retries must record
  `toconline_v1_auto_finalize_blocked` (blocked/skip), never POST
  `/api/v1/commercial_sales_documents`, never Comunicar TEST, and never use
  ELEVA to simulate. The cron follows D-18: QStash + `runInternalWorkflow`,
  not Vercel Workflows DevKit `"use workflow"`. Operator checklist:
  [`operator-tasks/toconline-setup.md`](./operator-tasks/toconline-setup.md).
- Reference: `invoicing-retry.ts`, D-03, D-09, D-18, 07.2.1 issuance-gate entry
- Next review date: 07.1 engineering unblocked 2026-09-17; live POST still gated

### 2026-09-15: Phase 07.2.1 keeps v1 issuance unconditionally closed

- Owner: engineering
- Status: active
- Summary: Phase 07.2.1 ships TOConline OAuth + TEST series lookup +
  `expert_invoices` schema. `issueInvoice()` / `assertV1SalesDocumentPostAllowed()`
  always throw `toconline_v1_auto_finalize_blocked`. Do not treat
  `TOCONLINE_ALLOW_V1_AUTO_FINALIZE`, a TEST prefix, or PR 07.1 scaffolding as
  permission to POST `/api/v1/commercial_sales_documents`. PR 07.1 acceptance
  that required `issued` FTs, finalize, or Comunicação à AT stays deferred.
  Founder 2026-09-17 unblocks **engineering** of the IVA matrix and 07.1
  code paths; it does not open the v1 POST. Accountant 2026-09-15
  (Manolo (MB)): D-09/D-03 Aprovado com condições.
- Reference: `issuance-gate.ts`, D-03, D-09,
  [`accountant-approval-2026-09-15.md`](./accountant-approval-2026-09-15.md)
- Next review date: 07.1 engineering unblocked 2026-09-17; live POST still gated

### 2026-09-15: Accountant written reply — Aprovado com condições (not a 07.1 issuance unlock)

- Owner: accountant (`Manolo (MB)`);
  recorded by engineering from the founder paste
- Status: active — **Aprovado com condições**, 2026-09-15,
  `Manolo (MB)`. This **is** the
  accountant written reply, with conditions. It is **not** a founder
  D-03–D-06 substitute for accountant production sign-off. It does **not**
  authorize activating automatic issuance or intra-EU flows whose fiscal
  configuration is not yet validated.
- Summary: After review of the proposed Eleva v3 invoicing model, the
  accountant authorized recording this reply in the decision diary as
  **"Aprovado com condições"**, with the date and their name. Automatic
  issuance may be activated only after the stated conditions are met and
  pending fiscal parameters are confirmed. Full verbatim text:
  [`accountant-approval-2026-09-15.md`](./accountant-approval-2026-09-15.md).
  Point-by-point (no invented legal terms): (1) two-tier invoicing model
  **Aprovado**, presupposing that contracts and actual operation frame Eleva
  as intermediary and that amounts collected on behalf of professionals are
  treated that way in accounting; (2) historical `legacy` /
  `legacy_missing` **Aprovado** — see D-09; (3) IVA matrix **Aprovado com
  condições** — see D-03 and the payments spec (pending before production:
  tax codes, rates, legal mentions; VIES 24h reuse + downtime procedure before
  activating intra-EU flows; OSS depends on service/operation classification;
  EU without a valid VIES NIF is not automatically a consumer; extra-EU is
  not an indiscriminate “zero rate”); (4) issuance timing and VAT-inclusive
  commission **Aprovado** — see D-03; (5) credit notes **Aprovado** with
  conditions in the payments spec; (6) billing data + commercial cent rounding
  **Aprovado**, provided taxable base, IVA and total stay compatible with
  legal rules and TOConline — no “single rounding” rule that produces
  divergences; (7) TEST series / no fictitious fiscal documents **Aprovado**;
  ELEVA production series depend on legally required procedures including
  series communication and fiscal configuration; (8) activation **Aprovado
  com condições**.
- Reference:
  [`accountant-approval-2026-09-15.md`](./accountant-approval-2026-09-15.md),
  D-03, D-09,
  [`payments-payouts-spec.md`](./payments-payouts-spec.md),
  [`execution-plan/phases/07-invoicing-toconline.md`](./execution-plan/phases/07-invoicing-toconline.md)

### 2026-09-15: `expert_invoices` is tenant-owned with platform-admin bypass

- Owner: engineering
- Status: active
- Summary: Phase 07.2.1 adds `expert_invoices` (Tier 2 expert → member
  invoice log). RLS class is tenant-owned on `org_id` (= expert org).
  Platform-admin bypass is required so the Stripe webhook / invoicing
  dispatcher can insert `pending` rows with no expert session. A composite
  foreign key `(booking_id, org_id)` → `bookings(id, org_id)` prevents
  cross-tenant invoice rows. Optional `bookings.buyer_tax_id` stores the
  member NIF for later issuance. This does not enable Tier 1 ELEVA
  issuance. D-09 historical classification is recorded separately as
  Aprovado com condições (2026-09-15).
- Reference: ADR-013, `0035_expert_invoices`, D-09 (Aprovado com condições)
- Next review date: with PR 07.2 issuance / Become-Partner gating

### 2026-09-14: TEST FT/NC stay TOConline-only; never communicate TEST to AT

- Owner: founder (Rodrigo Barona)
- Status: active
- Summary: TEST FT and NC series stay **active inside TOConline** for
  sandbox/API testing. They are **never** communicated to AT (`Comunicar
série`) — that would register them as official Portuguese document series.
  TOConline refuses sales-document issuance until a series is AT-communicated;
  that refusal is expected on TEST. When ready for live invoicing, communicate
  and issue on **ELEVA** (and `ELEVA-FEE-*` / `ELEVA-SAAS-*`), not TEST.
  Document AT (`send_document_at_webservice`) also stays off for TEST. This
  closes 07.0 without a TEST invoice. D-09 historical classification is
  Aprovado com condições (2026-09-15). 07.1 automatic production issuance
  stays blocked on remaining fiscal-parameter confirmation. Next
  engineering slice is 07.2.
- Reference: [`spikes/07-toconline.md`](./spikes/07-toconline.md), D-09,
  [`execution-plan/phases/07-invoicing-toconline.md`](./execution-plan/phases/07-invoicing-toconline.md)

### 2026-09-14: Phase 07.0 OAuth + TEST series proven; issuance blocked on AT series communication

- Owner: engineering (spike) + operator (communicate TEST series) + accountant (IVA / D-09)
- Status: superseded by the founder 2026-09-14 entry (TEST stays uncommunicated)
- Review date: with D-09 (2026-09-21 while D-09 is `proposed`)
- Summary: Re-run with a real Dados API secret (not a copy of the client id)
  proved official Authorization Code (`GET /auth` 302 Location code, no
  browser follow; `POST /token` HTTP Basic), refresh grant `expires_in=14400`,
  TEST FT id=337 / NC id=343, customer NIF `999999990`, service
  `ELEVA-SPIKE-070`. Both TEST series have `at_status=uncommunicated`, so
  `POST /api/v1/commercial_sales_documents` refuses issuance. Official
  payment codes are `MO`/`TR` (SAF-T `TB` is rejected). Document AT (check 06) stayed off (`TOCONLINE_SPIKE_SEND_AT` unset). Live `ELEVA` unused.
  Superseded: founder decided not to communicate TEST to AT.
  PR 07.1 stays blocked on D-09.
- Reference: [`spikes/07-toconline.md`](./spikes/07-toconline.md), D-09,
  [`execution-plan/phases/07-invoicing-toconline.md`](./execution-plan/phases/07-invoicing-toconline.md)

### 2026-09-13: Phase 07.0 TOConline spike is TEST series only; 07.1 still gated on D-09

- Owner: engineering (spike) + accountant (IVA / D-09) + operator (Dados API secret)
- Status: superseded by the 2026-09-14 entry (secret is in local env; new
  blocker is TEST series AT communication)
- Review date: with D-09 (2026-09-21 while D-09 is `proposed`)
- Summary: The founder created series prefix **TEST**. The throwaway runner
  accepts exact `TEST` or `TEST-…` and refuses live `ELEVA`. Official `/auth`
  302 + code is proven against env hosts. `/token` returns 403 `access_denied`
  because local `TOCONLINE_CLIENT_SECRET` is a placeholder copy of the client
  id. No TEST invoice, PDF, AT, or credit note was issued. Do not invent D-09
  commercial terms. PR 07.1 stays blocked until D-09 is signed and a TEST
  series run with a real secret fills `docs/eleva-v3/spikes/07-toconline.md`.
- Reference: [`spikes/07-toconline.md`](./spikes/07-toconline.md), D-09,
  [`execution-plan/phases/07-invoicing-toconline.md`](./execution-plan/phases/07-invoicing-toconline.md)

### 2026-09-13: Phase 06.3 is Playwright closeout, not a new commercial gate

- Owner: engineering
- Status: active
- Summary: The original Phase 06 plan listed 06.0 / 06.1 / 06.2 only. After 06.2
  merged, closeout is a dedicated `phase-06.3/e2e-payouts` PR: Playwright
  coverage of payout/refund OpenAPI paths, anonymous 401s, unsigned Stripe
  webhooks, and payout-workflow drain-secret rejection. This does not invent
  D-gates. D-03–D-06 remain founder working pre-launch. Phase 06 closes when
  06.3 merges. There is no 06.4.
- Reference:
  [`execution-plan/phases/06-payments-payouts.md`](./execution-plan/phases/06-payments-payouts.md)

### 2026-09-11: Phase 06.0 Stripe funds-flow spike evidence

- Owner: engineering
- Status: active
- Review date: 2026-09-21 (finance/legal re-sign D-03 / D-04 / D-05 before
  go-live)
- Summary: Test-mode spike committed. PT Custom receives transfers with
  `transfers` only (`card_payments` absent). US Custom rejects that pair.
  PT Express create without `card_payments` is accepted, but capability
  state after hosted onboarding is unproven. Platform PaymentIntent + delayed
  `source_transaction` transfer + the tested pre-payout refund/reversal
  flow + cumulative partials + dispute-on-transfer are proven.
  Connected-account reversal after payout remains unproven because the
  platform test balance was insufficient; defer validation to Phase 06.1/06.2.
  The 2026-04-22 "single `/webhooks/stripe` endpoint" clause is superseded:
  06.1/06.2 must register `/webhooks/stripe` (platform,
  `STRIPE_WEBHOOK_SECRET`) and `/webhooks/stripe/connect` (`connect: true`,
  `STRIPE_CONNECT_WEBHOOK_SECRET`). Same dispatcher and
  `stripe_webhook_events` table. ADR-005 is amended to match. D-03, D-04,
  D-05 are working pre-launch (founder) as of 2026-09-12. D-06 is
  working pre-launch (founder) as of 2026-09-12. The Connect
  endpoint lands in PR 06.1.
- Reference: [`spikes/06-stripe-funds-flow.md`](./spikes/06-stripe-funds-flow.md)

### 2026-09-10: Private-link credential after reserve is reservationToken

- Owner: engineering
- Status: accepted
- Summary: Records the shipped Phase 04.2 contract (does not change an
  ADR). `GET /public/booking-links/{token}` and `POST /bookings/reserve`
  take plaintext `linkToken` and validate hash, expiry, revocation,
  `max_uses`, and recipient (same `404` on any failure). After reserve,
  `reservationToken` is the sole client credential: `POST /payments/intent`
  and `POST /bookings/confirm` do not accept `linkToken` again. They
  re-read `revoked_at` on the reservation's stored `booking_link_id` and
  return `404` if revoked. Compatibility: clients must stop sending
  `linkToken` after reserve; OpenAPI and `@eleva/api-client` already
  match. No ADR is reopened.
- Reference: [`scheduling-booking-spec.md`](./scheduling-booking-spec.md),
  [`api-contract-spec.md`](./api-contract-spec.md)

### 2026-09-10: Phase 04.2 leftover status after marketing pages

- Owner: engineering
- Status: active
- Review date: 2026-09-17
- Summary: 04.1 and 04.2 leftover PRs `#43`–`#50` are on `main`. Entry-gate
  records D-01, D-02, D-10, D-13, D-14 exist below and stay working
  pre-launch (not DPO/finance production sign-off). Gated: contact POST
  API (DPO), Lighthouse ≥90 on profile (staging), cancel/reschedule
  execution (Phase 6). Phase 5 may start against the D-12 working
  pre-launch default recorded below; DPO/legal still re-sign D-12
  before go-live. Switching booking-scope consents to erasure is a new
  decision, not that sign-off.
- Reference:
  [`execution-plan/phases/04-public-marketplace-booking.md`](./execution-plan/phases/04-public-marketplace-booking.md)

### 2026-09-10: Staging booking funnel synthetic probes

- Owner: engineering
- Status: active
- Review date: 2026-09-17 (reassess probe coverage, on-call, Lighthouse, and the contact DPO gate)
- Summary: Phase 04.2 leftover item 8 adds `GET /cron/booking-probes`
  (Vercel Cron daily 06:15 UTC, `CRON_SECRET`; Hobby runs once per
  day sometime in 06:00–06:59 UTC). It HTTP-probes seeded
  `fisiomota/first-visit` slots and test-mode `POST /payments/intent`
  with a fake reservation (404/422 healthy; no PaymentIntent). Failures
  call `@eleva/observability` `reportProbeFailure` (Sentry → on-call).
  Success heartbeats `booking-probes`. Lighthouse ≥90 on the profile page
  and the contact POST API stay gated (staging evidence / DPO).
- Reference:
  [`execution-plan/phases/04-public-marketplace-booking.md`](./execution-plan/phases/04-public-marketplace-booking.md)

### 2026-09-09: Domain-events outbox for booking guest activation

- Owner: engineering
- Status: superseded — magic-link on activation was replaced by the
  2026-10-08 "Guest confirm sends one booking mail; magic-link only on
  sign-in" entry. Outbox + `booking.guest_activation_required` still
  stand; the mail is confirmation + durable `/signup` CTA, not Better Auth
  "Sign in".
- Summary: Phase 04.2d adds `domain_events_outbox` + `domain_event_deliveries`
  (service-only, org-scoped writes plus `eleva.platform_admin` /
  `eleva.service = 'domain_events_publisher'`). Confirm and the Stripe
  `payment_intent.succeeded` webhook flip `pending_payment` → `confirmed`
  and enqueue `booking.guest_activation_required`. The publisher claims
  deliveries (`processing` + stale reclaim), runs subscribers outside the
  claim transaction, and never stores guest email/name in the durable
  payload. Guest activation reads contact fields from `bookings` under
  `withOrgContext`. It used to send a Better Auth magic link once
  (`guest_activation_sent_at`); that send is gone — see 2026-10-08.
  Cancel/reschedule and refund execution stay out of this slice.
- Reference: [`execution-plan/phases/04-public-marketplace-booking.md`](./execution-plan/phases/04-public-marketplace-booking.md),
  [`schema-and-migration-rules.md`](./schema-and-migration-rules.md)

### 2026-09-09: Remove internal `apps/poc` playground

- Owner: engineering
- Status: active
- Summary: Deleted `@eleva/poc` (`apps/poc`) and companion specs in
  `_context/PoCs`. Wizard/map UI lived only inside that app (not shared
  packages). Dropped cataloged Leaflet deps (`leaflet`, `react-leaflet`,
  `@types/leaflet`) and CI exclusions (`turbo --filter=!@eleva/poc`,
  lint-staged / CodeRabbit / i18n-parity / proxy-test skips).
  `_context/mobbin/` stays as design screenshot references.
- Reference: [`contribution-workflow.md`](./contribution-workflow.md)

### 2026-09-08: Local Better Auth e2e capture stays out of production Redis

- Owner: engineering
- Status: active
- Summary: Playwright auth (`pnpm e2e:auth`) reads verify/reset/magic URLs
  from Upstash only when `E2E_AUTH_CAPTURE=1` **and** the runtime is not
  production (`VERCEL_ENV` / `NODE_ENV`). Keys are `e2e:auth-url:{kind}:{sha256(email)}`
  with a 5-minute TTL so KV never stores a raw address or a production
  one-time link. Direct Neon `email_verified` writes stay behind
  `E2E_ALLOW_DB_WRITES=1` and are unused when capture works. Auth rate
  limiting stays on for Vercel production and preview even if the capture
  flag is set. Operators set `E2E_AUTH_CAPTURE=1` in local `.env.local`
  only; never on the production Vercel project.
- Reference: [`environment-matrix.md`](./environment-matrix.md),
  [`../../e2e/AUTH-USER-TESTING.md`](../../e2e/AUTH-USER-TESTING.md)

### 2026-05-21: v3 icon SSOT / import boundary policy

- Owner: design/platform
- Status: active
- Summary: Product iconography uses **`@eleva/icons`** as the single source of truth ([Phosphor Icons](https://phosphoricons.com)). Apps import SSR-safe icons from `@eleva/icons`; client wrappers (`NavIcon`, `ElevaIcon`, `getNavIcon`) from `@eleva/icons/client`. **Never** import `lucide-react` or `@phosphor-icons/react` outside `packages/icons`. Server layouts pass `NavIconName` string literals (not icon components) across the RSC boundary. **Weights:** `light` for idle sidebar nav, `duotone` for active nav and illustrations ≥ 32px, `regular` for UI chrome. **`expert-verified-icon.svg`** is a trust/marketing asset, not part of the icon registry.
- Reference: [brand book §Iconography](./brand-book/README.md#iconography), `.cursor/rules/eleva-icons.mdc`, `packages/icons/`

### 2026-05-19: Stripe Phase 1+2 cutover — PRODUCTION READY (audit complete)

- Owner: platform/billing
- Status: active
- Summary: 8-phase production-readiness audit completed evening of 2026-05-19, grounded in current Stripe + WorkOS docs via Context7. All 11 original done-criteria remain PASS. New evidence: real-customer happy path verified end-to-end (first non-fixture event in lifetime hit dispatcher as `processed`, mirror + audit + ordering protection all healthy); 5/5 adversarial webhook security tests passed (missing/wrong/stale/tampered signatures all 400); subscription lifecycle full coverage (create/upgrade/cancel-AP/cancel-now); F3 ordering protection refuses stale replays correctly; idempotency under 5-replay storm produced 0 duplicate audit rows; audit pipeline coherence (outbox shipped count == audit_events count exactly); webhook p95 = 1999ms (within Stripe-recommended ack budget). Bonus: a real user provisioned a real org during the audit window with full pipeline working end-to-end with no agent intervention. Two non-blocking findings flagged for backlog: **N7** Stripe Entitlements API returns empty in Sandbox (re-test on live to confirm WorkOS Add-on JWT-claim path); **N8** webhook handler error column lacks PG diagnostic detail (one-line fix). ADR-016 can flip from `Accepted` to `Active` immediately.
- Reference: [`operator-tasks/stripe-phase-1-2-cutover.md`](./operator-tasks/stripe-phase-1-2-cutover.md), [`adrs/ADR-016-subscription-ux-direction.md`](./adrs/ADR-016-subscription-ux-direction.md)
- Next review: only triggered by a P1+ incident or major Stripe API version migration

### 2026-04-22: Start with one authenticated product app

- Owner: architecture/product
- Status: active
- Summary: Eleva v3 will begin with one authenticated `apps/app` using route groups and RBAC rather than splitting into separate expert/patient/admin apps on day one.
- Reference: [`adrs/ADR-001-app-topology.md`](./adrs/ADR-001-app-topology.md)

### 2026-04-22: Bring `Eleva Diary` into the same monorepo later

- Owner: architecture/product
- Status: active
- Summary: The Expo mobile app should join the Eleva monorepo after shared auth/API/domain contracts are stable.
- Reference: [`mobile-integration-spec.md`](./mobile-integration-spec.md)

### 2026-04-22: Multi-zone routing is progressive, not day-one

- Owner: architecture/platform
- Status: active
- Summary: Keep multi-zone as a future optimization once routing/SEO/team needs justify it.
- Reference: [`master-architecture.md`](./master-architecture.md)

### 2026-04-22: Package manager — pnpm installer, bun as task runner (bun install banned)

- Owner: platform
- Status: active
- Summary: `pnpm` + Turborepo is the only installer and lockfile source of truth. Pin `"packageManager": "pnpm@<version>"`. Bun is allowed for `bun run` and `bun test`, never for install, to prevent lockfile drift between local and Vercel. Migration from current `bun.lock` + shadcn template is the first Phase 1 task.
- Reference: [`monorepo-structure.md`](./monorepo-structure.md), ADR-002

### 2026-04-22: Web analytics split — GA4 on apps/web, PostHog on apps/app

- Owner: product/platform
- Status: active
- Summary: Google Analytics 4 instruments the marketing website only. PostHog instruments the authenticated product only. No overlap. Consent banner gates both.
- Reference: [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)

### 2026-04-22: Feature flags — Vercel Flags SDK + Edge Config

- Owner: platform
- Status: active
- Summary: Vercel Flags SDK is the API/adapter surface. Vercel Edge Config is the default backend provider. PostHog adapter reserved for experimentation flags. All flag reads go through `packages/flags`. Drops WorkOS as flag provider.
- Reference: [`feature-flag-rollout-plan.md`](./feature-flag-rollout-plan.md), ADR-008

### 2026-04-22: Notifications — two-lane architecture, Novu retired

- Owner: platform
- Status: active
- Summary: Lane 1 (transactional, PHI-aware) = Vercel Workflows → Resend + Twilio EU + Neon inbox + Expo push, owned by `packages/notifications` with `sendNotification` entrypoint. Lane 2 (marketing, PHI-free) = Resend Automations triggered via `triggerAutomation` with consent-gated Neon→Resend contact sync. No direct `resend`/`twilio` imports outside `packages/notifications`. Novu is retired.
- Reference: [`notifications-spec.md`](./notifications-spec.md), ADR-006

### 2026-04-22: SMS provider — Twilio EU subaccount

- Owner: platform
- Status: active
- Summary: Twilio EU subaccount is the SMS provider for Lane 1 high-urgency transactional notifications (booking confirmation, 24h reminder, day-of prompt, cancellation). Per-user preferences and quiet hours enforced in `packages/notifications`.
- Reference: [`notifications-spec.md`](./notifications-spec.md)

### 2026-04-22: Durable workflow orchestration — Vercel Workflows DevKit

- Owner: platform
- Status: active
- Summary: Vercel Workflows DevKit handles every durable flow (booking confirmation, reminders, payment→entitlement, payout, transcript→AI→review, invoice issuance, DSAR, crypto-shredding). Upstash QStash is scoped to periodic cron only (drift checks, nightly digests, monthly reconciliation). Upstash Redis handles slot reservation and rate-limit locks.
- Reference: [`workflow-orchestration-spec.md`](./workflow-orchestration-spec.md), ADR-007

### 2026-04-22: Stripe — Connect Express + Dynamic Payment Methods + Embedded Components + single webhook

- Owner: payments
- Status: active
- Summary: Stripe API pinned ≥ 2023-08-16. `payment_method_types` never hardcoded for booking checkout — Dynamic Payment Methods auto-show the right set per country (PT = card + MB WAY + wallets; EU = SEPA/iDEAL/Bancontact per country). Subscription Checkout limited to `card + sepa_debit` per ADR-016 (MB WAY/Multibanco are one-time-only). Enabled methods managed in Stripe Dashboard per environment. Two accounts (staging + production). Single `/webhooks/stripe` endpoint per env handles all event types (Payment + Subscriptions + Connect + Identity) with idempotency via `stripe_webhook_events`. UX uses Embedded Checkout for SaaS purchase + Customer Portal for management per ADR-016, plus Connect/Identity Embedded Components, Payment Element for booking checkout. `appearance` API themed to Eleva tokens. CSP allows Stripe domains.
- Superseded in part (2026-09-07): the booking-checkout method set is now fixed by D-14 (Payment Method Configuration `STRIPE_PMC_BOOKING`: `card` incl. wallets, `link`, `mb_way` only; Multibanco, SEPA Direct Debit, Klarna and every delayed-notification method off) and the launch currency by D-02 (EUR only). The "never hardcode `payment_method_types`" rule stands — the configuration decides, not a list in code.
- Superseded in part (2026-09-11): the "single `/webhooks/stripe` endpoint" clause is replaced by the two-endpoint contract in the Phase 06.0 entry (platform + `connect: true`). One dispatcher and one idempotency table remain.
- Reference: [`payments-payouts-spec.md`](./payments-payouts-spec.md), ADR-005, ADR-016

### 2026-04-22: Multibanco reference vouchers — excluded

- Owner: payments
- Status: active
- Summary: Multibanco voucher payments (7-day settlement + D3/D6/expiry reminder workflow) are out of scope for v3. MB WAY wallet (instant, Stripe-native) covers PT market. Revisiting requires a new ADR.
- Reference: [`payments-payouts-spec.md`](./payments-payouts-spec.md), ADR-005

### 2026-04-22: Marketplace monetization — hybrid (solo=commission, clinic=SaaS)

- Owner: product/commercial
- Status: active
- Summary: Segment-differentiated hybrid model grounded in Doctolib's EU health-marketplace precedent (€139/user/mo, 85% subscription revenue). Solo experts pay 15% commission per booking (reduced to 8% on Top Expert tier via Stripe Entitlements). Clinics/Orgs pay per-seat SaaS (Starter €99 + €39/seat; Growth €199 + €29/seat; Enterprise custom) with **zero commission** on member bookings (clinic Connect account receives 100% of booking, internal distribution is clinic's bookkeeping). Three-party revenue (clinic + Eleva + expert commission split) demoted to phase-2 opt-in behind `ff.three_party_revenue`.
- Reference: [`organization-and-clinic-model.md`](./organization-and-clinic-model.md), [`payments-payouts-spec.md`](./payments-payouts-spec.md), ADR-005

### 2026-04-22: Accounting — two-tier invoicing, TOConline + adapter registry

- Owner: payments/compliance
- Status: active
- Summary: Tier 1 (Eleva→Expert/Clinic) uses TOConline OAuth — series `ELEVA-FEE-{YYYY}` for per-booking solo commission invoices, series `ELEVA-SAAS-{YYYY}` for monthly clinic SaaS invoices, idempotency via Neon. Tier 2 (Expert→Patient) uses a cal.com-style adapter registry in `packages/accounting/expert-apps/` with adapters for TOConline, Moloni, InvoiceXpress, Vendus, Primavera, Manual/SAF-T (P1 seed = TOConline + Moloni + Manual). Expert onboarding forces a choice (auto or manual). Clinic→Expert third-leg invoicing = clinic's own bookkeeping, out of scope. IVA matrix in this 2026-04-22 entry is **superseded in part** by the accountant 2026-09-15 written reply (Aprovado com condições): do not treat PT=23% / EU-VIES=reverse-charge / EU-nonVIES=23% / non-EU=zero-rated as a fully signed automatic table. See D-03, D-09, and [`accountant-approval-2026-09-15.md`](./accountant-approval-2026-09-15.md).
- Reference: [`payments-payouts-spec.md`](./payments-payouts-spec.md), ADR-013

### 2026-04-22: Tenancy isolation — Neon RLS with `withOrgContext()`

- Owner: platform/security
- Status: active
- Summary: Neon Postgres with RLS enabled on every tenant-scoped table, enforced via `withOrgContext()` in `packages/db`. Two Neon projects: `eleva_v3_main` (application) and `eleva_v3_audit` (immutable audit stream). All queries set `org_id` via `SET LOCAL` inside the helper; RLS policies verify per-role access.
- Reference: [`compliance-data-governance.md`](./compliance-data-governance.md), ADR-003

### 2026-04-22: Video — Daily.co EU region

- Owner: platform
- Status: active
- Summary: Daily.co EU region for video sessions and transcripts. Transcripts are Eleva-owned records encrypted at rest (originally via WorkOS Vault references; **superseded in part 2026-09-07** — now `@eleva/encryption` envelope encryption per ADR-020). Transcript content never leaks into notifications, analytics, or AI-gateway logs.
- Reference: [`vendor-decision-matrix.md`](./vendor-decision-matrix.md), ADR-009

### 2026-04-22: Calendar OAuth ownership — Eleva, not WorkOS Pipes (reaffirmed)

- Owner: platform
- Status: superseded (see [2026-05-06: Calendar OAuth — WorkOS Pipes for credential management](#2026-05-06-calendar-oauth--workos-pipes-for-credential-management-supersedes-2026-04-22))
- Summary: `packages/calendar` owns Google + Microsoft OAuth, token refresh, event read/write, and webhook subscription. Tokens stored in WorkOS Vault. WorkOS Pipes is explicitly not used for calendar sync. Re-evaluated: keeping Eleva-owned protects booking-critical flows that need idempotent event creation with client-supplied IDs, multi-calendar busy/destination modeling, real-time freebusy, explicit token-expiry surfacing, and Pub/Sub cache invalidation — none of which Pipes exposes with the fidelity we need. WorkOS Pipes remains valid for identity-side integrations (SCIM, directory sync, SSO federation).
- Reference: [`vendor-decision-matrix.md`](./vendor-decision-matrix.md), ADR-004

### 2026-04-22 (revision): Public surface — app at root + API on subdomain + docs at `/docs`

- Owner: platform
- Status: active (supersedes the earlier 2026-04-22 multi-zone entry below)
- Summary: Revised the multi-zone model to match vercel.com / resend.com / linear.app conventions. Authenticated routes live at the `eleva.care` **root** (`/patient`, `/expert`, `/org`, `/admin`, `/settings`, `/callback`, `/logout`) — rewritten individually from the gateway to `apps/app`, which runs without a `basePath`. APIs (external webhooks, OAuth callbacks, session-aware endpoints like Stripe AccountSession) live on the dedicated **`api.eleva.care`** subdomain — separation of concerns, no `/api` path collisions with the product. Docs stay at `eleva.care/docs/*` for SEO authority (zone rewrite to `apps/docs`, `basePath: '/docs'`). Context-sensitive root: `/` with session 302-redirects to role home; `/` without session serves marketing; `/home` is the always-marketing escape hatch. Cookies scoped to `.eleva.care` keep gateway/app same-origin; CORS + credentials handle cross-origin calls to `api.eleva.care`. Reserved-paths list expanded (add `patient`/`expert`/`org`/`admin`/`settings`/`callback`/`logout`/`home`); `app` and `api` removed from the reserved list. ADR-014 revised in place.
- Reference: [`adrs/ADR-014-multi-zone-rewrites.md`](./adrs/ADR-014-multi-zone-rewrites.md), [`environment-matrix.md`](./environment-matrix.md), [`monorepo-structure.md`](./monorepo-structure.md), [`identity-rbac-spec.md`](./identity-rbac-spec.md), [`_context/blueprints/multi-zone-monorepo.md`](../../_context/blueprints/multi-zone-monorepo.md)

### 2026-04-22 (superseded): Public surface architecture — multi-zone rewrites, single canonical domain

- Owner: platform
- Status: superseded (see revision above, same day)
- Summary: Original multi-zone entry proposed `/app/*`, `/api/*`, `/docs/*` all as zone-rewrite prefixes under `eleva.care`. Revised on the same day to move APIs to `api.eleva.care` subdomain and drop the `/app` prefix so authenticated routes live at the root. Original text preserved below for historical reference.
- Original text: `eleva.care` is the only public domain. Gateway app `apps/web` owns the root and rewrites `/app/*`, `/api/*`, `/docs/*` to sibling Vercel projects via multi-zone. Sub-apps declare matching `basePath`. Internal Vercel project URLs (`elevacare-app.vercel.app`, etc.) serve `noindex` + `robots.txt` disallow OR 301 to canonical. Third-party-hosted surfaces (`status.eleva.care` BetterStack, `sessions.eleva.care` Daily) stay as subdomains. Single-domain cookies on `.eleva.care` eliminate CORS and cross-subdomain auth friction.

### 2026-04-22: Short URLs — cal.com style, username-first, `as-needed` locale

- Owner: product/platform
- Status: active
- Summary: Public profile URLs at `eleva.care/[username]` (experts and clinics share the root namespace), booking URLs at `eleva.care/[username]/[event-slug]`. Locale prefix `as-needed`: EN at root, PT/ES prefixed. Drop the `/e/` segment. Reserved-paths list in `@eleva/config/reserved-usernames.ts` (Sprint 1) enforced at signup, DB CHECK constraint, and admin tooling. Username format: 3-30 chars, lowercase `[a-z0-9-]`, no leading/trailing/consecutive hyphens. Event slugs case-insensitive unique per expert. Collision prevention across expert/clinic namespaces via shared unique constraint and reserved list.
- Reference: [`identity-rbac-spec.md`](./identity-rbac-spec.md), [`scheduling-booking-spec.md`](./scheduling-booking-spec.md), [`search-and-discovery-spec.md`](./search-and-discovery-spec.md)

### 2026-04-22: PR review gate — CodeRabbit AI required before merge

- Owner: platform
- Status: active
- Summary: `.coderabbit.yaml` at repo root drives default review config. GitHub branch protection on `main` requires the `coderabbit` status check in addition to lint/typecheck/Vitest/Playwright smoke/boundary lint/i18n parity/RLS isolation test. PR author must acknowledge or address every CodeRabbit comment (reply or fix) before merge. Documented in [`contribution-workflow.md`](./contribution-workflow.md).
- Reference: [`implementation-sprints.md`](./implementation-sprints.md) Global Rules + Sprint 0

### 2026-04-22: Audit write pipeline — transactional outbox between Neon main and audit projects

- Owner: platform/security
- Status: active
- Summary: Two Neon projects stay (`eleva_v3_main` + `eleva_v3_audit`). `withAudit(action, entity, fn)` writes domain rows **and** `main.audit_outbox` row in the same main-DB transaction — atomic commit preserves transactional integrity across the physically separated audit store. `auditOutboxDrainer` Vercel Workflow (ADR-007) copies outbox rows to `eleva_v3_audit.audit_events` with at-least-once delivery (idempotent on pre-generated `audit_id` UUID); marks outbox row `shipped`. Shipped rows purged after 90 days. Audit DB RLS: INSERT via drainer credentials only; SELECT filtered by `org_id` OR `audit:view_all` capability; UPDATE/DELETE revoked. Hash-chain option (prev_hash + row_hash) additive in Sprint 7 for ISO 27001 / SOC 2 integrity evidence. Compliance-control mapping (GDPR Art. 30/17, HIPAA 164.312(b)/(c), ISO 27001 A.12.4, SOC 2 CC7.3) recorded in compliance spec.
- Reference: [`adrs/ADR-003-tenancy-and-rls.md`](./adrs/ADR-003-tenancy-and-rls.md), [`compliance-data-governance.md`](./compliance-data-governance.md)

### 2026-04-22: DNS management — Vercel Domains for `eleva.care`

- Owner: platform
- Status: active
- Summary: Vercel manages the entire DNS for `eleva.care` (A/AAAA/CNAME/MX/TXT including SPF/DKIM/DMARC/BIMI). Locked subdomain split: `eleva.care` → `apps/web`, `app.eleva.care` → `apps/app`, `api.eleva.care` → `apps/api` (all webhooks + server callbacks), `docs.eleva.care` → `apps/docs`, `status.eleva.care` → BetterStack, `sessions.eleva.care` → Daily.co branded CNAME, `*.preview.eleva.care` wildcard for PR previews. Staging mirrors this with `staging-` prefix. Wildcard SSL on `*.eleva.care`.
- Reference: [`environment-matrix.md`](./environment-matrix.md), [`monorepo-structure.md`](./monorepo-structure.md)

### 2026-04-22: RBAC backbone — WorkOS `admin`/`member` defaults + capability bundles

- Owner: platform
- Status: superseded in part (2026-09-07, ADR-021): the `admin`/`member` seniority model and `(org_type, role)` label derivation stay; WorkOS as the role store and `infra/workos/rbac-config.json` are replaced by Better Auth `organization` roles + `packages/auth/src/permissions.ts`
- Summary: Eleva uses WorkOS's default `admin` and `member` roles as **org-seniority** (not product labels). Product labels are derived from `(org_type, workos_role)` plus capability bundles loaded from `infra/workos/rbac-config.json`. Patient = `admin` of personal org; solo expert = `admin` of solo org; clinic admin = `admin` of clinic org; expert-in-clinic = `member` of clinic org; Eleva staff = `admin` of a single internal `eleva-operator` org with cross-org capability grants.
- Reference: [`identity-rbac-spec.md`](./identity-rbac-spec.md), ADR-003

### 2026-04-22: Launch market — Portugal-first

- Owner: product/compliance
- Status: active
- Summary: v3 launches Portugal-first. Launch requirements: PT/EN/ES locales, MB WAY + Stripe Tax PT, NIF collection, TOConline Tier 1 invoicing with pilot expert green, consent banner, ERS PT compliance docs published at `apps/docs/compliance/portugal/`, Daily/Neon/Resend/WorkOS EU regions confirmed, DSAR workflow tested, Vault crypto-shredding test passing, Tier 2 invoicing registry with ≥2 adapters (TOConline expert-side + Moloni) production-tested, Become-Partner admin verification enforcing invoicing choice.
- Reference: [`compliance-data-governance.md`](./compliance-data-governance.md), [`roadmap-and-milestones.md`](./roadmap-and-milestones.md), ADR-012

### 2026-05-05: Onboarding, admin verification, and expert finance platform

- Owner: platform/product
- Status: active
- Summary: Expert onboarding is a multi-step wizard (Profile, Stripe Connect, Identity Verification, Invoicing Setup, First Event Type). Admin Become-Partner flow provisions org + expert profile + Stripe Connect account on approval. Finance surface exposes invoicing status and Stripe payout/balance dashboards. API layer (`apps/api`) handles OAuth callbacks, adapter status, and Stripe Identity session creation with CORS, RLS, and capability checks. Invoicing choice is enforced at onboarding via the Tier 2 adapter registry (`packages/accounting`). Multi-step wizard is the sole onboarding entry point; admin approval is required before an expert can onboard; API surface requires CORS for cross-origin `app.eleva.care` to `api.eleva.care` calls.
- Reference: [`adrs/ADR-005-payments-and-monetization.md`](./adrs/ADR-005-payments-and-monetization.md), [`adrs/ADR-013-accounting-integration.md`](./adrs/ADR-013-accounting-integration.md), [`payments-payouts-spec.md`](./payments-payouts-spec.md)

### 2026-05-06: Calendar OAuth — WorkOS Pipes for credential management (supersedes 2026-04-22)

- Owner: platform
- Status: superseded in part (2026-09-07, ADR-017): credential management moves from WorkOS Pipes to Better Auth `account` rows (`getProviderAccessToken` in `@eleva/auth`); `packages/calendar` still owns the Google/Microsoft API surface
- Supersedes: [2026-04-22: Calendar OAuth ownership — Eleva, not WorkOS Pipes](#2026-04-22-calendar-oauth-ownership--eleva-not-workos-pipes-reaffirmed)
- Summary: Calendar OAuth credential management (token storage, refresh, revocation) is delegated to WorkOS Pipes. `packages/calendar` retains ownership of the Google/Microsoft API surface (event create/read/delete, freebusy, webhook subscriptions) but no longer manages raw tokens directly — instead it requests access tokens from WorkOS Pipes via the user's `workosUserId` and provider slug. This aligns with the ADR-004 amendment (2026-05) and the scheduling-booking-spec §Calendar Integration. The April decision's rationale about needing fidelity for booking-critical flows remains valid for the API layer; the change is purely about who stores/refreshes the OAuth credentials, not who calls the calendar APIs.
- Reference: [`adrs/ADR-004-scheduling-and-calendar-oauth.md`](./adrs/ADR-004-scheduling-and-calendar-oauth.md) (amended 2026-05), [`scheduling-booking-spec.md`](./scheduling-booking-spec.md)

### 2026-05-06: Tech-debt backlog governance — PR #7 code review triage

- Owner: platform
- Status: active
- Summary: Triaged 20+ findings from the PR #7 code review against [`tech-debt-backlog.md`](./tech-debt-backlog.md). Fixed 11 still-valid issues (auth proxy SDK primitives, slot-picker race conditions and missing deps, timezone input validation, calendar busy-source whitelist, email JSON-LD rendering, booking-context email guard, accounting error logging, reserve-slot error fallback). Deferred 5 items requiring infrastructure or schema migrations: (1) accounting callback PKCE server-side opaque state (Sprint 7+), (2) persist `expertIntegrationId`/`externalCalendarId` in sessions table (Sprint 7), (3) composite FK on `expert_integrations` child tables (Sprint 7), (4) ICS VTIMEZONE generation (Sprint 7+), (5) external busy-time cache for public booking funnel (Sprint 5+). Skipped 4 items already tracked or assessed: `scheduleId` composite FK (Item #5), WorkOS disconnect lifecycle (Item #12), `findPart` throw-vs-fallback (verify step catches mismatches), duplicate outside-diff comments. RLS policy updates (Items #2–4) and composite-FK changes (Items #5, #15–17) are planned for batched migrations per the schema-and-migration-rules policy.
- Reference: [`tech-debt-backlog.md`](./tech-debt-backlog.md), [`schema-and-migration-rules.md`](./schema-and-migration-rules.md)

### 2026-05-18: Subscription UX — Embedded Checkout + Customer Portal (supersedes ADR-005 UX)

- Owner: payments
- Status: active
- Supersedes: 2026-04-22 Stripe UX subsection of ADR-005 ("Custom Eleva UI + Payment Element + no Customer Portal redirect").
- Summary: Subscription purchase flow uses Stripe **Embedded Checkout** + **Customer Portal** for management instead of a custom Eleva UI + Payment Element. Multi-admin attribution closed via `withAudit({ entity: "billing_portal", action: "session_minted" })` correlated with webhook events. Subscription `payment_method_types` pinned to `["card", "sepa_debit"]` (MB WAY/Multibanco are one-time-only). Booking checkout, Connect Embedded Components, Identity, and the Appearance API mapping remain unchanged from ADR-005.
- Reference: [`adrs/ADR-016-subscription-ux-direction.md`](./adrs/ADR-016-subscription-ux-direction.md), [`adrs/ADR-005-payments-and-monetization.md`](./adrs/ADR-005-payments-and-monetization.md)

### 2026-05-18: API-First, Agentic-First, and Secure Architecture

- Owner: engineering
- Status: active
- Summary: Adopted an API-first, agentic-first, and secure-by-default architecture. All mutating business logic is callable via HTTP endpoints in `apps/api`, every endpoint supports dual auth (session + Bearer) with deterministic JSON error codes, and every route explicitly declares its auth model with rate limiting and Zod validation required. BotID is enforced on public-facing mutations.
- Core principles: API-first, Agentic-first, Secure-by-default
- Key consequences: migration of inline DB writes from Server Actions to domain package functions or API calls; standardized error envelope; OpenAPI spec as source of truth.
- Reference: [`api-first-architecture.md`](./api-first-architecture.md)
- Primary affected artifacts: `apps/api/src/lib/auth.ts` (requireApiAuth), `apps/api/src/lib/rate-limit.ts`, `apps/api/src/lib/bot-protection.ts`, `apps/api/src/lib/openapi.ts`, `packages/api-client` schemas

### 2026-09-07: Execution plan supersedes roadmap and sprint plan for sequencing

- Owner: engineering
- Status: active
- Supersedes: `roadmap-and-milestones.md` and `implementation-sprints.md` as the sequencing source of truth (both kept for history).
- Summary: `docs/eleva-v3/execution-plan/` is the authoritative build plan: phases 0-16, one branch (`phase-NN/<slug>`) = one PR = one CodeRabbit loop (CLI before the PR via `pnpm review` / `pnpm review:branch`, GitHub App on the PR) per phase, and a self-contained copy-paste prompt per phase. `index.html` is generated from the Markdown (`pnpm docs:execution-plan:html`). commitlint gains scopes `plan`, `p0`-`p16`, `p16.1`-`p16.16`.
- Reference: [`execution-plan/README.md`](./execution-plan/README.md), [`contribution-workflow.md`](./contribution-workflow.md)

### 2026-09-08: Better Auth spike 02.0 pins 1.7.3 and disables implicit Google linking

- Owner: engineering
- Status: active
- Summary: PR 02.0 proved Better Auth **1.7.3** on Neon branch
  `spike-02-better-auth` / database `auth_spike`. Catalog pins for 02.1:
  `better-auth`, `@better-auth/passkey`, `@better-auth/api-key`,
  `@better-auth/drizzle-adapter` at 1.7.3. `accountLinking.disableImplicitLinking`
  is required (ADR-017) — the Phase 2 prompt now includes it. Default JWT alg is
  EdDSA; JWTs from `/auth/token` are short-lived (`15m`) and
  **non-revocable** (JWKS only — no session-table check after verify);
  `GET /auth/ok` is not a vendor route; `adminRoles: ["platform_admin"]`
  requires `roles.platform_admin`; `@better-auth/cli` 1.4.22 must not generate
  1.7 schema. The throwaway `packages/auth/spikes/` instance is exempt from
  `withAudit` (isolated `auth_spike` has no `audit_outbox`); 02.1 deletes the
  folder and wraps the real hook. Passkey attestation is 02.2, not a 02.0
  gate.
- Reference: [`spikes/02-better-auth.md`](./spikes/02-better-auth.md),
  [`execution-plan/phases/02-better-auth-foundation.md`](./execution-plan/phases/02-better-auth-foundation.md)

### 2026-09-08: Better Auth clients and account UI (Phase 02.2)

- Owner: engineering
- Status: active
- Summary: Frontends use `@eleva/auth/client` (`createAuthClient` against
  `${NEXT_PUBLIC_API_URL}/auth`) and `getSession()` via
  `@eleva/api-client` `GET /auth/get-session`. Proxy optimistic auth uses
  `getSessionCookie` (no DB). Account hosts `/login`, `/signup`,
  `/verify-email`, `/reset-password`, `/two-factor`, `/logout`. Org switch
  calls `POST /organizations/active`. WorkOS Widgets CSS/config is removed
  from `@eleva/dashboard`. Residual WorkOS provisioning helpers stay until
  Phase 3.
- Reference:
  [`execution-plan/phases/02-better-auth-foundation.md`](./execution-plan/phases/02-better-auth-foundation.md)

### 2026-09-08: Phase 1.2 CI merge gates

- Owner: engineering
- Status: active
- Summary: required checks on `main` now include `lockfile-guard`, `lint`,
  `typecheck`, `build`, `test`, `i18n-parity`, `gitleaks`, `e2e-smoke`, and
  `neon-branch-migrate-and-rls` (plus `coderabbit`). Same-repo PRs fail the
  Neon job when `NEON_API_KEY` / `NEON_PROJECT_ID` are missing so tenant
  isolation cannot skip. Fork PRs skip the live branch (secrets unavailable).
- Reference: [`contribution-workflow.md`](./contribution-workflow.md),
  [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml),
  [`.github/workflows/e2e.yml`](../../.github/workflows/e2e.yml),
  [`.github/workflows/neon-branch.yml`](../../.github/workflows/neon-branch.yml)

### 2026-09-08: Phase 1.1 authored ADR-017..021 and ADR-023

- Owner: engineering
- Status: active
- Summary: Phase 1.1 (`phase-01.1/adrs-handbook`) writes the ADR documents that
  formalise the 2026-09-07 direction (this does not reopen those decisions),
  rewrites `identity-rbac-spec.md`, updates the handbook Current Canon, replaces
  WorkOS Cursor rules/skills with Better Auth / Daily / encryption, and adds the
  RLS taxonomy + localized-column contract + `security-traceability.md` skeleton.
  Canonical staging host is `dev.eleva.care` (API `api.dev.eleva.care`);
  `staging.eleva.care` is a historical alias to retire (callbacks, CORS,
  webhooks). The former `rbacDriftCheck` QStash job is not in the catalog
  (RBAC is code, ADR-021). Calendar workers persist Better Auth `account.id` and
  call `auth.api.getAccessToken({ body: { accountId, userId } })`
  (`calendar-integration-spec.md`). CI foundations (Playwright, Neon branch,
  gitleaks, i18n parity, audit migrations) are Phase 1.2.
- Reference: [`adrs/ADR-017-better-auth-identity.md`](./adrs/ADR-017-better-auth-identity.md)
  through [`ADR-023-plate-rich-text-editor.md`](./adrs/ADR-023-plate-rich-text-editor.md),
  [`execution-plan/phases/01-rebaseline-adrs-ci.md`](./execution-plan/phases/01-rebaseline-adrs-ci.md)

### 2026-09-07: Identity, video, encryption, RBAC and migration direction for v3 (ADR-017..021 authored in Phase 1)

- Owner: engineering
- Status: **accepted** — decided 2026-09-07 and locked for the execution plan; Phase 1 only writes the ADR documents (ADR-017..021) that formalise it, it does not reopen the decision. Earlier entries that assume WorkOS are superseded in part **as of this entry**, not once the ADRs land: [2026-04-22 Video — Daily.co EU region](#2026-04-22-video--dailyco-eu-region) (transcripts encrypted with `@eleva/encryption` envelope encryption, not WorkOS Vault; ADR-009 references to WorkOS Vault read as ADR-020), [2026-04-22 RBAC backbone](#2026-04-22-rbac-backbone--workos-adminmember-defaults--capability-bundles) (roles/capabilities come from Better Auth `organization` + `packages/auth/src/permissions.ts`, not `infra/workos/rbac-config.json`), and [2026-05-06 Calendar OAuth — WorkOS Pipes](#2026-05-06-calendar-oauth--workos-pipes-for-credential-management-supersedes-2026-04-22) (tokens now managed by Better Auth `account` rows).
- Supersedes **in part**: ADR-004 — only its WorkOS Pipes credential transport and its Google Meet link assumption; the Eleva-owned Google/Microsoft calendar OAuth and the cal.com-inspired scheduling model stay and Phase 4 builds on them; ADR-015 — only the "single WorkOS Application" assumption; the role-focused multi-app split stays; plus the WorkOS Vault/Pipes assumptions in `compliance-data-governance.md` and `calendar-integration-spec.md`. Phase 1 adds "Superseded in part by ADR-017/018/020" banners to ADR-004 and ADR-015 rather than retiring them.
- Summary:
  - **ADR-017 Identity**: self-hosted Better Auth in `apps/api` (`api.eleva.care/auth/*`), Drizzle adapter, `auth` schema on the main Neon project, plugins `organization`, `admin`, `twoFactor`, `passkey`, `magicLink`, `bearer`, `jwt`, `apiKey`, `openAPI`, `nextCookies`; session cookie on `.eleva.care`; frontend apps never instantiate the auth server. Neon managed Better Auth rejected (Beta, partial organization plugin, no MFA/hooks).
  - **ADR-018 Video**: Daily.co only (HIPAA-enabled domain, branded `sessions.eleva.care`); Google/Microsoft calendars remain for busy-time and destination sync.
  - **ADR-019 Migration**: import MVP data (users, orgs, experts, bookings, payout ledger, records) into v3 with a DNS cutover; same Stripe platform account.
  - **ADR-020 Encryption**: envelope encryption in `@eleva/encryption` (AES-256-GCM, per-org DEK wrapped by a versioned KEK from env, `org_data_keys`, crypto-shred = delete DEK); OAuth tokens encrypted by Better Auth.
  - **ADR-021 RBAC**: single source of truth in code (`packages/auth/src/permissions.ts`); product label derived from `(organization.type, member.role)`.
  - **Staff-only locale exception**: `apps/admin` ships `en` + `pt` only (Eleva staff surface); all member/expert/clinic-facing surfaces keep `pt`/`en`/`es`. Enforcement lives in `packages/config/src/i18n-locales.ts` (`REQUIRED_LOCALES_BY_APP`), which `scripts/check-i18n-parity.mjs` (Phase 1) reads instead of assuming `pt`/`en`/`es`; the universal prompt hard constraint in `execution-plan/README.md` section 7 names this exception.
- Reference: [`execution-plan/README.md`](./execution-plan/README.md) section 2, [`execution-plan/phases/01-rebaseline-adrs-ci.md`](./execution-plan/phases/01-rebaseline-adrs-ci.md), [`execution-plan/phases/02-better-auth-foundation.md`](./execution-plan/phases/02-better-auth-foundation.md)

### 2026-09-07: `@eleva/ui` primitives move from Radix UI to React Aria Components (ADR-022)

- Owner: engineering
- Status: active
- Summary: `@eleva/ui` regenerated from the shadcn `aria-luma` style on `react-aria-components`; `radix-ui`, `cmdk`, `react-hook-form` dropped; `navigation-menu`/`form` deleted, `field` + `checkbox-field` added. `@eleva/dashboard` mounts `AppRouterProvider` (relative hrefs → `router.push`, absolute → hard navigation for cross-zone). Consumers in `apps/web`, `apps/account`, `apps/expert` migrated to React Aria props (`isDisabled`, `onPress`, `isOpen`, `selectedKey`). Done before Phase 2 so all new v3 UI is written once against the final primitive layer.
- Reference: [`adrs/ADR-022-react-aria-ui-primitives.md`](./adrs/ADR-022-react-aria-ui-primitives.md), [`design-system-spec.md`](./design-system-spec.md)

### 2026-09-07: Rich text = Plate in a single `@eleva/editor` package (ADR-023, authored in Phase 1)

- Owner: engineering + product
- Status: accepted
- Summary: every rich-text surface (expert bios, event-type descriptions, location instructions, clinical notes, reports, the template library, clinic pages) uses Plate through `packages/editor`; Plate JSON stored in `jsonb` with server-derived sanitized HTML and plain text; `platejs`/`@platejs/*`/`slate*` are importable only inside `packages/editor`, and `@radix-ui/*` is allowed there as an ADR-022 exception (the other ADR-022 exception, `@radix-ui/themes` as the WorkOS Widgets peer, is transitional and ends in Phase 3). AI writing help (improve, shorten, fix grammar, translate) runs through `@eleva/ai` over the Vercel AI Gateway with the `approved-models` allow-list; the clinical context is enabled only in Phase 10 with zero-retention models. Tiptap (Pro licensing for AI/comments), Lexical (thinner ecosystem) and per-app Markdown textareas were rejected.
- Reference: [`execution-plan/phases/04b-expert-offer-builder.md`](./execution-plan/phases/04b-expert-offer-builder.md), [`execution-plan/phases/10-records-crm-ai.md`](./execution-plan/phases/10-records-crm-ai.md), [`monorepo-structure.md`](./monorepo-structure.md)

### 2026-09-07: Offer model — event type = service, delivery modes carry how/where/language/price/schedule

- Owner: product + engineering
- Status: accepted
- Summary: health licences are national while video consultations are not, and one practice mixes online, phone and several physical addresses with different calendars and prices. `event_types` keeps the service (kind `clinical|non_clinical`, defaults, policies, visibility); one or more `event_type_modes` carry `mode online|phone|in_person`, location, schedule, price/duration overrides, `country_scope` (worldwide or ISO list) and `languages`. Expert practice scope (`practice_country`, `service_countries`, `languages`, `worldwide_remote`, `accepting_bookings`) is the legal universe modes must fit; invariants live in `@eleva/scheduling` and are enforced on publish and at booking time (`assertModeBookable`). Busy time is shared across all modes of one expert. Private booking links (`booking_links`, hashed token, expiry, uses, schedule and price overrides) bypass a closed agenda but never the invariants. Experts own an Eleva calendar with a read-only ICS feed and may connect zero or many external calendars (per-calendar busy toggle; destination default overridable per event type and per mode). Supersedes the single `session_mode`/`worldwide_mode`/`languages` columns on `event_types` and the per-event-type `event_locations` table (folded into `expert_practice_locations`).
- Reference: [`scheduling-booking-spec.md`](./scheduling-booking-spec.md), [`execution-plan/phases/04-public-marketplace-booking.md`](./execution-plan/phases/04-public-marketplace-booking.md), [`execution-plan/phases/04b-expert-offer-builder.md`](./execution-plan/phases/04b-expert-offer-builder.md)

### 2026-09-07: CodeRabbit review loop cap and PR size targets

- Owner: engineering
- Status: accepted
- Summary: the CLI loop is bounded — `pnpm review` max 3 rounds, `pnpm review:branch` max 2, GitHub App max 2 fix-and-push rounds. Exit early on a clean round or when fewer than 3 Minor/Trivial findings remain; exit at the cap only with zero Critical/Major (a Critical/Major still open at the cap means the PR is too big: split and restart). Leftover Minor/Trivial go to the PR body "Deferred findings" table and, when real work, a Phase 16 row. PR size target <= 400 changed lines / <= 30 files; split above 800 / 60. Rationale: after 14 rounds on the plan PR each round kept surfacing 8-10 wording findings on freshly touched text; reviews are generative on large diffs and never reach a literal zero, while small PRs converge in 1-2 rounds. The design quality bar (rule 10) was recorded in the same change.
- Reference: [`execution-plan/README.md`](./execution-plan/README.md) section 4 rules 1, 4, 6, 10; [`contribution-workflow.md`](./contribution-workflow.md); `.cursor/skills/coderabbit-review/SKILL.md`

### 2026-09-07: Execution-plan contract tightenings from the Phase 0 review loop

- Owner: engineering
- Status: accepted
- Summary: the Phase 0 CodeRabbit loop locked several cross-phase contracts that previous documents left ambiguous. (1) Payout states: `payout_states.status` = `pending|scheduled|approval_required|transferred|paid_out|failed|held|reversal_pending|reversed` is the SSOT (`reversal_pending` added by the 2026-09-07 amendment: refund succeeded, transfer reversal not yet confirmed) (Phase 6 and `payments-payouts-spec.md` identical); a hold records `held_from_status` and a dispute won or a hold release restores it — there is no `released` state. (2) Notifications: one `sendNotification({ kind, recipient, orgId?, ctx, idempotencyKey, channelsOverride? })` contract; urgency belongs to `NOTIFICATION_KINDS[kind]`; e-mail is an idempotent provider submission (Resend `Idempotency-Key` = delivery row id, 24 h dedupe), SMS is at-least-once with Twilio status callback + per-delivery `Ref` body-fingerprint reconciliation; disputes and manual holds go to `held` (never `approval_required`) as a `hold_reasons` set, and the row returns to `held_from_status` only when every reason is cleared. (3) Tier 1 invoice retry policy is two-stage (5 fast attempts -> `failed` + alert; 10 sweep attempts -> `dead_lettered` + admin flag). (4) Daily: delegate removal ejects + bans at the provider; webhook transitions are ordered by event time (`sessions.last_event_at`, monotonic status); room creation reconciles lost responses from Eleva-owned intent (`room_create_attempt_at`, `room_attempt_seq`, `room_fingerprint_exp`) matched against the listed rooms' `nbf`/`exp` — Daily HIPAA mode rejects custom room names and room properties have no `meta`, so there is no provider-side handle (supersedes the earlier `room_request_id`-in-`meta` design, 2026-09-07 amendment) — and otherwise lands in `room_unresolved`. (5) Private booking links claim a use inside the durable reservation transaction, after the slot lock. (6) Migration deltas key on the MVP source snapshot (`migration_runs.source_watermark`), never the target completion time; Phase 15 production configuration is gated one mutation at a time (ADR-019). (7) CodeRabbit: the App's 100-file cap is the only file cap; the loop caps are 3 `pnpm review` rounds, 2 `pnpm review:branch` rounds and 2 GitHub App rounds, exiting only with zero open Critical/Major and every remaining Minor/Trivial recorded in the PR body "Deferred findings" table; the PR-size targets of `execution-plan/README.md` section 4 rule 1 (<= 30 files / 400 lines) apply to every prompt; hourly allowance recorded (Advanced trial 10/dev/h until 21 Sep 2026, then Team 8 or Essentials 5).
- Reference: execution-plan phases 4, 6, 7, 8, 9, 12, 14, 15; [`payments-payouts-spec.md`](./payments-payouts-spec.md) "Payout States"; [`notifications-spec.md`](./notifications-spec.md) entrypoint.

### 2026-09-07: Execution-plan amendment from the external engineering review (D-01..D-14)

- Owner: engineering (plan), named owners per decision below
- Status: active — accepted 2026-09-07 by Rodrigo Barona (founder); this entry records the
  amendment itself, the D-NN entries below carry their own sign-off
- Summary: an external engineering evaluation of the execution plan (kept verbatim at
  [`execution-plan/reviews/2026-09-07-external-engineering-review.md`](./execution-plan/reviews/2026-09-07-external-engineering-review.md),
  disposition per finding in
  [`execution-plan/reviews/2026-09-07-review-response.md`](./execution-plan/reviews/2026-09-07-review-response.md))
  was folded into the plan as one amendment PR. Structural changes: PR-level dependencies and
  approval gates (README section 4 rules 11-13, including environment mutation rules and the
  no-vendor-call-inside-a-transaction rule), spike PRs 02.0 / 06.0 / 07.0 / 09.0, the security
  baseline moved to the phases that create the risk (Phase 13 verifies, does not introduce),
  recording/transcription stripped from Phase 10 into Phase 16.8, refund + transfer-reversal
  contract corrected for separate charges and transfers, `computeSettlement` as the financial
  calculation contract, DB exclusion constraint as the booking consistency boundary,
  `consents` / `public_handles` / per-subscriber outbox deliveries created in Phase 4 PR 04.1,
  rollback narrowed to an acceptance point. The decisions below are the **approval gates**; each
  is `proposed` until its owner signs, and the phase file names the PR that cannot open before
  that. Sign-off is recorded by editing the status and adding the date and name in place.
- Reference: [`execution-plan/README.md`](./execution-plan/README.md) section 4 rule 12 (gate table)

### 2026-09-07: Phase 1 security baseline contracts (RLS policy classes, secret scanning, traceability, localized columns)

- Owner: engineering (security), DPO informed
- Status: accepted (documentation + CI contracts; the controls themselves are implemented by the phases named in `security-traceability.md`)
- Summary: Phase 1 fixes four contracts that later phases build on. (1) **RLS policy classes**: every tenant table declares one of the seven classes (`tenant-owned`, `dual-organization`, `owner-user-visible`, `participant-visible`, `staff-only`, `public-read`, `service-only`) documented in `schema-and-migration-rules.md`; `rls-classes.test.ts` (Phase 1.2) proves each class with a fixture and positive/negative assertions. (2) **Secret scanning**: `gitleaks` runs in CI with the repo `.gitleaks.toml`; a hit fails the job (Phase 1.2). (3) **Security traceability**: `docs/eleva-v3/security-traceability.md` maps every control to the phase that introduces it, the test that enforces it and the evidence link; Phase 13 CI fails when a control row has no enforcing check. (4) **Localized columns**: `LocalizedText` / `LocalizedRichText` (JSONB keyed by `Locale`, one row per entity, Zod-validated, sibling `_source_locale`) are the only storage shape — the duplicate `LocalizedString` type is deleted in PR 04.1.
- Reference: [`execution-plan/phases/01-rebaseline-adrs-ci.md`](./execution-plan/phases/01-rebaseline-adrs-ci.md), [`security-hardening-checklist.md`](./security-hardening-checklist.md)

### 2026-09-07: Admin dual-control kinds, distinct `analytics` consent, imported-consent semantics, rollback acceptance point

- Owner: engineering (Phase 12/13/14 contracts); finance for the refund threshold (D-06); DPO for consent semantics (informed)
- Status: accepted (plan contracts — implementation is verified by the phase tests named below)
- Review date: 2026-09-21 for the dual-control threshold default (`ADMIN_DUAL_CONTROL_REFUND_CENTS = 20000`) and the analytics-consent default (denied); the rest is structural
- Summary: (1) **Dual control (Phase 12)** is required for exactly six admin action kinds, mapped route-by-route in `packages/auth/src/admin-actions.ts`: `payment.refund_large` (above the threshold), `payout.release` (from `held`), `expert.commission_override`, `partner.approve_clinical` (clinical specialties), `expert.ban_with_future_bookings` (suspend/ban with confirmed future bookings), `record.break_glass_decrypt`; every other admin mutation is single-actor with a mandatory reason. Adding a kind = map row + table-driven test + audit-union entry. (2) **`analytics` is a distinct consent kind** (Phase 13), separate from `marketing`: PostHog/GA4 stay off until it is granted; it is never inferred from marketing or from a legacy field. (3) **Imported consents (Phase 14)** keep their MVP acceptance timestamp, `source = import`, document version tagged `legacy`; `analytics`, `ai_processing` and `session_recording` are never imported; the mapper (`infra/migration/src/map/consents.ts`) is deny-by-default and fails the run on an unmapped legacy field. (4) **Rollback boundary (Phase 14/15)**: `CUTOVER_ACCEPTANCE_TS = min(CUTOVER_TS + 48 h, first executed payout)`; before it, rollback to the MVP is a rehearsed runbook; after it, issues are fixed forward — no rollback path exists once money has moved.
- Reference: [`execution-plan/phases/12-admin-console.md`](./execution-plan/phases/12-admin-console.md), [`execution-plan/phases/13-hardening-observability.md`](./execution-plan/phases/13-hardening-observability.md), [`execution-plan/phases/14-mvp-migration.md`](./execution-plan/phases/14-mvp-migration.md), [`execution-plan/phases/15-launch-cutover.md`](./execution-plan/phases/15-launch-cutover.md)

### D-01 (2026-09-07): `pt-BR` retired as a locale; alias to `pt`; no `fr` now

- Owner: product (founder)
- Status: active — decided 2026-09-07 by Rodrigo Barona (founder, product owner) during the
  review of the external evaluation; recorded by engineering
- Summary: the `Locale` union in `@eleva/config` is `pt | en | es`; `apps/web/src/proxy.ts`
  answers `/pt-BR/*` with a 301 to `/pt/*` (query preserved) so indexed MVP URLs keep working;
  hreflang `pt/en/es` + `x-default`; no `pt-BR` message files anywhere (the i18n parity checker
  fails on a stray one). `fr` is not added: no content, experts, legal pages or native reviewer;
  adding a locale later is message files plus a reviewer, not architecture. Brazil returns as a
  content + payments discovery item (Phase 16.2). Blocks: Phase 4 PR 04.2.
- Reference: [`execution-plan/phases/04-public-marketplace-booking.md`](./execution-plan/phases/04-public-marketplace-booking.md) (SEO), [`execution-plan/phases/01-rebaseline-adrs-ci.md`](./execution-plan/phases/01-rebaseline-adrs-ci.md) (parity checker)

### D-02 (2026-09-07): EUR-only launch

- Owner: founder + finance
- Status: active — working pre-launch decision recorded 2026-09-09 by Rodrigo
  Barona (founder, product owner). Not a production finance sign-off. Re-sign
  before go-live.
- Review date: 2026-09-21 (re-sign with finance before production)
- Summary: `CHECK (currency = 'EUR')` on `event_types` and `event_type_modes`; the Stripe call
  still reads `currency` from the reservation snapshot, so lifting the CHECK later is the whole
  multi-currency change on the payment path. Blocks: Phase 4 PR 04.2.
- Reference: [`execution-plan/phases/04-public-marketplace-booking.md`](./execution-plan/phases/04-public-marketplace-booking.md), [`payments-payouts-spec.md`](./payments-payouts-spec.md) settlement matrix

### D-03 (2026-09-07): Commission is VAT-inclusive — the expert nets the headline

- Owner: accountant (`Manolo (MB)`) for the
  2026-09-15 written reply; founder recorded the working pre-launch payout
  default on 2026-09-12
- Status: active — **Aprovado** (commission / issuance-timing model),
  2026-09-15, `Manolo (MB)`, with the
  commercial-terms condition below. Founder working pre-launch (2026-09-12)
  still unblocks PR 06.1. This **is** the accountant reply for the commission
  example and issuance-not-tied-to-payout rule; it is **not** a founder
  D-03–D-06 substitute for remaining fiscal-parameter confirmation. IVA
  matrix and automatic issuance: **Aprovado com condições** (see the
  2026-09-15 accountant entry). Does **not** unlock PR 07.1 automatic
  production issuance. Founder 2026-09-17 unblocks 07.1 **engineering**
  of the IVA matrix in code.
- Review date: ELEVA series communication + remaining Manolo confirmation
  of live tax codes/rates/legal mentions before 07.1 production issuance.
  D-04 / D-05 / D-06 stay founder working pre-launch until finance/legal
  re-sign.
- Summary: the advertised commission (15% / 8% / 0%) is the gross amount
  deducted from the professional, including IVA when due. Accountant
  2026-09-15 example, with no other deductions: 100,00 € booking, 15,00 €
  total commission, professional receives 85,00 €; with 23% IVA the
  commission is 12,20 € taxable base + 2,80 € IVA; in reverse charge
  (autoliquidação) it is 15,00 € taxable base, with no IVA charged by Eleva.
  This model must appear clearly in the commercial terms. Issuance does not
  depend on payout (repasse) to the professional; issuance at collection must
  respect when the commission becomes due, treatment of any advances, and
  legal deadlines. IVA matrix **Aprovado com condições**: Portugal applies
  the legally due rate considering applicable territorial rules; other EU
  Member States, B2B under the general rule — no Portuguese IVA charged and
  reverse charge by the acquirer when legal requirements are met; EU without
  a valid VIES NIF — analyse the professional's tax status and available
  evidence, **without** automatic classification as consumer; extra-EU —
  determine treatment from acquirer status and location rules, **without**
  indiscriminate “zero rate”. Eventual OSS use depends on service
  classification and the operations covered (pending accountant validation —
  not an implemented fact). VIES check at registration and before issuance,
  with evidence retained; 24-hour reuse and downtime procedure need specific
  validation before activating intra-EU flows. Tax codes, rates and legal
  mentions must be confirmed before production. Implemented once in
  `computeSettlement` for payouts; do not treat the old automatic table
  (EU-without-VIES = 23% consumer / extra-EU = zero-rated) as fully signed.
- Reference: [`payments-payouts-spec.md`](./payments-payouts-spec.md)
  "Settlement matrix",
  [`accountant-approval-2026-09-15.md`](./accountant-approval-2026-09-15.md),
  [`execution-plan/phases/06-payments-payouts.md`](./execution-plan/phases/06-payments-payouts.md)

### D-04 (2026-09-07): Processing-fee bearer

- Owner: finance for production re-sign; founder acting as product owner
  (working pre-launch)
- Status: active — working pre-launch decision recorded 2026-09-12 by Rodrigo
  Barona (founder). Unblocks PR 06.1. Not a production finance sign-off.
- Review date: 2026-09-21 (finance re-sign before production)
- Summary: marketplace bookings — Eleva absorbs Stripe's processing fee out of its commission
  (`expertTransfer = gross − platformFeeGross`); clinic-attributed 0% bookings — the clinic bears
  the processing fee (`expertTransfer = gross − processingFeeCents`). `processing_fee_cents` is
  stored on `booking_payments` from `balance_transaction.fee`. Working pre-launch
  decision that unblocks PR 06.1; finance re-sign still required before production.
- Reference: [`payments-payouts-spec.md`](./payments-payouts-spec.md) "Settlement matrix"

### D-05 (2026-09-07): Connect capability model — `transfers` only, Identity behind a flag

- Owner: finance + legal for production re-sign; founder acting as product
  owner (working pre-launch)
- Status: active — working pre-launch decision recorded 2026-09-12 by Rodrigo
  Barona (founder). Unblocks PR 06.1. Not a finance/legal production sign-off.
- Review date: 2026-09-21 (finance + legal re-sign before production)
- Summary: working default is `transfers` only (no `card_payments`) for
  **PT Custom**, because the connected account only receives transfers;
  `charges_enabled` never gates anything. 06.0 evidence: PT Custom matches
  that default; US Custom requires `card_payments`; PT Express create
  without `card_payments` is accepted but capability state after hosted
  onboarding is unproven. Keep `card_payments` on Express and on unsupported
  country/account-type combinations until hosted onboarding proves
  transfers-only is receivable. Connect's own KYC is the identity check.
  Publish gate = `details_submitted && payouts_enabled &&
capabilities.transfers = active`. Stripe Identity stays implemented behind
  `ff.expert_identity_verification` (default off) in case legal requires a
  second verification for clinical experts. Working pre-launch decision that
  unblocks PR 06.1; finance and legal re-sign still required before production.
  Phase 12 partner checklist reads the same fields.
- Reference: [`execution-plan/phases/06-payments-payouts.md`](./execution-plan/phases/06-payments-payouts.md), [`execution-plan/phases/12-admin-console.md`](./execution-plan/phases/12-admin-console.md)

### D-06 (2026-09-07): Refund, dispute and no-show policy

- Owner: finance + product for production re-sign; founder acting as product
  owner (working pre-launch)
- Status: active — working pre-launch decision recorded 2026-09-12 by Rodrigo
  Barona (founder). Unblocks PR 06.2. Not a finance/legal production sign-off.
- Review date: 2026-09-21 (finance + legal re-sign before production)
- Summary: cancellation-window refund rules (per-service presets, see the
  2026-09-26 entry "Per-service cancellation policies"), dispute handling (hold payout, reverse on loss) and
  the no-show policy (Phase 9 records attendance only; this decision says refund / keep / partial
  per attendance outcome). Refunds above `ADMIN_DUAL_CONTROL_REFUND_CENTS` (default 200 EUR) need
  dual control in the admin console. Working pre-launch decision that unblocks PR 06.2; finance
  and legal re-sign still required before production.
- Reference: [`payments-payouts-spec.md`](./payments-payouts-spec.md) "Refunds", [`execution-plan/phases/09-video-daily.md`](./execution-plan/phases/09-video-daily.md) (attendance)
- Update 2026-10-29 (founder, working pre-launch): balanced no-show and
  dispute policy chosen and published in the legal pages — see the
  2026-10-29 entry "Legal pages for the launch posture". The finance + legal
  re-sign is **still pending** (not waived).

### D-07 (2026-09-07): Daily HIPAA domain, BAA/DPA and EU processing position

- Owner: founder + DPO
- Status: **deferred** (founder 2026-10-07 — BAA and HIPAA not pursued now)
- Review date: when the founder wants production PHI-video (clinical sessions on Daily)
- Summary: the Daily plan tier with HIPAA enabled, the executed BAA/DPA, the documented EU
  media-processing position (stated only as Daily documents it — no stronger claim on `/trust`),
  `sessions.eleva.care` verified, recording confirmed off for the domain. **Does not
  block Phase 09 engineering or accountant/legal demo on standard Daily.** Blocks
  **production PHI-video processing** (clinical sessions on Daily), not only a HIPAA
  marketing claim. Phase 09 uses standard Daily until this is signed.
- Reference: [`spikes/09-daily-account.md`](./spikes/09-daily-account.md),
  [`execution-plan/phases/09-video-daily.md`](./execution-plan/phases/09-video-daily.md)

### D-08 (2026-09-07): Session-recording storage — S3 EU landing zone, private Blob system of record

- Owner: DPO + founder
- Status: proposed (decide before Phase 16.8 is promoted)
- Review date: 2026-09-21 (two weeks; re-review every two weeks while `proposed`, and the blocked PR cannot open without sign-off regardless of this date)
- Summary: Daily HIPAA recording writes only to a customer-owned AWS S3 bucket via IAM role trust;
  Vercel Blob, Neon object storage and Cloudflare R2 are not accepted destinations. Design: a
  disposable EU S3 bucket (SSE-KMS, 72 h lifecycle) as a mailbox, a workflow that pulls, encrypts
  per org and stores through `@eleva/storage` in the private Blob store (EU region confirmed),
  then deletes the S3 object. Recording lives only in 16.8. Blocks: 16.8.
- Reference: [`execution-plan/phases/16-post-launch-backlog.md`](./execution-plan/phases/16-post-launch-backlog.md) "16.8 design note"

### D-09 (2026-09-07): Historical MVP invoices — `legacy` / `legacy_missing`, never reissued

- Owner: accountant (`Manolo (MB)`)
- Status: active — **Aprovado com condições**, 2026-09-15,
  `Manolo (MB)`. Approves the historical
  classification and its exclusion from v3 automatic issuance. Does **not**
  unlock PR 07.1 automatic production issuance (pending fiscal parameters —
  see the 2026-09-15 accountant entry and D-03). Founder 2026-09-17
  unblocks 07.1 **engineering** of `platform_fee_invoices` / D-09 statuses,
  not live FT issuance.
- Review date: ELEVA series communication + remaining Manolo confirmation
  of live tax codes/rates/legal mentions before activating 07.1 production
  issuance; `legacy_missing` regularization is a separate accountant-guided
  procedure (not a calendar substitute for either).
- Summary: migrated MVP paid bookings are imported as
  `platform_fee_invoices.status = legacy` (+ `legacy_document_ref`) or
  `legacy_missing`; v3 never issues a Tier 1 document for a booking paid
  before cutover (exclusion from v3 automatic issuance, to avoid
  duplications or incorrect documents). Accountant 2026-09-15: this
  exclusion does **not** waive Eleva's regularization duties. Cases
  without a document (`legacy_missing`) must be sent for analysis with
  the respective values, dates, and available documents. Regularization is a
  separate procedure under accountant guidance — not automatic v3 issuance
  and not a backfill invented by engineering. Phase 14 reports the
  `legacy_missing` count. Does **not** unlock PR 07.1 automatic production
  issuance.
- Reference:
  [`accountant-approval-2026-09-15.md`](./accountant-approval-2026-09-15.md),
  [`execution-plan/phases/07-invoicing-toconline.md`](./execution-plan/phases/07-invoicing-toconline.md),
  [`execution-plan/phases/14-mvp-migration.md`](./execution-plan/phases/14-mvp-migration.md)

### D-10 (2026-09-07): Public-site parity dispositions

- Owner: product (founder)
- Status: active — **consent set published 2026-10-24** (founder-approved),
  revised 2026-10-29. `CONSENT_DOCUMENT_VERSION` is `2026-10-29` (no `dev-`
  prefix). Legal/trust
  draft chrome removed; marketing landing drafts (`/become-expert`,
  `/for-clinics`, `/contact`) remain. Earlier working pre-launch record
  (2026-09-09, version `dev-2026-09-09`) is superseded for the publication
  switch; see decision-log entry 2026-10-24.
- Summary: every surface of the live MVP site has a disposition. Expert URLs
  via `public_handles`; `/pt-BR/*` 301 (D-01); versioned `/{locale}/legal/*`
  (`CONSENT_DOCUMENTS`). Contact POST and Phase 13 evidence-backed trust
  claims remain separate follow-ups.
- Reference: [`execution-plan/phases/04-public-marketplace-booking.md`](./execution-plan/phases/04-public-marketplace-booking.md) "Public-site parity",
  [`legal/fact-sheet.md`](./legal/fact-sheet.md) §6

### D-11 (2026-09-07): Clinical access model

- Owner: DPO + product
- Status: active — **working pre-launch** (founder 2026-10-12 opened Phase 10.1).
  Author-only writes now. Clinic-shared SELECT exists in 10.1 RLS but stays inactive
  (`clinic_shared_records` default false, no setter until Phase 11). Not a DPO production sign-off.
- Review date: DPO + product re-sign before production clinical records
- Summary: expert-authored records are readable by the authoring expert; by other experts of the
  same clinic organization only when the clinic admin enabled `clinic_shared_records` (default
  off, reason required, audited) and the member has not opted out (`record_access_optouts`);
  by Eleva staff never in plaintext (metadata only; break-glass decrypt is a Phase 12 dual-control
  action). Phase 10 enforces author-only INSERT/UPDATE/DELETE (`created_by = eleva.user_id`) and
  author/assigned-expert SELECT; clinic_shared_read is compiled but inactive. Phase 11 only adds
  the toggle. **2026-10-20 engineering:** member per-clinic opt-out API + Privacy UI (`/me/record-access-optouts`, PR #250); clinic admin `clinic_shared_records` toggle still Phase 11.
- Reference: [`execution-plan/phases/10-records-crm-ai.md`](./execution-plan/phases/10-records-crm-ai.md), [`execution-plan/phases/11-team-clinics.md`](./execution-plan/phases/11-team-clinics.md)

### D-12 (2026-09-07): Account deletion vs legal retention of clinical records

- Owner: DPO + legal for production re-sign; founder acting as product owner
  (working pre-launch)
- Status: active — working pre-launch decision recorded 2026-09-11 by Rodrigo
  Barona (founder). Unblocks Phase 5 schema and deletion-flow development.
  Not a DPO/legal production sign-off.
- Review date: 2026-09-25 (DPO + legal re-sign before production)
- Summary: Two consent scopes, stated the same way in this entry, the
  retention matrix, and the deletion sweep. **Account-scope consents**
  (`booking_id IS NULL`: marketing, later analytics, account terms/privacy)
  are **erased** on the sweep. **Booking-scope consents** are
  **pseudonymised** (`user_id` → NULL, `subject_pseudonym` = HMAC-SHA256 of
  the former user id under `RETENTION_PSEUDONYM_KEY`, `guest_email_hash` →
  NULL) and retained for the Portuguese clinical-record minimum (DPO fills
  the year in `data-retention-export-matrix.md` before go-live; this
  record does not invent a year). Expert-authored clinical records follow the
  same retain-then-Phase-10-crypto-shred rule. Product grace for
  `scheduled_for` is `ACCOUNT_DELETION_GRACE_DAYS = 14` (not the clinical
  period). Switching booking-scope consents to erasure is a **new
  decision**, not a sign-off. The member deletion UI says so in plain
  language. This working pre-launch record unblocks Phase 5; DPO and legal
  re-sign before go-live.
- Reference: [`execution-plan/phases/05-member-app.md`](./execution-plan/phases/05-member-app.md), [`data-retention-export-matrix.md`](./data-retention-export-matrix.md)

### D-13 (2026-09-07): Cookie, CSRF and subdomain threat model

- Owner: founder acting as security owner (working pre-launch); engineering lead
  re-signs before production
- Status: active — working pre-launch decision recorded 2026-09-09 by Rodrigo
  Barona (founder). CSRF/session model as written in Phase 2. Unblocks PR 04.2
  for development. Not a production security sign-off.
- Review date: 2026-09-21 (engineering-lead security owner re-sign before production)
- Summary: Product-app session cookies are `better-auth.session_token` or
  `__Secure-better-auth.session_token` with `Domain=.eleva.care`, `Secure`,
  `HttpOnly`, `SameSite=Lax`. Admin (Phase 12) uses a host-only `__Host-` cookie
  and rejects the shared cookie. Cookie-authenticated mutations require a trusted
  `Origin` or `Sec-Fetch-Site` of `same-origin`/`same-site`, and reject
  `cross-site` and missing provenance (`403 CSRF_ORIGIN_MISMATCH`). Duplicate
  session cookies are `401 SESSION_COOKIE_AMBIGUOUS` and both values are cleared
  on the parent domain and host. `__Secure-` does not stop cookie tossing.
  Bearer and API-key paths are exempt. Previews never mint `.eleva.care` cookies.
  `*.eleva.care` DNS inventory lives in `environment-matrix.md`. This working
  pre-launch record unblocks PR 04.2; the engineering-lead security owner
  re-signs before go-live.
- Reference:
  [`security/cookie-csrf-threat-model.md`](./security/cookie-csrf-threat-model.md),
  [`execution-plan/phases/02-better-auth-foundation.md`](./execution-plan/phases/02-better-auth-foundation.md)

### D-14 (2026-09-07): Launch payment-method set

- Owner: finance + product
- Status: active — working pre-launch decision recorded 2026-09-09 by Rodrigo
  Barona (founder, product owner). Launch set: card (incl. wallets), Link, MB WAY.
  Not a production finance sign-off. Re-sign before go-live.
- Review date: 2026-09-21 (finance re-sign before production)
- Summary: booking PaymentIntents use a Stripe Payment Method Configuration (`STRIPE_PMC_BOOKING`,
  owned by `infra/stripe/setup-payment-methods.ts`) with `card` (incl. Apple Pay / Google Pay),
  `link`, `mb_way`; Multibanco, SEPA Direct Debit, Klarna and every delayed-notification method are
  off for one-time bookings (a 5-minute hold cannot outlive a days-long settlement). MB WAY is
  `async_short`: hold extended to 10 min while `processing`. SEPA DD remains allowed for SaaS
  subscriptions (ADR-016 carve-out). Blocks: Phase 4 PR 04.2.
- Reference: [`payments-payouts-spec.md`](./payments-payouts-spec.md) "Dynamic Payment Methods", `packages/billing/src/server/payment-method-policy.ts`

### D-15 (2026-09-08): Phase 03.2 leftover-identity contract

- Owner: platform
- Status: active
- Summary: After the Phase 03.2 exit-gate grep, migration `0024_drop_legacy_identity`
  drops `main.users` / `organizations` / `memberships` / `roles` / `permissions`,
  leftover identity-provider columns, and the read-only write triggers. Locale
  SSOT is the `ELEVA_LOCALE` cookie (`getAuthenticatedLocale`); do not read a
  leftover IDP `user.locale`. Session fields are `user.id`, `orgId`, and
  `membershipRole: "admin" | "member"` (Better Auth `owner` maps to `admin`).
  Keep `apps/account/.../settings-widgets.tsx` — it is the live React Aria
  settings UI, not leftover widgets. Keep the `org_type` enum. Calendar tokens
  stay on Better Auth `account` rows. Vercel Hobby deploy checks are not a merge
  gate.
- Reference: [`execution-plan/phases/03-remove-workos.md`](./execution-plan/phases/03-remove-workos.md), ADR-017, ADR-020

### D-16 (2026-09-09): public_handles is a global namespace

- Owner: platform
- Status: active
- Summary: `public_handles` is the public `/[handle]` resolution table. It has no
  `org_id` because handles are a single citext namespace across experts and (later)
  clinics. ADR-003 still holds for tenant-scoped tables. This table is the documented
  split: SELECT is public-read (`USING true`); writes are staff-only
  (`eleva.platform_admin`). Phase 4B onboarding claims handles through audited domain
  code, not a tenant WITH CHECK.
- Reference: [`schema-and-migration-rules.md`](./schema-and-migration-rules.md),
  ADR-003, [`execution-plan/phases/04-public-marketplace-booking.md`](./execution-plan/phases/04-public-marketplace-booking.md)

### D-17 (2026-09-11): Phase 5 member contracts (working pre-launch)

- Owner: platform
- Status: active — working pre-launch record for Phase 5. Not a DPO/legal
  production sign-off.
- Review date: 2026-09-25 (revisit with D-12 before go-live)
- Summary: Member HTTP for cancel, reschedule, DSAR, and account deletion
  shipped in Phase 5 (`POST /me/bookings/{id}/cancel`,
  `POST /me/bookings/{id}/reschedule`, `/privacy/dsar*`,
  `/privacy/delete-account`). Phase 6 executes Stripe refunds for
  `refund_pending` payments; do not attribute cancel/reschedule HTTP to
  Phase 6. DSAR kickoff is `after()` + QStash with a localhost inline
  fallback, as locked in `execution-plan/phases/05-member-app.md`. ADR-007
  still assigns durable `dsarExport` to Vercel Workflows; that migration is
  deferred, not done in Phase 5. Member DSAR writes a private-Blob zip
  (`uploadPrivateBlob`), HMAC-signs a 24h download URL, marks `failed` on
  upload errors, and expires ready rows after the TTL. Notification
  preferences are the `(user_id, channel, category)` matrix (not the former
  per-kind schema); Phase 8 sending consumes it. `GET /me/bookings` reads
  under `withOrgContext(session.orgId)` plus `member_user_id`.
- Reference: [`api-contract-spec.md`](./api-contract-spec.md),
  [`compliance-data-governance.md`](./compliance-data-governance.md),
  [`notifications-spec.md`](./notifications-spec.md), ADR-007,
  [`execution-plan/phases/05-member-app.md`](./execution-plan/phases/05-member-app.md)

### D-18 (2026-09-12): Phase 06.2 payout crons stay on QStash

- Owner: engineering
- Status: active — working pre-launch exception to ADR-007 for this slice
- Review date: 2026-09-25 (revisit when payout orchestration moves to DevKit)
- Summary: Phase 06.2 registers `process-expert-transfers`,
  `process-pending-payouts`, and `check-upcoming-payouts` as QStash cron
  schedules that call domain functions through `runInternalWorkflow`, matching
  audit-outbox and stuck-event jobs. ADR-007 still assigns durable payout
  orchestration to Vercel Workflows DevKit. Wrapping these crons as DevKit
  step graphs is a follow-up, not a 06.2 merge gate. QStash remains the
  periodic trigger.
- Reference: ADR-007, [`execution-plan/phases/06-payments-payouts.md`](./execution-plan/phases/06-payments-payouts.md),
  [`workflow-orchestration-spec.md`](./workflow-orchestration-spec.md)

## Related Docs

- [`accountant-approval-2026-09-15.md`](./accountant-approval-2026-09-15.md)
- [`adrs/README.md`](./adrs/README.md)
- [`master-architecture.md`](./master-architecture.md)
- [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)
- [`contribution-workflow.md`](./contribution-workflow.md)
