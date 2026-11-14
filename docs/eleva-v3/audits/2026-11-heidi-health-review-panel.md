# What Eleva can learn from Heidi Health: review panel (2026-11-14)

**Question.** After Web Summit Lisbon the founder commissioned a 21-page public-evidence
audit of Heidi Health, an AI clinical scribe company, with a blueprint for "a Portugal-first,
EU-ready health marketplace"
([`_context/HeadiHealth/Heidi Health Audit Report.pdf`](../../../_context/HeadiHealth/Heidi%20Health%20Audit%20Report.pdf)).
Does it make sense for Eleva, and what should Eleva take from it?

**Answer.** The audit makes sense as a general framework, and its description of Heidi's
contracts is accurate. It was written without knowledge of this repo, so most of what it
tells a marketplace to do first already exists here: the ERS memo, RoPA, DPIA, breach
procedure, the published DPA and sub-processor list, per-organisation encryption and a
fail-closed AI gateway. On several points Eleva is already stricter than Heidi.

Its value for Eleva is narrower than its length suggests. Reading it against the code and
the legal pack surfaced **about twenty concrete gaps**, most of them small. Five matter most:

1. Eleva's promise not to train AI on member data lives in a notice, not in the contract,
   and is worded narrowly. Heidi's is a contract clause that survives de-identification.
2. The AI report prompt asks the model for `recommendations` and `redFlags`. That is the
   wording most likely to move a documentation aid towards medical-device software.
3. DAC7 tax reporting is promised to experts in the agreement and nothing is built for it.
4. No payment-services (PSD2) analysis exists for the Stripe funds flow.
5. Trust documents are good but hard to find: there is no trust index, no named route for
   sub-processor changes and no vulnerability disclosure page.

The audit also recommends things Eleva should not do now: a separate clinical database,
certification programmes, round-the-clock on-call, FHIR exports. Section 6 lists them.

## Method and limits

Five reviewers each read the audit and the repo on `main` at `ea0c85e7` through one
specialist lens. Three of them also checked claims against official web pages, including
[heidihealth.com/en-ie](https://www.heidihealth.com/en-ie) and its legal documents.

The reviewers are AI agents. They are **not** a substitute for the lawyer, the DPO, the
accountant, device counsel or an external penetration test, and section 5 lists what only
those people can decide. Nothing was run: findings come from reading code and documents.
The findings marked "hand-checked" were re-verified in the repo after the panel reported.
Web checks went through a fetch tool that summarises pages, and several regulatory facts
were confirmed from law-firm or government summaries rather than the official text; the
tables say which.

This report does not change the expert pilot invitation gate
([`decision-log.md`](../decision-log.md), 2026-11-06). Timing labels below are the panel's
recommendation. Adding any item to the gate is a founder decision.

## Scores

Each reviewer scored how useful the audit is **for Eleva** through their lens (0–10).

| Lens                                   | Score | One-line reason                                                                         |
| -------------------------------------- | ----- | --------------------------------------------------------------------------------------- |
| Privacy and contracts (GDPR / DPO)     | 5     | Eleva's own DPA checklist is sharper, but six contract points are still open            |
| Portuguese and EU regulation           | 4     | Eleva's legal pack goes further on ERS, DSA and DAC7; three useful prompts remain       |
| Security architecture and assurance    | 6     | Good control checklist; about eight controls have a plan here but no enforcement yet    |
| Clinical AI (MDR and AI Act)           | 5     | Right principles, mostly already built; exposes five or six gaps before AI is turned on |
| Heidi fact-check and trust: usefulness | 6     | The "evidence discipline" lesson is right; much of the rest is enterprise procurement   |
| Heidi fact-check and trust: accuracy   | 8     | Every DPA and Product Terms claim that could be opened checks out                       |

## 1. Does the audit make sense?

**What it gets right.**

- Its central point: copy Heidi's operating model and evidence discipline, not its feature
  list. A published contract proves a commitment, not a working control.
- Roles differ by feature. A booking intermediary, a video tool, a record host and an AI
  assistant carry different duties. Eleva's RoPA already splits them (C1–C13 as controller,
  P1–P6 as processor, `docs/eleva-v3/legal/ropa.md`).
- Audio, transcript, AI draft and signed record are different objects with different rules.
- A disclaimer does not decide whether software is a medical device. Function and claims do.
- Consent is several decisions, not one checkbox.

