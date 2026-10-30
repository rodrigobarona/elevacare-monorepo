# Data protection impact assessment (DPIA)

> **Draft for review by a Portuguese lawyer and the external DPO. Not legal advice. The DPO's art. 35(2) advice and the founder's sign-off are still pending.**

- **Controller:** BÚZIOS E TARTARUGAS - LDA (Eleva.care), NIPC 515001708.
- **Scope:** the platform as a whole, centred on health data at scale and four
  higher-risk features:
  - booking with health professionals;
  - video sessions on **standard Daily** (not HIPAA, no BAA, recording off).
    Production clinical video is gated; see §2.6;
  - live transcription;
  - AI-drafted session reports.
- **Roles:**
  - Eleva is **controller** for platform processing (RoPA C1–C13).
  - Eleva is **processor** for clinical content (RoPA P1–P6).
  - For the processor part, this DPIA is the assistance Eleva owes each
    expert-controller under art. 28(3)(f). Experts can rely on it for their
    own art. 35 assessment.
- **Version:** draft 2026-10-29. **Review triggers:**
  - turning on `ff.ai_reports_beta`;
  - clinic-shared records (Phase 11);
  - cloud recording (Phase 16.8 / D-08);
  - HIPAA Daily (D-07);
  - any new sub-processor handling health data;
  - a significant incident;
  - otherwise every 12 months.
- **Related:** [`ropa.md`](./ropa.md),
  [`retention-schedule.md`](./retention-schedule.md),
  [`breach-response.md`](./breach-response.md), ADR-003, ADR-009, ADR-020,
  D-06, D-07, D-08, D-11, D-12.

## 1. Is a DPIA required?

Yes, on four independent grounds.

1. **GDPR art. 35(3)(b).** Large-scale processing of special categories of
   data (art. 9). The core activity is booking and supporting health care for
   many members across many professionals.
   - Recital 91 exempts "an individual physician, other health care
     professional or lawyer". It does not exempt a platform aggregating many
     professionals.
   - WP243 rev.01 §2.1.3 treats "processing of patient data in the regular
     course of business by a hospital" as large scale. A multi-expert platform
     sits much closer to that example than to the individual physician.
2. **CNPD Regulamento n.º 1/2018** (published as Regulamento n.º 798/2018, DR
   2.ª série n.º 231, 30 Nov 2018). This is the art. 35(4) list. It applies:
   - **item 9**: art. 9 data processed "com utilização de novas tecnologias ou
     nova utilização de tecnologias já existentes". This covers speech-to-text
     and generative AI drafting.
   - **item 2**: "interconexão de dados pessoais ou tratamento que relacione
     dados" of art. 9 data. Booking, payment, attendance, intake, notes and
     transcripts are linked per member.
   - **item 1**, arguably: "dispositivos eletrónicos que transmitam, por redes
     de comunicação, dados pessoais relativos à saúde" (video consultation over
     the internet). This is often read as wearables, so it is not relied on
     alone.
3. **WP248 rev.01** (endorsed by the EDPB). Meeting two criteria is normally
   enough to require a DPIA. Eleva meets at least four:
   - criterion 4, sensitive data;
   - criterion 5, large scale;
   - criterion 6, matching or combining datasets;
   - criterion 7, vulnerable data subjects ("patients" are listed expressly);
   - criterion 8, innovative use of technology (AI, transcription).
4. **Lei 58/2019 art. 29** sets specific conditions for health data that must
   be shown to be met:
   - need-to-know access;
   - secrecy duty;
   - electronic access;
   - notification of every access;
   - an electronic access log.

**Prior consultation (art. 36)** is needed only if residual risk stays high
after mitigation. See §7.

## 2. Description of the processing (art. 35(7)(a))

### 2.1 Nature

Members find independent, **regulated** health professionals
(psychologists, physicians, physiotherapists, nutritionists and others whose
licence has been verified against their Ordem; founder decision 4), book and
pay for sessions, and meet online (Daily video) or in person. Eleva does not
deliver care (founder decision 1; see
[`ers-position.md`](./ers-position.md)).

Around each session, the expert can keep an encrypted clinical record. With
the member's opt-in, the expert can also turn on live transcription and, when
enabled, AI-drafted report suggestions.

### 2.2 Data flow

