# Phase 15 — PT launch gate + production cutover

| Field      | Value                                                                                                                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-15/launch-cutover` (code: gate fixes, final config; the cutover itself is an operated runbook)                                                                                                                                         |
| Depends on | Phase 14                                                                                                                                                                                                                                      |
| Effort     | 1 week + 7-day watch                                                                                                                                                                                                                          |
| Touches    | `docs/eleva-v3/launch-readiness-checklist.md`, `apps/docs` (compliance pages), `infra/**` (production apply scripts), Vercel project settings (domains, env), DNS, Stripe webhook endpoints, Daily/Resend/Twilio production keys              |
| Exit gate  | Production traffic on v3 at `eleva.care`; migrated experts sign in and see history; 7-day SLO >= 99.9% API availability, zero P1 incidents; rollback documented and rehearsed; WorkOS cancelled only after final record checksum verification |

## Why this phase exists

ADR-012 (Portugal-first) and ADR-019 (cutover) require a formal gate. This phase verifies every
launch-readiness item, executes the freeze/migrate/switch runbook from Phase 14, and watches SLOs.

## Scope

In:

- **Launch gate** (`launch-readiness-checklist.md` — every item ticked with evidence):
  - Compliance: ERS Portugal pages live in `apps/docs/compliance/portugal/*` and linked from
    `apps/web` footer; privacy/health-data/terms final and versioned; DPIA updated (WorkOS removed,
    Daily added, Better Auth self-hosted, AI Gateway); subprocessor list; DSAR export within 10
    minutes verified in production-like data; crypto-shred test on a staging org; EU data
    residency confirmations (Neon EU, Upstash EU, Vercel region `fra1`/`cdg1`, Daily EU, Sentry EU,
    PostHog EU) — each a hard gate; **Resend**: EU region enabled on the account is the gate; if
    Resend cannot process in the EU, launch is blocked until the DPIA records the approved
    transfer mechanism (SCCs / DPF), the subprocessor entry, minimisation (no PHI in email
    bodies, transactional only) and the retention setting — a missing EU region is never silently
    skipped.
  - Money: Stripe live keys in all projects; Connect platform settings (branding, payout schedule,
    statement descriptor); live webhook endpoint created with `pnpm stripe:setup:webhooks -- --url
https://api.eleva.care/webhooks/stripe --apply`; TOConline production series and OAuth app;
    IVA sign-off recorded; test a 1 EUR live booking + refund + invoices with an internal expert.
  - Video: Daily HIPAA domain confirmed, webhook secret set, `sessions.eleva.care` CNAME live.
  - Notifications: Resend domain verified (DKIM/SPF/DMARC), Twilio EU sender approved.
  - Security: penetration test findings closed (high/critical), CSP enforced, rate limits live,
    secrets rotated post pen-test, `BETTER_AUTH_SECRET` production unique, KEK v1 stored in
    Vercel + offline escrow.
  - Ops: on-call rotation, status page, alerts tested, backups (Neon PITR window >= 7 days),
    runbooks reviewed, support macros ready, DNS TTL lowered to 300s 48h before.
  - Product: `pt/en/es` copy reviewed by a native speaker; pricing page matches Stripe products;
    `feature-flag-rollout-plan.md` production defaults set (`ff.toconline_invoicing_enabled` on,
    `ff.ai_reports_beta` off, `ff.session_recording` off).
- **Cutover** (operated from `docs/eleva-v3/operator-tasks/cutover-runbook.md`): T-48h TTL lowering + comms
  banner on MVP; T-2h MVP read-only + booking disabled; final `--since` migration run; verify;
  Vercel domains move (`eleva.care`, `www`, `api`, `admin`, `sessions`) to v3 projects; Stripe
  webhook switch (disable MVP endpoint after v3 endpoint confirmed receiving); QStash schedules
  applied to production (`pnpm qstash:setup`); flags applied; smoke E2E against production
  (read-only spec + one 1 EUR booking); welcome wave 1 (experts), wave 2 (members) over 48h;
  calendar reconnect notifications.
- **Watch**: 7 days: SLO dashboard (API availability, booking success rate, payment success
  rate, webhook lag, transfer success, invoice success, notification delivery), daily report;
  rollback trigger criteria (P1 > 30 min, payment success < 95%, auth error rate > 5%, data
  inconsistency); rollback preserves post-cutover writes (v3 write freeze, reverse export,
  Stripe-driven reconciliation) before DNS reverts — see the prompt, step C.
- **Decommission**: MVP kept read-only 30 days; WorkOS cancelled after final record checksum
  verification and 7-day watch; Novu already retired; remove migration schema after 30 days.

Out: Spain launch, Academy content (Phase 16).

## Deliverables

1. Ticked `launch-readiness-checklist.md` with evidence links; updated DPIA in
   `compliance-data-governance.md`; `apps/docs` compliance pages.
2. Production configuration scripts applied (`stripe:setup:webhooks`, `stripe:setup:portal`,
   `qstash:setup`, `flags:sync`, `betterstack:setup`, `daily:setup`, `resend:setup`,
   `twilio:setup` — each `--apply` script exists or is added in this phase, dry-run by default)
   with recorded ids in `infra/*/README.md`, every one executed through `scripts/cutover-gate.mjs`
   (`pnpm cutover:gate`, new in this phase: refuses to run a wrapped command unless the dated
   cutover log holds an owner-committed approval line for that step, then appends the execution
   line; unit tests for missing, stale and foreign-author approvals).
3. `e2e/production-smoke.spec.ts` (read-only + gated 1 EUR booking with `E2E_ALLOW_LIVE_PAYMENT`).
4. Cutover log `docs/eleva-v3/operator-tasks/cutover-log-YYYY-MM-DD.md`, one per UTC day
   (timeline, verifications, issues, `CUTOVER_TS`).
5. 7-day SLO report `docs/eleva-v3/reports/launch-slo-YYYY-MM-DD.md`, one per UTC day.
6. Decommission checklist executed (dated) in `decision-log.md`.

## Acceptance criteria

- [ ] Every checklist item ticked with a link (PR, dashboard screenshot, or doc).
- [ ] Live 1 EUR booking: payment succeeded, payout scheduled, Tier 1 invoice issued, Tier 2
      manual/auto recorded, notifications delivered, session room created; refund + credit note.
- [ ] DNS switched; `https://eleva.care`, `/experts`, `/[username]`, `/app`, `/expert`,
      `api.eleva.care/health`, `admin.eleva.care` all green; old MVP URLs redirect (sample 20).
