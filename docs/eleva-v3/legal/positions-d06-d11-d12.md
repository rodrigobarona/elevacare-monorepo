# Position papers: D-06, D-11, D-12

> **Draft for review by a Portuguese lawyer and the external DPO. Not legal advice. "Signed-ready" means each paper has a decision, a legal basis and a sign-off block. None is signed yet.**

These papers turn the founder's working pre-launch decisions into positions
that can be signed for production. The decisions are recorded in
`docs/eleva-v3/decision-log.md`: D-06, D-11, D-12, the 2026-10-29 entry "Launch
legal posture", and the 2026-10-30 entry for provisional rules and open
decisions. [`fact-sheet.md`](./fact-sheet.md) quotes them for the public pages;
the decision log stays the record of the decision. Signing is Eleva's decision
as controller; the DPO's row records advice, not approval. Once a paper is
signed, update the decision-log entry from "working pre-launch" to "active —
signed" and link the signed copy.

---

## D-06: Refunds, no-shows and chargebacks

### Decision (founder, 2026-10-29, "balanced")

1. **Member cancellation.** The refund follows the service's tier. The booking
   stores the policy, and `resolveCancellationRefund` computes the refund
   (`@eleva/config/cancellation-policy.ts`, tier table version 1):
   - **Flexible:** 100% if cancelled ≥ 24 h before; 0% after that.
   - **Moderate:** 100% ≥ 48 h; 50% between 24 and 48 h; 0% after that.
   - **Strict:** 100% ≥ 7 days; 50% between 48 h and 7 days; 0% after that.
   - **Grace:** 100% within 24 h of booking if the session is at least 48 h
     away. A cancel exactly on a boundary gets the higher refund.
   - **Awaiting expert confirmation:** a request-to-book booking that the
     expert has not confirmed refunds 100% of what is still refundable.
2. **Member no-show** is treated as a cancellation at the start time under the
   service's tier. In every tier that means **no refund**.
3. **Expert no-show or expert cancellation** (any time). The member gets
   **100%, including Eleva's fee**, and is **offered a rebooking**.
4. **Chargebacks:**
   - **Session not delivered:** Eleva accepts or refunds, and recovers the
     expert's share from the expert's transfer. The transfer is reversed if
     already made. If it is already paid out, the amount is deducted from
     future transfers.
   - **Session delivered:** Eleva contests the chargeback with the join and
     attendance logs.
5. **Promotion codes** are Eleva-funded (decision 5). The refund is a
   percentage of what the member actually paid. The expert's share is
   computed on the list price.

### Facts the position relies on

- The policy is shown before payment. The hold records the policy displayed.
- The booking stores the policy name and `cancellation_policy_version`.
  **The stored version does not drive the refund.** `resolveCancellationRefund`
  takes the policy name and reads the current tier table; the version is only
  written to the audit payload. Only version 1 exists, so refunds match what
  was shown today. Editing a tier table would change refunds on existing
  bookings, so quote, cancel and reschedule must read versioned rules before
  any tier edit ships.
- `409 POLICY_CHANGED` fires only when the caller sends a `cancellationPolicy`
  that differs from the service's current policy name. The field is optional,
  and a version change under the same name does not trigger it.
- The member sees a refund quote before cancelling
  (`GET /me/bookings/{id}/cancellation-quote`).
- Refunds above €200 require dual control (AUD-022).
- Attendance comes from Daily `meeting.*` and `participant.*` webhooks, with a
  fallback after the join window (decision log 2026-10-07 and 2026-10-08).
- **Not built yet:**
  - the expert-cancel path (decision log 2026-09-26);
  - no-show outcome handling;
  - the rebooking offer;
  - versioned tier rules for existing bookings.
    These must ship before this paper is signed as "implemented".

### Legal analysis

**1. Withdrawal rules do not apply to the session.** DL 24/2014 (distance
contracts) does not apply arts. 4–21 to "contratos relativos a serviços de
cuidados de saúde, prestados ou não no âmbito de uma estrutura de saúde"
(contracts for health-care services, inside or outside a health structure).
That is **art. 2(3)(f)** in the current consolidated text, as amended by DL
109-G/2021 and Lei 10/2023. The fact sheet cites it as art. 2(2) and should be
corrected.

Consequences:

- the member–expert contract carries no 14-day withdrawal right;
- the pre-contractual information duties of DL 24/2014 do not apply to it;
- arguably, the online-marketplace duties of art. 4-A do not apply either.

Eleva still discloses who the trader is and how obligations are shared,
because it is good practice and because of DL 57/2008 as amended. Eleva's own
service to members is free of charge to them; its fee is charged to the
expert. If Eleva's intermediation is treated as a separate contract, the art.
17(1)(a) exception still covers fully performed services.

