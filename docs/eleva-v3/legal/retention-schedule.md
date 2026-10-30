# Retention schedule (proposed for adoption on DPO advice — AUD-028)

> **Draft for review by a Portuguese lawyer and the external DPO. Not legal advice. Engineering values stay "working pre-launch" until Eleva adopts this schedule on the DPO's advice.**

This schedule proposes **final** retention periods for each data category,
with the legal basis and whose duty each period is. Once adopted:

- update `docs/eleva-v3/data-retention-export-matrix.md`;
- update the retention table in [`fact-sheet.md`](./fact-sheet.md) §4;
- update the constants in `packages/compliance/src/retention.ts`;
- update the public privacy and health-data pages.

## 1. Legal framework

### 1.1 General rules

- **GDPR art. 5(1)(e).** Keep data no longer than necessary for the purpose.
- **Lei 58/2019 art. 21:**
  - **n.º 1:** where a law or regulation sets a period, that period applies.
    Otherwise, keep the data for as long as the purpose requires.
  - **n.º 3:** data that the controller **or processor** needs to prove it met
    contractual or other obligations may be kept "enquanto não decorrer o
    prazo de prescrição dos direitos correspetivos" (until the limitation
    period for the related rights has expired).
  - **n.º 4:** once the purpose is spent, destroy or anonymise.
  - **n.º 5:** where a legal retention period applies, the right to erasure
    can be exercised only after it ends.
- **GDPR art. 17(3)(b), (c) and (e):** legal obligation, public health, and
  legal claims limit erasure. See
  [`positions-d06-d11-d12.md`](./positions-d06-d11-d12.md) §D-12.
- **GDPR art. 28(3)(g).** As processor, Eleva deletes or returns personal data
  at the end of the service, at the controller's choice, unless EU or Member
  State law requires storage.

### 1.2 Clinical records: there is no general statutory period

Portuguese law sets **no general statutory retention period** for clinical
records held by private providers.

- **Lei 12/2005:**
  - art. 3(1): health information "é propriedade da pessoa" (belongs to the
    person). Providers are custodians ("depositários").
  - art. 4: duties of security, separation of data and backups.
  - art. 5: defines the processo clínico.
  - The law sets no conservation period for clinical records.
- **Lei 95/2019 (Lei de Bases da Saúde), Base 15:** the same ownership
  principle. No period.
- **Portaria 247/2000, as amended by Portaria 157/2014:** archival tables for
  **hospitals and services of the Ministry of Health only**. A secondary source
  reports 4 years active, 1 year semi-active, then permanent conservation. Not
  verified in the primary annex. Does not bind private professionals.
- **Portaria 287/2012 art. 7 (private clinics and consultórios), as amended by
  Portaria 136-B/2014:** clinical files must be kept "durante os períodos
  constantes da lei vigente" (for the periods in force under the law). This
  points back to a law that sets no number.

### 1.3 Clinical records: the professional codes

The only explicit floors come from the codes of the Ordens:

| Profession      | Rule                                                                                                                                                                           | Period                                                                                                                         | Source                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Psychologist    | Código Deontológico OPP (Regulamento n.º 898/2024), 5.5: records "devem ser guardados durante o período mínimo de 5 anos depois da conclusão da intervenção"                   | **≥ 5 years after the intervention ends**                                                                                      | <https://www.ordemdospsicologos.pt/ficheiros/documentos/opp_codigodeontologico_2024.pdf>                                                       |
| Nurse (liberal) | Estatuto da OE (Lei 156/2015) art. 97(1)(c): "guardar e zelar pelos registos de enfermagem realizados no âmbito do exercício profissional liberal, pelo período de cinco anos" | **5 years** (confirm this survived the 2023–2024 statute revisions)                                                            | <https://www.ordemenfermeiros.pt/arquivo/publicacoes/Documents/nEstatuto_REPE_29102015_VF_site.pdf>                                            |
| Physician       | Regulamento de Deontologia Médica (Regulamento n.º 707/2016), arts. 39–40, 43, 46–49. Duty to record and keep records safe. No period.                                         | None in law. OM-Sul legal FAQ **advises 20 years** (the ordinary limitation period, CC art. 309) or indefinite digital keeping | <https://www.omsul.pt/Portals/0/docs/regulamento-de-deontologia-medica.pdf>; <https://www.omsul.pt/Portals/0/docs/FAQ-ACESSO-A-INFORMACAO.pdf> |
| Physiotherapist | Código Deontológico (Regulamento n.º 457/2023) art. 10(4)(a), (10): retain and delete "respeitando a legislação em vigor"                                                      | None                                                                                                                           | <https://ordemdosfisioterapeutas.pt/wp-content/uploads/2023/05/codigo-dre.pdf>                                                                 |
| Nutritionist    | Código Deontológico (Regulamento n.º 587/2016) art. 7(3): the client is told "o tempo que essa informação será conservada"                                                     | None. The professional sets the period and discloses it.                                                                       | <http://www.ordemdosnutricionistas.pt/documentos/legislacao/em_vigor/8-Codigo-Deontologico-5872016.pdf>                                        |

