# Phase 09 readiness checklist (2026-10-07)

Status: **Phase 09 engineering is open on standard Daily.** Human gates below
stay honest. Nothing here claims HIPAA, a Daily BAA, or live tax issuance.

Founder 2026-10-07: no BAA and no HIPAA programme for now. The running product
will be shown to accounting and legal. Phase 09 may proceed in **standard
(non-HIPAA) Daily** with recording off. D-07 is **deferred**, not signed.
Stamp **not HIPAA**. The 2026-09-25 Phase 04B waiver still closes none of the
tax or legal gates.

## Human gates (founder / DPO / legal / accountant)

| Gate                                     | Owner                | State        | What closes it                                                                                                                                                                                                |
| ---------------------------------------- | -------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-07 Daily HIPAA domain + BAA/DPA        | Founder + DPO        | **Deferred** | Executed BAA/DPA + HIPAA domain before **production PHI-video processing** (clinical sessions on Daily), not only a HIPAA claim. Not required to build Phase 09 or to demo standard Daily with recording off. |
| FT POST / Comunicação / `invoice.issued` | Founder + accountant | **Open**     | Tax and issuance gates open, or a founder waiver that **names** FT POST, Comunicação and `invoice.issued`. **Not named** on 2026-10-07.                                                                       |
| D-06 Strict policy legal review (PT)     | Legal                | **Open**     | Legal sign-off on the Strict tier; expert cancel and no-show stay out of scope until then                                                                                                                     |
| D-12 legal / trust pages                 | Legal + DPO          | **Open**     | Final copy; pages stay draft-bannered until then                                                                                                                                                              |
| Twilio IE1 Auth Token                    | Founder              | **Open**     | IE1 credentials before any EU SMS residency claim (US1 Trial smoke passed 2026-09-25)                                                                                                                         |
| Phase 04B human evidence                 | Founder              | Waived       | Waived 2026-09-25. Stamp as waived/unproven, never as proven                                                                                                                                                  |

## Engineering prerequisites

| Item                                                         | State                | Evidence / next step                                                                                 |
| ------------------------------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------- |
| Phases 01–08 audit fixes (AUD-001…025)                       | Merged               | [`2026-09-phases-01-08-audit.md`](./2026-09-phases-01-08-audit.md); AUD-006 deferred, AUD-007 waived |
| Loopback e2e (auth, member, member:stripe, cancellation, 06) | PASS 2026-10-07      | Same doc, "Production pass closeout"                                                                 |
| a11y (axe WCAG 2.1 AA) + Lighthouse ≥ 90 on `apps/web`       | PASS 2026-10-07      | Same doc                                                                                             |
| 09.0 Daily account spike                                     | Written              | [`spikes/09-daily-account.md`](../spikes/09-daily-account.md) — standard mode, no BAA, recording off |
| Migrations `0049`, `0050` on staging and production          | **Pending operator** | `pnpm db:migrate` per environment before the next `apps/api` deploy                                  |
| Staging W3 smokes (AUD-001, 017, 021, 024, 025)              | **Not run**          | Needs a staging deploy with the migrations applied                                                   |
| Stripe test-mode pay → transfer → payout on staging          | **Not run**          | Phase 06 closeout evidence                                                                           |
| BotID promotion (AUD-017)                                    | Staging only         | `operator-tasks/botid-staging-validation.md`; production stays `BOTID_MODE=off`                      |
| UX-009 inline field errors                                   | Open follow-up       | Not a Phase 09 blocker                                                                               |
| Dark mode on `apps/web`                                      | Not built            | Follow-up; not a Phase 09 blocker                                                                    |

## Phase 09 engineering entry

- Daily rooms use a **standard** domain and deterministic names (`eleva-{bookingId}`).
  Do not implement the HIPAA random-name fingerprint path until D-07 is signed.
- Recording stays off. Phone and in-person bookings never reach Daily.
- `issueInvoice()` stays closed. Do not Comunicar TEST or issue fictitious documents
  for the accountant demo.
- Legal/trust pages stay draft-bannered for the lawyer review.
- **09.2 acceptance:** the member session "Join" button stays disabled until a
  Daily room exists for that booking, then enables from room availability.
  Copy must say **standard Daily, not HIPAA**.

## Stakeholder leftovers (TODO, not blockers)

