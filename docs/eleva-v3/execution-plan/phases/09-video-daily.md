# Phase 9 — Video with Daily.co (`@eleva/video`, join pages, webhooks)

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-09/video-daily`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Depends on | Phases 5, 8. **Pre-check PR 09.0** (`phase-09.0/spike-daily-account`, docs + evidence only) must be merged before 09 opens: Daily HIPAA domain enabled and BAA/DPA executed with Daily (owner: founder + DPO; record in `decision-log.md` as D-07 with the Daily plan tier), EU data-processing position documented (Daily media servers are region-routed; TURN/media residency stated as Daily documents it — no stronger claim on `/trust`), custom domain `sessions.eleva.care` verified, webhook secret issued, meeting-token claims verified against the current API in staging, and the recording feature confirmed **off** for the domain (recording moves to Phase 16.8, not Phase 10). Evidence in `docs/eleva-v3/spikes/09-daily-account.md`. |
| Effort     | 1.5 weeks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Touches    | `packages/video/**` (new), `packages/db/src/schema/main/sessions.ts`, `packages/workflows/src/video/**`, `apps/api/src/app/{sessions,webhooks/daily,workflows}/**`, `apps/app/**` + `apps/expert/**` join pages, `packages/observability` (CSP), `packages/eslint-config/boundaries.js`, `apps/web/vercel.json` or gateway rewrites for `sessions.eleva.care`                                                                                                                                                                                                                                                                                                                                                                                            |
| Exit gate  | Expert and member join the same private Daily room via per-participant meeting tokens from their apps; unauthorized token rejected; room expires automatically; `meeting.started/ended` webhooks update the session; no PHI in logs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Why this phase exists

ADR-018: Daily.co is the only video provider (HIPAA-enabled domain). Every confirmed **online**
booking (snapshotted `mode = online`; phone and in-person bookings never get a room) needs a room
created ahead of time, tokens minted per participant at join time, and lifecycle webhooks to
drive session status and notifications (recording and transcripts: Phase 16.8 only).

## Scope

In:

- `packages/video` (`@eleva/video`, sole `@daily-co/*` importer; server = REST via `fetch` with
  `DAILY_API_KEY`, client = `@daily-co/daily-react` + `@daily-co/daily-js`):
  `createSessionRoom({ bookingId, startAt, endAt })` — called **only for bookings whose
  snapshotted `mode = online`** (`event_type_modes`, Phase 4); `phone` bookings get no room (the
  session page shows the member's masked number to the expert and "your expert will call you" to
  the member) and `in_person` bookings show the location card instead of a join button; both
  `ensureSessionRoom` and the no-room sweep below filter on the snapshotted `mode = 'online'`
  before creating or scheduling anything, so phone and in-person bookings never reach Daily ->
  private room, random name (HIPAA mode
  forbids custom names), `nbf = startAt - 15 min`, `exp = endAt + 30 min`,
  `max_participants` = 2 + number of delegated participants (recomputed via Daily room update
  when a delegate is added, so every authorised participant can join), `enable_prejoin_ui: true`, `enable_chat: true`,
  `enable_screenshare: true`, `enable_recording: false` (recording is Phase 16.8, gated on D-07/D-08),
  `eject_at_room_exp: true`; `mintMeetingToken({ roomName, userId, userName, isOwner, exp })`;
  `deleteRoom(roomName)`; `verifyWebhookSignature(req)`; typed webhook event parser.
- `sessions` table: `booking_id` unique, `daily_room_name`, `daily_room_url`, `status`
  (`scheduled|live|ended|no_show|cancelled|room_unresolved` — one union shared by the migration,
  the API types and the state machine), `attendance` nullable (`both|expert_only|member_only|nobody`,
  derived from the full ordered participant history by `finalizeAttendance` after
  `meeting.ended` and re-derived by later correction runs when late participant events arrive —
  see the state machine below), `room_create_attempt_at`, `room_attempt_seq int`,
  `room_fingerprint_exp` (Daily gives us **no** idempotency handle: HIPAA mode replaces any custom
  room name with a random string and rejects a `name` in the request, and room properties are a
  closed set with no `meta`. The only booking-specific values a room carries are `nbf` and `exp`,
  so each attempt sets `exp = endAt + 30 min + <offset of 0–599 s>` stored in
  `room_fingerprint_exp`, which carries a **global UNIQUE index** — the offset is allocated in
  Eleva-owned state so no two sessions ever share an `exp` second, and the pair
  (`nbf`, `exp`) therefore identifies exactly one booking; a lost response is reconciled by
  listing rooms created inside the attempt window whose `config.nbf`/`config.exp` equal the
  stored pair, and anything other than exactly one match is `room_unresolved`, never an
  adoption — details in the prompt; verified in PR 09.0), `last_event_at`,
  `started_at`, `ended_at`, `participants jsonb`. Transition to `no_show`: `attendance` is
  **derived, never written from a single event**: on `meeting.ended` (or the sweep at `end_at +
15 min` when Daily sent nothing) the handler schedules `finalizeAttendance(bookingId)` at
  `ended + 2 min` (QStash, idempotent); it recomputes attendance from the full ordered
  `participants` history (an empty history — Daily sent nothing — yields `nobody`, so the sweep
  path always persists a non-NULL attendance before the status transition; every
  `participant.joined`/`left` persisted by the webhook, including
  those whose event time precedes `meeting.ended` but arrived after it) and only then sets the
  status: `attendance <> 'both'` -> `no_show`, else `ended`; a participant event that arrives
  after finalization with an event time inside the session window re-runs the recompute and may
  flip `no_show` -> `ended` (never the reverse; emits `session.attendance_corrected` and undoes
  any no-show side effect that has not executed yet); both transitions are in the state-machine
  table and tested, including the out-of-order sequence `participant.joined` (t=10:02) delivered
  after `meeting.ended` (t=10:31) -> final status `ended`, not `no_show`
  (join/leave history only — never used for authorization), RLS for expert org + buyer org.
- `session_participants` table (the **authorization** contract for delegated participants):
  `booking_id`, `user_id`, `role` (`delegate|supervisor`), `added_by`, `added_at`, `revoked_at`,
  `ejected_at`, unique (`booking_id`, `user_id`); RLS expert org + the participant's own row;
  written only by
  `POST /sessions/[bookingId]/participants` (assigned expert only, audited
  `session.participant_added`) and `DELETE …/participants/[userId]` (`session.participant_removed`).
  Daily meeting tokens are signed JWTs and cannot be revoked, so removal is a two-phase
  operation that is safe in both failure directions: phase 1 (transaction) sets
  `session_participants.revoked_at = now()` (a deny state — `join` requires `revoked_at IS
NULL`, so no new token can be minted from this instant) inside withAudit
  `session.participant_removed`. **Linearization point** — the participant row lock: `join` runs
  `SELECT … FROM session_participants WHERE booking_id = $1 AND user_id = $2 FOR UPDATE` (the
  table is keyed by `booking_id`, the route's parameter — there is no `session_id` column), checks
  `revoked_at IS NULL` and the session status, signs the meeting token (a local HS256 JWT signed
  with the Daily domain API key — no vendor call, so README rule 9 is respected) and inserts the
  `session_joins` audit row **inside that same transaction**; the revocation `UPDATE … SET
  revoked_at` on the same row therefore waits for the join to commit or the join waits for the
  revocation, never interleaves: either the token is minted before the revoke commits (and the
  eject in phase 2 removes that participant, which is the accepted residual since a Daily JWT
  cannot be invalidated) or the join sees `revoked_at` and returns 403. No second unlocked
  re-check is used. Race test (two connections): `BEGIN join; SELECT … FOR UPDATE` held ->
  revoke blocks -> join commits with a token -> revoke commits -> next join 403 -> eject called
  with the minted participant's user id; and the mirror order (revoke first -> join 403, no
  token, no eject of a phantom); phase 2 calls Daily `POST /rooms/{name}/eject` with
  `user_ids: [userId]` and `ban: true` (idempotent — no live participant is a no-op) with a
  10 s timeout and bounded retry, then sets `ejected_at`; the route returns 200 when both
  phases succeeded and 202 `{ ejectionPending: true }` when Daily failed — the row stays revoked
  and `POST /workflows/video-eject-retry` (QStash, every minute while rows have `revoked_at`
  and no `ejected_at`) completes the ejection. Rows are never hard-deleted while the session
  exists (revoked rows are history). Tests: Daily 5xx -> row revoked, join 403, retry job ejects;
  DB failure after a successful eject cannot re-authorize because the eject is only attempted
  after phase 1 committed; mint -> remove -> rejoin 403.
- Workflow: on booking confirmed -> `ensureSessionRoom(bookingId)` (idempotent; returns early
  unless the booking's snapshotted `mode = 'online'`; also run by a QStash sweep 1h before start
  for online bookings without a room — the sweep query itself filters `mode = 'online'`); on
  cancel -> `deleteRoom` (no-op when no room).
- API: `POST /sessions/[bookingId]/join` -> checks the caller is the booking's assigned expert,
  the booking's member, or an explicitly delegated participant of that booking (never "any
  member of the expert org"; non-participants get 403 `NOT_A_PARTICIPANT`), that
  `sessions.status IN ('scheduled','live')` (a `cancelled`/`ended`/`no_show` session gets 410
  `SESSION_NOT_ACTIVE` even if the Daily `deleteRoom` failed or is still pending — the DB status,
  not the room's existence, is the authority) and that now is
  within `[startAt-15m, endAt+30m]`, mints a token, returns `{ roomUrl,
token, expiresAt }` (rate-limited, audited `session.joined`); `POST /webhooks/daily` handles
  `meeting.started`, `meeting.ended`, `participant.joined`, `participant.left` (Daily webhook
  payloads; verify signature; idempotent by event id **and ordered by event time**: Daily
  delivers roughly, not strictly, in order, so the handler persists the payload's event
  timestamp on `sessions.last_event_at` and applies a transition only when the incoming
  timestamp is newer — a late `meeting.started` can never overwrite `ended`; `sessions.status`
  is a monotonic machine `scheduled -> live -> ended`, and `participant.*` events after `ended`
  only append history) -> session status + `emitDomainEvent`.
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

- **Payment ↔ session state**: a room is created only for `bookings.status = confirmed` (paid);
  `payment_intent.payment_failed` / `refund succeeded` before `startAt` set `sessions.status =
cancelled` and delete the room in the same workflow that releases the slot; a refund after the
  session leaves `sessions` untouched (history) — the state machine is drawn in
  `scheduling-booking-spec.md` and every transition has a test. No-show: `meeting.ended` with a
  single participant (or none) for the whole window marks `sessions.attendance = expert_only |
member_only | nobody` (both present -> `both`) and the status `no_show` (see the schema bullet); the no-show **policy** (refund/keep/partial) is a Phase 6 refund-policy
  input decided by finance, this phase only records attendance.
- **Session-token hygiene**: meeting tokens are minted at join time only, `exp = min(now + 2h,
endAt + 30 min)` — the Eleva join-window end, **never the room `exp`**, which carries the
  fingerprint offset and may be up to 599 s later (boundary test: a token minted at
  `endAt + 29 min 59 s` expires at exactly `endAt + 30 min`, not at room `exp`) — never stored, never logged, never placed in a URL the browser can bookmark (the
  join page fetches it via `POST /sessions/[bookingId]/join` and hands it to `daily-js` in
  memory); `session.joined` audit rows carry `userId` and `roomName` only.

Out: **recording and transcription (moved to Phase 16.8 — not Phase 10; Daily HIPAA recording
requires a customer-owned S3 landing zone, see 16.8)**, group sessions, dial-in.

## Deliverables

1. `packages/video/{package.json,src/server/*,src/client/*,src/webhooks.ts,README.md}` + tests.
2. Migration: `sessions` + `session_participants` + `daily_webhook_events` (`event_id` unique,
   `type`, `received_at`, `processed_at`, `payload jsonb`; 90-day retention sweep; RLS
   staff-only — no tenant rows; test fixture with a replayed `meeting.ended`); RLS; audit unions
   (`session:` `room_created`, `joined`, `started`, `ended`, `room_deleted`,
   `participant_added`, `participant_removed`).
3. Workflows + QStash sweep; API routes (`join`, `participants` add/remove, Daily webhook) +
   OpenAPI + client; tests: delegate can join, removed delegate gets 403, third participant fits
   the room capacity.
4. Join pages in `apps/app` and `apps/expert` with `pt/en/es` messages.
5. CSP update + boundary lint + env (`DAILY_API_KEY`, `DAILY_DOMAIN`, `DAILY_WEBHOOK_SECRET`).
6. Playwright `e2e/video-join.spec.ts` (mocks Daily JS or uses a fake media device profile).

## Acceptance criteria

- [ ] Confirmed online booking has a room within seconds (workflow) and the sweep catches missing
      rooms; phone and in-person bookings never get one (both paths tested).
- [ ] Expert token is `is_owner: true`; member token is not; token `exp` <= `endAt + 30 min` (< room `exp` whenever the fingerprint offset is > 0) — boundary test included.
- [ ] Join outside the window -> 403 `SESSION_NOT_OPEN`; non-participant (including another
      expert of the same organization) -> 403 `NOT_A_PARTICIPANT`; delegated participant -> 200.
- [ ] Two browsers (expert, member) in staging join and see each other; leaving/ending updates
      `sessions.status` via webhooks within 30s.
- [ ] Room auto-expires (`exp`) and is deleted on cancellation.
- [ ] Webhook signature failure -> 401; replay same event -> no duplicate transitions.
- [ ] Logs and audit payloads contain room name and ids only (no names, no emails).
- [ ] CSP allows the call to run without console violations.
- [ ] Payment failure / refund before `startAt` cancels the session and deletes the room; refund
      after the session leaves the session record intact (state-machine tests).
- [ ] PR 09.0 evidence file exists and D-07 (Daily HIPAA + BAA) is recorded before this PR opens.
- [ ] Meeting token never appears in a URL, log line, audit payload or persisted column (grep test
      over fixtures + `check-no-phi-logs` extension).

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
  designed in from the start; the account state is verified **before** the phase starts (PR
  09.0), not discovered during implementation.
- Daily BAA/DPA or plan tier not in place: 09.0 blocks the phase; the fallback is to ship phone
  and in-person modes first (they need no room) and keep online bookings unpublishable.
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
3. Read every file under "Local references" and docs/eleva-v3/spikes/09-daily-account.md (PR
   09.0 evidence: if it is missing or D-07 is not in decision-log.md, stop and report — this
   phase must not start). Pull Daily REST API (rooms, meeting tokens,
   webhooks, HIPAA, custom domain), daily-react and Next.js CSP docs through Context7
   (resolve-library-id then query-docs); prefer those docs over memory.

Workflow (mandatory) — this is the outer loop; the "PHASE 9 TASK" section further down is
what you implement at the "Implement the deliverables" step. Read the whole prompt before the
first command; run the checks and both review loops only AFTER the task work exists:
- git checkout main && git pull --ff-only && git checkout -b phase-09/video-daily
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

PHASE 9 TASK — Daily.co video sessions (ADR-018).

1. Create packages/video (@eleva/video): package.json with exports "." (server), "./client",
   "./webhooks"; catalog entries for @daily-co/daily-js and @daily-co/daily-react. Server (fetch
   against https://api.daily.co/v1 with DAILY_API_KEY, never log the key): createSessionRoom({
   bookingId, startAt, endAt, fingerprintExp }) -> POST /rooms { privacy: "private" (NO name —
   HIPAA mode rejects it), properties: { nbf: startAt-15m,
   exp: fingerprintExp (= endAt+30m + 0..599 s, see ensureSessionRoom), max_participants: 2 + delegated participant count (updateRoom when a delegate
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
   webhook verification. Room creation has no client idempotency key at Daily, HIPAA mode
   REJECTS a custom room name (Daily assigns a random one — persist the returned name, never
   send one) and room properties accept no custom metadata (schema is additionalProperties:
   false — never send properties.meta), so ensureSessionRoom must reconcile from Eleva-owned
   state plus the only booking-specific room values Daily keeps, nbf and exp: (a) inside a
   short transaction it takes an in-progress LEASE — UPDATE sessions SET room_attempt_seq =
   room_attempt_seq + 1, room_create_attempt_at = now(), room_create_lease_until = now() + 60 s,
   room_fingerprint_exp = endAt + 30 min + offset WHERE booking_id = $id AND daily_room_name IS
   NULL AND (room_create_lease_until IS NULL OR room_create_lease_until < now()) RETURNING * —
   zero rows means another worker holds the lease (or the room already exists): return
   in_progress without calling Daily (the caller's workflow retries after the lease expires), so
   only ONE POST can be in flight per booking; offset = 0..599 s is ALLOCATED, not derived:
   sessions.room_fingerprint_exp has a global UNIQUE index and the lease UPDATE picks the offset
   in the same statement — room_fingerprint_exp = (SELECT $endAt + interval '30 min' + n *
   interval '1 s' FROM generate_series(0, 599) n WHERE NOT EXISTS (SELECT 1 FROM sessions s2
   WHERE s2.room_fingerprint_exp = $endAt + interval '30 min' + n * interval '1 s') ORDER BY n
   LIMIT 1) — so a single statement normally commits; the unique index is the guarantee for the
   race where two workers pick the same free second concurrently: that raises 23505, which
   ABORTS the lease transaction (PostgreSQL leaves no usable transaction after an error), so the
   caller re-runs the WHOLE lease transaction as a new transaction (never a statement retry
   inside the aborted one; no savepoint games), at most 3 times, then status = room_unresolved
   before any vendor call; the subselect returning NULL (all 600 taken) is caught by a CHECK /
   NOT NULL on the RETURNING row and is the same room_unresolved path. The lease transaction
   COMMITS before Daily is called (the row is the record of intent) and the vendor result is
   persisted afterwards in a separate compare-and-set transaction (WHERE room_attempt_seq = $seq
   AND daily_room_name IS NULL) — README rule 9. Tests: a collision test creates two bookings
   with identical startAt/endAt and asserts distinct exp values; a saturation test fills the 600
   offsets and asserts room_unresolved with zero POSTs; a forced-23505 test (mocked unique
   violation on the first run) asserts one re-run, one commit, one POST,
   so the pair (nbf, exp) is unique across ALL sessions — the fingerprint proves booking identity
   because Eleva allocated it uniquely, not because Daily made it unique (persisted BEFORE the
   vendor call; the row is the record of intent — the extra seconds are invisible to users
   because the join window ends at endAt+30m in our authorization, not at room exp; a new
   attempt (seq + 1) allocates a fresh unique exp and the old one is released only when the
   session leaves room_unresolved or is cancelled); the lease is cleared when the room is persisted or the
   attempt lands in room_unresolved, and an expired lease with no room is the signal for the
   reconciliation path in (c), never for a blind new POST; (b) POST /rooms { privacy: "private", properties: {
   nbf: startAt - 15 min, exp: room_fingerprint_exp, ... } } with a bounded timeout (10 s) and no
   automatic retry; on 200 persist daily_room_name/url from the response; (c) on
   timeout/5xx/network error it reconciles: GET /rooms?limit=100 followed through every page
   with ending_before/starting_after until created_at < room_create_attempt_at - 60 s (Daily
   lists newest first), and collects rooms whose config.nbf and config.exp equal the stored
   pair exactly (second resolution — the fingerprint) and whose created_at is within
   [room_create_attempt_at - 60 s, now]; exactly one match -> adopt it (persist name/url);
   zero -> wait 30 s and list once more (visibility lag), still zero -> a NEW attempt (seq + 1,
   new fingerprint) and one retry of the POST; more than one match, or the retry also fails to
   resolve -> status = room_unresolved, emit session.room_unresolved and alert — the sweep never
   re-creates blindly and admins resolve from Phase 12 (the resolver shows the candidate rooms
   with their created_at/nbf/exp and lets staff adopt one and delete the rest). Orphan sweep
   (hourly): any private room older than 10 min whose name is not in sessions.daily_room_name
   and whose exp is in the future is deleted (rooms are unreachable without a token we mint, so
   an orphan is a cost, not a risk). deleteRoom on cancel is DELETE /rooms/{daily_room_name}
   (404 = already gone = success). Tests with a mocked Daily client: lost response then one
   fingerprint match on the second page -> adopted, zero extra POSTs; lost response, no match
   twice -> exactly one more POST with seq 2; two matches -> room_unresolved, no POST; two
   concurrent ensureSessionRoom calls -> one POST (the second sees the lease and returns
   in_progress); a worker that dies mid-call -> the lease expires, the next call reconciles by
   fingerprint before any POST;
   cancel with DELETE 404 -> success; orphan sweep deletes an unreferenced room and never a
   referenced one.
   Tests: lost response after Daily created the room -> reconciliation adopts it -> exactly one
   room; delayed visibility (room appears only after the second POST) -> the late room is
   adopted or deleted, exactly one room remains.
2. packages/db: sessions (id, booking_id unique FK, expert_org_id, buyer_org_id, daily_room_name
   unique, daily_room_url, status scheduled|live|ended|no_show|cancelled|room_unresolved,
   attendance both|expert_only|member_only|nobody nullable (derived by finalizeAttendance from
   the full participant history after meeting.ended, re-derived by correction runs when late
   participant events arrive; status -> no_show when attendance <> both, else ended; sweep at
   end_at + 15 min if no webhook),
   room_created_at, room_create_attempt_at, room_create_lease_until timestamptz nullable,
   room_attempt_seq int NOT NULL DEFAULT 0, room_fingerprint_exp timestamptz nullable UNIQUE
   (global — the allocation described in item 1 depends on it),
   last_event_at, started_at,
   ended_at, participants jsonb [{ role, joined_at, left_at }] (history only, never
   authorization), created_at, updated_at) and session_participants (booking_id FK, user_id FK,
   role delegate|supervisor, added_by, added_at, revoked_at nullable, ejected_at nullable,
   unique(booking_id, user_id)) — the only source of delegated-join authorization (a row with
   revoked_at set is a deny). RLS: expert org and buyer org read sessions; session_participants
   readable by the expert org and by the participant; API writes. Audit unions session:
   room_created|joined|started|ended|room_deleted|participant_added|participant_removed|
   room_unresolved. daily_webhook_events (event_id text PK, type, received_at, processed_at,
   payload jsonb; 90-day retention sweep; RLS staff-only, no tenant rows) — the idempotency
   table used by POST /webhooks/daily in item 4; fixture with a replayed meeting.ended.
3. Workflows: packages/workflows/src/video/ensure-session-room.ts (idempotent: returns existing
   room; guard first: load the booking and return { skipped: "not_online" | "not_confirmed" }
   unless its snapshotted mode = 'online' AND status = 'confirmed') invoked from
   emitDomainEvent("booking.confirmed") and by a QStash sweep every 15 min for CONFIRMED ONLINE
   bookings (WHERE mode = 'online' AND status = 'confirmed') starting within 2h without a room
   (route POST /workflows/video-room-sweep; tests: phone and in_person bookings create no room in
   either path; pending_payment and cancelled online bookings create no room in either path;
   infra/qstash/setup-video.ts + root script + setup:all); on booking.cancelled -> deleteRoom.
4. apps/api: POST /sessions/[bookingId]/join (requireApiAuth; caller must be exactly one of:
   the booking's assigned expert (bookings.expert_user_id — the FK auth.user column Phase 4 sets
   at reserve time from the event type's expert_profiles.user_id; the ONLY assigned-expert
   identity, never expert_org_id membership), the booking's member
   (bookings.member_user_id), or a user listed in session_participants for that booking with a
   delegated role (added by the assigned expert via POST /sessions/[bookingId]/participants,
   audited session.participant_added; clinic admins are NOT implicitly allowed) — anyone else,
   including other members of the expert's organization, gets 403 NOT_A_PARTICIPANT; requires
   sessions.status IN ('scheduled','live') else 410 SESSION_NOT_ACTIVE (checked BEFORE the window
   and before any Daily call — a cancelled session never mints even when deleteRoom failed; test:
   cancel with deleteRoom mocked to fail -> join 410, the room-cleanup retry later succeeds); window
   [startAt-15m, endAt+30m] else 403 SESSION_NOT_OPEN; mints token with exp = min(now+2h,
   endAt+30m) — NEVER roomExp, which includes the fingerprint offset (boundary test: mint at
   endAt+29m59s -> token exp = endAt+30m exactly); audited session.joined; rate limit 10/min/user) and POST /webhooks/daily (verify
   signature -> 401 on failure; idempotency table daily_webhook_events keyed by event id; stale
   guard: apply only when payload event time > sessions.last_event_at, status transitions are
   monotonic scheduled -> live -> ended; test the sequence meeting.ended then a delayed
   meeting.started -> status stays ended -> update sessions + emitDomainEvent). DELETE
   .../participants/[userId] never hard-deletes: it sets session_participants.revoked_at inside
   withAudit (the row is kept as history and as the retry record), then calls Daily
   POST /rooms/{name}/eject { user_ids: [userId], ban: true } (no-op when nobody is live), sets
   ejected_at on success and
   returns 200 after eject succeeded (or the room does not exist yet) and 202 { ejectionPending:
   true } when Daily failed — two-phase per the Scope section: revoked_at first (deny state,
   join checks revoked_at IS NULL), eject second (10 s timeout, retry via POST
   /workflows/video-eject-retry every minute until ejected_at is set); tests for Daily 5xx and
   for mint -> remove -> rejoin 403. OpenAPI + client.
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
   https://api.dev.eleva.care/webhooks/daily (staging; Phase 15 repeats it for
   https://api.eleva.care/webhooks/daily) with the secret, configure the custom domain
   sessions.eleva.care (CNAME) and the corresponding Vercel DNS record.
7. Tests: unit as above; e2e/video-join.spec.ts loads the join page with
   --use-fake-device-for-media-stream and reaches the prejoin UI. Manual staging test with two
   browsers; paste screenshots in the PR.
8. Payment <-> session state machine: rooms only for bookings.status confirmed; subscribe the
   video workflow to payment.failed and refund.succeeded events — before startAt they set
   sessions.status cancelled and deleteRoom in the same workflow run that releases the slot;
   after the session they do nothing to sessions. meeting.ended with <2 distinct participants
   sets sessions.attendance (expert_only|member_only|nobody) — attendance only, no refund
   decision here. Tokens: minted in POST /sessions/[bookingId]/join only, returned in the JSON
   body, held in memory by the join page, never in URLs, logs, audit payloads or columns; extend
   scripts/check-no-phi-logs with a meeting-token JWT pattern.
9. Docs: scheduling-booking-spec.md sessions section + state machine diagram,
   security-hardening-checklist.md CSP, integration-runbooks.md (Daily outage: fall back to
   reschedule + notify), decision-log.md (D-07 reference).

Acceptance (paste evidence): room created on confirm + sweep; token claims (expert is_owner);
403 outside window / non-participant; two-browser call works on staging; webhooks update status,
signature failure 401, replay idempotent; room deleted on cancel; PHI-free logs; no CSP
violations.

Report: package layout, migrations, endpoints, schedules, tests, CodeRabbit CLI counts, PR URL,
operator tasks pending.
```
