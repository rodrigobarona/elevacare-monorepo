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
  `sendNotification({ kind, recipient, orgId, ctx, idempotencyKey, channelsOverride? })` where
  `recipient` is a discriminated union `{ userId }` **or** `{ email, locale? }` — the e-mail
  mode exists for recipients who have no account yet (`auth.org_invitation` to a new address,
  guest booking confirmations before activation) and is **email-only**: no preferences lookup,
  no SMS, no in-app row, suppression list still applied; the `{ userId }` mode resolves
  preferences + quiet hours + locale and fans out to email / SMS / in-app. Renders the
  `@eleva/email` template (React Email) / SMS text / in-app payload -> delivers -> writes
  `notification_deliveries` (idempotent on key + recipient + channel, where the recipient column
  is `user_id` or, for e-mail mode, `recipient_email`). Kinds: `booking.confirmed`, `booking.reminder_24h`,
  `booking.reminder_1h`, `booking.cancelled`, `booking.rescheduled`, `payment.failed`,
  `payment.receipt`, `payout.paid`, `payout.approval_required` (staff), `invoice.issued`,
  `invoice.failed` (expert), and the auth kinds `auth.magic_link`, `auth.verify_email`,
  `auth.reset_password`, `auth.two_factor_otp`, `auth.org_invitation`. **Boundary:** this phase
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
  transactional outbox `emitDomainEvent(tx, event)` in `@eleva/workflows` (introduced in Phase 7
  with `domain_events_outbox` and the `/workflows/domain-events-publisher` route); this phase
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

Workflow (mandatory):
- git checkout main && git pull --ff-only && git checkout -b phase-08/notifications-lane1
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

PHASE 8 TASK — Implement Lane 1 transactional notifications and reminder workflows (ADR-006).

1. packages/db: notifications (id, user_id, org_id, kind, title, body, href, data jsonb, read_at,
   created_at), notification_deliveries (id, idempotency_key, kind, user_id nullable,
   recipient_email nullable, CHECK (num_nonnulls(user_id, recipient_email) = 1), channel email|
   sms|in_app, status queued|sent|delivered|bounced|complained|failed|suppressed, provider_id,
   error, created_at, updated_at, unique(idempotency_key, coalesce(user_id::text, recipient_email),
   channel) as a unique expression index — the recipient is part of the key because one event (a
   booking confirmation) fans out to member AND expert; callers pass a per-event idempotencyKey
   such as booking:<id>:confirmed and the library derives the row key per recipient, so the
   second recipient is never suppressed by the first), email_suppressions (email, reason,
   created_at), phone_verifications (user_id, phone_e164, code_hash, expires_at, verified_at).
   RLS by user/org; audit unions (notification: sent|failed|suppressed; phone: verified).
2. @eleva/notifications (only importer of resend and twilio): sendNotification({ kind, recipient,
   orgId, ctx, idempotencyKey, urgency normal|urgent }) with recipient: { userId: string } |
   { email: string; locale?: Locale }. userId mode -> load user locale, preferences (Phase 5
   table), quiet hours (defer non-urgent to window end via QStash notBefore), suppression list ->
   render via @eleva/email (React Email) for email, short template for SMS, payload for in-app ->
   deliver -> record notification_deliveries. email mode (recipient has no account yet — used by
   auth.org_invitation when the invitee e-mail is unknown to auth.user, and by guest booking
   confirmations before activation) -> email channel only, locale from the argument or the org
   default, suppression list applied, no preferences/SMS/in-app, row keyed by recipient_email.
   The Better Auth invitation callback resolves the invitee: existing user -> { userId }, otherwise
   -> { email }. Test: invitation to an unknown address delivers exactly one e-mail and writes no
   notifications row; the same idempotencyKey sent twice -> one delivery. Kinds: booking.confirmed
   (member + expert variants), booking.reminder_24h, booking.reminder_1h (urgent), booking.
   cancelled, booking.rescheduled, payment.failed, payment.receipt, payout.paid,
   payout.approval_required (staff), invoice.issued, invoice.failed. Twilio client configured with
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
   POST /workflows/domain-events-publisher already exist from Phase 7 (transactional outbox, typed
   event union, subscriber registry); this phase extends the union with the booking/payment/payout
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