### 1.4 Limitation periods (Código Civil)

These are relevant to evidence under Lei 58/2019 art. 21(3):

- art. 309: **20 years**, the ordinary period. This includes contractual
  liability of a health professional.
- art. 498(1): **3 years** from knowledge for tort, subject to the 20-year
  outer limit.
- art. 310: **5 years** for periodic payments.
- art. 317(c): **2 years** presumptive limitation for liberal-profession fees.
- Case law is split on whether medical liability is contractual (20 years) or
  tort (3 years).

### 1.5 Tax and accounting

- **CIRC art. 123(4):** books, accounting records and supporting documents are
  kept for 10 years.
- **CIVA art. 52(1):** "durante os 10 anos civis subsequentes" (during the 10
  following calendar years).
- **DL 28/2019:** invoice archiving rules. Electronic archive allowed.
- **Código Comercial art. 40:** 10 years for commercial correspondence and
  records.

### 1.6 AML

**AML (Lei 83/2017 art. 51, 7 years)** does not apply. Eleva is not an obliged
entity; Stripe holds the AML duty as the payment institution. This changes if
Eleva itself ever holds client funds.

## 2. Who owns which period

- **The expert's duty, as controller.** The clinical retention period belongs
  to each expert or clinic.
  - The code of their Ordem sets a floor, or requires them to choose and
    disclose one.
  - Eleva, as processor, keeps records **on the expert's instruction**
    (art. 28(3)(a)).
  - Eleva offers a **platform default** so that an expert who gives no
    instruction is still covered. The default must satisfy the strictest
    floor, which is 5 years for psychologists and nurses.
- **Eleva's own duty, as controller.** Everything in RoPA C1–C13: accounts,
  bookings, payments, invoices, consents, logs and support.

## 3. Proposed schedule

"Proposed" is the value for the DPO's advice and Eleva's decision. "Today" is what the code or the
fact sheet does now.

### 3.1 Clinical content (Eleva as processor; expert decides)

| Data                                                                          | Proposed period                                                                                                                                                                                                                                                                                                              | Trigger                                       | Legal basis                                                                                                                  | Today                                                                                                                                    | Owner                                   |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Expert-authored records: notes, internal report, published report, transcript | **Platform default 7 years** after the **last session between that expert and that member**. The expert may set a longer period per organisation (e.g. physicians up to 20 years) or a shorter one that is not below their Ordem's floor. Hard delete at the end, after a 90-day notice to the expert with an export option. | Last completed session per expert–member pair | Art. 28(3)(a), (g). OPP Reg. 898/2024 §5.5 (≥ 5 years). OE Estatuto art. 97(1)(c). Lei 58/2019 art. 21(1), (3). CC art. 498. | 7 years (fact sheet). No hard delete scheduled for expert-authored records. `compliance-data-governance.md` says 10 years "ERS-aligned". | Expert                                  |
| Member-authored records and member uploads                                    | Same as the row above while the account exists. **Deleted on member account deletion** (D-12), including every intake row, which is what `eraseMemberClinicalRecords` does today. Open decision D-12-A: whether an intake is kept with the clinical record once a session has taken place.                                   | Account deletion due date                     | Art. 17(1). Art. 17(3)(b) if D-12-A keeps any part.                                                                          | Deleted on account deletion                                                                                                              | Expert / member                         |
| Session documents (private Blob)                                              | Same rule as expert-authored records: **7 years after the last session**, not after upload                                                                                                                                                                                                                                   | Last session                                  | As above                                                                                                                     | 7×365 days after **upload** (`createdAt`)                                                                                                | Expert                                  |
| Transcripts                                                                   | Part of the record, same period. The expert may delete earlier once a report is written, if their professional rules allow.                                                                                                                                                                                                  | As above                                      | As above                                                                                                                     | Stored in the record. `compliance-data-governance.md` says 2 years.                                                                      | Expert                                  |
| Unpublished AI drafts                                                         | **90 days** after last change                                                                                                                                                                                                                                                                                                | `updated_at`                                  | Art. 5(1)(c), (e). A draft is not a clinical record until the expert adopts it.                                              | 90 days (sweep)                                                                                                                          | Eleva default; expert can delete sooner |
| Expert CRM contacts and follow-ups                                            | While the expert's organisation is active. Member contacts are deleted on member account deletion.                                                                                                                                                                                                                           | Org closure / member deletion                 | Art. 28(3)(g)                                                                                                                | As proposed                                                                                                                              | Expert                                  |
| All clinical content when an **expert leaves**                                | Export offered for 90 days. After that, Eleva continues to hold records only under a written instruction from the expert, or from the Ordem where the code requires it (OM art. 43; OF art. 10(11)), until the period ends. Then crypto-shred.                                                                               | Expert account closure                        | Art. 28(3)(g). Professional codes on records after a professional stops practising.                                          | Not defined                                                                                                                              | Expert, Eleva executes                  |