**2. Unfair-terms control applies in full.** Cancellation and no-show terms
are **standard contract terms** (DL 446/85) in a **consumer** relationship
(Lei 24/96).

- **DL 446/85 art. 19(c).** Terms that "consagrem cláusulas penais
  desproporcionadas aos danos a ressarcir" (impose penalties out of proportion
  to the loss) are relatively prohibited. Art. 20 extends this to consumer
  contracts.
- **DL 446/85 art. 22(1)(l).** Terms that "imponham antecipações de
  cumprimento exageradas" (require excessive advance performance) are
  relatively prohibited in consumer contracts. Full prepayment at booking is
  normal for appointment services and is refundable under the tier, so it
  should pass.
- **DL 446/85 art. 15.** Terms contrary to good faith are prohibited.
- **Lei 24/96 art. 9(2)(b).** No "significativo desequilíbrio em detrimento
  do consumidor" (significant imbalance against the consumer).
- **Lei 24/96 art. 8(1).** Clear information on price and on "as
  consequências do não pagamento".
- **Lei 24/96 art. 9-A.** Any additional payment needs express prior consent.
  That is not relevant here: no extra fee is charged on a no-show; the member
  only loses the prepaid amount.

**Why the tiers are proportionate:**

- The slot is reserved exclusively for the member.
- Short-notice health appointments are rarely resold. The loss to the expert
  is close to the full fee, and grows as the session approaches.
- The tiers step down gradually (100/50/0) and are disclosed before payment,
  with a grace period.
- The position is **reciprocal**: the expert's failure gives a 100% refund,
  including Eleva's fee.
- Reschedule is allowed while a cancel would still be refunded in full.

**Weak points to manage:**

- **Strict tier.** 0% under 48 h and 50% up to 7 days ahead may be found
  disproportionate for low-volume or high-price services. It is also
  sensitive in health care, where illness is a foreseeable reason to cancel.
  - Mitigation options for the lawyer:
    - limit Strict to services where the expert documents a real
      preparation cost or a long session;
    - add a one-time illness exception per member per expert;
    - let the expert waive the penalty.
  - The decision log already lists the Strict legal review as outstanding.
- **No-show detection errors.** Technical failures must not count as a member
  no-show. **Rule:**
  - If Daily or Eleva fails (room not created, webhook gap, platform
    incident), the session is treated as **not delivered**: 100% refund.
  - If the member joined and the expert did not, it is an expert no-show.
  - If neither joined, Eleva reviews the case manually; the default is a
    member no-show only if the expert joined within the window.
  - **In-person sessions** have no Daily evidence. The expert marks the
    outcome, the member can dispute it, and staff decide.
- **Transparency.** The terms of use and the payments page must state the
  no-show rule, in plain language, before payment. Text size must respect
  DL 446/85 art. 21(i) (font of at least size 11 / 2.5 mm, line spacing of at
  least 1.15), which applies to written consumer contracts. Check the web
  rendering.

**3. Chargebacks are card-scheme disputes, not statutory rights.**

- DL 91/2018 (RJSPME) gives the payer refund rights against **their own
  payment provider**:
  - unauthorised transactions: art. 114, refund by the end of the next
    working day; claims within 13 months under art. 112;
  - pre-authorised direct debits: arts. 117–118.
- Disputes such as "service not as described" or "not received" are card
  network rules applied through Stripe.
- Contesting a chargeback where the service was delivered is lawful. The
  evidence must be minimised (see §4 below).
- Recovering the expert's share when the session was not delivered follows
  from the expert agreement. **It must be written there**: right of set-off
  against future transfers, and transfer reversal. The current expert
  agreement does not say this.

**4. Data protection in disputes.**

- Sending attendance evidence to Stripe and the card network relies on
  art. 6(1)(f) and art. 9(2)(f) (establishment, exercise or defence of legal
  claims). The fact of attending a health session is health-related.
- **Minimise:**
  - booking id, service name **without the clinical specialty if possible**,
    date, price;
  - policy shown and accepted (version and timestamp);
  - join and leave timestamps of both parties.
- **Never send:** notes, transcripts or documents.
- Retention: attendance metadata is kept with the booking for 10 years
  ([`retention-schedule.md`](./retention-schedule.md)).

### Position

The balanced D-06 is **defensible** under DL 446/85 and Lei 24/96 if all of
the following hold:

- (a) tiers and the no-show rule are disclosed before payment, and each
  booking keeps the rules it was sold under (true today only while a single
  tier-table version exists);
