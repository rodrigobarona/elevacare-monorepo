# Phase 5 — Member app (`apps/app`)

| Field      | Value                                                                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Branch     | `phase-05/member-app`                                                                                                                                                                                                                                        |
| Depends on | Phase 4                                                                                                                                                                                                                                                      |
| Effort     | 1.5 weeks                                                                                                                                                                                                                                                    |
| Touches    | `apps/app/**`, `apps/api/src/app/{me,bookings,payments,privacy}/**`, `packages/dashboard/**`, `packages/api-client/**`, `packages/compliance/**` (DSAR export), `packages/db` (notification_preferences, dsar_requests, account_deletion_requests, consents) |
| Exit gate  | A member activated from a guest booking signs in, sees the booking, downloads the receipt, updates preferences, requests a DSAR export, and cancels/reschedules within policy                                                                                |

## Why this phase exists

`apps/app` is a stub. Members need a place to manage sessions, payments, and privacy — and the
video join page (Phase 9) and reports (Phase 10) plug into it.

## Scope

In:

- Routes under `apps/app/src/app/[orgSlug]/` (personal Space slug):
  - `/` dashboard: upcoming sessions (join CTA disabled until Phase 9), past sessions, quick
    actions (book again, find experts -> `apps/web`).
  - `/sessions`, `/sessions/[bookingId]`: details, expert card, add to calendar (ICS), cancel and
    reschedule (policy text shown, calls Phase 4 endpoints), receipt link.
  - `/payments`: list of `booking_payments` with status, receipt PDF/URL from Stripe
    (`charges.receipt_url`), refunds.
  - `/settings`: profile (name, avatar via `@eleva/storage` upload), language (`ELEVA_LOCALE`),
    theme (`ELEVA_THEME`), timezone, notification preferences (email/SMS/in-app per category,
    quiet hours) stored in `notification_preferences` (consumed by Phase 8).
  - `/privacy`: consents (view/withdraw), DSAR export request (creates `dsar_requests` row,
    handled by `@eleva/compliance` `dsarExport` job -> private Blob zip + email link; 10-minute
    target from `data-retention-export-matrix.md`), account deletion request (soft-delete +
    scheduled crypto-shred per policy).
- `apps/api`: `GET /me` (profile + preferences), `PATCH /me`, `GET /me/bookings`,
  `GET /me/payments`, `PUT /me/notification-preferences`, `POST /privacy/dsar`,
  `GET /privacy/dsar/[id]`, `POST /privacy/delete-account`; workflow route
  `POST /workflows/dsar-export` (QStash triggered).
- `@eleva/compliance`: `dsarExport(userId)` collecting user, bookings, payments, consents,
  notifications (records in Phase 10 extend it), producing JSON + CSV zip in the private Blob
  store; `scheduleAccountDeletion(userId)`.
- `packages/dashboard`: member nav config (`NavIconName`s), `enableOrgSwitcher: false` for
  personal Spaces unless the user belongs to more orgs.
- Playwright `e2e/member.spec.ts`.

Out: video join (Phase 9), reports/records (Phase 10), notifications sending (Phase 8).

## Deliverables

1. `apps/app` pages, layouts, `proxy.ts` (< 50 LOC), messages `pt/en/es`.
2. API routes above + OpenAPI + api-client.
3. DB migration: `notification_preferences`, `dsar_requests`, `account_deletion_requests`,
   `consents` (if not already present), each with RLS policies and audit unions.
4. `@eleva/compliance` implementation + tests; QStash schedule/trigger registration in
   `infra/qstash` if periodic.
5. `e2e/member.spec.ts`.

## Acceptance criteria

- [ ] Guest from Phase 4 activates via magic link, lands on `/{space-slug}` dashboard showing the
      booking.
- [ ] Cancel >= 24h before start: booking `cancelled`, payment `refund_pending` (executed in
      Phase 6); reschedule moves the booking and releases the old slot.
- [ ] Receipt URL opens Stripe-hosted receipt; payments list matches `booking_payments`.
- [ ] Preferences persist and are returned by `GET /me`.
- [ ] DSAR request produces a zip in the private Blob store within 10 minutes locally; link expires
      (signed URL) after 24h; audit rows present.
- [ ] Delete-account request schedules deletion and blocks new bookings; audited.
- [ ] `e2e/member.spec.ts` green; `check:i18n-parity` green.

## Tests

