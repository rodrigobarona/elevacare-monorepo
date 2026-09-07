# Phase 9 — Video with Daily.co (`@eleva/video`, join pages, webhooks)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-09/video-daily`                                                                                                                                                                                                                                                                                                                                        |
| Depends on | Phases 5, 8                                                                                                                                                                                                                                                                                                                                                   |
| Effort     | 1.5 weeks                                                                                                                                                                                                                                                                                                                                                     |
| Touches    | `packages/video/**` (new), `packages/db/src/schema/main/sessions.ts`, `packages/workflows/src/video/**`, `apps/api/src/app/{sessions,webhooks/daily,workflows}/**`, `apps/app/**` + `apps/expert/**` join pages, `packages/observability` (CSP), `packages/eslint-config/boundaries.js`, `apps/web/vercel.json` or gateway rewrites for `sessions.eleva.care` |
| Exit gate  | Expert and member join the same private Daily room via per-participant meeting tokens from their apps; unauthorized token rejected; room expires automatically; `meeting.started/ended` webhooks update the session; no PHI in logs                                                                                                                           |

## Why this phase exists

ADR-018: Daily.co is the only video provider (HIPAA-enabled domain). Every confirmed booking needs
a room created ahead of time, tokens minted per participant at join time, and lifecycle webhooks to
drive session status, notifications and (Phase 10) transcripts.

## Scope

In:

- `packages/video` (`@eleva/video`, sole `@daily-co/*` importer; server = REST via `fetch` with
  `DAILY_API_KEY`, client = `@daily-co/daily-react` + `@daily-co/daily-js`):
  `createSessionRoom({ bookingId, startAt, endAt })` -> private room, random name (HIPAA mode
  forbids custom names), `nbf = startAt - 15 min`, `exp = endAt + 30 min`,
  `max_participants` = 2 + number of delegated participants (recomputed via Daily room update
  when a delegate is added, so every authorised participant can join), `enable_prejoin_ui: true`, `enable_chat: true`,
  `enable_screenshare: true`, `enable_recording: false` (Phase 10 behind consent),
  `eject_at_room_exp: true`; `mintMeetingToken({ roomName, userId, userName, isOwner, exp })`;
  `deleteRoom(roomName)`; `verifyWebhookSignature(req)`; typed webhook event parser.
- `sessions` table: `booking_id` unique, `daily_room_name`, `daily_room_url`, `status`
  (`scheduled|live|ended|no_show|cancelled`), `started_at`, `ended_at`, `participants jsonb`
  (join/leave history only — never used for authorization), RLS for expert org + buyer org.
- `session_participants` table (the **authorization** contract for delegated participants):
  `booking_id`, `user_id`, `role` (`delegate|supervisor`), `added_by`, `added_at`, unique
  (`booking_id`, `user_id`); RLS expert org + the participant's own row; written only by
  `POST /sessions/[bookingId]/participants` (assigned expert only, audited
  `session.participant_added`) and `DELETE …/participants/[userId]` (`session.participant_removed`).
- Workflow: on booking confirmed -> `ensureSessionRoom(bookingId)` (idempotent; also run by a
  QStash sweep 1h before start for bookings without a room); on cancel -> `deleteRoom`.
- API: `POST /sessions/[bookingId]/join` -> checks the caller is the booking's assigned expert,
  the booking's member, or an explicitly delegated participant of that booking (never "any
  member of the expert org"; non-participants get 403 `NOT_A_PARTICIPANT`) and that now is
  within `[startAt-15m, endAt+30m]`, mints a token, returns `{ roomUrl,
token, expiresAt }` (rate limited, audited `session.joined`); `POST /webhooks/daily` handles
  `meeting.started`, `meeting.ended`, `participant.joined`, `participant.left` (Daily webhook
  payloads; verify signature; idempotent by event id) -> session status + `emitDomainEvent`.
- Join pages: `apps/app/[orgSlug]/sessions/[bookingId]/join` and
  `apps/expert/[orgSlug]/sessions/[bookingId]/join` using `@eleva/video/client` components:
  prejoin device check, waiting room ("Your expert will join shortly"), in-call UI (mute, camera,
  screenshare, chat, leave), expert-only side panel placeholder for notes (Phase 10), post-call
  screen (feedback CTA). Custom UI (no Daily Prebuilt) to keep branding and CSP control.
- Branding: `sessions.eleva.care` CNAME to Daily per their custom-domain docs (operator task) —
  room URLs use the branded domain when configured (`DAILY_DOMAIN`).
- CSP in `@eleva/observability` security headers: `connect-src`/`frame-src`/`media-src` for
  `*.daily.co`, `wss://*.daily.co`, `sessions.eleva.care`; permissions policy for camera/mic
  on join routes only.
- Boundary lint: `@daily-co/*` only in `packages/video`.
- Notifications: `booking.reminder_1h` and confirmation include the join link (deep link to the
  app join page, not the raw room URL).

Out: recording/transcription (Phase 10), group sessions, dial-in.

## Deliverables

