# Phases 01–10 implementation audit

Date: 2026-10-19  
Scope: code on `main` at `53f3dafc` versus `docs/eleva-v3/execution-plan/phases/01`–`10`, plus
the AUD-001–AUD-025 register from [`2026-09-phases-01-08-audit.md`](./2026-09-phases-01-08-audit.md)
and [`2026-10-phase-09-readiness.md`](./2026-10-phase-09-readiness.md).  
Method: per-phase acceptance matrix with file evidence; architecture sweeps (route policy,
OpenAPI, `withAudit`, RLS, vendor boundaries, vendor I/O inside transactions); UX inventory of
the MVP and v3 marketing surfaces. No staging or production smokes were run in this pass.  
Hard limits still in force: no production mutation; `issueInvoice()` stays closed; D-07 deferred
(**not HIPAA**); the 04B human-evidence waiver stays **waived/unproven**; D-gates are reported,
not closed by engineering.

## Executive summary

Phases 01–08 remain **engineering-on-main** and pass their code-level acceptance checks.
The fixes from the 2026-09 audit (AUD-001/002/003/005/008/009/010/011/012/015/016/018/020/021/023/024/025)
are present and have not regressed. The platform is **not production-ready**. Every
remaining blocker is evidence (staging money and video proofs) or unbuilt Phase 10 safety work,
not a regression.

Phase 09 video engineering is on main. Its **exit gate is still unproven**: there is no staging
Eleva grant join across two browsers and no Daily webhook subscription evidence.

Phase 10 is roughly **40% of PR 10.1**. Encrypted session records, documents and the in-call
autosave exist. The PHI-handling guard rails (branded decrypted type, allow-list logger), publish,
retention, `ai_processing` consent and clinical tombstones do not exist yet. **Do not open Phase 10.2
(AI drafts, CRM) until 10.1a–d land.** Update 2026-10-20: 10.1a (structural PHI guards) is on main;
only its ESLint `Decrypted` response ban remains.