```text
Member/guest ──booking funnel──▶ apps/api (Vercel fra1) ──▶ Neon (Frankfurt)
   │  name, email, phone, service, time, consents, intake (encrypted)
   │                                   │
   │                                   ├─▶ Stripe Checkout (EEA entity, US replication)
   │                                   ├─▶ Resend / Twilio (PHI-free notices + signed join link)
   │                                   └─▶ Upstash (holds, rate limits, QStash jobs)
   │
   └─/join/{bookingId}?g=──▶ Eleva join page ──▶ Daily room (eu-central-1, recording off)
                                                     │  live audio/video (transient)
                                                     ├─▶ Deepgram via Daily (EU) — only with ai_processing consent
                                                     │      └─▶ transcript → encrypted record (Neon)
                                                     └─▶ webhooks: meeting/participant events → attendance (Neon)

Expert ──notes, internal report, published report, documents──▶ encrypted (per-org DEK) ──▶ Neon / private Blob (fra1)
   └─(flag off) AI draft: transcript+notes ──▶ Vercel AI Gateway (EU zone, ZDR attestation) ──▶ model ──▶ draft (90-day TTL)

Every mutation ──withAudit──▶ audit_outbox ──drainer──▶ audit_events (separate Neon project, append-only)
```

### 2.3 Scope and scale

- **Data subjects:** members, including guests, possibly minors (see R13);
  experts; clinic staff.
- **Volume:** `[[FOUNDER INPUT: expected members, experts and sessions per month at launch and at 12 months]]`.
  - Large scale is assessed qualitatively (WP243 §2.1.3: number of people,
    volume, duration, geography). The assessment does not depend on reaching a
    numeric threshold.
- **Geography:** Portugal first; EU members possible; UI in English,
  Portuguese and Spanish.
- **Duration:** clinical records are kept for years
  ([`retention-schedule.md`](./retention-schedule.md)).

### 2.4 Context

- Members are in a care relationship and may be in distress. That is a
  power and information imbalance (WP248 criterion 7).
- Mental-health content (psychology) is among the most sensitive health
  data.
- Members reasonably expect professional secrecy (Lei 58/2019 art. 29(2),
  (4); the professional codes of the Ordens).

### 2.5 Purposes

Booking, payment and payout, delivery of online sessions, the clinical
record-keeping duty of the expert, optional transcription and drafting
assistance, and platform security. See the RoPA for each purpose and its
lawful basis.

### 2.6 Video: production status (D-07 gate)

This DPIA assesses the **standard Daily** configuration that is built today:
EU call server (`geo: "eu-central-1"`), recording off
(`enable_recording: false`), per-invitee tokens, no BAA, **not HIPAA**.

It does **not** approve production clinical sessions on Daily:

- D-07 (Daily HIPAA domain, BAA/DPA and EU processing position) is
  **deferred** (decision log 2026-10-07 and 2026-10-12). The D-07 entry
  states that it blocks production PHI-video processing.
- Standard Daily is cleared for engineering, demos and the
  accountant/legal review only.

Production clinical video on Daily may start only when **D-07 is signed** and
recorded in `docs/eleva-v3/decision-log.md`. No other route is authorised today.

D-07 as written covers a HIPAA-enabled Daily plan and an executed BAA. The
founder stated on 2026-10-12 that HIPAA is not an EU launch priority, and D-07
stays deferred. Production clinical video on standard Daily (not HIPAA, recording
off) would need a **new decision-log entry that supersedes D-07 for that
processing**, with its scope and approval conditions. This is an open founder
decision (decision log 2026-10-30). This DPIA does not claim HIPAA or a BAA.

Any route that is recorded must cite this DPIA (R5, R6, R7) and confirm that:

- the Daily DPA is accepted in the company's name;
- Daily's DPF status has been rechecked on or after 2026-11-16;
- recording is confirmed off for the account.

Until then, R5 and R6 below are rated for the standard-Daily configuration,
and the §7 conclusion does not cover production clinical video.

## 3. Necessity and proportionality (art. 35(7)(b))