1. `packages/video/{package.json,src/server/*,src/client/*,src/webhooks.ts,README.md}` + tests.
2. Migration: `sessions` + `session_participants`; RLS; audit unions (`session:` `room_created`,
   `joined`, `started`, `ended`, `room_deleted`, `participant_added`, `participant_removed`).
3. Workflows + QStash sweep; API routes (`join`, `participants` add/remove, Daily webhook) +
   OpenAPI + client; tests: delegate can join, removed delegate gets 403, third participant fits
   the room capacity.
4. Join pages in `apps/app` and `apps/expert` with `pt/en/es` messages.
5. CSP update + boundary lint + env (`DAILY_API_KEY`, `DAILY_DOMAIN`, `DAILY_WEBHOOK_SECRET`).
6. Playwright `e2e/video-join.spec.ts` (mocks Daily JS or uses a fake media device profile).

## Acceptance criteria

- [ ] Confirmed booking has a room within seconds (workflow) and the sweep catches missing rooms.
- [ ] Expert token is `is_owner: true`; member token is not; token `exp` <= room `exp`.
- [ ] Join outside the window -> 403 `SESSION_NOT_OPEN`; non-participant (including another
      expert of the same organization) -> 403 `NOT_A_PARTICIPANT`; delegated participant -> 200.
- [ ] Two browsers (expert, member) in staging join and see each other; leaving/ending updates
      `sessions.status` via webhooks within 30s.
- [ ] Room auto-expires (`exp`) and is deleted on cancellation.
- [ ] Webhook signature failure -> 401; replay same event -> no duplicate transitions.
- [ ] Logs and audit payloads contain room name and ids only (no names, no emails).
- [ ] CSP allows the call to run without console violations.

## Tests

- vitest: room option builder (nbf/exp math), token claims, join authorization matrix, webhook
  parser + signature, idempotency.
- Playwright: join page loads prejoin UI with mocked devices.

## Docs to update

- `scheduling-booking-spec.md` (sessions), `security-hardening-checklist.md` (CSP),
  `environment-matrix.md` (`sessions.eleva.care`), `integration-runbooks.md` (Daily outage),
  `operator-tasks/daily-setup.md` (HIPAA domain, webhook, custom domain), `decision-log.md`.

## Local references

- ADR-018, `docs/eleva-v3/scheduling-booking-spec.md`, `docs/eleva-v3/security-hardening-checklist.md`.
- `packages/observability/src/**` (security headers), `apps/api/src/lib/security-headers.ts`.
- `packages/workflows/src/**`, `infra/qstash/**`, `packages/db/src/schema/main/bookings.ts`.
- `apps/app/src/app/[orgSlug]/sessions/**`, `apps/expert/src/app/**` (layout patterns).
- `.cursor/rules/daily-video.mdc` (from Phase 1).

## External docs

- Daily REST API `/websites/daily_co_reference_rest-api` (rooms, meeting tokens, webhooks, HIPAA
  constraints, custom domains), `@daily-co/daily-react` `/daily-co/daily-react`, `daily-js`.
- Next.js CSP guidance `/vercel/next.js`.

## Risks

- HIPAA mode restrictions (no custom room names, no live streaming, limited recording types):
  designed in from the start; verify the account has HIPAA enabled (operator task).
- Browser permissions on iOS Safari: test on device before Phase 15.

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(the directory containing pnpm-workspace.yaml). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc (daily-video, api-first-agentic, audit-wiring, eleva-icons)
   and .cursor/skills/{api-first-agentic,audit-wiring,coderabbit-review}/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/09-video-daily.md in full.
3. Read every file under "Local references". Pull Daily REST API (rooms, meeting tokens,
   webhooks, HIPAA, custom domain), daily-react and Next.js CSP docs through Context7
   (resolve-library-id then query-docs); prefer those docs over memory.

Workflow (mandatory):
- git checkout main && git pull --ff-only && git checkout -b phase-09/video-daily
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build &&
  pnpm check:i18n-parity
- Run: pnpm review  (CodeRabbit CLI on uncommitted changes) -> fix all findings -> repeat until clean
- Commit with Conventional Commits. Run: pnpm review:branch -> fix -> repeat until clean.
- git push -u origin HEAD && gh pr create --base main (PR body template README section 8).
- Loop on CodeRabbit GitHub App comments + CI until zero unresolved and all green; request
  approval from @rodrigobarona; gh pr merge --squash --delete-branch.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for pt/en/es, cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 9 TASK — Daily.co video sessions (ADR-018).

