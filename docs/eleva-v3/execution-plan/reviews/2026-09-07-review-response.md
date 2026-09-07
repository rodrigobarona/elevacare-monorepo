# Response to the external engineering review (7 September 2026)

Source: [`2026-09-07-external-engineering-review.md`](./2026-09-07-external-engineering-review.md)
(verbatim). This document records, per finding, what the plan now does about it and where. It is
the reply to the team; the plan files are the source of truth, this is the index.

Legend: **Adopted** — folded into the plan in this amendment. **Already resolved** — the reviewed
HTML was stale or the reader missed the section; pointer given, no change. **Adopted with
changes** — the intent is taken, the mechanism differs and the reason is stated. **Declined** —
not taken, reason stated.

Decision ids: the reviewer proposed a `D-01..D-14` list in §15. The plan keeps the same ids for
D-01..D-05 and D-09..D-14 and renumbers three: reviewer D-06 (recording storage) is plan **D-08**,
reviewer D-07 (hostname ownership) is resolved in text (no gate needed), reviewer D-08 (rollback
acceptance point) is a Phase 14 deliverable (`CUTOVER_ACCEPTANCE_TS`), and the plan uses **D-06**
for the refund/dispute/no-show policy and **D-07** for the Daily HIPAA domain + BAA/DPA. The
authoritative table is in `README.md` §"Approval gates" and `../../decision-log.md`.

## Headline outcome

- Conditional approval accepted as an amendment backlog. All ten P0 items and all ten P1 items
  have a disposition below; 19 adopted (some with changes), 1 already resolved (P0-8), none
  declined. Of the domain and methodology notes, only the up-front re-estimation (§10) is
  deferred.
- Recording/transcription leaves Phase 10 entirely and lives only in **16.8**, gated on D-07/D-08.
- Security controls are introduced in Phases 1, 2, 4, 10 and 12; Phase 13 **verifies** them.
- Spike PRs (`phase-NN.0/spike-*`) precede Phases 2, 6, 7 and 9; approval gates D-01..D-14 block
  the PRs listed in the README table.

## P0 findings

| Id    | Finding                                             | Disposition              | Where                                                                                                                                                                                                                                                                                                   |
| ----- | --------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1  | Refund contract used `reverse_transfer: true`       | **Adopted**              | Phase 6 refunds: `refunds.create` then `transfers.createReversal`, `payout_states.reversal_pending`, proportional partial reversal, no fresh transfer idempotency key; `payments-payouts-spec.md` §Refunds                                                                                              |
| P0-2  | Redis lock is not the consistency boundary          | **Adopted**              | Phase 4 `/bookings/reserve`: `btree_gist` exclusion constraint on `slot_reservations`, `23P01` -> 409 `SLOT_TAKEN`, concurrency test runs with and without the lock                                                                                                                                     |
| P0-3  | Parent-domain cookie needs a CSRF/subdomain model   | **Adopted**              | Phase 2: `docs/eleva-v3/security/cookie-csrf-threat-model.md` + `requireApiAuth` origin checks for cookie mutations; gate **D-13** blocks PR 04.2                                                                                                                                                       |
| P0-4  | Consent collected after the funnel needs it         | **Adopted**              | `consents` table created in PR 04.1; `/bookings/reserve` body carries `consents[]` persisted in the reservation transaction; Phase 5 only extends (marketing kind, withdrawal UI)                                                                                                                       |
| P0-5  | `public_handles` introduced too late                | **Adopted**              | Created in PR 04.1, backfilled from `expert_profiles.username`; 4B onboarding writes to it; Phase 11 adds clinic owners; Phase 14 asserts every MVP URL resolves                                                                                                                                        |
| P0-6  | Multi-currency text conflicted with Portugal launch | **Adopted**              | **D-02** EUR-only: `CHECK (currency = 'EUR')` on `event_types` / `event_type_modes`; Stripe calls read the reservation snapshot, never a literal                                                                                                                                                        |
| P0-7  | Daily HIPAA recording vs proposed storage           | **Adopted**              | Stripped from Phase 10 and Phase 9; 16.8 is the only home; two-hop design (AWS S3 EU landing zone, 72 h lifecycle -> encrypt -> private Vercel Blob) recorded as **D-08**; Neon/R2/Blob cannot be Daily's destination                                                                                   |
| P0-8  | `sessions.eleva.care` DNS ownership conflict        | **Already resolved**     | Daily owns the hostname (CNAME) in Phase 9 §Branding, Phase 15 C.0 and `environment-matrix.md`; the join page lives on `app.eleva.care`; CSP lists both                                                                                                                                                 |
| P0-9  | Rollback design is a second migration platform      | **Adopted with changes** | Phase 14: rollback is limited to the window before `CUTOVER_ACCEPTANCE_TS` (T+48 h or first payout run); after it, fix-forward only; the reverse script covers identity + bookings, not money                                                                                                           |
| P0-10 | External API calls inside DB transactions           | **Adopted**              | README rule 9 now forbids vendor calls inside a `tx` (commit intent, call outside, record with compare-and-set, reconcile); Phase 9 `ensureSessionRoom` already journals the attempt before calling Daily and reconciles lost responses; the Phase 10 flow that held a lock across a Daily call is gone |