| Principle                         | How it is met                                                                                                                                                                                                | Remaining concern                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Lawfulness (arts. 6, 9)           | Contract for booking and payment. Art. 9(2)(h)+(3) via the expert's professional secrecy. Explicit consent for transcription and AI (`ai_processing`).                                                       | The mandatory `health_data_processing` funnel consent may not be "freely given" (art. 7(4)). Eleva decides, on the DPO's advice (RoPA point 1). |
| Purpose limitation (art. 5(1)(b)) | No health data is used for advertising or profiling (health-data notice). AI is used only for the expert's own draft. No model training (AI notice).                                                         | —                                                                                                                                               |
| Minimisation (art. 5(1)(c))       | Notifications are PHI-free (Lane 2 schema; Resend DPA "sensitive data — not applicable"). No Daily token or clinical data in URLs. Bookings do not store date of birth or location. Audit payload allowlist. | The expert's name and profession in an email still reveal a health relationship. This is accepted as necessary.                                 |
| Accuracy (art. 5(1)(d))           | The expert reviews every AI draft before publishing. The member can ask the expert to rectify.                                                                                                               | Transcription errors could enter the record. The expert must review before relying on it.                                                       |
| Storage limitation (art. 5(1)(e)) | Retention sweep: AI drafts after 90 days, notification logs after 365 days, session documents after 7 years. D-12 pseudonymisation on account deletion.                                                      | No hard delete yet for expert-authored records. Documents are deleted by upload date, not "after last session". See the retention schedule.     |
| Integrity and confidentiality     | See §5.                                                                                                                                                                                                      | See risks.                                                                                                                                      |
| Transparency (arts. 12–14)        | Privacy, health-data, AI and cookie notices published (consent version `2026-10-24`).                                                                                                                        | No DPO is appointed, yet the public pages label `dpo@eleva.care` the DPO contact (fact sheet §1).                                               |
| Data subject rights               | Self-service DSAR export (target 10 minutes), account deletion with a 14-day grace period, consent withdrawal, record-access opt-out.                                                                        | Erasure of clinical records is limited by art. 17(3)(b)/(c). This is explained in the UI (D-12).                                                |
| Processors (art. 28)              | Vendor DPAs listed in the fact sheet.                                                                                                                                                                        | Several DPAs were accepted in a personal name. Twilio is on US1. Inth and Beehiiv DPAs are not signed.                                          |
| Transfers (chapter V)             | EEA storage; DPF and SCCs for US vendors.                                                                                                                                                                    | Daily DPF recheck on or after 2026-11-16. OpenAI and Beehiiv are not on the DPF. TIAs are outstanding.                                          |

**Is there a less intrusive way?**

- **Video.** Video is necessary for a remote consultation. Recording is off and
  only live relay is used.
- **Transcription.** Transcription is not necessary. It is therefore opt-in,
  off by default, and can be withdrawn.
- **AI drafting.** AI drafting is not necessary. It is therefore behind a
  flag, consent and a fail-closed zero-retention guard.
- **Encryption.** Storing records in plaintext would be easier. Envelope
  encryption per organisation was chosen so that staff and vendors cannot read
  them.

## 4. Risk assessment (art. 35(7)(c))

**Scale.**

- Likelihood (L): 1 remote, 2 possible, 3 likely, 4 almost certain.
- Severity (S) for data subjects: 1 minimal, 2 significant, 3 serious, 4 very
  serious or irreversible.
- Risk = L × S: **1–3 low, 4–6 medium, 8–9 high, 12–16 very high.**
- "Inherent" means before the measures in §5. "Residual" means after the
  measures already in code. The "Launch preconditions" column lists what must
  be true for the residual rating to hold.