**What it gets wrong about Eleva.**

| The audit assumes                                      | Eleva runs                                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| DatoCMS holding content                                | MDX in `@eleva/content`; no CMS holds member or expert data                            |
| WorkOS or a hosted identity provider                   | Better Auth, self-hosted in `apps/api`; CI rejects any reference to the old provider   |
| A managed KMS/HSM                                      | A versioned KEK with per-organisation data keys (ADR-020, `packages/encryption`)       |
| VPC segmentation, intrusion detection, container scans | No equivalent on Vercel, Neon serverless and R2                                        |
| The ERS question is open and critical (its R1)         | Assessed and decided on 2026-10-29 (`legal/ers-position.md`); lawyer confirmation due  |
| Connected payouts are still to be designed (its R7)    | Built; any payment-services analysis is now retroactive                                |
| DAC7 "may" apply, with exclusions                      | Eleva already declares itself a reporting platform operator; no exclusion for services |

**What it could not see.** The two findings with the most consequence came from reading
Eleva's code, not from the audit: the `recommendations` and `redFlags` fields in the AI
prompt, and the DAC7 promise with nothing behind it.

## 2. Heidi: what checked out and what the audit missed

**Verified on Heidi's own pages.** The DPA dated 29 September 2026; customer as controller
and Heidi as processor; the ban on using customer data and outputs to train, fine-tune or
improve any model, which survives de-identification; TLS 1.2+, AES-256, logs kept at least
12 months and an annual CREST penetration test; breach notice within 72 hours; 30 days'
notice of new sub-processors with an objection route; export 30 days, deletion 30 days,
backups 90 days; the product families and "audio is not retained as a stored recording
unless you enable a feature that saves recordings".

**Partly verified or not reproduced.**

- The Trust Centre renders in the browser only, so its certificate list and named cloud
  providers could not be read. The DPA itself lists the certificates.
- The audit says the legal index lists 24 documents. The Irish index shows three and the
  Australian one four. The DPA, Product Terms and vulnerability policy exist only at direct
  URLs.
- The audit names Heidi Health Ireland Limited as the EU entity. The privacy policy does,
  but the 29 September MSA sends "all other countries" to an Australian entity under
  Victoria law, while the DPA applies Irish law. The Irish MSA URL serves a 1 May 2026
  version without the no-training clause. This matters only if Eleva ever contracts with
  Heidi.
- The help centre says "encrypted end-to-end". The DPA describes transport and at-rest
  encryption with cloud-managed keys. The audit was right to flag the gap.

**What the audit missed about Heidi.**

- **Audience.** GPs and NHS trusts lead. Site-wide, allied health means physiotherapists,
  podiatrists, chiropractors and occupational therapists, and mental health includes
  psychological sessions. Nutrition is not named.
- **Languages.** Marketing says 110; the developer docs list 72 codes including `pt` and
  `pt-BR`. There is no separate European Portuguese entry, so its quality is unverified.
- **Pricing.** A free tier ("free forever": unlimited transcription and standard notes),
  then Clinician, Practice and Enterprise. Euro prices did not appear on the pages read.
- **Consent.** Heidi says it does not rely on consent and does not enforce it in the
  product. The clinician is expected to ask, with posters and an optional form.
- **Integration.** Heidi offers a widget SDK and API, including for telehealth systems. It
  has closed new integrations in Australia and New Zealand.

**Positioning.** For Eleva's experts Heidi is a complement at the edges. It sells
documentation to clinicians and does nothing for discovery, booking, payment or the member
relationship. The overlap is session notes, live transcription and AI report drafts. Eleva
should not try to out-scribe Heidi. Its advantage is that the member's consent, the
session and the record live in one place.

**Build or partner.** Build Phase 10.1 drafting as specified. The path is largely built,
narrow, and keeps a short vendor chain under Eleva's own consent and audit trail. Heidi's
widget streams live audio to Heidi, which adds an audio sub-processor, conflicts with
Eleva's no-audio-stored position, needs a new DPIA and leaves European Portuguese and EU
residency unconfirmed. An expert who uses their own scribe outside Eleva makes that choice
as controller.

## 3. Where Eleva already matches or leads

These are worth saying in public, because Heidi is a well-funded reference and Eleva
compares well on the points members and experts care about.