## P1 findings

| Id   | Finding                                         | Disposition              | Where                                                                                                                                                                                                              |
| ---- | ----------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 6.1  | "One phase, one PR" is incompatible with scope  | **Adopted with changes** | README rule 11/12: a phase is a predefined **PR sequence** (`phase-NN.k/<slug>`), each PR leaves `main` buildable; spike PRs first; phase ids kept so cross-references stay stable                                 |
| 6.2  | Security cannot wait until Phase 13             | **Adopted**              | Phase 1: RLS policy-class taxonomy, gitleaks, `security-traceability.md` skeleton; Phase 2: D-13; Phase 4: `check:route-guards`; Phase 10: KEK controls; Phase 12: step-up + dual control; Phase 13 verifies       |
| 6.3  | Outbox needs per-subscriber delivery state      | **Adopted**              | `domain_event_deliveries` ships with the outbox in PR 04.2; Phases 7, 8, 9 register subscribers; a failing subscriber never blocks a healthy one                                                                   |
| 6.4  | Resend is not exactly-once                      | **Adopted**              | Phase 8: `Idempotency-Key` = delivery row id, our own delivery log is the recipient-level guarantee, SMS has no idempotency so every message carries a `StatusCallback`; content rules (no PHI in subjects or SMS) |
| 6.5  | Confirm status codes conflicted (201 vs 200)    | **Adopted**              | Phase 4 `/bookings/confirm`: flip -> 201, already confirmed -> 200 `alreadyConfirmed`, webhook acks independently; tests updated (`201 then 200`)                                                                  |
| 6.6  | Async payment methods need a reservation policy | **Adopted**              | **D-14** + `payment-method-policy.ts`: `synchronous`, `async_short` (MB WAY extends the hold to 10 min, sweep never cancels a `processing` intent), `excluded` (Multibanco, SEPA DD, Klarna)                       |
| 6.7  | Connect capability requirements excessive       | **Adopted**              | **D-05**: `transfers` only, gate on `details_submitted` + `payouts_enabled` + `transfers === "active"`; Stripe Identity behind `ff.expert_identity_verification`; Phase 12 partner checklist aligned               |
| 6.8  | Fee / VAT / expert-net not defined              | **Adopted**              | **D-03/D-04** + `computeSettlement` matrix in Phase 6 and the payments spec; accountant-approved fixture table is the unit test                                                                                    |
| 6.9  | Historical invoicing not addressed              | **Adopted**              | **D-09**: `platform_fee_invoices.status legacy \| legacy_missing`, v3 never reissues Tier 1 documents for pre-cutover bookings (Phases 7 and 14)                                                                   |
| 6.10 | Public-site parity needs decisions              | **Adopted**              | **D-10** parity table in Phase 4 (quiz retire, help -> `apps/docs`, community external, contact migrate, legal versioned, trust claims evidence-backed), `e2e/legacy-urls.spec.ts`                                 |

## Domain notes (§7) and phase assessment (§8, §9)