| ID  | Risk to data subjects                                                                                                                               | Inherent L×S | Measures in place (§5)                                                                                                                                                                                                             | Residual L×S        | Launch preconditions / further measures                                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | External attacker exfiltrates clinical records from the database or Blob store                                                                      | 3×4 = 12     | Per-organisation AES-256-GCM envelope encryption (ADR-020). KEK outside the database. RLS on every tenant table. Private Blob store with signed, time-boxed grants. Rate limits.                                                   | 1×4 = 4             | KEK custody and rotation runbook (ADR-020 §3). Production secrets limited to named people with MFA. Penetration test before go-live.                                                                                                                                                                                  |
| R2  | Eleva staff or a vendor's staff read clinical content                                                                                               | 3×4 = 12     | Staff never get plaintext (D-11). Break-glass decrypt is not built. Every staff read is audited (100%). Append-only audit project.                                                                                                 | 1×4 = 4             | Keep break-glass out of scope until Phase 12 dual control exists. Secrecy undertakings (Lei 58/2019 art. 29(4)). Review `ADMIN_BYPASS_TABLES` (ciphertext only).                                                                                                                                                      |
| R3  | Another expert, or the wrong expert, reads a member's records                                                                                       | 2×4 = 8      | Author-only SELECT/INSERT/UPDATE/DELETE on `records` (migration 0061). Clinic sharing compiled but off. Member opt-out API. Cross-org RLS test.                                                                                    | 1×4 = 4             | Phase 11 toggle needs its own DPIA update (reason required, audited, member opt-out honoured).                                                                                                                                                                                                                        |
| R4  | Health information leaks through email, SMS or calendar invites (shared inbox, lock-screen preview, forwarded email)                                | 3×3 = 9      | PHI-free payloads. Lane 2 schema. No Daily token in email or ICS. Join grant per booking and person, valid only in the window. Quiet hours.                                                                                        | 2×2 = 4             | Keep subjects and bodies generic: "your session with {expert}" without the clinical specialty where possible. Move Twilio to IE1.                                                                                                                                                                                     |
| R5  | An unauthorised person joins a video session (forwarded link, guessed room)                                                                         | 2×4 = 8      | Eleva join page. Signed grant. One meeting token per invitee. Two-person base cap for the assigned expert and the booking member; each active delegate adds one place. `enforce_unique_user_ids`. Grant window. Revocation ejects. | 1×3 = 3             | Expert UI shows who is in the room. Staging two-browser webhook exit gate still open.                                                                                                                                                                                                                                 |
| R6  | Video content is captured or retained by the provider; US access to call metadata                                                                   | 2×4 = 8      | Recording off (`enable_recording: false`). EU call server (`geo: "eu-central-1"`). Daily DPA. DPF and SCCs.                                                                                                                        | 1×3 = 3             | **Production clinical video gated by §2.6** (D-07 signed, or a decision-log entry that supersedes it). Recheck Daily on the DPF list on or after 2026-11-16. Do not claim HIPAA or a BAA. Sign the Daily DPA in the company's name.                                                                                   |
| R7  | Transcription captures more than intended (third parties, unrelated disclosures), is inaccurate, or happens without a valid choice                  | 3×3 = 9      | Off by default. Member's explicit `ai_processing` consent. Withdrawal closes all rows. Live only, no audio. EU processing (`transcription_geo: "eu"`). Stored encrypted in the record.                                             | 2×3 = 6             | Show a visible "transcribing" indicator to both parties. Let either party stop it. The expert confirms consent before starting. Retention follows the record.                                                                                                                                                         |
| R8  | AI drafts: provider retains or trains on clinical content; data leaves the EU; inaccurate drafts influence care                                     | 3×4 = 12     | `ff.ai_reports_beta` off. Approved-model allowlist. EU inference zone. Fail-closed ZDR attestation, checked live every 6 hours. Consent check. Drafts never shown to the member. 90-day purge. Human review.                       | 1×3 = 3 (while off) | **Before turning on:** company-held Vercel Pro with ZDR; review the provider's abuse-monitoring retention; TIA for OpenAI (not on DPF); AI Act art. 50 labels; expert attestation on review; update this DPIA.                                                                                                        |
| R9  | PHI ends up in logs or error monitoring (Sentry, Vercel logs) where it is unencrypted and broadly accessible                                        | 3×3 = 9      | `pnpm check:no-phi-logs` CI grep. Sentry PHI and JWT redaction. EU Sentry. Audit payload allowlist.                                                                                                                                | 2×3 = 6             | Run a staging log review to prove logs are PHI-free (security checklist, open). Keep Sentry at 90 days.                                                                                                                                                                                                               |
| R10 | Loss of availability or integrity of records: ransomware, vendor outage, **loss of the KEK makes all records permanently unreadable**               | 2×4 = 8      | Neon managed backups and PITR. Encrypted DEKs. Versioned KEKs.                                                                                                                                                                     | 2×3 = 6             | Documented KEK escrow (two custodians, offline copy). Restore test. Expert export so experts meet their own record duties.                                                                                                                                                                                            |
| R11 | Excessive retention, or erasure that destroys a record the expert must keep                                                                         | 3×3 = 9      | Retention sweep. D-12 pseudonymisation of expert-authored records. Deletion of member-authored rows. 14-day grace period.                                                                                                          | 2×2 = 4             | Eleva adopts the retention schedule on the DPO's advice. Schedule the hard delete of expert-authored records. Notify the expert before deletion.                                                                                                                                                                      |
| R12 | Data subjects cannot exercise rights or are not told about access to their health data (Lei 58/2019 art. 29(6)); controller role unclear to members | 3×3 = 9      | DSAR export. Deletion. Consent withdrawal. Health-data notice explains the expert-controller role.                                                                                                                                 | 2×3 = 6             | **Gap:** owning-expert reads are audited at 1% sampling only, and members get no access notification. Eleva must decide, on the DPO's advice, what art. 29(6)–(7) requires and whether to build an access log visible to members. Each control that decision requires must be implemented and verified before launch. |
| R13 | Minors' data processed without valid consent or safeguards                                                                                          | 2×4 = 8      | None specific today.                                                                                                                                                                                                               | 2×4 = 8             | `[[FOUNDER INPUT: may experts treat minors on Eleva? If yes, who books and consents (parent/guardian)?]]` Lei 58/2019 art. 16 (13 for online-service consent) does not settle consent to health care. Decide before launch.                                                                                           |
| R14 | Account takeover reveals bookings, published reports and documents                                                                                  | 3×3 = 9      | Better Auth. Rate limits. Optional 2FA and passkeys. Secure cookies. Magic link. Session cookie on `.eleva.care`.                                                                                                                  | 2×3 = 6             | Make 2FA mandatory for experts (they hold records). Notify new sign-ins. BotID in production (AUD-017).                                                                                                                                                                                                               |
| R15 | An unlicensed or impersonating professional gets health data                                                                                        | 2×4 = 8      | Only regulated professionals with an Ordem-verified licence (decision 4). Stripe Connect KYC.                                                                                                                                      | 1×4 = 4             | Document the verification procedure and periodic re-checks (RoPA C2). Collect the ERS registration number.                                                                                                                                                                                                            |
| R16 | Processor terms do not bind vendors to the company; DPAs accepted in a personal name                                                                | 3×2 = 6      | Vendor DPAs exist.                                                                                                                                                                                                                 | 3×2 = 6             | Move accounts and DPAs to the company before production health data (fact sheet "Contracting entity").                                                                                                                                                                                                                |