| Topic                         | Heidi (public documents)                       | Eleva                                                                                                    |
| ----------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Breach notice to the customer | Within 72 hours                                | Within 24 hours (`trust/en/dpa.mdx`, backed by `legal/breach-response.md`)                               |
| Sub-processor list            | Behind the Trust Centre                        | Fully public, with region, transfer basis and which vendors can touch session records                    |
| Member consent                | Left to the clinician, outside the product     | Captured in the booking flow, versioned, with an in-call notice (`packages/compliance`)                  |
| Staff access to clinical data | Support access with permission                 | No staff read path; impersonation sessions are refused; an RLS test asserts it                           |
| Audio                         | Not kept unless a save-recording feature is on | Recording is off; no audio is stored                                                                     |
| AI retention and region       | Contractual no-training; region varies         | Zero retention and EU inference enforced per call, failing closed (`packages/ai/src/approved-models.ts`) |
| Read auditing                 | Access logs                                    | Every record read emits `record.decrypted` with viewer and purpose (`packages/records`)                  |
| Draft publication             | Clinician review required by terms             | An `ai_draft` can never be published; only an expert-saved `report` can                                  |
| Regulator position            | No equivalent page                             | Public ERS page and an internal memo with eight registration triggers                                    |

## 4. What to adopt

Effort: S is under a day, M is a few days, L is more. "Lens" names the reviewer.

### 4.1 Before the first real expert is invited

| #   | Action                                                                                                                                                                                                                                                                     | Why                                                                                                                                                                                  | Lands in                                                                | Effort | Lens            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------ | --------------- |
| A1  | Add a no-training clause to the DPA: no training, fine-tuning or evaluation on records, transcripts or drafts by Eleva or any vendor, and the rule survives de-identification. Narrow the "aggregate form" clause in the expert agreement so it excludes clinical content. | Heidi's strongest clause. Today the only promise is "We do not send Eleva data to train public foundation models" in `legal/en/ai-processing.mdx` (hand-checked); the DPA is silent. | `trust/*/dpa.mdx`, `legal/*/expert-agreement.mdx`                       | S      | Privacy, Trust  |
| A2  | Ask Daily in writing whether its transcription provider retains or trains on session audio, and whether the opt-out can be passed through.                                                                                                                                 | The published training statement covers transcription, and the panel found no evidence for that path.                                                                                | `legal/fact-sheet.md`                                                   | S      | Clinical AI     |
| A3  | Fix contract precedence so the DPA prevails on personal data. Consider the Commission's Article 28 clauses (Decision 2021/915) as the core text with Eleva annexes.                                                                                                        | The expert agreement currently prevails over the DPA (hand-checked), the reverse of Heidi. The published DPA is a summary, not a binding instrument.                                 | `trust/*/dpa.mdx`, expert agreement preamble                            | M      | Privacy         |
| A4  | Record each expert's acceptance of the agreement and DPA version.                                                                                                                                                                                                          | `CONSENT_KINDS` has no acceptance kind (hand-checked). This is the Article 28(9) evidence, and the decision log already lists it as open.                                            | `packages/compliance`, expert onboarding                                | M      | Privacy         |
| A5  | Split `ai_processing` into two consents: live transcription and AI drafting. Ask for the drafting consent only when the feature ships. Add an in-call stop, and align who starts transcription with RoPA P3.                                                               | One tick covers two purposes and two vendors, and consent is collected for drafting that is switched off. On withdrawal mid-session, audio keeps flowing until the call ends.        | `packages/compliance/src/consents.ts`, booking funnel, `packages/video` | M      | Privacy, AI     |
| A6  | Make the health-data consent and the notice it links to describe the same thing.                                                                                                                                                                                           | The required checkbox links to a notice that frames consent only as on the expert's behalf, while the privacy notice says it covers Eleva as intermediary.                           | `legal/*/health-data.mdx`                                               | S      | Privacy         |
| A7  | Publish a trust index at `/trust` listing every legal and trust document with its last-updated date, and link it from the footer.                                                                                                                                          | The footer links only `/trust/security` (hand-checked). The DPA, sub-processor and ERS pages are reachable only from inside other pages.                                             | `apps/web/src/app/[locale]/trust/`, `packages/site-chrome`              | S      | Trust           |
| A8  | Write a one-page "who is responsible for what" (Eleva, expert, clinic) and a help article on how Eleva protects sessions and notes.                                                                                                                                        | Heidi's provider/deployer split is clear to buyers. Eleva has the facts but spread across four documents.                                                                            | `packages/content/content/help/experts`, `help/clinics`, `help/members` | S      | Trust           |
| A9  | Name the sub-processor change route: a dated change log on the page and an email to organisation owners.                                                                                                                                                                   | The DPA promises 30 days' notice but names no channel. The list changed on 2026-10-31 with this question open.                                                                       | `trust/*/sub-processors.mdx`, `packages/notifications`                  | S      | Privacy, Trust  |
| A10 | Tighten the breach clause (the 24 hours run from awareness, Article 33(3) content, phased updates) and record each vendor's breach clause and security contact.                                                                                                            | The DPA says "24-hour" in one section and "without undue delay" in another.                                                                                                          | `trust/*/dpa.mdx`, `legal/fact-sheet.md`                                | S      | Privacy         |
| A11 | Move audit rights to a reports-first model with a frequency cap and cost rule, backed by a shareable security-measures annex.                                                                                                                                              | A one-person processor serving many controllers cannot host open-ended audits.                                                                                                       | `trust/*/dpa.mdx`                                                       | S      | Privacy         |
| A12 | Publish a vulnerability disclosure page and `/.well-known/security.txt`.                                                                                                                                                                                                   | Neither exists in `apps/web` (hand-checked). `security@eleva.care` is already published.                                                                                             | `apps/web`, `packages/content/content/trust`                            | S      | Security, Trust |
| A13 | Align public wording with what the contract and code support (see 4.5).                                                                                                                                                                                                    | The same kind of gap the audit found between Heidi's help centre and its DPA.                                                                                                        | `packages/content/content`                                              | S      | Trust           |

