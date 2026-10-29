# Legal and compliance pack (internal)

Internal GDPR and health-regulation documents for Eleva.care v3, operated by
BÚZIOS E TARTARUGAS - LDA. These documents are **not** the public legal pages.
The public pages live in `packages/content/content/legal/*` and
`packages/content/content/trust/*`, and quote facts from the fact sheet below.

**Status of every document except the fact sheet: draft — pending
lawyer/DPO review.** These are drafts prepared for a Portuguese lawyer and the
external DPO. They are not legal advice and do not record signed decisions
until the sign-off blocks are completed.

| Document                                                 | What it is                                                                                                                      | Status                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| [`fact-sheet.md`](./fact-sheet.md)                       | SSOT for company facts, sub-processors, cookies, retention and the law list used by the public pages                            | Living (last verified 2026-10-21) |
| [`ropa.md`](./ropa.md)                                   | Record of processing activities: GDPR art. 30(1) as controller and art. 30(2) as processor                                      | Draft — pending lawyer/DPO review |
| [`dpia.md`](./dpia.md)                                   | Data protection impact assessment (art. 35; CNPD Regulamento 1/2018): health data at scale, video, transcription, AI drafts     | Draft — pending lawyer/DPO review |
| [`retention-schedule.md`](./retention-schedule.md)       | Proposed final retention periods with legal basis, expert duty vs Eleva duty (AUD-028)                                          | Draft — pending lawyer/DPO review |
| [`dpo-appointment.md`](./dpo-appointment.md)             | Why a DPO is required, tasks, independence, external DPO selection checklist, draft appointment letter, CNPD notification steps | Draft — pending lawyer/DPO review |
| [`ers-position.md`](./ers-position.md)                   | Memo: Eleva as intermediary vs ERS registration, health advertising, triggers, experts' own obligations                         | Draft — pending lawyer/DPO review |
| [`breach-response.md`](./breach-response.md)             | Personal data breach procedure (arts. 33–34), severity matrix, CNPD, expert and member templates                                | Draft — pending lawyer/DPO review |
| [`positions-d06-d11-d12.md`](./positions-d06-d11-d12.md) | Position papers for D-06 (refunds, no-shows, chargebacks), D-11 (clinical access) and D-12 (deletion vs retention)              | Draft — pending lawyer/DPO review |
| [`experts-dpa-checklist.md`](./experts-dpa-checklist.md) | Art. 28(3) checklist for the expert processor terms, with a gap list against `trust/pt/dpa.mdx`                                 | Draft — pending lawyer/DPO review |

## Founder decisions these documents rely on (2026-10-29)

1. Eleva is an **intermediary** only and does not deliver care. Experts are
   independent, hold their own ERS registration and invoice members. Eleva
   does not register with the ERS as a provider.
2. An **external DPO service** will be appointed (GDPR art. 37(1)(c)). The
   provider is not yet named.
3. **D-06 "balanced".**
   - A member no-show counts as a late cancellation under the service tier.
   - An expert no-show or expert cancellation gives a 100% refund, including
     Eleva's fee, plus an offer to rebook.
   - Chargebacks: if the session was not delivered, the amount is recovered
     from the expert's transfer. If it was delivered, Eleva contests with the
     join and attendance logs.
4. Only **regulated** health professionals, with a licence verified against
   their Ordem, may sell at launch.
5. Promotion codes are **Eleva-funded**. The expert's share is computed on the
   list price.

## How to maintain

- When a fact changes, change it in [`fact-sheet.md`](./fact-sheet.md) first.
  Then update the RoPA, the DPIA and the retention schedule in the same PR.
- Every document ends with "Points for lawyer/DPO review". When a point is
  resolved, record the outcome in `docs/eleva-v3/decision-log.md` and remove
  the point.
- `[[FOUNDER INPUT: …]]` marks a fact only the founder can supply. Never
  replace it with a guess.
- Never commit the names, NIFs or personal details of shareholders or managers,
  or the Certidão access code (fact sheet §1).