### 3.2 Eleva's own data (Eleva as controller)

| Data                                                          | Proposed period                                                                                                                                              | Trigger               | Legal basis                                                                                        | Today                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Account profile                                               | While the account exists, plus the 14-day deletion grace period. Then erased, or pseudonymised where another row must be kept.                               | Deletion request      | Art. 6(1)(b). Art. 17.                                                                             | As proposed                                |
| Unverified guest accounts and Spaces never used               | **24 months** after the last booking reaches a terminal state, then anonymised (Phase 13 sweep)                                                              | Last booking terminal | Art. 5(1)(e)                                                                                       | Kept (planned Phase 13 sweep)              |
| Booking and attendance metadata                               | **10 years** from the end of the year of the session                                                                                                         | Session date          | Source document for payments and invoices (CIRC art. 123(4); CIVA art. 52(1)). Art. 17(3)(b), (e). | Not swept                                  |
| Payments, refunds, disputes, payouts                          | **10 years** from the end of the financial year                                                                                                              | Transaction date      | CIRC art. 123(4); CIVA art. 52(1); CCom art. 40                                                    | 10 years                                   |
| Eleva invoices (ELEVA-FEE, SaaS) and accounting               | **10 years** after the end of the year                                                                                                                       | Document date         | CIVA art. 52(1); CIRC art. 123(4); DL 28/2019                                                      | 10 years                                   |
| DAC7 seller records                                           | `[[FOUNDER INPUT / accountant: period under Lei 36/2023 / DL 61/2013 — Directive 2021/514 requires 5–10 years]]`; propose 10 years to align with tax records | Reporting period      | Art. 6(1)(c)                                                                                       | Not defined                                |
| Funnel consents (booking scope)                               | Same period as the clinical record they authorised (D-12), pseudonymised after account deletion                                                              | As clinical row       | Art. 7(1) proof. Lei 58/2019 art. 21(3).                                                           | Pseudonymised; no end date                 |
| Account-scope consents (marketing, account terms and privacy) | While relied on. Erased on account deletion (D-12). Proof of **marketing** consent kept **3 years** after withdrawal.                                        | Withdrawal / deletion | Art. 7(1). Lei 58/2019 art. 21(3). CC art. 498.                                                    | Erased on deletion                         |
| `ai_processing` consent                                       | Same as the transcripts and drafts it authorised                                                                                                             | As clinical row       | Art. 7(1), art. 9(2)(a)                                                                            | Booking- or account-scoped per row         |
| Cookie consent records (c15t)                                 | **12 months** for the choice (re-prompt after that). Proof kept 3 years.                                                                                     | Choice date           | Lei 41/2004 art. 5. Art. 7(1).                                                                     | Not live                                   |
| Notification delivery logs                                    | **365 days**                                                                                                                                                 | `created_at`          | Art. 6(1)(f): delivery disputes and abuse                                                          | 365 days (sweep)                           |
| Email suppression list                                        | While needed to honour the suppression (hashed if possible)                                                                                                  | —                     | Lei 41/2004 art. 13-A                                                                              | Kept                                       |
| Expert licence verification evidence                          | Relationship + **5 years**                                                                                                                                   | Account closure       | Art. 6(1)(f). DL 238/2015 art. 8 offence limitation (proposal)                                     | Not defined                                |
| Support tickets and complaints                                | **3 years** after closure; longer while a dispute is open                                                                                                    | Ticket closure        | CC art. 498(1). Lei 58/2019 art. 21(3).                                                            | Not defined                                |
| Livro de Reclamações replies                                  | **3 years**                                                                                                                                                  | Reply date            | DL 156/2005                                                                                        | Not defined                                |
| DSAR requests (log) and DSAR export zip                       | Log **3 years** after closure. Zip deleted on expiry (24 hours after ready).                                                                                 | Request closure       | Art. 5(2) accountability. Lei 58/2019 art. 21(3).                                                  | Zip deleted on expiry; log not swept       |
| Audit events (`audit_events`)                                 | **10 years**, redacted allowlist only                                                                                                                        | `created_at`          | Art. 5(2). Art. 17(3)(b), (e). Aligned with the 10-year financial record.                          | 10 years (`compliance-data-governance.md`) |
| Audit outbox (shipped rows)                                   | **90 days**                                                                                                                                                  | Shipped               | Reconciliation                                                                                     | 90 days                                    |
| Security logs (rate-limit and auth events)                    | **12 months**                                                                                                                                                | Event                 | Art. 6(1)(f), art. 32                                                                              | Up to 1 year (fact sheet)                  |
| Sentry and operational logs                                   | **90 days**                                                                                                                                                  | Event                 | Art. 6(1)(f)                                                                                       | 90 days (vendor setting)                   |
| Marketing contacts                                            | Until withdrawal or **24 months** without engagement, then deleted                                                                                           | Last engagement       | Art. 5(1)(e)                                                                                       | Not defined                                |