The audit also adds weight to three security findings that were already open at the
2026-11-05 council, with no fix found on `main` since. They are not new work:

- **SEC1-04:** the runtime database role bypasses row-level security.
- **SEC2-03:** MFA is optional. The panel recommends making it mandatory for Eleva staff
  first.
- **SEC3-06:** the restore drill and KEK escrow. The runbook log holds only its adoption
  entry (hand-checked), and the restore window is 6 hours.

### 4.2 Before AI drafting is switched on (`ff.ai_reports_beta`)

| #   | Action                                                                                                                                                                                                                                        | Why                                                                                                                                                                                                 | Lands in                                                               | Effort |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------ |
| I1  | Reshape the prompt contract to be extractive. Replace `recommendations` with "Plan you noted", drop `redFlags`, and remove "tracked symptoms" and model-inferred follow-up timing from the spec.                                              | The v1 schema asks the model for both fields (hand-checked). Model-originated, member-specific items of that kind are the clearest "information used for therapeutic decisions" exposure under MDR. | `packages/ai/src/prompts/session-report.v1.ts`, `ai-reporting-spec.md` | S      |
| I2  | Write an intended-purpose register: one line per AI feature (table below), plus a copy rule that Eleva's AI never "detects", "recommends" or gives "clinical insights".                                                                       | No MDR or Rule 11 analysis exists anywhere in the repo. Heidi frames every product as administrative support with professional review.                                                              | New file in `docs/eleva-v3/legal/`                                     | S      |
| I3  | Complete the AI event log: emit `requested` before the call, record failures of every kind, store the resolved provider, region and zero-retention flag, the consent version, and whether the expert accepted, edited or discarded the draft. | Today `requested` is written only after a successful generation, so a failed call that sent member data leaves no trace. Nothing links a report to the draft it came from.                          | `packages/records/src/draft-session-report.ts`, `packages/audit`       | M      |
| I4  | Build an evaluation set (20–30 synthetic notes in pt-PT, es and en, scored for unsupported statements and omissions) and a "this draft was wrong" control. Fix the hard-coded `locale: "en"`.                                                 | Only mocked tests exist. Portuguese notes currently produce an English draft (hand-checked).                                                                                                        | `packages/ai`, `packages/records`, `apps/expert`                       | M      |
| I5  | Add the expert attestation at publish and an "AI-assisted, reviewed by your expert" label on the report.                                                                                                                                      | Both are promised in the DPIA and the member notice and are not built.                                                                                                                              | `apps/expert` report editor, `apps/app`                                | S      |
| I6  | Reconcile the documents before any transcript-based summary ships.                                                                                                                                                                            | RoPA P4 and the DPIA diagram say the transcript goes to the model; the code and the member notice say notes and intake only.                                                                        | `legal/ropa.md`, `legal/dpia.md`, `ADR-009`                            | S      |