- [ ] Migrated experts: >= 95% of active experts signed in within 7 days (tracked); support tickets
      triaged.
- [ ] 7-day SLO report: API availability >= 99.9%, payment success >= 98%, webhook p95 lag < 60s,
      zero P1.
- [ ] Rollback plan rehearsed before cutover (staging) and not needed — or executed and documented.
- [ ] WorkOS cancelled only after checksum verification sign-off; recorded in `decision-log.md`.

## Tests

- Production smoke E2E; synthetic monitors; manual live booking.

## Docs to update

- `launch-readiness-checklist.md`, `compliance-data-governance.md` (DPIA), `environment-matrix.md`
  (production hosts final), `decision-log.md` (go/no-go, cutover, decommission), `owner-map.md`.

## Local references

- `docs/eleva-v3/{launch-readiness-checklist,compliance-data-governance,service-level-objectives,support-escalation-matrix,feature-flag-rollout-plan,environment-matrix}.md`, ADR-012, ADR-019.
- `docs/eleva-v3/operator-tasks/cutover-runbook.md` (Phase 14), `infra/**/README.md`, `.github/workflows/e2e.yml`.
- MVP Vercel project + DNS provider settings (operator access).

## External docs

- Vercel domains/DNS + project domain moves `/vercel/vercel` docs; Stripe live mode go-live
  checklist `/websites/stripe`; Neon PITR `/websites/neon_com_docs`; Daily custom domain docs;
  Resend domain verification.

## Risks

- DNS propagation and cookie domain mismatches: keep MVP responding read-only; monitor auth error
  rate; rollback follows the write-preserving procedure in step C (freeze, reverse export,
  reconcile, then DNS revert) — never a bare DNS flip.