- (b) technical failures are never charged to the member;
- (c) the Strict tier is reviewed or narrowed;
- (d) the expert agreement provides for recovering refunds and chargebacks;
- (e) expert no-show and expert cancel are refunded at 100% including the fee.

### Sign-off

| Role               | Name                                      | Date | Signature |
| ------------------ | ----------------------------------------- | ---- | --------- |
| Founder            | `[[FOUNDER INPUT]]`                       |      |           |
| Finance            | `[[FOUNDER INPUT: accountant / finance]]` |      |           |
| Lawyer             | `[[FOUNDER INPUT: counsel]]`              |      |           |
| DPO (advice on §4) | `[[FOUNDER INPUT: DPO]]`                  |      |           |

---

## D-11: Clinical access model

### Decision (working pre-launch, re-stated for signature)

1. Expert-authored records are readable and writable by their **author
   only**: RLS on `records`, migration 0061.
2. Members read:
   - published reports;
   - documents shared with them (`scope=shared`);
   - documents they uploaded.

   **Internal reports, notes and transcripts are not shown to the member in
   the app.**

3. Within a clinic, other experts may read a record only if:
   - the clinic admin enabled `clinic_shared_records` (default off, reason
     required, audited); and
   - the member has not opted out (`/me/record-access-optouts`).

   The SELECT policy is compiled but inactive. The toggle comes in Phase 11.

4. **Eleva staff never read plaintext:**
   - metadata only;
   - every staff read is audited;
   - break-glass decryption is a future Phase 12 dual-control action and does
     not exist today.
5. Reads are audited as `record.decrypted`: 100% for staff and members, **1%
   sampled for the owning expert**.

### Legal analysis

- **Need-to-know and secrecy.**
  - Lei 58/2019 art. 29(1): access to health data follows the need-to-know
    principle.
  - Art. 29(2): processing under art. 9(2)(h) must be done by a professional
    bound by secrecy, or another person under a duty of confidentiality.
  - Art. 29(4): the duty extends to the controller's service providers, so to
    Eleva and its staff.
  - Lei 12/2005 art. 5(5): the processo clínico may be consulted only by the
    treating clinician, or under supervision by another professional bound by
    secrecy, as strictly necessary.
  - Author-only reads plus no staff plaintext implements these rules
    directly.
- **Security by design.**
  - GDPR arts. 25 and 32.
  - Lei 12/2005 art. 4(5): systems must separate health information from
    other personal data through "diversos níveis de acesso" (several access
    levels).
  - Per-organisation envelope encryption (ADR-020) plus RLS meets this.
- **Personal notes.** The professional codes allow the professional to keep
  personal or subjective notes out of what the patient receives:
  - Regulamento de Deontologia Médica art. 40(4) (expurgar anotações
    pessoais);
  - OPP Código 5.7 (notas pessoais);
  - Ordem dos Fisioterapeutas Regulamento 457/2023 art. 10(3)(f).

  The unpublished internal report fits this category **only where it really
  is personal annotation**.

- **Member access rights.**
  - The member has a right of access to the **whole** processo clínico (Lei
    12/2005 art. 3(2)–(3), as amended by Lei 26/2016; GDPR art. 15), subject
    to the narrow exceptions.
  - The duty belongs to the **expert-controller**. Eleva must give the expert
    a way to answer: an export of the member's records, including internal
    reports and transcripts, art. 28(3)(e).
  - **"Never member-visible in the app" must not become "never disclosed".**
    The DSAR runbook exports only published reports for the member's own
    request. Requests about expert-authored content are routed to the expert.
- **Clinic sharing (Phase 11).**
  - Sharing a record with other professionals of the same clinic is a
    further disclosure by the controller (the clinic).
  - It needs:
    - a basis (art. 9(2)(h) continuity of care within the clinic);
    - information to the member;
    - the opt-out already built.
  - Update the DPIA before switching it on.
- **Access notification.**
  - Lei 58/2019 art. 29(6): "o titular dos dados deve ser notificado de
    qualquer acesso realizado aos seus dados pessoais" (the data subject must
    be notified of any access to their data).
  - Art. 29(7) foresees an electronic log of accesses and of the data
    accessed.
  - **Sampling the owning expert's reads at 1% does not produce a complete
    access log.**
  - Proposal for the DPO:
    - log 100% of reads by anyone other than the author;
    - keep 100% author reads as well, as aggregated per-day entries to limit
      volume;
    - give the member a view of who accessed their records.
  - This does not change the access model, only its traceability.
