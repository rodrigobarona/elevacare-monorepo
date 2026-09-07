# Phase 4B — Expert offer builder: practice scope, locations, schedules, delivery modes, private links, calendars, `@eleva/editor`

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-04b/expert-offer-builder` (split: `phase-04b.1/practice-locations-schedules-calendars`, `phase-04b.2/event-type-builder-links-editor`)                                                                                                                                                                                                                                                        |
| Depends on | Phase 3 (Google/Microsoft `linkSocial` calendar credentials), Phase 4 (offer tables, invariants, public API — PR 04.1 at minimum)                                                                                                                                                                                                                                                                    |
| Effort     | 2 weeks                                                                                                                                                                                                                                                                                                                                                                                              |
| Touches    | `apps/expert/**`, `apps/api/src/app/{expert,calendar,ai/editor}/**`, `packages/editor/**` (new), `packages/ai/src/{approved-models,translate-messages}.ts`, `packages/scheduling/src/{offer-invariants,publish-event-type}.ts`, `packages/calendar/src/{feed,connections}.ts`, `packages/dashboard/src/onboarding-shell.tsx`, `packages/api-client/**`, `e2e/**`                                     |
| Exit gate  | Through the UI alone an expert completes onboarding (practice country, countries served, languages), adds three locations and three schedules, builds the two reference offers from `scheduling-booking-spec.md` (Quick chat; Physiotherapy), publishes them, creates a private link for a closed agenda, connects two external calendars — and the public funnel from Phase 4 reflects every choice |

## Why this phase exists

Phase 4 makes the offer model bookable; nothing lets an expert **author** it. Health regulation
makes the offer inherently geographic and linguistic (a licence is national; a video consultation
is not), and a real practice mixes online, phone and several physical addresses, each with its own
calendar and price. The MVP hid this behind a single "location" field. This phase gives experts a
builder that expresses it without feeling like a tax form, plus the two things every expert asked
for: a private link to squeeze someone in when the agenda is closed, and their own calendar that
works with zero or many external calendars.

It also introduces `@eleva/editor` (Plate, ADR-023): the one rich-text surface reused by Phase 10
(notes, reports, templates) and Phase 11 (clinic pages), with AI writing help through the Vercel AI
SDK behind `@eleva/ai`.

## Scope

In:

- **Onboarding wizard** (`apps/expert/src/app/onboarding/**`, one step per screen, autosave,
  resumable, progress rail — patterns from `_context/Onboarding-exxamples/airbnb.com/*/readme.md`;
  shell in `@eleva/dashboard` `OnboardingShell` so Phase 11 clinics reuse it): Profile (name,
  handle from `public_handles`, avatar, headline, bio via `@eleva/editor`), **Practice**
  (`practice_country`, `service_countries` with plain-language legal helper text, `languages`,
  `license_scope`, `worldwide_remote` for non-clinical work), Locations (optional), Availability
  (default schedule), First service (compact event type builder). Phase 6 appends Payments and
  Identity, Phase 7 appends Invoicing, completion creates `become_partner_applications`
  (Phase 12). Steps are declared in one registry (`onboarding-steps.ts`) so later phases append,
  never fork the shell.
- **Availability** `/[orgSlug]/availability`: schedules list (name, timezone, default badge, "used
  by" mode chips); editor with weekly grid (drag to create ranges, copy day to others, split
  ranges), date overrides calendar (open/close/blocked), timezone; delete guarded when a mode uses
  the schedule.
- **Locations** `/[orgSlug]/locations`: CRUD with structured address, country (must be inside
  `service_countries`), timezone (auto from country when single-zone), localized instructions
  (`@eleva/editor`, short), "Open in Maps" link (no map SDK); archive guarded when a mode uses it.
- **Services** `/[orgSlug]/services` (event types): list with visibility/published badges and
  mode icons; builder tabs — Basics (localized title + description in `@eleva/editor` with AI
  "Improve", "Shorten", "Translate from English"), Kind (`clinical` | `non_clinical` with the
  legal consequence spelled out), Defaults (duration, price), **Delivery modes** (cards: Video /
  Phone / In person -> pick location; per card: schedule select, price and duration override,
  countries — "Worldwide" toggle only when allowed, otherwise a picker limited to
  `service_countries` with presets EU / Portugal only —, languages subset, optional label),
  Policies (notice, window, buffers, cancellation/reschedule copy preview), Visibility & publish
  (`public` | `unlisted` | `private`, live preview link, publish runs `publishEventType` which
  enforces >= 1 active mode and all invariants and returns human-readable violations), **Private
  links** tab (create: pin mode, recipient e-mail, expiry, uses, price override, schedule override,
  note -> token shown **once** with copy button; list with used/expired/revoked state; revoke).
- **Calendar** `/[orgSlug]/calendar`: Eleva calendar (week/month) of every booking across modes with
  mode/location colour coding, block time (writes `date_overrides`), booking drawer; **ICS feed**
  (create/rotate/revoke token, subscribe instructions for Apple/Google/Outlook); **Connected
  calendars**: accounts from Phase 3 `linkSocial` (Google, Microsoft, several of each), per calendar
  `use_for_busy` toggle, one default destination, destination override per event type and per
  mode, reconnect banner on token failure, disconnect. Explicit empty state: "Eleva is your
  calendar. Connect one only if you already live in another."
- **API** (`apps/api`, all Zod + OpenAPI + rate limit + `requireApiAuth` expert role): `GET/PATCH
/expert/practice`, `/expert/locations` CRUD, `/expert/schedules` CRUD + `PUT
/expert/schedules/[id]/rules` (batch) + `/overrides`, `/expert/event-types` CRUD + `/modes` CRUD +
  `POST /expert/event-types/[id]/publish|unpublish`, `/expert/booking-links` CRUD + `POST