- Multibanco pending payments on MVP: verify zero pending at freeze; if any, wait for expiry.

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(the directory containing pnpm-workspace.yaml). Work autonomously for the code and documentation parts;
STOP before each production mutation step (every B.n sub-step, each C step: DNS records,
Stripe live webhook switch, migration --apply against production, WorkOS cancellation): print
the step id and the exact command, then wait until the repository owner (@rodrigobarona) has
COMMITTED an approval line `<step> | approved | @rodrigobarona | <ISO-8601 UTC>` to
docs/eleva-v3/operator-tasks/cutover-log-$(date -u +%F).md — one file per calendar day (UTC),
created on first write; "the cutover log" below always means the file for the current UTC day.
Run every mutation through `pnpm cutover:gate <step> -- <command>` (section B defines it); the
gate refuses without a fresh owner-authored approval line, so a chat message is never an
approval. (These angle-bracket tokens are the log grammar the gate parses, not prompt
placeholders.)

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc and .cursor/skills/coderabbit-review/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6, 7 (universal preamble this
   prompt follows) and 8 (PR body template used below), and
   docs/eleva-v3/execution-plan/phases/15-launch-cutover.md in full, plus
   docs/eleva-v3/operator-tasks/cutover-runbook.md and docs/eleva-v3/launch-readiness-checklist.md.
3. Pull Vercel domains, Stripe go-live, Neon PITR, Daily custom domain and Resend domain docs
   through Context7
   (resolve-library-id then query-docs); prefer those docs over memory.

Workflow (mandatory) for the code/doc PR — this is the outer loop; the "PHASE 15 TASK" section further down is
what you implement at the "Implement the deliverables" step. Read the whole prompt before the
first command; run the checks and both review loops only AFTER the task work exists:
- git checkout main && git pull --ff-only && git checkout -b phase-15/launch-cutover
- Implement the deliverables of the PHASE 15 TASK below (runbook, scripts, gate report, docs) in
  the order listed. Keep the PR at <= 30 files / 400 lines where possible; split above 60 files / 800 lines and always before 100 reviewable files (the review cap).
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build &&
  pnpm e2e
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
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only. Never commit production
secrets, ids of live customers, or PHI into the repo; evidence files must be redacted.

PHASE 15 TASK — Launch gate, production cutover, 7-day watch, decommission (ADR-012, ADR-019).

A. Launch gate (PR): go through docs/eleva-v3/launch-readiness-checklist.md item by item; for each
   item either link evidence (PR, screenshot path under docs/eleva-v3/reports/evidence/, dashboard
   URL) or fix the gap in this PR. Required items: ERS compliance pages in apps/docs (compliance/
   portugal: licensing statement, complaint book link, professional registration display rules,
   no-diagnosis disclaimers) linked from the apps/web footer; final versioned legal texts in all
   locales; DPIA update in compliance-data-governance.md (WorkOS removed, Daily/Better Auth/AI
   Gateway added, subprocessor table); DSAR timing test; crypto-shred test on a staging org;
   EU residency table (Neon, Upstash, Vercel region fra1/cdg1 functions, Daily EU, Sentry EU,
   PostHog EU, and Resend: EU region evidence OR the DPIA-approved transfer mechanism +
   subprocessor + minimisation + retention entries — otherwise the gate fails) with links; pen-test findings closed; CSP enforced; production flag defaults
   (ff.toconline_invoicing_enabled on, ff.ai_reports_beta off, ff.session_recording off) applied
   with pnpm flags:sync; pricing page vs Stripe products check script; native-speaker copy review
   recorded. Add e2e/production-smoke.spec.ts (read-only checks on every public surface + one
   1 EUR booking only when E2E_ALLOW_LIVE_PAYMENT=true) and a workflow dispatchable manually.