## 4. Deletion mechanics to align

These are engineering follow-ups, not legal decisions:

1. Key the session-document sweep on **last session per expert–member pair**,
   not `createdAt`, so documents and notes expire together.
2. Schedule the hard delete (or crypto-shred) of expert-authored records at the
   end of the period. Today it is not scheduled.
3. Add a per-organisation retention setting, bounded below by the floor of the
   expert's profession. Notify the expert 90 days before deletion, with an
   export option.
4. Reconcile `compliance-data-governance.md` "Retention And Deletion (locked
   defaults)":
   - 10-year notes, "ERS-aligned": no ERS source was found;
   - transcripts 2 years.
     Point it to this schedule.
5. Add a sweep for account-scope consent proof, support tickets and DSAR logs
   at the periods above.

## Points for lawyer/DPO review

1. **Platform default of 7 years.** It covers the psychologist and nurse
   floors and has some margin. It is below the OM-Sul advice of 20 years for
   physicians. Two options:
   - accept 7 years plus a per-organisation override;
   - choose a 10-year default to match tax records.
2. **"After the last session" vs "after the end of the intervention"**
   (OPP §5.5). Is the last session a good proxy, or must the expert mark an
   intervention as closed?
3. **Physicians' records.** Should Eleva require physicians to set a period
   explicitly at onboarding?
4. **Intake.** Advice for open decision D-12-A
   ([`positions-d06-d11-d12.md`](./positions-d06-d11-d12.md)): should an intake
   the expert relied on be kept with the clinical record when the member
   deletes their account? Today every intake is deleted.
5. **Expert departure.** The path when an expert leaves and does not instruct
   Eleva. Can Eleva lawfully keep records for the remaining period as
   processor, or must it return them and delete? Art. 28(3)(g) "unless Union
   or Member State law requires storage" — does any law require Eleva to keep
   them?
6. **Nurses.** Confirm the OE Estatuto art. 97(1)(c) 5-year rule after the
   2023–2024 statute revisions. Confirm the Portaria 247/2000 annex (public
   sector only).
7. **Retention end dates** (end of year vs exact date) for tax records under
   CIVA art. 52(1) ("10 anos civis subsequentes").
8. **DAC7** retention period.
9. **Cookie consent re-prompt** at 12 months: confirm against current CNPD
   guidance.

## Sources

- Lei 58/2019 art. 21:
  <https://files.diariodarepublica.pt/1s/2019/08/15100/0000300040.pdf>
- Lei 12/2005:
  <https://diariodarepublica.pt/dr/detalhe/lei/12-2005-624463>
- Lei 95/2019:
  <https://diariodarepublica.pt/dr/detalhe/lei/95-2019-124417108>
- Portaria 247/2000:
  <https://diariodarepublica.pt/dr/detalhe/portaria/247-2000-276024>.
  Portaria 157/2014:
  <https://diariodarepublica.pt/dr/detalhe/portaria/157-2014-56152684>
- Portaria 136-B/2014 (amending Portaria 287/2012):
  <https://www.omd.pt/content/uploads/2017/12/portaria-136b-2014.pdf>
- Professional codes: see the table in §1.
- CIRC art. 123:
  <https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/circ_rep/Pages/irc123.aspx>
- CIVA art. 52:
  <https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/Pages/iva52.aspx>
- GDPR arts. 5, 17, 28: <https://eur-lex.europa.eu/eli/reg/2016/679/oj>
