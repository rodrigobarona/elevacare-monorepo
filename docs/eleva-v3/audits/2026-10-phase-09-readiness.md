# Phase 09 readiness checklist (2026-10-07)

Status: **Phase 09 engineering is open on standard Daily.** Human gates below
stay honest. Nothing here claims HIPAA, a Daily BAA, or live tax issuance.

Founder 2026-10-07: no BAA and no HIPAA programme for now. The running product
will be shown to accounting and legal. Phase 09 may proceed in **standard
(non-HIPAA) Daily** with recording off. D-07 is **deferred**, not signed.
Stamp **not HIPAA**. The 2026-09-25 Phase 04B waiver still closes none of the
tax or legal gates.

## Human gates (founder / DPO / legal / accountant)

| Gate                                     | Owner                | State        | What closes it                                                                                                                          |
| ---------------------------------------- | -------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| D-07 Daily HIPAA domain + BAA/DPA        | Founder + DPO        | **Deferred** | Executed BAA/DPA + HIPAA domain, if the founder later wants a HIPAA / PHI-video claim. Not required to build Phase 09.                  |
| FT POST / Comunicação / `invoice.issued` | Founder + accountant | **Open**     | Tax and issuance gates open, or a founder waiver that **names** FT POST, Comunicação and `invoice.issued`. **Not named** on 2026-10-07. |
| D-06 Strict policy legal review (PT)     | Legal                | **Open**     | Legal sign-off on the Strict tier; expert cancel and no-show stay out of scope until then                                               |
| D-12 legal / trust pages                 | Legal + DPO          | **Open**     | Final copy; pages stay draft-bannered until then                                                                                        |
| Twilio IE1 Auth Token                    | Founder              | **Open**     | IE1 credentials before any EU SMS residency claim (US1 Trial smoke passed 2026-09-25)                                                   |
| Phase 04B human evidence                 | Founder              | Waived       | Waived 2026-09-25. Stamp as waived/unproven, never as proven                                                                            |

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
- The member session "Join" button stays disabled until the first Phase 09
  implementation PR ships join pages.
