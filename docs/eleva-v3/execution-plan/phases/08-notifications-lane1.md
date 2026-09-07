# Phase 8 — Notifications Lane 1 + reminder workflows

| Field      | Value                                                                                                                                                                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-08/notifications-lane1`                                                                                                                                                                                                                                                                 |
| Depends on | Phases 5, 6, 7 (`invoice.*` kinds consume Phase 7 `invoices` events)                                                                                                                                                                                                                           |
| Effort     | 1.5 weeks                                                                                                                                                                                                                                                                                      |
| Touches    | `packages/notifications/**`, `packages/email/**`, `apps/email/**` (React Email preview), `packages/workflows/src/notifications/**`, `packages/db/src/schema/main/notifications.ts`, `apps/api/src/app/{notifications,workflows}/**`, `packages/dashboard/**` (bell + inbox), `infra/qstash/**` |
| Exit gate  | Booking confirmation, 24h and 1h reminders, cancellation, payment failed, receipt, payout paid, invoice issued are delivered by email (Resend), SMS (Twilio EU, opt-in) and in-app inbox, respecting preferences and quiet hours, idempotently                                                 |

## Why this phase exists

Transactional notifications are the glue between payments, scheduling and video. ADR-006 defines
two lanes; this phase implements Lane 1 (transactional) fully and stubs Lane 2 (marketing, Resend
Audiences, PHI-free).

## Scope

In:

- `@eleva/notifications` (sole importer of `resend` and `twilio`):
  `sendNotification({ kind, recipient, orgId?, ctx, idempotencyKey, channelsOverride? })` — the
  one contract (this signature is copied verbatim into the prompt below and into
  `notifications-spec.md`; urgency is **not** a parameter, it is a property of the kind in
  `NOTIFICATION_KINDS`; `channelsOverride` may only narrow the kind's default channels;
  `orgId` is optional only in the type's top-level shape — `NOTIFICATION_KINDS[kind].scope` is
  `"org" | "user"`, the exported signature is an overload that makes `orgId` **required** for
  every org-scoped kind, and the runtime Zod refine rejects a missing `orgId` for an org-scoped
  kind with `ORG_CONTEXT_REQUIRED` before any inbox or delivery write, so no tenant row is ever
  written without RLS + audit context; test: org-scoped kind without orgId -> throws, zero
  rows) — where
  `recipient` is a discriminated union `{ userId }` **or** `{ email, locale? }` — the e-mail
  mode exists for recipients who have no account yet (`auth.org_invitation` to a new address,
  guest booking confirmations before activation) and is **email-only**: no preferences lookup,
  no SMS, no in-app row, suppression list still applied; the `{ userId }` mode resolves
  preferences + quiet hours + locale and fans out to email / SMS / in-app. Renders the
  `@eleva/email` template (React Email) / SMS text / in-app payload -> delivers -> writes
  `notification_deliveries` (idempotent on key + recipient + channel, where the recipient column
  is `user_id` or, for e-mail mode, `recipient_email`). The delivery row is **claimed before the
  provider is called**: insert `status = queued` (the unique key makes a concurrent/retried call
  hit the conflict and return the existing row — if it is `sent`, stop; if `queued` older than
  60 s, re-claim with an atomic lease: `UPDATE ... SET lease_owner = :runId, claimed_at = now()
WHERE id = :id AND status = 'queued' AND claimed_at < now() - interval '60 s' RETURNING id` —
  no row means another worker holds it; the completion update is likewise guarded by
  `WHERE lease_owner = :runId AND claimed_at = :claimedAt`, so a worker whose lease was taken
  over never overwrites the newer result; the first claim is the INSERT itself, which always
  writes `lease_owner = :runId, claimed_at = now()` (both columns NOT NULL), so no `queued` row
  ever exists without a lease and a crash before the provider call is reclaimed by the same
  60 s rule), then call the provider, then update to
  `sent`/`failed` with `provider_id`. **E-mail is an idempotent provider submission** (not a
  recipient-delivery guarantee): Resend gets an `Idempotency-Key` header equal to the row id
  and deduplicates the same key for 24 h, so a crash between provider accept and the update
  leaves a `queued` row that the retry re-claims and re-sends with the same key without a
  second e-mail; every Resend request also carries `tags: [{ name: "deliveryId", value: row.id
  }]`, and retries older than 24 h reconcile before re-sending: `emails.list` filtered to the
  recipient and the window since `first_attempt_at`, then `emails.get` on each candidate (the
  list view does not expose tags) — a candidate whose `deliveryId` tag equals the row id is
  adopted as `sent`; test: accepted e-mail, update lost, retry after 24 h -> adopted, zero new
  sends. Both providers reconcile from `notification_deliveries.first_attempt_at` (set once,
  immediately before the FIRST provider call, never overwritten by a re-claim — `claimed_at`
  moves on every re-claim and is therefore never a reconciliation bound). **SMS is
  at-least-once** and is documented and tested as such: Twilio
  has no idempotency key, so every SMS carries a `StatusCallback` URL
  `POST /webhooks/twilio/status?deliveryId=<rowId>` (Twilio signature validated) that marks the
  row `sent` with the Message SID even when the sending process died; before re-sending a stale
  `queued` SMS row the worker reconciles by listing Twilio messages to that number sent after
  `first_attempt_at` (`dateSentAfter`; stable across re-claims) and adopts a message only when
  its body equals the row's rendered body — every
  SMS body ends with a per-delivery reference `Ref <8-char base32 of the row id>`, so the
  rendered text (`sms_body_hash` stored at claim time) is unique per delivery row and a match
  identifies exactly this send; two rows can never share a body, a message with a different
  body is never adopted, and if no identical message exists the row is re-sent (the documented
  at-least-once duplicate); SMS templates are written to be
  harmless if received twice (no one-time codes without expiry, reminders idempotent in
  wording). Kinds: `booking.confirmed`, `booking.reminder_24h`,
  `booking.reminder_1h`, `booking.cancelled`, `booking.rescheduled`, `payment.failed`,
  `payment.receipt`, `payout.paid`, `payout.approval_required` (staff), `invoice.issued`,
  `invoice.failed` (expert), and the auth kinds `auth.magic_link`, `auth.verify_email`,
  `auth.reset_password`, `auth.two_factor_otp`, `auth.org_invitation`. Kinds are a closed
  union exported as the `NOTIFICATION_KINDS` const from `@eleva/notifications` (each kind
  declares its default channels, urgency and template id); **later phases extend the const in
  their own PR** together with the template, channel policy, i18n copy and a delivery test —
  the owning phase per kind: Phase 10 `crm.follow_up_due`; Phase 11 `team.invitation`,
  `team.member_joined`, `clinic.verified`, `clinic.rejected`; Phase 12 `partner.approved`, `partner.rejected`,
  `partner.needs_changes`; Phase 14 `calendar.reconnect_required`, `migration.welcome`. A kind
  that is not in the const does not compile. **Boundary:** this phase
  makes `@eleva/email` renderer-only (React Email templates, no `resend` import — boundary lint)
  and rewires the Better Auth `sendMagicLink` / `sendVerificationEmail` / `sendResetPassword` /
  OTP / invitation callbacks (Phase 2 sent them through `@eleva/email` + Resend directly as a
  temporary measure) to `sendNotification({ kind: "auth.*" })`, so every mail — auth included —
  gets the same idempotency, suppression list, delivery log and audit.
- `@eleva/email`: templates per kind with `pt/en/es` copy, shared layout, brand from
  `docs/eleva-v3/brand-book`; `apps/email` runs the React Email preview server.
- Twilio EU (region `ie1`), sender from `TWILIO_MESSAGING_SERVICE_SID`; SMS only when the user
  opted in and has a verified phone (`phone_verified_at` via OTP endpoint).
- In-app: `notifications` table (user_id, kind, title, body, href, read_at, created_at) + bell +
  inbox in `@eleva/dashboard` (`NavBell`, `/[orgSlug]/notifications` page in `apps/app`,
  `apps/expert`, `apps/team`), `GET /notifications`, `POST /notifications/[id]/read`,
  `POST /notifications/read-all`.
- Reminder workflows: on booking confirm schedule QStash messages (not cron) for 24h and 1h with
  `notBefore`; cancellation deletes/ignores them (check booking status at send time);
  `packages/workflows/src/notifications/reminders.ts`, route `POST /workflows/booking-reminder`.
- Hook points: Phase 4/6 code paths and the Phase 7 invoice transitions emit events through the
  transactional outbox `emitDomainEvent(tx, event)` in `@eleva/workflows` (introduced in Phase 4
  with `domain_events_outbox` and the `/workflows/domain-events-publisher` route, extended by
  Phase 7); this phase
  registers `sendNotification` as a publisher subscriber (idempotent on the event
  `idempotency_key`) and extends the event union with booking/payment/payout types.
- Lane 2 stub: `syncMarketingContact(userId)` to Resend Audiences only when `marketing` consent
  granted; no PHI fields.
- Resend webhooks (`/webhooks/resend`: delivered, bounced, complained) -> `notification_deliveries`
  status; suppress future sends on hard bounce.

Out: push (Expo) — post-launch; Novu (retired).

## Deliverables

1. Migration: `notifications`, `notification_deliveries`, `phone_verifications`; RLS; audit unions.
2. `@eleva/notifications` + tests (mocked Resend/Twilio), `@eleva/email` templates + preview.
3. Workflows + routes + QStash usage; Resend webhook route with signature verification.
4. Dashboard bell/inbox; API routes; api-client.
5. Env: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
   `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_REGION=ie1`.

## Acceptance criteria

- [ ] Templates are **mode-aware** (`bookings.mode` snapshot): online -> "your video link arrives
      before the session" + join CTA (Phase 9), phone -> "your expert will call you on <masked
                                                              number>", in person -> location name, address, "Open in Maps" link and the location's
      instructions; the ICS `LOCATION` follows the same rule.
- [ ] Booking confirmation email arrives in the member's locale with ICS attached; expert receives
      "new booking"; in-app rows created for both.
- [ ] Reminders fire at T-24h and T-1h (verify with a booking 25h ahead and QStash `notBefore`
      or a shortened test schedule); cancelled booking -> reminders skipped.
- [ ] Quiet hours defer non-urgent kinds to the next allowed window; urgent kinds
      (`booking.reminder_1h`) bypass.
- [ ] Same `idempotencyKey` twice for the same recipient -> one delivery per channel; the same
      `idempotencyKey` for member and expert (booking.confirmed) -> both delivered (test both).
- [ ] SMS sent only with verified phone + opt-in; Twilio EU region used.
- [ ] Hard bounce suppresses further emails to that address; visible in delivery table.
- [ ] Every template renders in `pt/en/es` in `apps/email` preview; no PHI in subjects or SMS.

## Tests

- vitest: preference resolution, quiet hours, idempotency, template rendering snapshots per
  locale, reminder scheduling math, webhook signature verification.

## Docs to update

- `notifications-spec.md` (final kinds + channels), `integration-runbooks.md` (Resend/Twilio),
  `environment-matrix.md`, `decision-log.md`.

## Local references

- `packages/notifications/src/**` (stub), `packages/email/src/**`, `apps/email/**`,
  `packages/workflows/src/scheduling/ics-email.ts`, `packages/dashboard/src/*`,
  `packages/db/src/schema/main/*`, `docs/eleva-v3/notifications-spec.md`, ADR-006, ADR-007,
  `docs/eleva-v3/brand-book/**`.
- MVP: `_context/clone-repo/eleva-care-app/src/app/api/cron/appointment-reminders*/`,
  `_context/clone-repo/eleva-care-app/src/lib/integrations/novu/**` (copy of message contents only).

## External docs

- Resend `/resend/resend-node` + webhooks; React Email `/resend/react-email`.
- Twilio Programmable Messaging + EU region (Twilio docs via `twilio__search`).
- QStash `/upstash/qstash-js` (publishJSON with `notBefore`, deduplication id).
- Next.js `after()` `/vercel/next.js`.

## Risks

- Deliverability: verify Resend domain (`eleva.care`) DKIM/SPF/DMARC before staging tests —
  operator task.

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(the directory containing pnpm-workspace.yaml). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc (api-first-agentic, audit-wiring, eleva-icons) and
   .cursor/skills/{api-first-agentic,audit-wiring,coderabbit-review}/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/08-notifications-lane1.md in full.
3. Read every file under "Local references". Pull Resend, React Email, Twilio (EU region), QStash
   and Next.js after() docs through Context7
   (resolve-library-id then query-docs) or the Twilio docs tools; prefer those docs over memory.

Workflow (mandatory) — this is the outer loop; the "PHASE 8 TASK" section further down is
what you implement at the "Implement the deliverables" step. Read the whole prompt before the
first command; run the checks and both review loops only AFTER the task work exists:
- git checkout main && git pull --ff-only && git checkout -b phase-08/notifications-lane1
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

PHASE 8 TASK — Implement Lane 1 transactional notifications and reminder workflows (ADR-006).

1. packages/db: notifications (id, user_id, org_id, kind, title, body, href, data jsonb, read_at,
   created_at), notification_deliveries (id, idempotency_key, kind, user_id nullable,
   recipient_email nullable, CHECK (num_nonnulls(user_id, recipient_email) = 1), channel email|
   sms|in_app, status queued|sent|delivered|bounced|complained|failed|suppressed, provider_id,
   lease_owner text NOT NULL, claimed_at timestamptz NOT NULL (written by the INSERT — the first
   claim — and by every re-claim; the reclaim UPDATE requires claimed_at < now() - 60 s),
   first_attempt_at timestamptz nullable (set once, immediately before the FIRST provider call,
   never overwritten — the stable lower bound for Resend/Twilio reconciliation), sms_body_hash
   text nullable
   (sha256 of the rendered SMS body, used by the Twilio reconciliation match),
   error, created_at, updated_at, unique(idempotency_key, coalesce(user_id::text, recipient_email),
   channel) as a unique expression index — the recipient is part of the key because one event (a
   booking confirmation) fans out to member AND expert; callers pass a per-event idempotencyKey
   such as booking:<id>:confirmed and the library derives the row key per recipient, so the
   second recipient is never suppressed by the first), email_suppressions (email, reason,
   created_at), phone_verifications (user_id, phone_e164, code_hash, expires_at, verified_at).
   RLS by user/org; audit unions (notification: sent|failed|suppressed; phone: verified).
2. @eleva/notifications (only importer of resend and twilio): sendNotification({ kind, recipient,
   orgId?, ctx, idempotencyKey, channelsOverride? }) with recipient: { userId: string } |
   { email: string; locale?: Locale }; urgency (normal|urgent) comes from NOTIFICATION_KINDS[kind],
   never from the caller; channelsOverride may only narrow the kind's channels (Zod refine);
   NOTIFICATION_KINDS[kind].scope is "org" | "user" and orgId is required (overloaded signature +
   Zod refine, error ORG_CONTEXT_REQUIRED, checked before any write) for every org-scoped kind.
   userId mode -> load user locale, preferences (Phase 5
   table), quiet hours (defer non-urgent to window end via QStash notBefore), suppression list ->
   render via @eleva/email (React Email) for email, short template for SMS, payload for in-app ->
   CLAIM the notification_deliveries row FIRST (INSERT status queued WITH lease_owner = runId
   and claimed_at = now() — both NOT NULL, the insert is the first claim; on unique conflict
   read the existing row: sent -> return it, queued with claimed_at older than 60 s -> re-claim
   with the atomic lease UPDATE (lease_owner, claimed_at; zero rows => another worker owns it,
   return), otherwise return) -> call the provider -> complete with a compare-and-swap: UPDATE
   ... SET status = sent|failed, provider_id WHERE id = :id AND lease_owner = :runId AND
   claimed_at = :claimedAt — zero rows means the lease was taken over by a newer worker, so the
   stale worker logs and exits WITHOUT touching the row (it never overwrites the newer result;
   test: a provider call that outlives the 60 s lease + a reclaiming worker -> exactly one final
   state, the newer one). Never send before the row exists; set first_attempt_at = now() (only
   when NULL) right before the first provider call and reconcile from it, never from claimed_at.
   E-mail: Resend Idempotency-Key = row id plus tags [{ name: "deliveryId", value: rowId }];
   rows older than 24 h reconcile first (emails.list for the recipient since first_attempt_at,
   emails.get per candidate, adopt the one whose deliveryId tag matches; test: accepted e-mail,
   lost update, retry after 24 h -> adopted, zero new sends)
   (idempotent provider submission — Resend deduplicates the same key for 24 h; test: kill the
   process between provider accept and the update (mock), retry -> one provider call with the
   same key, one sent row). SMS: at-least-once — Twilio StatusCallback
   POST /webhooks/twilio/status?deliveryId=<rowId> (validate X-Twilio-Signature; marks sent +
   Message SID even if the sender crashed); before re-sending a stale queued SMS row, list
   Twilio messages to that number with dateSentAfter = claimed_at and adopt one only when
   sha256(body) === sms_body_hash — bodies are unique per row because every SMS ends with
   "Ref <8-char base32 of the row id>" (never a different body; none => re-send); tests:
   (a) crash after Twilio accept + callback arrives -> row sent, no second send; (b) crash and
   no callback -> reconciliation finds the SID -> no second send; (c) reconciliation finds
   nothing -> one re-send (documented duplicate). email mode (recipient has no account yet — used by
   auth.org_invitation when the invitee e-mail is unknown to auth.user, and by guest booking
   confirmations before activation) -> email channel only, locale from the argument or the org
   default, suppression list applied, no preferences/SMS/in-app, row keyed by recipient_email.
   The Better Auth invitation callback resolves the invitee: existing user -> { userId }, otherwise
   -> { email }. Test: invitation to an unknown address delivers exactly one e-mail and writes no
   notifications row; the same idempotencyKey sent twice -> one delivery. Kinds: booking.confirmed
   (member + expert variants), booking.reminder_24h, booking.reminder_1h (urgent), booking.
   cancelled, booking.rescheduled, payment.failed, payment.receipt, payout.paid,
   payout.approval_required (staff), invoice.issued, invoice.failed, plus the auth.* kinds.
   Export NOTIFICATION_KINDS as a const object { kind: { channels, urgency, templateId } } and
   derive the Kind type from it; sendNotification only accepts Kind. Document in the package
   README that Phases 10/11/12/14 append crm.follow_up_due, team.invitation, team.member_joined,
   partner.approved|rejected|needs_changes, calendar.reconnect_required and migration.welcome in
   their own PRs (kind + template + channel policy + test each). Twilio client configured with
   region ie1 / edge dublin and TWILIO_MESSAGING_SERVICE_SID; SMS only if phone verified and
   sms channel enabled. verifyPhoneStart/verifyPhoneConfirm with OTP (6 digits, 10 min, hashed).
   Lane 2 stub: syncMarketingContact(userId) to Resend Audiences only with marketing consent and
   only name/email/locale.
3. @eleva/email: one template per kind with pt/en/es copy (members wording), shared brand layout
   from docs/eleva-v3/brand-book, ICS attachment for confirmation/reschedule (from
   @eleva/calendar ics-generator). apps/email: React Email preview with sample props per locale.
4. Workflows: packages/workflows/src/notifications/reminders.ts scheduling QStash messages at
   T-24h and T-1h on booking confirmation (deduplication id = bookingId:kind), the handler route
   POST /workflows/booking-reminder re-checks booking status before sending; cancellation does
   not need to delete messages. emitDomainEvent(tx, event) and the domain_events_outbox table +
   POST /workflows/domain-events-publisher already exist from Phase 4 (extended by Phase 7;
   transactional outbox, typed event union, subscriber registry); this phase extends the union with the booking/payment/payout
   event types, registers sendNotification as a publisher subscriber, and wires the Phase 4/6
   code paths (booking confirmed/cancelled/rescheduled, payment failed/succeeded, payout
   paid/approval required) to call emitDomainEvent(tx, ...) inside the same transaction as the
   state change — never from after() alone. The subscriber passes the outbox idempotency_key
   straight through as the notification idempotency key, so publisher retries never duplicate.
5. apps/api: GET /notifications?unread, POST /notifications/[id]/read, POST /notifications/
   read-all, POST /me/phone/verify-start, POST /me/phone/verify-confirm, POST /webhooks/resend
   (svix signature verification with RESEND_WEBHOOK_SECRET; events email.delivered, email.bounced,
   email.complained -> deliveries + suppressions). OpenAPI + client.
6. @eleva/dashboard: NavBell with unread count (SWR polling 30s) and inbox list; /[orgSlug]/
   notifications page in apps/app, apps/expert, apps/team (shared component).
7. Env: RESEND_API_KEY, RESEND_WEBHOOK_SECRET, RESEND_FROM (no-reply@eleva.care),
   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID, TWILIO_REGION=ie1 in
   .env.example, turbo.json, environment-matrix.md. Operator task: verify eleva.care in Resend
   (DKIM/SPF/DMARC) and create the Twilio EU messaging service.
8. Tests: preference/quiet-hour resolution, idempotency, template snapshots per locale, reminder
   scheduling, webhook signature, suppression. Docs: notifications-spec.md, integration-runbooks.md,
   decision-log.md.

Acceptance (paste evidence): confirmation emails (member + expert) with ICS in the right locale;
reminders scheduled and skipped on cancel; quiet hours deferral; idempotency; SMS only with
verified opt-in; bounce suppression; preview renders all templates in pt/en/es; no PHI in
subjects/SMS.

Report: migrations, kinds implemented, endpoints, tests, CodeRabbit CLI counts, PR URL, operator
tasks pending.
```