B. Production configuration — ADR-019: **one gate per production mutation**, enforced by the
   repository, not by chat. Add scripts/cutover-gate.mjs (root script pnpm cutover:gate) in this
   phase: `pnpm cutover:gate <step> -- <command...>` reads the dated cutover log
   (docs/eleva-v3/operator-tasks/cutover-log-$(date -u +%F).md), requires a line matching
   `<step> | approved | @rodrigobarona | <ISO-8601 UTC>`, resolves the commit that INTRODUCED
   that exact line (`git blame -L` on the line -> sha; the file's latest commit is irrelevant),
   and accepts it only if `gh api repos/rodrigobarona/elevacare-monorepo/commits/<sha>` reports
   `author.login == "rodrigobarona"` AND `commit.verification.verified == true` (GPG/SSH-signed
   by a key registered on that GitHub account; a local author e-mail is never trusted) and the
   commit's committer date is not older than 4 h, and only then runs the wrapped
   command, appending `<step> | executed | <ISO-8601 UTC> | <command> | <evidence path>` to the
   same file; without a fresh approval line the command is refused with exit 2. For each
   sub-step: print the exact command and affected system, STOP until the owner has committed
   the approval line, run it through the gate, paste evidence, then print the next sub-step.
   Never batch two sub-steps under one approval line. (The angle-bracket tokens in this
   paragraph are the gate's log grammar, not prompt placeholders.)
   B.1.a-B.1.h Vercel production env vars, ONE gate per project (web, app, expert, team,
       academy, account, admin, api — one letter each): `pnpm cutover:gate B.1.a -- pnpm
       vercel:env:apply -- --project elevacare-web --environment production`
       (scripts/vercel-env-apply.mjs, added in this phase: diffs environment-matrix.md against
       `vercel env ls` and applies only the listed keys, one project per invocation, dry-run
       by default; values come from the operator's 1Password vault, never from the repo). Evidence:
       `vercel env ls --environment production` output per project.
   B.2 Stripe live webhook: pnpm cutover:gate B.2 -- pnpm stripe:setup:webhooks -- --url
       https://api.eleva.care/webhooks/stripe --apply; record the endpoint id in
       infra/stripe/README.md.
   B.3 Stripe customer portal: pnpm cutover:gate B.3 -- pnpm stripe:setup:portal -- --apply.
   B.4 QStash production schedules: pnpm cutover:gate B.4 -- pnpm qstash:setup -- --apply;
       evidence: schedule list.
   B.5 BetterStack monitors and status page: pnpm cutover:gate B.5 -- pnpm betterstack:setup --
       --apply.
   B.6 Daily production webhook endpoint: pnpm cutover:gate B.6 -- pnpm daily:setup -- --apply
       (registers POST https://api.eleva.care/webhooks/daily); the sessions.eleva.care CNAME is
       a DNS mutation and is gated separately as C.0 in section C.
   B.7 Resend production domain verification (EU region — hard gate): pnpm cutover:gate B.7 --
       pnpm resend:setup -- --apply; evidence includes the region field.
   B.8 Twilio production messaging service (EU) + status callback URL: pnpm cutover:gate B.8 --
       pnpm twilio:setup -- --apply.
   B.9 Live smoke — a real charge, its own gate: pnpm cutover:gate B.9 -- env
       E2E_ALLOW_LIVE_PAYMENT=true pnpm exec playwright test e2e/production-smoke.spec.ts (the
       flag is set inside the gated command — without it the spec skips the live charge; 1 EUR
       booking with an
       internal expert end to end: payment, payout scheduled, Tier 1 + Tier 2 invoices,
       notifications, room), then the refund (credit note) through the same gate as B.9r. Paste
       evidence.
C. Cutover (one owner-committed approval line and one `pnpm cutover:gate C.n -- ...` per step,
   following docs/eleva-v3/operator-tasks/cutover-runbook.md; the step ids below are the gate
   ids): C.0 sessions.eleva.care CNAME to Daily; C.1 T-48h lower DNS TTL to 300s and show the
   MVP maintenance banner; C.2 T-2h MVP read-only + booking disabled, verify zero pending
   Multibanco; C.3 final pnpm migration:run --apply --target production --since
   "$LAST_REHEARSAL_TS" (LAST_REHEARSAL_TS = the `source_watermark` of the last successful
   `migration_runs` row — the MVP snapshot time recorded by Phase 14, never `completed_at`; the
   CLI applies the Phase 14 MIGRATION_DELTA_OVERLAP automatically and this final delta is exact
   because the MVP is already read-only from C.2 — printed by pnpm migration:verify and copied
   into the cutover log before
   this step; from infra/migration, read-only MVP role; the Phase 14 guard requires
   MIGRATION_CONFIRM_PRODUCTION=$(date -u +%F) in the environment and the operator typing
   the v3 production Neon project id at the interactive prompt — record both in the cutover log),
   pnpm migration:verify --target production (counts, checksums 100%, FK orphans 0); C.4 move
   domains eleva.care, www, api, admin to the v3 Vercel projects (one gate per domain: C.4.a-d);
   C.5 confirm Stripe live webhook receives events on v3 then disable the MVP endpoint; C.6 run
   production-smoke; C.7 send welcome wave 1 (experts) then C.8 wave 2 (members) within 48h;
   C.9 queue calendar.reconnect_required notifications.
   Log every step with timestamps in the cutover log. The moment the DNS switch is executed,
   record the ISO-8601 UTC timestamp as CUTOVER_TS in the cutover log and export it in the
   operator shell (export CUTOVER_TS=2026-..T..Z) — every --since below reads it from there.
   Rollback criteria: P1 > 30 min, payment success < 95%, auth error rate > 5%, data
   inconsistency. Rollback procedure (rehearsed on staging before C starts; written in
   cutover-runbook.md section "Rollback"): (1) freeze v3 writes (ff.booking_enabled=false,
   apps/api returns 503 on mutating routes, Stripe live webhook paused on v3); (2) export the
   COMPLETE post-cutover mutation set — every v3 row created OR updated since cutover across all
   tenant tables (bookings, booking_payments, payout_states, invoices, domain_events_outbox,
   notifications, consents, profiles, users created via magic link ...), plus soft-deletes and
   hard deletes reconstructed from audit_events, each tagged insert|update|delete — with
   pnpm migration:reverse-export --since "$CUTOVER_TS" to a signed JSON file, and replay it into
   the MVP idempotently by the id map (upsert / delete-or-tombstone; a second replay is a no-op)
   so a pre-cutover booking cancelled or rescheduled in v3 is never restored stale; (3) reconcile against Stripe as the source of truth
   for money — invariant: every succeeded PaymentIntent has exactly ONE canonical booking,
   keyed by stripe_payment_intent_id, in whatever state v3 last recorded for it (confirmed,
   completed, cancelled, refunded or refund_pending — a cancelled-and-refunded booking is still
   the canonical one; "active" is not required), and after rollback that canonical booking with
   its payment, refund and cancellation state lives in MVP; the exported v3 rows are retained
   read-only as an audit copy and are NOT counted as a second booking. Replay intents missing
   from MVP with the MVP booking importer as an idempotent upsert on stripe_payment_intent_id
   that also writes the recorded status, refunded_cents and cancellation reason (re-running the
   import is a no-op), never refund automatically, and record for each intent {intentId, mvpBookingId, v3BookingId, action} in
   the rollback report; (4) re-enable the MVP
   Stripe webhook endpoint before DNS moves; (5) revert DNS to MVP and unfreeze MVP; (6) announce
   and keep v3 read-only for post-mortem. Rollback is a go-ahead step like every other production
   mutation.
D. Watch 7 days: daily entry in docs/eleva-v3/reports/launch-slo-$(date -u +%F).md with API availability,
   booking and payment success rates, webhook p95 lag, transfer/invoice success, notification
   delivery, sign-in rate of migrated experts (target >= 95% active experts in 7 days), incidents.
E. Decommission (with go-ahead): after the 7-day watch and a final records checksum verification,
   cancel WorkOS; keep MVP read-only for 30 days then archive (Neon branch snapshot retained per
   retention matrix); schedule removal of the migration schema at +30 days; record everything in
   decision-log.md and update owner-map.md.

Acceptance: checklist fully evidenced; live 1 EUR cycle; DNS switched with all surfaces green and
20 sample redirects; migrated expert sign-in rate tracked; 7-day SLO report meets targets;
rollback rehearsed; WorkOS cancelled only after sign-off.

Report: gate gaps fixed, production ids (webhook endpoint, monitors), cutover log link, SLO report
link, open incidents, CodeRabbit CLI counts, PR URL.
```