## 5. Measures already in code (art. 35(7)(d))

| Area                     | Measure                                                                                                                                      | Where                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Encryption at rest (app) | AES-256-GCM envelope. Per-organisation DEK wrapped by a versioned KEK. Crypto-shred by deleting the DEK. Fails closed on an unknown version. | `packages/encryption`, ADR-020                                  |
| Tenant isolation         | RLS on every tenant table. `withOrgContext`. Cross-org CI test.                                                                              | `packages/db/src/rls/policies.ts`, ADR-003                      |
| Clinical access model    | Author-only records. Member reads shared documents only. Clinic share inactive. Member opt-out.                                              | D-11, migrations 0061, `/me/record-access-optouts`              |
| Audit                    | `withAudit` outbox in the same transaction. Drainer to a separate append-only Neon project. `record.decrypted` read events.                  | `packages/audit`, `packages/records/src/decrypt-audit.ts`       |
| Video                    | Signed join grants. Per-invitee tokens. Two-person base cap (active delegates add places). Unique ids. Recording off. EU geo.                | `packages/video`, Phase 09                                      |
| AI                       | Feature flag off. Model allowlist. EU zone. Live ZDR attestation (fails closed). Consent check.                                              | `packages/ai`, `packages/flags` (`ff.ai_reports_beta`), ADR-009 |
| Consent                  | Versioned consents (`CONSENT_DOCUMENT_VERSION` 2026-10-24). `ai_processing` opt-in and withdrawal.                                           | `packages/compliance`                                           |
| Retention                | Daily sweep: AI drafts 90 days, documents 7×365 days, notification logs 365 days. D-12 pseudonymisation.                                     | `packages/compliance/src/retention.ts`                          |
| Rights                   | DSAR zip in private Blob with an HMAC link valid 24 hours. Deletion with 14-day grace.                                                       | `compliance-data-governance.md` DSAR runbook                    |
| Logging hygiene          | PHI log grep in CI. Sentry and JWT redaction.                                                                                                | `packages/observability`                                        |
| Abuse                    | Upstash rate limits. BotID (staged). Dual control for refunds above €200.                                                                    | `apps/api/src/lib/rate-limit.ts`, AUD-017, AUD-022              |
| Storage separation       | Private Blob store for PHI, public store for avatars and marketing only (boundary lint).                                                     | `packages/storage`                                              |

These measures match the CNPD's general security guidance (Diretriz/2023/1):
MFA for remote access, audit logs, encryption, and access logs recording date,
time, user and data accessed. The access-log point is only partly met because
owning-expert reads are sampled (R12).

## 6. Consultation

- **DPO (art. 35(2)):** pending appointment
  ([`dpo-appointment.md`](./dpo-appointment.md)).