1. Create packages/video (@eleva/video): package.json with exports "." (server), "./client",
   "./webhooks"; catalog entries for @daily-co/daily-js and @daily-co/daily-react. Server (fetch
   against https://api.daily.co/v1 with DAILY_API_KEY, never log the key): createSessionRoom({
   bookingId, startAt, endAt }) -> POST /rooms { privacy: "private", properties: { nbf: startAt-15m,
   exp: endAt+30m, max_participants: 2 + delegated participant count (updateRoom when a delegate
   is added), enable_prejoin_ui: true, enable_chat: true,
   enable_screenshare: true, enable_recording: false, eject_at_room_exp: true, enable_knocking:
   false, lang: from booking locale } } (no custom name: HIPAA), returns { name, url } with url
   rewritten to https://${DAILY_DOMAIN}/${name} when DAILY_DOMAIN is a custom domain;
   mintMeetingToken({ roomName, userId, userName, isOwner, exp }) -> POST /meeting-tokens
   { properties: { room_name, user_id, user_name, is_owner, exp, eject_at_token_exp: true,
   enable_recording: false } }; deleteRoom(name); getRoom(name). webhooks.ts: verifyDailyWebhook
   (request, DAILY_WEBHOOK_SECRET) per Daily docs (HMAC over timestamp + body), typed parser for
   meeting.started, meeting.ended, participant.joined, participant.left, error. Client:
   <ElevaCall roomUrl token onLeft /> built on DailyProvider + daily-react hooks: prejoin device
   selection + preview, waiting state until the other participant joins, controls (mic, camera,
   screenshare, chat panel, leave), network quality indicator, post-call screen; expert variant
   with a right-side panel slot for notes (Phase 10). Tests for option builders, token claims,
   webhook verification.
2. packages/db: sessions (id, booking_id unique FK, expert_org_id, buyer_org_id, daily_room_name
   unique, daily_room_url, status scheduled|live|ended|no_show|cancelled, room_created_at,
   started_at, ended_at, participants jsonb [{ role, joined_at, left_at }] (history only, never
   authorization), created_at, updated_at) and session_participants (booking_id FK, user_id FK,
   role delegate|supervisor, added_by, added_at, unique(booking_id, user_id)) — the only source of
   delegated-join authorization. RLS: expert org and buyer org read sessions; session_participants
   readable by the expert org and by the participant; API writes. Audit unions session:
   room_created|joined|started|ended|room_deleted|participant_added|participant_removed.
3. Workflows: packages/workflows/src/video/ensure-session-room.ts (idempotent: returns existing
   room) invoked from emitDomainEvent("booking.confirmed") and by a QStash sweep every 15 min for
   bookings starting within 2h without a room (route POST /workflows/video-room-sweep;
   infra/qstash/setup-video.ts + root script + setup:all); on booking.cancelled -> deleteRoom.
4. apps/api: POST /sessions/[bookingId]/join (requireApiAuth; caller must be exactly one of:
   the booking's assigned expert (bookings.expert_user_id), the booking's member
   (bookings.member_user_id), or a user listed in session_participants for that booking with a
   delegated role (added by the assigned expert via POST /sessions/[bookingId]/participants,
   audited session.participant_added; clinic admins are NOT implicitly allowed) — anyone else,
   including other members of the expert's organization, gets 403 NOT_A_PARTICIPANT; window
   [startAt-15m, endAt+30m] else 403 SESSION_NOT_OPEN; mints token with exp = min(now+2h,
   roomExp); audited session.joined; rate limit 10/min/user) and POST /webhooks/daily (verify
   signature -> 401 on failure; idempotency table daily_webhook_events keyed by event id ->
   update sessions + emitDomainEvent). OpenAPI + client.
5. Join pages: apps/app/src/app/[orgSlug]/sessions/[bookingId]/join/page.tsx and the expert
   equivalent — server component fetches booking, renders <JoinClient> that calls the join
   endpoint via @eleva/api-client and mounts <ElevaCall>. Add "Join session" buttons (enabled in
   window) on the Phase 5 session pages and the expert sessions list; update the confirmation and
   1h-reminder templates to deep-link to the join page. Messages pt/en/es.
6. Security: extend the CSP builder in @eleva/observability (and apps/api security headers):
   connect-src https://*.daily.co wss://*.daily.co https://sessions.eleva.care; frame-src/media-src
   accordingly; Permissions-Policy camera=(self), microphone=(self), display-capture=(self) only
   on join routes (per-route header via proxy.ts helper). Boundary lint: @daily-co/* only in
   packages/video. Env: DAILY_API_KEY, DAILY_DOMAIN (elevacare.daily.co or sessions.eleva.care),
   DAILY_WEBHOOK_SECRET in .env.example, turbo.json, environment-matrix.md. Operator tasks doc
   operator-tasks/daily-setup.md: enable HIPAA on the Daily domain, create the webhook pointing to
   https://api.<env>/webhooks/daily with the secret, configure the custom domain
   sessions.eleva.care (CNAME) and the corresponding Vercel DNS record.
7. Tests: unit as above; e2e/video-join.spec.ts loads the join page with
   --use-fake-device-for-media-stream and reaches the prejoin UI. Manual staging test with two
   browsers; paste screenshots in the PR.
8. Docs: scheduling-booking-spec.md sessions section, security-hardening-checklist.md CSP,
   integration-runbooks.md (Daily outage: fall back to reschedule + notify), decision-log.md.

Acceptance (paste evidence): room created on confirm + sweep; token claims (expert is_owner);
403 outside window / non-participant; two-browser call works on staging; webhooks update status,
signature failure 401, replay idempotent; room deleted on cancel; PHI-free logs; no CSP
violations.

Report: package layout, migrations, endpoints, schedules, tests, CodeRabbit CLI counts, PR URL,
operator tasks pending.
```