Proposed intended purposes, for device counsel to confirm:

| Feature                 | Status               | Proposed intended purpose                                                                     | Drift risk                |
| ----------------------- | -------------------- | --------------------------------------------------------------------------------------------- | ------------------------- |
| Editor assist           | Built                | Helps an expert word and translate their own public profile text                              | Low                       |
| Live transcription      | Built, consent-gated | Turns what is said in a video session into text for the expert's written record               | Low                       |
| Session-report draft    | Built, flag off      | Reorganises the expert's own notes into a draft the expert edits; it adds no clinical content | Medium; high with I1 open |
| Summary from transcript | Specified            | Summarises what was said, for the expert to correct                                           | Medium                    |
| Member-facing summary   | Specified            | Restates the expert's approved report in plain words                                          | Medium to high            |
| Follow-up suggestions   | Specified            | Lists follow-ups the expert already wrote down                                                | High if model-inferred    |
| Structured extraction   | Specified            | Action items and themes only                                                                  | High for symptom tracking |

For its own-brand drafting features Eleva is most likely the AI Act **provider**, with
experts as deployers. The audit says "deployer", which fits only internal use such as
translation drafts.

### 4.3 Before launch (first live payment, real members)

| #   | Action                                                                                                                                                                                                                 | Why                                                                                                                                                                                                | Lands in                                                        | Effort                    | Lens       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------- | ---------- |
| B1  | Build DAC7: collect date of birth, tax number and address for each expert, register as a platform operator (Modelo 61), file the yearly report by 31 January and give each expert their statement.                     | Expert agreement §16 promises all of it. There is no DAC7 code, no date-of-birth field in the schema and no operator task (hand-checked). Paid personal services have no small-seller exclusion.   | Expert billing profile, `operator-tasks/`, execution plan       | M                         | Regulation |
| B2  | Write a payment-services memo jointly with the ERS collection-mandate question.                                                                                                                                        | Eleva "collects on the expert's behalf", funds sit in Eleva's Stripe balance for at least 7 days and no `on_behalf_of` is set (hand-checked). The wording that helps the ERS position raises this. | New memo in `docs/eleva-v3/legal/`                              | S memo, L if flow changes | Regulation |
| B3  | Add a Phase 10.1 addendum to the ERS memo: does live transcription count as recording for consent, and what storage location must experts declare for a telemedicine unit.                                             | Session records and transcripts move Eleva from directory-plus-video towards record host, which strengthens the "otherwise operates" reading the memo already flags.                               | `legal/ers-position.md`                                         | S                         | Regulation |
| B4  | Give credentials a lifecycle: periodic re-check of Ordem and ERS status, a rule on insurance evidence, and a block on expiry. State the rule for experts outside Portugal and members in the islands or abroad.        | Verification is one-off today and the licence is then locked.                                                                                                                                      | `packages/config/src/professional-bodies.ts`, admin review flow | M                         | Regulation |
| B5  | Encrypt document bytes in the private bucket with the organisation key.                                                                                                                                                | Only the filename and metadata are envelope-encrypted (hand-checked), so a storage-only compromise would expose documents in plaintext.                                                            | `packages/records/src/session-documents.ts`                     | M                         | Security   |
| B6  | Make the audit trail tamper-evident (SEC3-03) and audit reads of CRM notes.                                                                                                                                            | The hash-chain columns exist but are not populated. `packages/crm` audits writes only, and its encrypted note may hold health data.                                                                | `packages/audit`, `packages/crm`                                | M                         | Security   |
| B7  | Put numbers on termination: export window, deletion window, backup purge. Add an expert self-service export.                                                                                                           | The DPA says "at any time" and "as they roll over"; the internal schedule says 90 days. Backups age out within days here, so a 30-day promise would be honest and beat Heidi's 90.                 | `trust/*/dpa.mdx`, `legal/retention-schedule.md`                | S docs, M tooling         | Privacy    |
| B8  | Book an external EU penetration test; add SAST and an SBOM to CI; adopt and publish log retention.                                                                                                                     | The test is an unscheduled Phase 13 task. CI has secret and dependency scanning but neither of the other two. The retention schedule is still "proposed".                                          | `.github/workflows/ci.yml`, `legal/retention-schedule.md`       | S each                    | Security   |
| B9  | Make MFA mandatory for experts and clinic admins, with a shorter idle session.                                                                                                                                         | Heidi commits to MFA for its own staff; clinic buyers will ask the same of anyone who can open records.                                                                                            | `packages/auth`                                                 | M                         | Security   |
| B10 | Write a one-page platform classification note: DSA (hosting service and online platform, exempt as a micro-enterprise from Articles 20–28 and 30–32, monthly active users on request) and NIS2 (out of scope by size). | Both are assessed only in passing today. The note records when to re-check: 50 staff, €10m, or a clinic contract passing security terms down.                                                      | `docs/eleva-v3/legal/`                                          | S                         | Regulation |
| B11 | Finish the DPA particulars (expert CRM, video stream, guests and leads, Law 58/2019 art. 29 support duty, expert death or incapacity) and keep a version history for the DPA and expert agreement.                     | Gaps already listed in `legal/experts-dpa-checklist.md`. Heidi dates every document.                                                                                                               | `trust/*/dpa.mdx`                                               | S to M                    | Privacy    |

