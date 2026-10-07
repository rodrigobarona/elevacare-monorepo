# Phase 09 readiness checklist (2026-10-07)

Status: **Not ready to open Phase 09.** Engineering for phases 01–08 is on `main`. The human gates below are open, and nothing here closes them.

Phase 09 (video with Daily) may open only when both hold: (1) the tax and issuance gates open, or a separate founder waiver explicitly names FT POST, Comunicação and `invoice.issued`; and (2) D-07 is signed by the founder and the DPO (Daily BAA/DPA executed). D-07 cannot be waived. The 2026-09-25 Phase 04B waiver closes none of these.

## Human gates (founder / DPO / legal / accountant)

| Gate                                     | Owner                | State    | What closes it                                                                                             |
| ---------------------------------------- | -------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| D-07 Daily HIPAA domain + BAA/DPA        | Founder + DPO        | **Open** | Signed BAA/DPA, plan tier recorded in the decision log, evidence in `spikes/09-daily-account.md` (PR 09.0) |
| FT POST / Comunicação / `invoice.issued` | Founder + accountant | **Open** | Tax and issuance gates open, or a founder waiver that names FT POST, Comunicação and `invoice.issued`      |
| D-06 Strict policy legal review (PT)     | Legal                | **Open** | Legal sign-off on the Strict tier; expert cancel and no-show stay out of scope until then                  |
| D-12 legal / trust pages                 | Legal + DPO          | **Open** | Final copy; pages stay draft-bannered until then                                                           |
| Twilio IE1 Auth Token                    | Founder              | **Open** | IE1 credentials before any EU SMS residency claim (US1 Trial smoke passed 2026-09-25)                      |
| Phase 04B human evidence                 | Founder              | Waived   | Waived 2026-09-25. Stamp as waived/unproven, never as proven                                               |

## Engineering prerequisites

| Item                                                         | State                | Evidence / next step                                                                                 |
| ------------------------------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------- |
| Phases 01–08 audit fixes (AUD-001…025)                       | Merged               | [`2026-09-phases-01-08-audit.md`](./2026-09-phases-01-08-audit.md); AUD-006 deferred, AUD-007 waived |
| Loopback e2e (auth, member, member:stripe, cancellation, 06) | PASS 2026-10-07      | Same doc, "Production pass closeout"                                                                 |
| a11y (axe WCAG 2.1 AA) + Lighthouse ≥ 90 on `apps/web`       | PASS 2026-10-07      | Same doc                                                                                             |
| Migrations `0049`, `0050` on staging and production          | **Pending operator** | `pnpm db:migrate` per environment before the next `apps/api` deploy                                  |
| Staging W3 smokes (AUD-001, 017, 021, 024, 025)              | **Not run**          | Needs a staging deploy with the migrations applied                                                   |
| Stripe test-mode pay → transfer → payout on staging          | **Not run**          | Phase 06 closeout evidence                                                                           |
| BotID promotion (AUD-017)                                    | Staging only         | `operator-tasks/botid-staging-validation.md`; production stays `BOTID_MODE=off`                      |
| UX-009 inline field errors                                   | Open follow-up       | Not a Phase 09 blocker                                                                               |
| Dark mode on `apps/web`                                      | Not built            | Follow-up; not a Phase 09 blocker                                                                    |

## Phase 09 engineering entry

- PR 09.0 (`phase-09.0/spike-daily-account`, docs and evidence only) may proceed now, while D-07 is in progress, because it gathers the D-07 evidence. It merges before any other Phase 09 work: Daily HIPAA domain, BAA/DPA, `sessions.eleva.care`, webhook secret, token claims verified on staging, recording off.
- All other Phase 09 work waits for the opening rule above.
- Only bookings with snapshotted `mode = online` get a room. Phone and in-person bookings never reach Daily.
- The member session "Join" button stays disabled until 09 ships.