| Topic                                         | Disposition              | Where                                                                                                                                                                                                                                    |
| --------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Better Auth proof of concept before Phase 2   | **Adopted**              | New spike **PR 02.0** (`phase-02.0/spike-better-auth`): the reviewer's twelve contract checks proven on a Neon branch, report in `docs/eleva-v3/spikes/02-better-auth.md`, versions pinned from it; PR 02.1 cannot open before it merges |
| Drop identity mirror tables in one step       | **Adopted**              | Expand-and-contract: Phase 2 expands (new `auth.*`, backfill, `NOT VALID` FKs then `VALIDATE`), Phase 3 contracts (drops) after the exit-gate grep and parity pass                                                                       |
| RLS policy classes                            | **Adopted**              | Phase 1 taxonomy (`tenant-owned`, `dual-organization`, `owner-user-visible`, `participant-visible`, `staff-only`, `public-read`, `service-only`), `rls-classes.test.ts`                                                                  |
| Canonical time model                          | **Adopted**              | Phase 4 `@eleva/scheduling`: `timestamptz` instants, wall-clock + IANA zone rules, DST fixed-date tests, no offset-to-zone inference                                                                                                     |
| Localized columns: rows vs JSONB              | **Adopted with changes** | Kept JSONB-per-column (`LocalizedText` / `LocalizedRichText` keyed by `Locale`), `_source_locale` sibling, FTS via expression indexes; contract documented in Phase 1                                                                    |
| Twilio EU + status-callback validation        | **Adopted**              | Phase 8                                                                                                                                                                                                                                  |
| Daily account pre-check (BAA/DPA, EU, domain) | **Adopted**              | PR 09.0 spike, **D-07**; fallback ships phone/in-person modes first                                                                                                                                                                      |
| Meeting-token hygiene                         | **Adopted**              | Phase 9: minted at join time, never stored/logged/in URLs                                                                                                                                                                                |
| KEK custody and rotation                      | **Adopted**              | Phase 10 (ADR-009 detail), evidence in the Phase 13 compliance pack                                                                                                                                                                      |
| Clinic clinical access model                  | **Adopted**              | **D-11**: author; same-clinic via `clinic_shared_records` opt-in + member opt-out; staff metadata-only, break-glass under dual control (Phases 10, 11, 12)                                                                               |
| Admin step-up and dual control                | **Adopted**              | Phase 12: mandatory 2FA for staff, step-up on `[R]` routes, `admin_action_requests` for high-value money and identity actions                                                                                                            |
| Dependency table corrections                  | **Adopted**              | README phase index "Depends on" column is now PR-level (04.1 vs 04.2, spikes, gates); 4B and 5 may start on PR 04.1                                                                                                                      |
| Delivery estimates and staffing (§10)         | **Declined for now**     | Founder decision: estimates stay as the working cadence; re-estimation happens per phase from repository evidence at each phase's PR sequence definition, not up front                                                                   |

## Methodology (§14)

| Item                                       | Disposition              | Where                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 14.1 Replace "phase equals PR"             | **Adopted**              | README rules 11-13 (PR sequences, spike PRs, gates, environment mutation rules)                                                                                                                                                                                                                              |
| 14.2 Expand-and-contract migrations        | **Adopted**              | Phases 2/3 (identity), Phase 14 (MVP tables)                                                                                                                                                                                                                                                                 |
| 14.3 Environment mutation rules pre-launch | **Adopted**              | README rule 13: explicit `--env`, dry-run by default / `--apply`, fail closed on missing or mismatched environment identity, confirmation for destructive ops, ids + evidence recorded; staging from Phase 1, production operator-only from Phase 15                                                         |
| 14.4 AI review is advisory                 | **Adopted with changes** | README rule 13 states CodeRabbit is a code-quality gate, not a substitute for domain, finance, privacy, security or operator approvals (the D-gates). Rate-limit and plan notes stay in the execution-plan README, which is the tooling document; the architecture SSOT is `docs/eleva-v3/*.md` and the ADRs |
| 14.5 Requirements traceability matrix      | **Adopted**              | `docs/eleva-v3/security-traceability.md` (Phase 1 skeleton, Phase 13 completion) plus the Phase 15 launch checklist rows                                                                                                                                                                                     |

## What the team read that was stale

These were already in the merged Phase 0 plan (PR #20) when the review was written against an
earlier HTML build:

- `sessions.eleva.care` ownership (Daily) — Phase 9 and Phase 15 C.0 agreed before the review.
- Separate charges and transfers as the funds flow — the refund text was the only stale part
  (fixed as P0-1).

## Open items the review created for humans

Owners and status live in `../../decision-log.md`; nothing below blocks Phase 1-3 work.

| Gate | Decision                                               | Owner             | Blocks  |
| ---- | ------------------------------------------------------ | ----------------- | ------- |
| D-01 | `pt-BR` retired, 301 to `pt`; no `fr` now              | product           | PR 04.2 |
| D-02 | EUR-only launch                                        | founder + finance | PR 04.2 |
| D-03 | Commission VAT basis                                   | finance           | PR 06.1 |
| D-04 | Processing-fee bearer                                  | finance           | PR 06.1 |
| D-05 | Connect capability = `transfers` only                  | finance + legal   | PR 06.1 |
| D-06 | Refund, dispute and no-show policy                     | finance + product | PR 06.2 |
| D-07 | Daily HIPAA domain + BAA/DPA                           | founder + DPO     | Phase 9 |
| D-08 | Recording storage (S3 EU landing zone -> private Blob) | DPO + founder     | 16.8    |
| D-09 | Historical MVP invoices                                | accountant        | PR 07.1 |
| D-10 | Public-site parity dispositions                        | product           | PR 04.2 |
| D-11 | Clinical access model                                  | DPO + product     | PR 10.1 |
| D-12 | Deletion vs legal retention                            | DPO + legal       | Phase 5 |
| D-13 | Cookie / CSRF / subdomain threat model                 | security owner    | PR 04.2 |
| D-14 | Launch payment-method set                              | finance + product | PR 04.2 |