### 4.4 Later, with the trigger that brings each forward

- **A separate clinical database.** Not now. The app runtime would hold both connection
  strings, the KEK and the storage keys in one environment, so a split adds a consistency
  problem without shrinking the realistic blast radius. B5, SEC1-04 and a dedicated
  database role for the `records` tables give more protection for less. Revisit when a
  second person or system gets production database access, a clinic contract demands
  segregation, recording or transcripts ship at volume, or the KEK moves to a managed KMS.
- **ISO/IEC 27001.** Keep a light risk register and Statement of Applicability aligned to
  ISO/IEC 27001:2022 now. Certify when the first clinic buyer asks, then add ISO/IEC 27701.
- **ISO/IEC 42001.** Only if AI features multiply.
- **EHDS.** Nothing binds Eleva before 26 March 2029. The open question is whether session
  records make Eleva's software an "EHR system" for the priority categories.
- **Clinic SSO, a status page, support targets, malware scanning of uploads.** When the
  first clinic asks, or at the volume that justifies them.

### 4.5 Public wording to align (A13)

| Page                                            | Sentence                                                                                   | Issue                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `legal/en/ai-processing.mdx`                    | "We do not send Eleva data to train public foundation models."                             | Narrower than it sounds; closed by A1                                                                                                  |
| `help/experts/en/sessions/video-sessions.mdx`   | "Drafts are encrypted and visible only to you."                                            | The privacy notice says staff "cannot open it in normal operation"; use one description                                                |
| `trust/en/security.mdx`                         | "Sentry with EU data storage when configured…", "Vercel fra1 (Frankfurt) where configured" | The sub-processor page states both as fact; say what is true in production                                                             |
| `trust/en/security.mdx`                         | "industry-standard encryption from our cloud providers"                                    | Undersells the DPA's AES-256-GCM for clinical data; it also omits per-organisation keys, the read log and the no-staff-access position |
| `trust/en/security.mdx`                         | "row-level protections", "separate audit database"                                         | Ahead of the code until SEC1-04 closes; confirm the production audit database is its own project                                       |
| `trust/en/security.mdx`, `legal/en/privacy.mdx` | "an external data protection officer is being appointed"                                   | Update when the DPO is named                                                                                                           |

## 5. Decisions only people can make

**Founder**

- Keep or drop model-generated recommendations and red flags (I1).
- Whether any item in 4.1 joins the pilot gate.
- Move to `on_behalf_of` so the expert is the merchant on the member's statement (B2).
- Mandatory MFA for experts at pilot or at launch (B9).
- Whether insurance evidence becomes mandatory, and whether experts outside a Portuguese
  Ordem are ever in scope (B4).
- Whether the EU gateway endpoint (beta, about 5% more) is required before AI is turned on.
- Run the restore drill and escrow, and hold the breach tabletop due by 2026-12-07.

**Lawyer**