- **Break-glass.**
  - It does not exist. Until Phase 12 ships dual control, Eleva has **no
    technical path** to plaintext. That is the strongest position, but it
    means Eleva cannot help in an emergency or a court order. The answer in
    that case is: the expert, or decryption by key custodians under a
    documented legal order.
  - Document that procedure before launch.

### Position

D-11 is **compliant by design and recommended for signature**, with three
conditions:

- (1) full access logging for non-author reads, plus a decision on author
  reads (art. 29(6)–(7));
- (2) an expert-side export so experts can answer member access requests to
  the whole record;
- (3) a written procedure for legal orders until break-glass exists.

### Sign-off

| Role         | Name                     | Date | Signature |
| ------------ | ------------------------ | ---- | --------- |
| Founder      | `[[FOUNDER INPUT]]`      |      |           |
| DPO (advice) | `[[FOUNDER INPUT: DPO]]` |      |           |

---

## D-12: Account deletion vs legal retention of clinical records

### Decision (working pre-launch, re-stated for signature)

When a member asks to delete their account, deletion runs after a **14-day
grace period** (`ACCOUNT_DELETION_GRACE_DAYS`):

1. **Account data** is erased.
2. **Account-scope consents** (`booking_id IS NULL`: marketing, account terms
   and privacy) are erased.
3. **Booking-scope consents** are **pseudonymised**:
   - `user_id` → NULL;
   - `subject_pseudonym` = HMAC-SHA256 of the former user id under
     `RETENTION_PSEUDONYM_KEY`;
   - `guest_email_hash` → NULL.

   They are then kept for the clinical-record period. The code sets no end
   date or sweep for them today.

4. **Member-authored records**, including the booking-form intake, are
   **deleted**. This is today's behaviour: `eraseMemberClinicalRecords` deletes
   every row the member wrote and every `kind = "intake"` row. Whether that
   stays the rule once a session has taken place is **open** (decision D-12-A
   below).
5. **Expert-authored records** are kept: `member_user_id` → NULL and the same
   `subject_pseudonym` is set. They stay under the clinical retention
   exception until the period in [`retention-schedule.md`](./retention-schedule.md)
   ends.
6. **Session documents:**
   - member-uploaded and shared documents are deleted (Blob first, then the
     row);
   - expert-only files lose `member_user_id`.
7. **CRM:** the member's contacts and follow-ups are deleted.
8. **Booking and payment records** required for tax are kept for 10 years,
   with identity minimised.
9. The deletion UI says, in plain language, that the expert's clinical records
   are kept by law.

### Legal analysis

- **Art. 17 has limits.** The right to erasure (art. 17(1)) does not apply
  to the extent processing is necessary:
  - **(b)** for compliance with a legal obligation under Union or Member
    State law;
  - **(c)** for reasons of public interest in public health under art.
    9(2)(h), (i) and 9(3);
  - **(e)** for legal claims.

  Lei 58/2019 art. 21(5) adds that where a legal retention period applies,
  erasure can be exercised only after it ends.

- **Which legal obligation?** Portuguese law sets no general clinical
  retention period
  ([`retention-schedule.md`](./retention-schedule.md) §1). The obligation
  comes from:
  - the **professional codes**, which are regulamentos of public professional
    associations published in the Diário da República. For example, OPP
    Regulamento 898/2024 §5.5 requires a minimum of 5 years. These are
    arguably "Member State law" for art. 17(3)(b).
  - the record-keeping duties in Lei 12/2005 arts. 4–5;
  - art. 17(3)(e) for professional liability claims: Código Civil arts. 309
    and 498.

  Tax obligations (CIVA art. 52; CIRC art. 123) cover the payment and booking
  records.

- **Whose decision is it?** For clinical records Eleva is **processor**.
  Erasure requests about them are for the **expert-controller** to decide
  (art. 28(3)(e)). D-12's automatic retention is a **default instruction**
  from controllers to Eleva. It must therefore be written in the processor
  terms ([`experts-dpa-checklist.md`](./experts-dpa-checklist.md)). The member
  must be told to contact the expert for erasure of the clinical record, and
  the expert must be able to delete early where their rules allow.
- **Pseudonymisation is not anonymisation.**
  - Pseudonymised data remains personal data (GDPR recital 26; art. 4(5)).
  - The kept rows remain subject to the GDPR, encryption and access control.
    The UI must not say they are "anonymised".
  - The HMAC key must be held separately from the data and access-restricted.
    Rotating it breaks linkage for the existing rows.