- **Data subjects (art. 35(9)):** proposed. Run a short review of the
  transcription and AI consent copy with 5–10 pilot members and experts.
  `[[FOUNDER INPUT: pilot members/experts available for consultation]]`.
- **Processors:** the Daily and Vercel documentation was relied on. No
  written answers from the vendors are on file yet.

## 7. Conclusion and prior consultation (art. 36)

- **With the launch preconditions met**, no residual risk is rated high (8 or
  more). The preconditions are:
  - R1, R2 and R16 closed, and R8 while the flag is off;
  - R12 decided, with each control that decision requires implemented and
    verified;
  - R13 decided, with its safeguards in place.
- On that basis, **prior consultation with the CNPD under art. 36(1) is not
  required.** This conclusion **stays open** until those preconditions are met.
  A decision on R12 or R13 is not enough on its own. If the R12 decision
  requires full logging or member notifications, they must be built and
  verified first, and the R12 rating re-checked.
- **Video:** this conclusion does not cover production clinical sessions on
  Daily until the §2.6 gate is met.
- **Prior consultation becomes necessary before launch** in any of these
  cases:
  - the minors question (R13) is answered "yes" without safeguards;
  - AI drafting is switched on without the R8 preconditions;
  - production health data goes live while vendor DPAs are still in a
    personal name and no other mitigation exists.
- **Sign-off:**
  - DPO advice: `[[FOUNDER INPUT: DPO name, date, advice]]`;
  - controller decision: `[[FOUNDER INPUT: manager signature and date]]`.

## Points for lawyer/DPO review

1. Confirm that Regulamento 1/2018 items 2 and 9 (and possibly item 1) apply,
   and that the platform does not fall under the recital 91 exemption. The
   CNPD-hosted Portuguese translations of WP243 and WP248 quote recital 91
   with "hospital" in the exemption, which the English GDPR text does not
   contain. Check the official Portuguese text on EUR-Lex before relying on
   either wording.
2. **Art. 9 condition and funnel consent:** see RoPA point 1.
3. **Lei 58/2019 art. 29(6)–(7):**
   - Is the duty to notify the data subject of every access the
     expert-controller's duty alone?
   - Must Eleva, as processor, provide a full (not sampled) access log and a
     member-facing notification?
   - Has the joint Health/Justice portaria under art. 29(7) been published?
     (Not verified.)
4. **Minors (R13):** policy on whether experts may treat minors, and who
   consents.
5. **AI drafting (R8):**
   - acceptable provider terms (abuse-monitoring retention);
   - whether a model provider outside the DPF is acceptable at all for
     clinical content;
   - AI Act classification. Report drafting for a health professional is
     probably not high-risk under Annex III, but this should be confirmed.
6. **Transcription (R7):** whether the expert also needs to consent as a data
   subject (their voice is transcribed); the retention of transcripts.
7. **Prior consultation:** confirm the art. 36 conclusion once the
   preconditions are met.
8. **Volumes:** fill in §2.3 so that "large scale" is documented with
   numbers.

## Sources

- GDPR arts. 9, 28, 35, 36; recital 91:
  <https://eur-lex.europa.eu/eli/reg/2016/679/oj>
- CNPD Regulamento n.º 1/2018 (DR 2.ª série n.º 231, 30 Nov 2018, Regulamento
  n.º 798/2018): <https://www.cnpd.pt/umbraco/surface/cnpdDecision/download/121818>
- CNPD DPIA page:
  <https://www.cnpd.pt/organizacoes/outras-obrigacoes/avaliacao-de-impacto/>
- WP248 rev.01 (DPIA guidelines), EN:
  <https://ec.europa.eu/newsroom/article29/redirection/document/47711>; PT:
  <https://www.cnpd.pt/media/f0ide5i0/aipd_wp248rev-01_pt.pdf>
- WP243 rev.01 (DPO guidelines):
  <https://ec.europa.eu/newsroom/article29/redirection/document/44100>
- Lei 58/2019 art. 29:
  <https://diariodarepublica.pt/dr/detalhe/lei/58-2019-123815982>
- CNPD Diretriz/2023/1 (security measures):
  <https://www.cnpd.pt/umbraco/surface/cnpdDecision/download/122048>
- ERS teleconsultation guide (2024):
  <https://www.ers.pt/media/0grngycb/guia-pr%C3%A1tico_ers_-prestacao_teleconsultas.pdf>