Founder 2026-10-07: show the running product with honest notes. Nothing
below blocks Phase 09 engineering or a demo. Do not stamp any of these
closed until the evidence column is real.

| Leftover                                | Who it is for        | State                   | TODO (not a blocker)                                                                                                                                                                              |
| --------------------------------------- | -------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live money / production go-live         | Accountant + founder | Not safe for live money | Staging pay → transfer → payout, then production money. Still **not** a Phase 09 engineering gate.                                                                                                |
| Staging W3 smokes                       | Ops                  | Not run                 | After `0049`/`0050` on staging: auth, funnel, Connect, transfer/refund/dispute, reminders, DSAR, TOConline OAuth (no Comunicação). Loopback cancel refunds already PASS.                          |
| Phase 06 evidence                       | Accountant           | Machinery on main       | Live Stripe test-mode pay → transfer → payout on staging.                                                                                                                                         |
| Phase 07 issuance                       | Accountant           | Closed by design        | FT POST / Comunicação / `invoice.issued` stay operator-gated. `issueInvoice()` closed.                                                                                                            |
| Phase 08 Twilio EU                      | Legal                | US1 trial PASS          | IE1 Auth Token before any EU SMS residency claim. Quiet hours + ICS **are on main**.                                                                                                              |
| Phase 04B human UX                      | Founder              | Waived / unproven       | Design/OAuth/calendar live proof waived 2026-09-25. Do not call it proven.                                                                                                                        |
| AUD-006 fee reconciliation              | Accountant           | Deferred                | Lands when issuance opens.                                                                                                                                                                        |
| AUD-007 payout waits for fee invoice    | Accountant           | Waived                  | Flip when `issueInvoice()` opens.                                                                                                                                                                 |
| D-07 Daily BAA / HIPAA                  | Lawyer + DPO         | Deferred                | Needed only for production PHI-video. Demo uses standard Daily, recording off.                                                                                                                    |
| D-06 Strict PT legal                    | Lawyer               | Open                    | Expert cancel / no-show stay out of scope.                                                                                                                                                        |
| D-12 legal / trust copy                 | Lawyer + DPO         | Open                    | Pages stay draft-bannered.                                                                                                                                                                        |
| Migrations `0049` / `0050`              | Operator             | Loopback only           | `pnpm db:migrate` on staging then production.                                                                                                                                                     |
| Daily account probe                     | Engineering          | **PASS (Prebuilt)**     | Live key + `elevacare.daily.co` + two-browser Prebuilt call 2026-10-08. `DAILY_WEBHOOK_SECRET` is on Vercel; Daily subscription waits for an `elevacare-api` redeploy. Eleva join pages leftover. |
| Expert cancel, no-show, custom policies | Product              | Out of scope            | Flexible / Moderate / Strict only.                                                                                                                                                                |

## Phase 09 engineering closeout (2026-10-08)

Engineering slices **09.1–09.6.3** are on main. This is **not** a proven
exit gate and **not HIPAA**.

| Item                                                              | State               | Evidence                                         |
| ----------------------------------------------------------------- | ------------------- | ------------------------------------------------ |
| 09.1–09.5 server, rooms, join, ElevaCall, emails, pay-fail cancel | on main             | PRs #163–#166                                    |
| 09.6.1 attendance fallback (`endsAt + 30m`)                       | on main             | #167                                             |
| 09.6.2 Playwright fake-device join                                | on main             | #168 (`E2E_VIDEO_JOIN=1` leftover)               |
| 09.6.3a eject-before-capacity                                     | on main             | #169                                             |
| 09.6.3b webhook `processed_at` in session tx                      | on main             | #170                                             |
| Join Permissions-Policy camera/mic                                | on main             | `@eleva/observability` `joinPermissionsPolicy()` |
| Meeting-token JWT redaction + `check-no-phi-logs`                 | on main             | `redaction.ts` + `pnpm check:no-phi-logs`        |
| 09.0 live Daily probe                                             | **PASS (Prebuilt)** | Spike addendum 2026-10-08; not Eleva join pages  |
| Staging two-browser call                                          | leftover            | Operator; not a merge gate                       |
| `ended + 2 min` `finalizeAttendance`                              | **not built**       | Decision-log attendance SSOT                     |
| D-07 HIPAA / BAA                                                  | Deferred            | Never claim BAA or HIPAA                         |