- **Member-authored content.**
  - Deleting member-authored rows on request respects art. 17(1).
  - The open question is the intake: if the expert relied on it, it may form
    part of the processo clínico (Lei 12/2005 art. 5(2): "qualquer registo
    … que contenha informação de saúde").

  **Open decision D-12-A (founder, on DPO and lawyer advice).** Does an intake
  survive a member's deletion request once a session has taken place?
  - **Option 1, today's rule:** delete every intake. No code change. The risk
    is deleting part of a record the expert must keep.
  - **Option 2, drafter's proposal:** keep the intake with the expert-authored
    records once a session has taken place, and delete it if none did. This
    changes the `eraseMemberClinicalRecords` predicate and its tests,
    `data-retention-export-matrix.md`, the deletion UI copy and the decision
    log.

  Until this is decided, Option 1 applies and D-12 is not ready for signature
  on this point.

- **Consent rows.**
  - Keeping booking-scope consents for the clinical period serves as proof of
    the art. 9(2)(a) consents (art. 7(1)) and of policy acceptance, which
    matters for D-06 disputes. Lei 58/2019 art. 21(3) applies.
  - Keep them only as long as the record they authorised, then delete them.

### Position

D-12 is **sound, and can be recommended for signature once four conditions are
met**:

- (1) the processor terms state the default retention instruction and the
  expert's right to delete early;
- (2) open decision D-12-A is taken, and the decision text,
  `eraseMemberClinicalRecords`, the retention schedule and the data-retention
  matrix all state the same rule;
- (3) the hard delete at the end of the period is scheduled (today it is not);
- (4) the deletion UI and privacy notice say "kept by your expert as required
  by law", not "anonymised".

### Sign-off

| Role         | Name                         | Date | Signature |
| ------------ | ---------------------------- | ---- | --------- |
| Founder      | `[[FOUNDER INPUT]]`          |      |           |
| DPO (advice) | `[[FOUNDER INPUT: DPO]]`     |      |           |
| Lawyer       | `[[FOUNDER INPUT: counsel]]` |      |           |

---

## Points for lawyer/DPO review

1. **D-06 Strict tier.** Proportionality under DL 446/85 art. 19(c) for
   health services. Is an illness exception or an expert-waiver needed?
2. **D-06 no-show = late cancellation (0%).** Confirm it is not a
   disproportionate penalty where the expert's time is genuinely lost.
   Confirm the technical-failure carve-out.
3. **D-06 Eleva's intermediation service.** Does it constitute a separate
   consumer contract, with DL 24/2014 duties of its own, given the art.
   2(3)(f) exclusion for the session?
4. **D-06 expert agreement.** Add set-off and transfer-reversal clauses for
   refunds and chargebacks.
5. **D-06 dispute evidence.** Confirm the minimisation rule for evidence sent
   to Stripe and the card networks.
6. **D-11 access logging.** What Lei 58/2019 art. 29(6)–(7) requires in
   practice; whether the art. 29(7) portaria exists.
7. **D-11 internal reports.** Are internal reports "personal annotations"
   that can be withheld from the member, or part of the clinical record that
   must be disclosed on request?
8. **D-12 legal obligation.** Do the Ordens' regulamentos count as "Member
   State law" for art. 17(3)(b)? Is art. 17(3)(e) needed as an additional
   ground?
9. **D-12 intake rule.** Advice for open decision D-12-A: must an intake the
   expert relied on be kept as part of the clinical record?

## Sources

- DL 24/2014, consolidated:
  <https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=2062&tabela=leis>
- Lei 24/96, consolidated:
  <https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=726&tabela=leis>
- DL 446/85, consolidated:
  <https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=837&tabela=leis>
- DL 91/2018 (RJSPME):
  <https://www.bportugal.pt/sites/default/files/anexos/legislacoes/335415275_3.docx.pdf>
- Lei 12/2005:
  <https://files.diariodarepublica.pt/1s/2005/01/018a00/06060611.pdf>
- Lei 58/2019 arts. 21, 29:
  <https://files.diariodarepublica.pt/1s/2019/08/15100/0000300040.pdf>
- Regulamento de Deontologia Médica (Regulamento n.º 707/2016):
  <https://www.omsul.pt/Portals/0/docs/regulamento-de-deontologia-medica.pdf>
- OPP Código Deontológico (Regulamento n.º 898/2024):
  <https://www.ordemdospsicologos.pt/ficheiros/documentos/opp_codigodeontologico_2024.pdf>
- Ordem dos Fisioterapeutas Código Deontológico (Regulamento n.º 457/2023):
  <https://ordemdosfisioterapeutas.pt/wp-content/uploads/2023/05/codigo-dre.pdf>
- GDPR arts. 4(5), 7, 9, 15, 17, 25, 28, 32; recital 26:
  <https://eur-lex.europa.eu/eli/reg/2016/679/oj>