.../revoke`, `GET /expert/bookings?from&to`, `POST/DELETE /expert/calendar/feed-token`, public
  `GET /calendar/feed/[token].ics`, `GET /expert/calendar/connections`, `PATCH
/expert/calendar/calendars/[id]`, `PATCH /expert/event-types/[id]/destination`, `PATCH
/expert/event-types/[id]/modes/[modeId]/destination`, `POST /ai/editor` (streaming).
- **`@eleva/editor`** (new package, ADR-023): `RichTextEditor`, `RichTextViewer` (server-safe,
  sanitized), `LocalizedRichTextField` (locale tabs + "Translate from English"), value stored as
  Plate JSON in `jsonb` plus derived sanitized HTML and plain text columns; Plate registry
  components generated into `packages/editor/src/components/ui/*`; `@platejs/ai` wired to `POST
/ai/editor`. Boundary lint: `platejs`, `@platejs/*`, `slate*` importable only inside
  `packages/editor`; `@radix-ui/*` permitted only inside `packages/editor` (documented ADR-022
  exception for Plate UI); styled with `@eleva/ui` tokens, Phosphor icons.
- **`@eleva/ai`**: `approved-models.ts` allow-list (`{ modelId, provider, zeroRetention,
evidenceUrl }`, fail closed — Phase 10 later requires `zeroRetention: true` for PHI calls),
  `editorAssist({ command, text, targetLocale })` over the AI Gateway (`AI_GATEWAY_MODEL_EDITOR`),
  `translateMessages({ sourceLocale, targetLocales, glossary })` + root script `pnpm i18n:draft`
  writing `messages/<locale>.draft.json` files that `check:i18n-parity` ignores — humans review
  and move keys (README section 4 rule 10).
- Playwright `e2e/expert-offer.spec.ts`.

Out: seat/clinic ownership of locations and shared calendars (Phase 11), Plate-based intake form
builder and template library (Phase 10 / Phase 16), payments and identity onboarding steps
(Phase 6), invoicing step (Phase 7).

## Deliverables

1. `packages/editor` with ADR-023 boundary lint, tests, storybook-free demo route in `apps/expert`
   dev only (`/dev/editor`, excluded from production build).
2. `packages/ai` allow-list + `editorAssist` + `translateMessages` + `pnpm i18n:draft`.
3. `apps/api` routes above, OpenAPI, `@eleva/api-client`; `publishEventType`, `offer-invariants`
   reused from Phase 4; ICS feed generator in `@eleva/calendar`.
4. `apps/expert` onboarding wizard, availability, locations, services (builder + modes + private
   links), calendar (Eleva view, feed, connections); messages `pt/en/es`; `OnboardingShell` in
   `@eleva/dashboard`.
5. `e2e/expert-offer.spec.ts` building both reference offers via UI and asserting the Phase 4
   public funnel.
6. Docs: `scheduling-booking-spec.md` (editor flows), `calendar-integration-spec.md` (feed,
   multi-calendar, destination overrides), `design-system-spec.md` (editor + wizard patterns),
   `api-contract-spec.md`, `decision-log.md`.

## Acceptance criteria

- [ ] Onboarding cannot complete without `practice_country`, >= 1 language and a default schedule;
      `service_countries` outside the licence show the legal helper and are saved as declared.
- [ ] Builder refuses to publish a `clinical` event type whose mode is worldwide or outside
      `service_countries`, an in-person mode without a location, and a mode whose languages are not
      a subset of the profile; each refusal is a sentence a human understands, next to the field.
- [ ] Quick chat built via UI: video mode on schedule "Online" worldwide, phone mode on schedule
      "Phone" with EU preset; public funnel shows both cards in PT and one in BR.
- [ ] Physiotherapy built via UI: follow-up with Lisboa/Porto/Madrid modes, Madrid priced higher,
      each on its own schedule; slots differ per location in the funnel.
- [ ] Private link created for a `private` event type while `accepting_bookings = false` books one
      slot on the override schedule, then shows "used"; revoked link 404s.
- [ ] Two Google accounts and one Microsoft account connected; only calendars toggled
      `use_for_busy` affect slots (test with a busy event); destination override per mode writes the
      booking to the right calendar; token revoke -> reconnect banner; no calendar connected -> ICS
      feed subscription shows bookings in Apple Calendar (manual evidence).
- [ ] `@eleva/editor` AI actions stream, respect the allow-list (unknown model -> typed error), and
      never run on `apps/app` member content; `pnpm i18n:draft` produces draft files and
      `check:i18n-parity` ignores them.
- [ ] Design pass attached (README section 4 rule 10): wizard, builder, calendar in light/dark,
      `pt`/`en`, 360px and 1280px.
- [ ] `e2e/expert-offer.spec.ts` green; `check:i18n-parity` green.

## Tests

- vitest: schedule rule normalisation (overlaps merged, cross-midnight rejected), override
  precedence, invariant messages per violation, link token lifecycle (hash-only storage, expiry,
  uses, revoke), ICS feed content and token rotation, destination resolution order (mode > event
  type > expert default > ICS fallback), `approved-models` fail-closed, `translateMessages` writes
  drafts only.
- Playwright: `expert-offer.spec.ts` (both fixtures end to end), `calendar-connections.spec.ts`
  with mocked provider.

## Docs to update

- `scheduling-booking-spec.md`, `calendar-integration-spec.md`, `design-system-spec.md`,
  `api-contract-spec.md`, `monorepo-structure.md` (`packages/editor`), `decision-log.md`.

## Local references

- `apps/expert/src/**` (existing onboarding, event type and availability screens to replace or
  extend), `packages/dashboard/src/**`.
- `packages/scheduling/src/{offer-invariants,availability,reserve-slot}.ts` (Phase 4),
  `packages/db/src/schema/main/{expert-profiles,event-locations,schedules,event-types,event-type-modes,booking-links,calendar-feed-tokens,expert-integrations}.ts`
  (`expert_practice_locations`, `schedules`, `calendar_busy_sources`, `calendar_destinations` are
  the existing tables the builder edits).
- `packages/calendar/src/**` (adapters, `getProviderAccessToken` injection from Phase 3,
  `ics-generator`), `packages/auth/src/{client,server}.ts` (`linkSocial`, `listAccounts`).
- `packages/ai/src/**`, `packages/ui/src/**` (React Aria primitives — ADR-022),
  `docs/eleva-v3/adrs/ADR-022-react-aria-ui-primitives.md`,
  `docs/eleva-v3/adrs/ADR-023-plate-rich-text-editor.md` (Phase 1).
- `docs/eleva-v3/{scheduling-booking-spec,calendar-integration-spec,design-system-spec}.md`,
  `docs/eleva-v3/brand-book/{README,art-direction}.md`.
- UX references (patterns only, never code): `_context/Onboarding-exxamples/airbnb.com/*/readme.md`;
  `_context/clone-repo/cal.diy` event-type, availability and location flows; MVP screens under
  `_context/clone-repo/eleva-care-app/app/[locale]/(private)/**`.

## External docs

- Plate `/udecode/plate` (installation for Next.js, `editor-basic` / `editor-ai` blocks, AI plugin,
  serializing HTML, value JSON).
- Vercel AI SDK `/vercel/ai` (`streamText`, `generateObject`, AI Gateway provider options).
- Better Auth `/better-auth/better-auth` (`linkSocial` with scopes, `listAccounts`,
  `getAccessToken`).
- Google Calendar API and Microsoft Graph calendars (free/busy, calendar list) via Context7 or
  vendor docs; `ical-generator` or the existing `@eleva/calendar` ICS generator.
- Next.js 16 `/vercel/next.js` (streaming route handlers, Server Actions), next-intl v4
  `/amannn/next-intl`, react-aria-components `/adobe/react-spectrum`.

## Risks

- Plate UI registry components depend on Radix: keep the ADR-022 exception strictly inside
  `packages/editor` and re-style with tokens; never import Plate UI elsewhere.
- Schedule editor UX is where experts churn: prototype the weekly grid first and test with the two
  fixtures before wiring the API.
- Multi-calendar free/busy fan-out can be slow: cache per calendar (5 min) and query in parallel.

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(the directory containing pnpm-workspace.yaml). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc (api-first-agentic, audit-wiring, eleva-icons, react-aria-ui,
   better-auth) and the matching skills plus .cursor/skills/coderabbit-review/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/04b-expert-offer-builder.md in full.
3. Read every file under "Local references" (including the Airbnb onboarding readmes and the
   cal.diy event-type/availability flows as UX patterns). Pull Plate, Vercel AI SDK, Better Auth
   (linkSocial/listAccounts/getAccessToken), Next.js 16, next-intl v4 and react-aria-components docs
   through Context7 (resolve-library-id then query-docs); prefer those docs over memory.

Workflow (mandatory) — this is the outer loop; the "PHASE 4B TASK" section further down is
what you implement at the "Implement the deliverables" step. Read the whole prompt before the
first command; run the checks and both review loops only AFTER the task work exists:
- git checkout main && git pull --ff-only && git checkout -b
  phase-04b.1/practice-locations-schedules-calendars (second PR:
  phase-04b.2/event-type-builder-links-editor). Each under 150 reviewable files.
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

PHASE 4B TASK — Expert offer builder, calendars and @eleva/editor. Data model SSOT:
docs/eleva-v3/scheduling-booking-spec.md ("Event Type", "Delivery Mode", "Private Booking Link",
"Location", "Expert Practice Scope", "Connected Calendar"); tables and invariants already exist
from Phase 4 PR 04.1 — extend, never duplicate. Design bar: README section 4 rule 10 applies to
every screen here; UX copy is written for experts who are clinicians, not admins.

PR 04b.1 — practice scope, locations, schedules, Eleva calendar, connected calendars:
1. apps/api (Zod, OpenAPI, rate limit, requireApiAuth with expert role of the active org, withAudit
   on every write, RLS via withOrgContext): GET/PATCH /expert/practice (practice_country,
   service_countries, languages, license_scope, worldwide_remote, accepting_bookings; PATCH
   re-validates every published event type with @eleva/scheduling offer-invariants and returns
   409 OFFER_INVARIANT_VIOLATION listing the modes that would become illegal — never silently
   unpublish); /expert/locations CRUD (archive instead of delete when a mode references it;
   country must be in service_countries); /expert/schedules CRUD (one default per expert, cannot
   delete a schedule used by a mode -> 409 SCHEDULE_IN_USE with the mode names), PUT
   /expert/schedules/[id]/rules (batch replace; normalise overlaps; reject cross-midnight ranges;
   store weekday 0-6 + start/end time in the schedule timezone), PUT
   /expert/schedules/[id]/overrides (date, open ranges or blocked); GET /expert/bookings?from&to
   (all modes, includes mode/location snapshot); POST /expert/calendar/feed-token (rotate:
   revoke old, return new token ONCE; store sha256 in calendar_feed_tokens) and DELETE; public
   GET /calendar/feed/[token].ics (no session; rate limited 60/h per token; 404 identical for
   unknown/revoked; VEVENTs for confirmed bookings 90 days back/365 forward with mode/location
   in LOCATION and DESCRIPTION, no member PII beyond first name; ETag); GET
   /expert/calendar/connections (accounts from Better Auth listAccounts filtered to google |
   microsoft with calendar scopes, each with its calendars fetched through @eleva/calendar
   adapters, use_for_busy, is_default_destination, status connected|reconnect_required); PATCH
   /expert/calendar/calendars/[id] ({ useForBusy?, isDefaultDestination? } — exactly one default;
   toggling busy invalidates the BusyTimeProvider cache for that expert). Persist selections in
   the EXISTING tables (packages/db/src/schema/main/expert-integrations.ts): expert_integrations
   (one row per connected provider account, linked to the Better Auth account id from Phase 3;
   add last_sync_at, last_error), calendar_busy_sources (enabled = use for busy) and
   calendar_destinations (the per-expert default). Destination overrides: nullable
   destination_integration_id + destination_external_calendar_id on event_types and on
   event_type_modes, validated to belong to the same expert. RLS + audit unions
   (expert_integration: connected|updated|disconnected; calendar_busy_source: updated;
   calendar_destination: updated; calendar_feed_token: rotated|revoked). Update @eleva/api-client.
2. @eleva/calendar: BusyTimeProvider reads every enabled calendar_busy_sources row in parallel
   (Promise.all, 5-min Redis cache per calendar), tolerates one failing provider (log + mark the
   integration reconnect_required, continue); destination resolution order mode destination
   override > event type destination override > calendar_destinations default > ICS e-mail
   fallback (Phase 8 sends);
   feed generator generateIcsFeed({ expertProfileId }) with stable UIDs (bookingId@eleva.care).
   Tests for each rule.
3. @eleva/dashboard: OnboardingShell (progress rail, one step per screen, autosave via Server
   Action per step, resume from last incomplete step, "Save and exit"), StepFooter, declared by
   an onboarding-steps.ts registry (id, title key, component, isComplete(profile)) so Phases 6, 7
   append steps. apps/expert/src/app/onboarding/**: steps Profile (name, handle — validate via
   public_handles, avatar upload — browser calls uploadBlobClient from
   @eleva/storage/blob-upload-client against apps/api POST /expert/profile/avatar, a Route
   Handler that uses handleBlobUpload from @eleva/storage/blob-upload-handler with requireApiAuth
   + active-org check and writes the resulting URL onto expert_profiles.avatar_url; the browser
   never holds a Blob token — headline, bio with
   @eleva/editor placeholder textarea until PR 04b.2 swaps in RichTextEditor), Practice (country
   select with flags, "Where are you allowed to work?" multi-select with a plain-language legal
   note and a "Why we ask" disclosure, languages multi-select from @eleva/config supported
   languages plus free BCP-47 add, licence scope, worldwide toggle shown only for non-clinical
   scopes), Locations (optional, "Add a place" cards), Availability (default schedule editor —
   the same component as /[orgSlug]/availability), then hand-off to "First service" (PR 04b.2;
   until then a placeholder step that links to /services).
4. apps/expert /[orgSlug]/availability (schedules list; weekly grid editor: drag to create,
   click to edit, copy to weekdays/weekend/all, keyboard accessible alternative with time
   inputs; timezone select; date overrides month view; "used by" chips linking to services),
   /[orgSlug]/locations (cards, structured address form, timezone auto-suggest per country,
   localized instructions, "Open in Maps" link built from the address, archive), /[orgSlug]/
   calendar (week/month via a headless calendar grid in @eleva/ui — no calendar SDK — bookings
   coloured by mode and location, booking drawer with member first name, mode, join/phone/address
   line, cancel/reschedule entry points from Phase 4 endpoints; "Block time" creates overrides;
   right rail: ICS feed card (create/rotate/revoke, copy URL, subscribe instructions for Apple,
   Google, Outlook), Connected calendars card (Connect Google / Connect Microsoft via Phase 3
   linkSocial with calendar scopes, account rows with calendar checkboxes for busy, radio for
   destination, reconnect banner, disconnect), empty state copy "Eleva is your calendar.
   Connect one only if you already live in another."). Server Actions: Zod, authenticate inside,
   delegate to @eleva/api-client. Messages pt/en/es.
5. Tests: vitest for rule normalisation, override precedence, feed generation, destination
   resolution, busy fan-out with one failing provider; Playwright calendar-connections.spec.ts
   with a mocked provider adapter.

PR 04b.2 — @eleva/editor, AI assist, services builder, delivery modes, private links:
6. packages/editor (new, ADR-023): pnpm exec shadcn add for the Plate editor-basic block and the
   AI block into packages/editor/src/components/ui (registry https://platejs.org/r/{name}),
   rewrite cn/icon imports to @eleva/ui and @eleva/icons, restyle with tokens; export
   RichTextEditor ({ value, onChange, locale, ai?: { enabled, context: "marketing" | "clinical" } }),
   RichTextViewer (server component; renders the stored sanitized HTML; sanitizer allow-list
   tested against XSS vectors), LocalizedRichTextField (tabs for pt/en/es; "Translate from
   English" per tab calls the AI route and marks the tab "AI draft — review" until edited),
   toPlainText(value), toSanitizedHtml(value). Storage contract: jsonb value + html + text
   columns on every consumer table (this PR: event_types.description_*, expert_profiles.bio_*,
   expert_locations.instructions_*), written server-side from the JSON — clients never send
   HTML. ESLint boundary: platejs, @platejs/*, slate* only in packages/editor; @radix-ui/* only
   in packages/editor (documented ADR-022 exception) — add both to the boundary lint with tests;
   catalog every new dependency in pnpm-workspace.yaml.
7. @eleva/ai: packages/ai/src/approved-models.ts allow-list { modelId, provider, zeroRetention,
   evidenceUrl } with assertApprovedModel (fail closed, typed AI_MODEL_NOT_APPROVED); editorAssist
   ({ command: improve|shorten|fix_grammar|translate, text, sourceLocale, targetLocale, context })
   using streamText through the Vercel AI Gateway (model from AI_GATEWAY_MODEL_EDITOR, pinned);
   translateMessages({ sourceLocale: "en", targetLocales, glossary from
   packages/i18n/glossary.json — "members", "Space", "expert" fixed terms }) + root script
   "i18n:draft" writing messages/<locale>.draft.json in every app that has missing keys; extend
   scripts/check-i18n-parity.mjs to ignore *.draft.json and fail if a draft file is older than 14
   days (drafts must be reviewed, not parked). apps/api POST /ai/editor (expert session only:
   requires an active organization whose membership grants expert-content editing, and the body
   carries { resource: "expert_profile" | "event_type" | "location", resourceId } which the
   handler loads under withOrgContext and rejects with 404 when it is not owned by that org —
   member-owned apps/app content is never accepted; rate limit 30/h/org, streams; context
   "clinical" is REJECTED in this phase — Phase 10 enables it with zeroRetention models and adds
   the "record" resource; logs tokens/latency, never content).
8. apps/api: /expert/event-types CRUD (kind, visibility, defaults, policies, localized fields via
   the editor contract), /expert/event-types/[id]/modes CRUD (validated with offer-invariants on
   every write; 422 with field-level messages), POST /expert/event-types/[id]/publish ->
   @eleva/scheduling publishEventType (>= 1 active mode, all invariants, handle exists) and
   /unpublish, PATCH .../destination and .../modes/[modeId]/destination; /expert/booking-links
   (POST returns the raw token once and stores sha256; GET list with derived status
   active|used|expired|revoked; POST /[id]/revoke; recipient_email lowercased; price override
   >= 0; schedule override must belong to the expert); cache invalidation of
   cacheTag("public-experts") and the profile tag on publish/unpublish/mode changes. Update
   @eleva/api-client + OpenAPI.
9. apps/expert /[orgSlug]/services: list (cards with mode icons, price range, visibility and
   published badges, "Copy link", "Private link" quick action); builder at /services/[id] with
   tabs Basics (LocalizedRichTextField for description, AI actions), Kind (two cards explaining the
   legal consequence in one sentence each), Defaults, Delivery modes (mode cards; "Add a way to
   meet" chooses Video / Phone / In person -> location picker or "Add a place" inline; per card:
   schedule select with "New schedule" inline, price and duration override toggles, countries
   control = "Worldwide" switch when allowed else a chip picker limited to service_countries with
   presets "EU", "Portugal only", "All my countries"; languages chips subset; optional label;
   inline invariant messages), Policies, Visibility & publish (preview opens the Phase 4 public
   funnel in a new tab; publish button disabled with the list of blockers when invariants fail),
   Private links tab (create dialog -> token shown once with copy + "Send by e-mail" mailto; table
   with status, uses, expiry, note; revoke with confirm). Onboarding "First service" step reuses
   the builder in compact mode (Basics + one mode + publish). Messages pt/en/es; every enum shown
   to a human goes through i18n (never raw values).
10. e2e/expert-offer.spec.ts: log in as a seeded expert with an empty offer, complete onboarding,
    build Quick chat (video worldwide on "Online", phone EU on "Phone", 4 languages) and
    Physiotherapy (First visit online PT/ES; Follow-up with Lisboa/Porto/Madrid modes, Madrid
    priced higher, three schedules), publish, open the public funnel as a PT visitor and a BR
    visitor and assert the mode cards; create a private link for a private event type with
    accepting_bookings = false and book through it; assert used state.
11. Docs: scheduling-booking-spec.md (editor flows), calendar-integration-spec.md (feed,
    multi-calendar, destination order), design-system-spec.md (editor, wizard, weekly grid),
    api-contract-spec.md, monorepo-structure.md (packages/editor), decision-log.md.

Acceptance (paste evidence): both fixtures built through the UI and visible in the public funnel
with the expected cards per visitor country; invariant refusals shown inline; private link books
with a closed agenda and shows used; two providers connected with busy/destination behaviour proven
by tests; ICS feed subscribed in Apple Calendar (screenshot); AI actions stream and fail closed on
an unapproved model; pnpm i18n:draft drafts ignored by parity check; design pass screenshots;
e2e green; i18n parity green.

Report: endpoints, migrations, packages added (with catalog entries), tests, CodeRabbit CLI
counts, PR URLs, deferred items.
```