- Confirm the ERS memo with the Phase 10.1 addendum, and whether to ask the ERS for an
  informal view.
- The payment-services position under Portuguese law, alongside Stripe's written position.
- Whether transcription counts as recording for consent.
- Liability: the DPA and expert agreement have no cap and a one-way indemnity; Portuguese
  standard-terms law may limit both.

**DPO**

- Processor or joint controller for transcription, AI drafts, the CRM and intake. Eleva
  picks every sub-processor, sets default retention, designs the AI features and collects
  consent in its own funnel.
- Whether the mandatory health-data consent is valid alongside Article 9(2)(h), given
  withdrawal is blocked while a booking is confirmed.
- Whether a solo incident lead can keep a 24-hour breach promise.
- Transcript retention: ADR-009 says 2 years, the published notice says 7.
- The model provider's safety-retention terms and the transfer assessment.

**Accountant**

- Modelo 61 timing and the first reporting year.
- How Eleva-funded promotion codes count in reported consideration.
- VAT on the collection mandate, and CAE 86950.

**Device counsel**

- Qualification of the report draft and any transcript summary under MDR Rule 11, and
  whether extractive-only wording keeps them outside it.
- Whether AI Act Article 50 marking applies to drafts an expert reviews.

## 6. What to skip from the audit

- **Certification programmes now** (its §16). Under the founder rule of 2026-11-07, skip
  the US-origin attestation and framework items it lists and follow the ISO path in 4.4.
- **"NIS2 compliance, do not wait."** Eleva is a micro-enterprise and out of scope by size.
- **"FHIR-compatible structures now."** Keep the existing machine-readable export.
- **Round-the-clock on-call, regional failover, immutable offline backups, code signing,
  DAST, a distinct clinical service runtime.** Disproportionate for a one-person company.
- **Vendor breach notice in 12–24 hours.** Not negotiable on click-through terms. Recording
  each vendor's clause is enough (A10).
- **A DPA per relationship, regional addenda, product-specific terms per feature.** One
  Portugal-first pack is right for now.
- **Heidi's customer-obligation shifting.** Eleva collects the consents itself, so it
  cannot hand that duty to experts.
- **Heidi's "as is" AI disclaimer and broad indemnity for patient claims.** Eleva chooses
  the AI vendors.
- **DSA trader checks as a duty.** Eleva is exempt and does them voluntarily.
- **Certificate badges, gated evidence rooms, SLA credits, "end-to-end" or "never leaves
  the EU" absolutes.** Publish only what the contract and code support.
- **Agents, clinical coding, an evidence assistant, a voice bot, EHR writeback.** Not on
  Eleva's roadmap.
- **The "questions to send Heidi" list** (its §19). Useful only if Eleva decides to
  contract with Heidi.

## 7. Fact-check of the audit's regulatory claims