- vitest: preferences validation, DSAR export content shape (no PHI leak beyond the user's own),
  cancel/reschedule policy edge cases.
- Playwright: `member.spec.ts`.

## Docs to update

- `data-retention-export-matrix.md`, `compliance-data-governance.md` (DSAR runbook),
  `api-contract-spec.md`, `notifications-spec.md` (preferences model), `decision-log.md`.

## Local references

- `apps/app/src/**`, `apps/expert/src/app/**` (layout/nav patterns to reuse),
  `packages/dashboard/src/{config-helpers,nav-types,dashboard-shell}.ts*`.
- `packages/storage/src/**` (avatar upload flow), `apps/api/src/app/users/avatar/route.ts`.
- `packages/compliance/src/**` (stub), `docs/eleva-v3/data-retention-export-matrix.md`,
  `docs/eleva-v3/compliance-data-governance.md`, `docs/eleva-v3/notifications-spec.md`.
- Phase 4 booking endpoints and `@eleva/api-client`.

## External docs

- Stripe receipts (`charge.receipt_url`) `/websites/stripe`.
- Vercel Blob private store signed URLs `/vercel/storage` (or `@vercel/blob` docs).
- Next.js 16 `/vercel/next.js` (parallel routes, `after()` for export kickoff).
- QStash `/upstash/qstash-js` (publish JSON, verify signature).

## Risks

- DSAR scope grows in Phase 10 (records): design `dsarExport` with collectors registered per
  package.

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(/Users/<you>/…/elevacare-monorepo). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc (api-first-agentic, audit-wiring, blob-storage, eleva-icons,
   better-auth) and matching skills plus .cursor/skills/coderabbit-review/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/05-member-app.md in full.
3. Read every file under "Local references". Pull Stripe receipts, Vercel Blob, Next.js 16 and
   QStash docs through Context7
   (resolve-library-id then query-docs); prefer those docs over memory.

Workflow (mandatory):
- git checkout main && git pull --ff-only && git checkout -b phase-05/member-app
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

PHASE 5 TASK — Build the member product in apps/app.

1. packages/db: tables notification_preferences (user_id FK auth.user, channel email|sms|in_app,
   category booking|reminder|payment|marketing|system, enabled bool, quiet_hours_start/end time,
   timezone), consents (user_id, kind terms|privacy|health_data|marketing, version, granted_at,
   withdrawn_at, source), dsar_requests (id, user_id, status pending|processing|ready|expired|
   failed, blob_pathname, expires_at, requested_at, completed_at), account_deletion_requests
   (user_id, requested_at, scheduled_for, status). RLS by user (personal Space org) and audit
   unions (consent granted|withdrawn; dsar requested|ready; account deletion requested|cancelled).
2. apps/api (Zod, OpenAPI, rate limit, requireApiAuth session/bearer): GET /me, PATCH /me
   (name, timezone, locale, avatarUrl), GET /me/bookings (upcoming|past, cursor), GET /me/payments
   (joins booking_payments, includes Stripe receipt_url fetched via @eleva/billing and cached),
   PUT /me/notification-preferences, GET/PUT /me/consents, POST /privacy/dsar, GET /privacy/dsar/
   [id] (signed URL only when ready), POST /privacy/delete-account, POST /workflows/dsar-export
   (QStash-signed; runs @eleva/compliance dsarExport). Update @eleva/api-client.
3. @eleva/compliance: dsarExport(userId) with a collector registry (register collectors for
   profile, bookings, payments, consents, notification preferences; Phase 10 adds records) ->
   JSON + CSV files zipped and uploaded to the PRIVATE Blob store via @eleva/storage with a 24h
   signed URL; scheduleAccountDeletion(userId, days per data-retention-export-matrix.md) that
   marks the user (blocks new bookings) and enqueues crypto-shred (Phase 10 completes). Tests.
4. apps/app: layout with @eleva/dashboard (member nav: Home, Sessions, Payments, Settings,
   Privacy; NavIconName strings; org switcher hidden when the user has only the personal Space),
   proxy.ts < 50 LOC using @eleva/auth/proxy. Pages under /[orgSlug]: dashboard (upcoming with
   countdown and disabled Join placeholder, past, "Find an expert" link to apps/web),
   /sessions + /sessions/[bookingId] (details, ICS download, cancel/reschedule dialogs with policy
   copy and confirmation, calling Phase 4 endpoints), /payments (list + receipt links + refund
   status), /settings (profile + avatar upload via @eleva/storage client, language via ELEVA_LOCALE
   cookie helper from @eleva/i18n, theme via ELEVA_THEME, timezone, notification preferences
   matrix with quiet hours), /privacy (consents with withdraw, DSAR request + status + download,
   delete account with confirmation). Server Actions: Zod validate, authenticate inside, delegate
   to @eleva/api-client. Toasts via @eleva/ui Toaster. Messages pt/en/es with "members" wording.
5. e2e/member.spec.ts: activate via magic link (dev bypass), see booking, change preference,
   request DSAR (mock blob in E2E), cancel booking.
6. Docs: data-retention-export-matrix.md (DSAR flow + SLA), compliance-data-governance.md,
   api-contract-spec.md, notifications-spec.md (preferences model), decision-log.md.

Acceptance (paste evidence): activation -> dashboard shows booking; cancel/reschedule policy
enforced with DB + audit rows; receipts open; preferences persisted; DSAR zip produced in the
private store with expiring link; deletion request blocks bookings; e2e green; i18n parity green.

Report: endpoints, migrations, tests, CodeRabbit CLI counts, PR URL, deferred items.
```