The product UI is functional but visually thin. The public marketing site does not yet carry the
MVP's premium patterns. Brand v3 tokens and the curated media library landed in this pass
(#180, #181); the redesign follows (AUD-044).

## W0 — Baseline pipeline

| Check                                 | Result                                                       |
| ------------------------------------- | ------------------------------------------------------------ |
| `check:route-guards`                  | pass — 130 routes, all export `ROUTE_POLICY`                 |
| OpenAPI coverage test                 | pass — 126 documented paths, only intentional `/auth/*` gaps |
| `check:api-first-actions`             | pass                                                         |
| Webhook registry ≡ dispatcher ≡ setup | pass (`webhook-events.test.ts`)                              |
| CI on `main` @ `b8a2acab` e2e-smoke   | pass                                                         |
| CI on `main` @ `53f3dafc`             | running at time of writing                                   |
| Staging W3 money / video smokes       | **not run**                                                  |

## Phase closeout (honest stamps)

| Phase             | Engineering         | Stamp                                                                                       |
| ----------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| 01 Rebaseline     | On main             | Engineering closed                                                                          |
| 02 Better Auth    | On main             | Engineering closed; JWT-after-revoke and passkey/Google linking untested (AUD-040, AUD-049) |
| 03 WorkOS removal | On main             | Engineering closed; live calendar busy/create unproven (04B waiver)                         |
| 04 Public booking | On main             | Engineering closed; staging reserve→pay→confirm not run; BotID prod off (AUD-017)           |
| 04B Offer builder | On main             | **Waived / unproven** (founder 2026-09-25)                                                  |
| 05 Member app     | On main             | Engineering closed (loopback)                                                               |
| 06 Payments       | Machinery on main   | **Gated** — live pay→transfer→payout unproven; AUD-001 staging re-run open                  |
| 07 Invoicing      | Closed-gate on main | **Gated** (correct) — `issueInvoice()` closed, no `invoice.issued`                          |
| 08 Notifications  | Lane 1 on main      | Engineering closed; Twilio IE1 unproven; mode-aware copy partial (AUD-042)                  |
| 09 Video          | On main             | **Exit gate unproven** (staging grant join + Daily webhooks)                                |
| 10 Records        | ~50% of 10.1        | **Open** — AUD-027–AUD-032; AUD-026 mostly fixed (10.1a, 2026-10-20)                        |

## Findings register

Severity: **P0** blocks any production money or PHI. **P1** must be fixed or explicitly waived
before Phase 10 ships. **P2** before launch. **P3** hygiene.

No new P0. One candidate P0 was reclassified, see "Rejected or reclassified candidates".

### P1

| ID      | Finding                                                                                                                                                                                                                | Evidence                                                                                              | Fix                                                                                                                                                                                   |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUD-026 | No `Decrypted<T>` brand, PHI registry or allow-list logger. Decrypted record text is a plain string, and record/document routes `console.error` raw errors, so a future change can leak plaintext into logs or Sentry. | `packages/records/src/session-records.ts`; `packages/observability/src/redaction.ts` is key-name only | **Mostly fixed 2026-10-20** (10.1a): `Decrypted<T>`, PHI registry, `recordLogger`, Sentry key allow-list. Open: ESLint ban on `Decrypted` in responses                                |
| AUD-027 | No publish path. `publishedAt` is never written, so member policy B never exposes a report.                                                                                                                            | no `…/publish` route                                                                                  | Slice 10.1c: publish/unpublish API + audit + member reports UI                                                                                                                        |
| AUD-028 | Retention sweep absent (`ai_draft` 90 days, documents).                                                                                                                                                                | `packages/compliance/src/retention.ts` only pseudonymises consents                                    | Slice 10.1d: `POST /workflows/retention-sweep` + QStash schedule                                                                                                                      |
| AUD-029 | `ai_processing` is not a consent kind.                                                                                                                                                                                 | `CONSENT_KINDS` = terms/privacy/health/marketing                                                      | **Partly fixed 2026-10-20** (10.1b): kind + migration 0060, `/me/consents`, Privacy toggle, `hasActiveAiProcessingConsent`. Open: join banner, booking checkbox, versioned legal text |
| AUD-030 | Account deletion erases member documents but does not tombstone expert clinical records.                                                                                                                               | `account-deletion.ts`                                                                                 | Slice 10.1d: tombstone `member_user_id` and strip metadata per the retention matrix                                                                                                   |
| AUD-031 | Policy A SELECT also matches the booking's expert, wider than D-11 author-only.                                                                                                                                        | `records_author_select` in `0054`                                                                     | **Fixed 2026-10-20**: migration 0061 narrows SELECT to `created_by` (session documents keep the booking-expert read, because members upload them)                                     |
| AUD-032 | `summarizeSessionRecords` always throws; there is no consent or author gate yet. Safe today, but 10.2 must not ship on top of it before AUD-026–030.                                                                   | `packages/records/src/summarize.ts`                                                                   | Slice 10.2b after 10.1a–d                                                                                                                                                             |
| AUD-033 | Execution-plan README §3 "Current state" describes the pre-Phase-02 monorepo (WorkOS-locked, ~35 routes, 22 migrations).                                                                                               | `execution-plan/README.md` §3                                                                         | **Fixed in this PR**                                                                                                                                                                  |

Carried-forward P1 evidence gaps (no new IDs):

- Phase 06 exit: live Stripe test-mode pay → eligible → transfer → payout on staging.
- AUD-001: staging re-run of the cancellation refund sweep (loopback only so far).
- Phase 09 exit: staging Eleva grant join across two browsers plus Daily `meeting.*`/`participant.*`
  webhooks at `POST /webhooks/daily`.

### P2

| ID      | Finding                                                                                                                          | Evidence                                                                        | Fix                                                                                 |
| ------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| AUD-034 | Member session card has no `awaiting_confirmation` label, so Request-to-book bookings show a raw status and a Join affordance.   | `apps/app/src/app/[orgSlug]/_components/booking-card.tsx`                       | **Fixed on main** (verified 2026-10-20): label present, Join hidden while awaiting  |
| AUD-035 | No e2e for Request to book (pay → accept / decline / expiry).                                                                    | no match in `e2e/`                                                              | Loopback spec on a `requiresApproval` seed offer                                    |
| AUD-036 | Calls hard-eject at `endAt + 30m` with no soft warning at the booked end, and rooms are never deleted on inactivity.             | `room-options.ts` `eject_at_room_exp`; no idle-delete job                       | In-call soft warning at `endsAt`; QStash idle/trail room delete                     |
| AUD-037 | Unaudited writes: session-room lease, participant capacity flags, notification delivery claims.                                  | `ensure-session-room.ts`, `participants.ts`, `claim-delivery.ts`                | Wrap in `withPlatformAudit`, or document as operational exemptions                  |
| AUD-038 | `updateAvatar(url)` Server Action has no Zod validation.                                                                         | `apps/account/.../settings/actions.ts`                                          | **Fixed on main** (verified 2026-10-20): `UpdateAvatarRequestSchema.safeParse`      |
| AUD-039 | Two Route Handlers outside `apps/api` (post-auth `/dashboard` redirect, Stripe billing return).                                  | `apps/account/src/app/(auth)/dashboard/route.ts`, `.../billing/return/route.ts` | Keep as documented redirect-only exceptions, or move to a page + `redirect()`       |
| AUD-040 | No contract test for JWT validity after session revoke.                                                                          | `api-auth.test.ts`                                                              | Mint JWT → revoke → assert documented behaviour                                     |
| AUD-041 | Live RLS isolation tests do not cover `session_participants`, `records`, `session_documents` (extends AUD-014).                  | `rls-isolation.test.ts`                                                         | Add cross-org/cross-member fixtures under `ELEVA_RLS_INTEGRATION=1`                 |
| AUD-042 | Phone and in-person bookings get generic copy; ICS `LOCATION` is empty unless online.                                            | `send-booking-notification.ts`                                                  | Branch body and ICS by `sessionMode` (address, masked phone, never a number in ICS) |
| AUD-043 | Express Connect still requests `card_payments`, contrary to the phase AC.                                                        | `packages/billing/src/server/connect.ts`                                        | Record the D-05 exception or prove transfers-only and drop it                       |
| AUD-044 | Public marketing and product surfaces are visually thin compared with the MVP (no hero media, service storytelling, footer CTA). | `apps/web/.../marketing-home.tsx`, draft pages                                  | Brand v3 + `@eleva/media` + blocks redesign (Track B, in progress)                  |

Carried-forward P2: AUD-013 residual (fee row outside the ledger transaction, mitigated by backfill),
AUD-014, AUD-017 (BotID production off), Twilio IE1 residency, staging auth cookie/calendar proofs.

### P3

| ID      | Finding                                                                                                                | Fix                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| AUD-045 | Empty-body POSTs (publish/unpublish, read-all, feed-token, identity, invoicing retry) have no `z.object({}).strict()`. | Shared no-body schema                                                    |
| AUD-046 | Optional Instant Book lead-time is not modelled (boolean `requiresApproval` only).                                     | Lead-time column that forces approval inside the window                  |
| AUD-047 | Doc drift: webhook rule says "two-file" (code is registry + dispatcher + setup); Phase 01 says `drizzle/audit`.        | Align wording                                                            |
| AUD-048 | No `apps/email` template-lint script; quiet-hours SMS deferral and `ended + 2 min` attendance finalize not built.      | Add lint to CI; keep `endsAt + 30m` sweep as SSOT or build the delay job |
| AUD-049 | Passkey sign-in and Google `account_not_linked` are not in Playwright.                                                 | Extend `e2e/auth-api.spec.ts`                                            |

### Rejected or reclassified candidates

- **"PHI in API error logs" (proposed P0).** Record text is encrypted before the DB call, so the
  thrown errors observed carry ciphertext or driver messages, not plaintext. Reclassified as part of
  AUD-026 (P1): the risk is structural, not a current leak.
- **Vendor I/O inside DB transactions.** None found in billing, accounting refresh or video room
  creation.
- **Frontend DB writes.** None. Expert app uses `@eleva/db` for reads only.

## AUD-001–AUD-025 regression check

All previously fixed items are still fixed on `main`. Status changes since 2026-10-07: none.
AUD-006 stays deferred, AUD-007 stays waived until issuance opens, AUD-014 and AUD-017 stay partial,
AUD-022 stays product backlog.

## Phase 10 remaining slice order

1. **10.1a** PHI hardening (AUD-026) — landed 2026-10-20 except the ESLint `Decrypted` response ban
2. **10.1b** `ai_processing` consent (AUD-029)
3. **10.1c** publish + member reports (AUD-027)
4. **10.1d** retention sweep, clinical tombstone, DSAR decrypt + signed URLs (AUD-028, AUD-030)
5. **10.1e** expert `/members` list and detail
6. **10.1f** record templates
7. **10.2a** KEK rotation CLI + decrypt audit sampling
8. **10.2b** `draftSessionReport` behind `ff.ai_reports_beta` (AUD-032)
9. **10.2c** CRM

AUD-031 is a D-11 decision, not a slice: resolve it before 10.1c exposes reports.

## Fix pack

| PR      | Contents                                                                                      |
| ------- | --------------------------------------------------------------------------------------------- |
| this PR | This audit, AUD-033 README §3 refresh                                                         |
| next    | AUD-034 + AUD-038 (small product fixes)                                                       |
| then    | 10.1a PHI hardening (AUD-026) — landed 2026-10-20; ESLint `Decrypted` response ban still open |
| Track B | AUD-044 redesign slices (blocks → web → app → expert → account → team/academy/admin → email)  |