| Claim                                                                                        | Status                                                                                                | Source                                                                                                                                  |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| ERS: telemedicine units register; a server abroad does not avoid it for mainland patients    | Verified                                                                                              | [ers.pt FAQ](https://www.ers.pt/pt/prestadores/perguntas-frequentes/faqs/perguntas-frequentes-sobre-obrigatoriedade-de-registo-na-ers/) |
| Decree-Law 125/2025 transposes NIS2; medium and larger entities in scope                     | Verified from law-firm and press summaries, not the official text                                     | [Cuatrecasas](https://www.cuatrecasas.com/pt/portugal/tecnologias-meios-digitais/art/novo-regime-juridico-ciberseguranca)               |
| Online marketplaces in the Portuguese Annex II; main-establishment rule                      | Unverified on the Portuguese text                                                                     | —                                                                                                                                       |
| CNCS Regulation 756/2026 of 22 June 2026                                                     | Verified                                                                                              | [Diário da República](https://diariodarepublica.pt/dr/detalhe/regulamento/756-2026-1134399056)                                          |
| EHDS applies from 26 March 2027, with 2029 and 2031 phases                                   | Verified                                                                                              | [European Commission](https://health.ec.europa.eu/ehealth-digital-health-and-care/european-health-data-space-regulation-ehds_en)        |
| DAC7 "may" apply to personal services                                                        | Understated: paid personal services are a relevant activity; the small-seller exclusion is goods only | [Portal das Finanças](https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/questoes_frequentes/pages/faqs-00213.aspx)            |
| DSA trader traceability "subject to exemptions"                                              | Verified, and the exemption applies to Eleva (Articles 19 and 29)                                     | [Article 29](https://www.springlex.eu/en/packages/dsa/dsa-regulation/article-29/)                                                       |
| PSD2 commercial-agent exclusion fails when a platform acts for both sides                    | From a search summary of two EBA Q&As; not opened                                                     | [EBA Q&A 2020_5355](https://www.eba.europa.eu/single-rule-book-qa/qna/view/publicId/2020_5355)                                          |
| AI Omnibus in force 27 July 2026; high-risk dates moved to 2 December 2027 and 2 August 2028 | Verified via law-firm sources, not EUR-Lex                                                            | [Lewis Silkin](https://www.lewissilkin.com/insights/2026/07/27/the-digital-omnibus-on-ai-enters-into-force-today-102nedo)               |
| Vercel AI Gateway offers zero data retention and EU inference that fails closed              | Verified; pinning where the gateway receives the request needs the EU regional endpoint (beta)        | [Vercel ZDR](https://vercel.com/docs/ai-gateway/security-and-compliance/zdr)                                                            |
| Daily's transcription provider does not retain or train on session audio                     | Unverified (see A2)                                                                                   | [Daily transcription guide](https://docs.daily.co/docs/guides/features/transcription.md)                                                |

## 8. Inconsistencies found in Eleva's own documents

Small, and worth fixing before the DPO reads the pack:

- `compliance-data-governance.md` (lines 239–251) still calls 10-year notes, 2-year
  transcripts and an analytics consent banner "locked". The published pages say 7 years and
  no analytics. The same file maps controls to a US-origin attestation framework, which the
  2026-11-07 founder rule retires.
- `ADR-012` still calls Eleva a "digital health platform", the wording the ERS memo
  recommends dropping. None was found on the EN or PT public pages; ES was not checked.
- RoPA P3 says the expert starts transcription; in the product it starts automatically.
- In-call chat is not in the RoPA. Whether it is stored was not verified.
- `.env.example` sets `AI_GATEWAY_MODEL_EDITOR` to a model that is not on the allow-list.
  Harmless, stale.

## 9. Follow-up applied on 2026-11-14

The founder asked for the five headline gaps to be applied. Sections 1 to 8
above are the panel's snapshot and are not rewritten. The record of what
changed is the decision-log entry of 2026-11-14.

| Gap                         | What changed                                                                                                                                                        | What is still open                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1. No-training promise      | A1: clause in DPA §9, the AI notice and expert agreement §12, in EN, PT and ES. Evidence per provider recorded in `legal/fact-sheet.md`.                            | A2: Daily's written confirmation. Lawyer review of the new clauses. A3 (precedence) is unchanged.                       |
| 2. AI prompt wording        | I1: prompt contract v2 is extractive, with a guard test. I2: intended-purpose table in `ai-reporting-spec.md`. The draft language follows the booking (part of I4). | Device counsel confirms the table. I3, the rest of I4, I5 and I6.                                                       |
| 3. DAC7                     | Runbook drafted: [`operator-tasks/dac7-reporting.md`](../operator-tasks/dac7-reporting.md).                                                                         | **B1 is not built.** Seller tax profile, checks and reminders, yearly export. Seven questions for the accountant.       |
| 4. Payment services         | B2: memo drafted for the lawyer, [`legal/payment-services-position.md`](../legal/payment-services-position.md), with options and questions for Stripe.              | The lawyer's answer, Stripe's written position, and the founder's choice on `on_behalf_of`.                             |
| 5. Trust pages hard to find | A7: `/trust` index and footer link. A9: change route named, change log published, runbook drafted. A12: disclosure page and `security.txt`.                         | The notice email is sent by hand. A8 (responsibility one-pager, help article) and A13 (wording alignment) are not done. |

## Related

- [`2026-11-expert-pilot-council.md`](./2026-11-expert-pilot-council.md): the open SEC and
  PRIV findings this report references.
- [`../legal/README.md`](../legal/README.md): the internal legal pack.
- [`../ai-reporting-spec.md`](../ai-reporting-spec.md) and
  [`../adrs/ADR-009-ai-and-transcripts.md`](../adrs/ADR-009-ai-and-transcripts.md).
