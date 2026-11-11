# Data protection impact assessment (DPIA)

> **Adopted by the controller for the public beta on 2026-11-07** (see §7).
> Version 1.0. The external DPO's art. 35(2) advice is added to §6 when the DPO
> takes up the role, and this assessment is reviewed against it.

- **Controller:** BÚZIOS E TARTARUGAS - LDA (Eleva.care), NIPC 515001708.
- **Scope:** the platform as a whole, centred on health data at scale and four
  higher-risk features:
  - booking with health professionals;
  - video sessions on **standard Daily** (EU call server, recording off).
    Production clinical video follows the gate in §2.6;
  - live transcription;
  - AI-drafted session reports.
- **Roles:**
  - Eleva is **controller** for platform processing (RoPA C1–C13).
  - Eleva is **processor** for clinical content (RoPA P1–P6).
  - For the processor part, this DPIA is the assistance Eleva owes each
    expert-controller under art. 28(3)(f). Experts can rely on it for their
    own art. 35 assessment.
- **Version:** 1.0, adopted 2026-11-07 (previous working version 2026-10-29).
  **Owner:** Rodrigo Barona, founder. **Next scheduled review:** 2027-05-07.
  **Review triggers** (any one brings the review forward):
  - turning on `ff.ai_reports_beta`;
  - clinic-shared records (Phase 11);
  - cloud recording (Phase 16.8 / D-08);
  - opening bookings to minors;
  - any new sub-processor handling health data;
  - a significant incident (breach-response §8);
  - the platform passing 50 active experts or 1,000 sessions in a month;
  - the external DPO's art. 35(2) advice.
- **Related:** [`ropa.md`](./ropa.md),
  [`retention-schedule.md`](./retention-schedule.md),
  [`breach-response.md`](./breach-response.md),
  [`../operator-tasks/backup-restore-kek-escrow.md`](../operator-tasks/backup-restore-kek-escrow.md),
  ADR-003, ADR-009, ADR-020, D-06, D-08, D-11, D-12.

## 1. Is a DPIA required?

Yes, on four independent grounds.

1. **GDPR art. 35(3)(b).** Large-scale processing of special categories of
   data (art. 9). The core activity is booking and supporting health care for
   many members across many professionals.
   - Recital 91 exempts "an individual physician, other health care
     professional or lawyer". It does not exempt a platform aggregating many
     professionals.
   - WP243 rev.01 §2.1.3 treats processing of health data "in the regular
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
   - **item 1**, as a supporting ground: "dispositivos eletrónicos que
     transmitam, por redes de comunicação, dados pessoais relativos à saúde"
     (video consultation over the internet). It is often read as covering
     wearables, so Eleva does not rely on it alone.
3. **WP248 rev.01** (endorsed by the EDPB). Meeting two criteria is normally
   enough to require a DPIA. Eleva meets five:
   - criterion 4, sensitive data;
   - criterion 5, large scale;
   - criterion 6, matching or combining datasets;
   - criterion 7, vulnerable data subjects (people receiving health care are
     listed expressly);
   - criterion 8, innovative use of technology (AI, transcription).
4. **Lei 58/2019 art. 29** sets specific conditions for health data that must
   be shown to be met:
   - need-to-know access;
   - secrecy duty;
   - electronic access;
   - notification of access;
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

**Public beta frame (adopted 2026-11-07).** The public beta runs on
`dev.eleva.care` with:

- members who are **adults (18+) booking for themselves** (R13);
- regulated experts whose licence Eleva verified with their Ordem before
  listing;
- preview deployments isolated from production data (decision log
  2026-11-07, "Preview deployments get their own database and secrets");
- recording off; AI drafts off (`ff.ai_reports_beta` false); transcription
  only with the member's `ai_processing` consent and the expert's start;
- production clinical video under the §2.6 gate.

### 2.2 Data flow

```text
Member/guest ──booking funnel──▶ apps/api (Vercel fra1) ──▶ Neon (Frankfurt)
   │  name, email, phone, service, time, consents incl. adult_confirmation, intake (encrypted)
   │                                   │
   │                                   ├─▶ Stripe Checkout (EEA entity, US replication)
   │                                   ├─▶ Resend / Twilio (notices without clinical content + signed join link)
   │                                   └─▶ Upstash (holds, rate limits, QStash jobs)
   │
   ├─ after confirmation (guest): guest-activation ─▶ unverified member account + personal Space (Neon)
   │
   └─/join/{bookingId}?g=──▶ Eleva join page ──▶ Daily room (eu-central-1, recording off)
                                                     │  live audio/video (transient)
                                                     ├─▶ Deepgram via Daily (EU) — only with ai_processing consent
                                                     │      └─▶ transcript → encrypted record (Neon)
                                                     └─▶ webhooks: meeting/participant events → attendance (Neon)

Expert ──notes, internal report, published report──▶ encrypted (per-org DEK) ──▶ Neon
Member or expert ──session document files──▶ private R2 (EU jurisdiction, provider encryption at rest); only the filename uses the per-org DEK
   └─(flag off) AI draft: transcript+notes ──▶ Vercel AI Gateway (EU zone, ZDR attestation) ──▶ model ──▶ draft (90-day TTL)

Every mutation ──withAudit──▶ audit_outbox ──drainer──▶ audit_events (separate Neon project, append-only)
```

### 2.3 Scope and scale

- **Data subjects:** adult members, including guests who book without an
  account; experts; clinic staff. Minors are out of scope (R13).
- **Volume at adoption (2026-11-07):** the platform is at the start of its
  public beta. It has one pilot expert (the co-founder pilot, decision log
  2026-11-06) and test bookings; a production read-only count on 2026-11-07
  found 22 unverified member accounts. Growth is expected to stay within tens
  of experts and hundreds of members in the first months of the beta.
- **Large scale** is assessed qualitatively (WP243 §2.1.3: number of people,
  volume, duration, geography), not by a numeric threshold. Eleva treats the
  processing as large scale from the start, because the core activity is
  health data across many professionals and records are kept for years. The
  review trigger at 50 active experts or 1,000 sessions in a month makes sure
  the measures are re-checked as volumes grow.
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

### 2.6 Video: production status

This DPIA assesses the **standard Daily** configuration that is built today:
EU call server (`geo: "eu-central-1"`), recording off
(`enable_recording: false`), per-invitee tokens. This is the intended EU
setup for Eleva video.

Production clinical sessions on Daily start when a **decision-log entry
approves that processing**, with its scope and conditions. That entry cites
this DPIA (R5, R6, R7) and confirms that:

- the Daily DPA is accepted in the company's name;
- Daily's DPF status has been rechecked on or after 2026-11-16;
- recording is confirmed off for the account.

R5 and R6 below are rated for the standard-Daily configuration. The §7
conclusion covers production clinical video from the date of that entry.

## 3. Necessity and proportionality (art. 35(7)(b))

| Principle                         | How it is met                                                                                                                                                                                                                                                                                                                       | Residual point and owner                                                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lawfulness (arts. 6, 9)           | Contract for booking and payment. **Adopted 2026-11-07:** art. 9(2)(h) with art. 9(3) and Lei 58/2019 art. 29 for health data that a booking reveals, plus the member's explicit `health_data_processing` consent (art. 9(2)(a)) for what Eleva handles as intermediary. Explicit `ai_processing` consent for transcription and AI. | The `health_data_processing` consent cannot be withdrawn while a confirmed future booking exists; 9(2)(h) carries that booking. Explained in the privacy notice §4. |
| Purpose limitation (art. 5(1)(b)) | No health data is used for advertising or profiling (health-data notice). AI is used only for the expert's own draft. No model training (AI notice).                                                                                                                                                                                | —                                                                                                                                                                   |
| Minimisation (art. 5(1)(c))       | Notifications carry no clinical content (Lane 2 schema; Resend DPA "sensitive data — not applicable"). No Daily token or clinical data in URLs. Bookings do not store date of birth or location; the adult check is a self-declaration, not an identity document. Audit payload allowlist.                                          | The expert's name and profession in an email still reveal a health relationship. Accepted as necessary.                                                             |
| Accuracy (art. 5(1)(d))           | The expert reviews every AI draft before publishing. The member can ask the expert to rectify.                                                                                                                                                                                                                                      | Transcription errors could enter the record. The expert reviews before relying on it.                                                                               |
| Storage limitation (art. 5(1)(e)) | Retention sweep: AI drafts after 90 days, notification logs after 365 days, session documents after 7 years. D-12 pseudonymisation on account deletion. Unused guest accounts deleted 12 months after the last booking ends (published commitment; sweep `sweepUnclaimedGuestAccounts`, owner engineering).                         | Hard delete of expert-authored records follows the retention schedule §4 engineering items.                                                                         |
| Integrity and confidentiality     | See §5.                                                                                                                                                                                                                                                                                                                             | See risks.                                                                                                                                                          |
| Transparency (arts. 12–14)        | Privacy, health-data, AI, terms and cookie notices published. The 2026-11-07 revision adds the art. 9 condition, guest accounts, adults-only bookings and a cookie list by name. Interim data protection contact `privacy@eleva.care` (founder).                                                                                    | Consent version moves to `2026-11-07` with this revision.                                                                                                           |
| Data subject rights               | Self-service DSAR export (target 10 minutes), account deletion with a 14-day grace period, consent withdrawal, record-access opt-out. Requests by email (including guests) answered within one month, identity confirmed through the booking email.                                                                                 | Erasure of clinical records is limited by art. 17(3)(b)/(c). This is explained in the UI (D-12).                                                                    |
| Processors (art. 28)              | Vendor DPAs listed in the fact sheet.                                                                                                                                                                                                                                                                                               | Accounts and DPAs move into the company's name (R16, accepted with a plan).                                                                                         |
| Transfers (chapter V)             | EEA storage; DPF and SCCs for US vendors.                                                                                                                                                                                                                                                                                           | Daily DPF recheck on or after 2026-11-16. TIAs for OpenAI (before AI drafts) and Beehiiv (before the newsletter embed).                                             |

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
- **Age.** Collecting an identity document or date of birth would be more
  intrusive than the risk requires for adults booking for themselves. A
  per-booking self-declaration, the expert's professional duty to check who
  they treat, and cancellation with a refund when a minor is found are
  proportionate.

## 4. Risk assessment (art. 35(7)(c))

**Scale.**

- Likelihood (L): 1 remote, 2 possible, 3 likely, 4 almost certain.
- Severity (S) for data subjects: 1 minimal, 2 significant, 3 serious, 4 very
  serious or irreversible.
- Risk = L × S: **1–3 low, 4–6 medium, 8–9 high, 12–16 very high.**
- "Inherent" means before the measures in §5. "Residual" means after the
  measures in place on 2026-11-07. The last column lists the follow-up
  measures, each with an owner, that keep or lower the residual rating.

| ID  | Risk to data subjects                                                                                                                               | Inherent L×S | Measures in place (§5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Residual L×S        | Follow-up measures (owner)                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | External attacker exfiltrates clinical records from the database or object store                                                                    | 3×4 = 12     | Per-organisation AES-256-GCM envelope encryption (ADR-020). KEK outside the database. RLS on every tenant table. Private R2 bucket with signed, time-boxed grants streamed through the API. Rate limits. Preview isolated from production data and keys (2026-11-07). KEK rotation runbook and escrow procedure adopted.                                                                                                                                                                                      | 1×4 = 4             | Complete the KEK escrow and first restore drill (backup runbook §3–§4, founder). Production console access limited to the founder with MFA (RoPA SEC-ACCESS). Penetration test before general availability (founder). |
| R2  | Eleva staff or a vendor's staff read clinical content                                                                                               | 3×4 = 12     | Staff never get plaintext (D-11). Break-glass decrypt is not built. Every staff read is audited (100%). Append-only audit project. Secrecy duty for anyone with production access (Lei 58/2019 art. 29(4)).                                                                                                                                                                                                                                                                                                   | 1×4 = 4             | Keep break-glass out of scope until Phase 12 dual control exists. Review `ADMIN_BYPASS_TABLES` (ciphertext only) at each review (engineering).                                                                        |
| R3  | Another expert, or the wrong expert, reads a member's records                                                                                       | 2×4 = 8      | Author-only SELECT/INSERT/UPDATE/DELETE on `records` (migration 0061). Clinic sharing compiled but off. Member opt-out API. Cross-org RLS test.                                                                                                                                                                                                                                                                                                                                                               | 1×4 = 4             | The Phase 11 toggle gets its own DPIA update (reason required, audited, member opt-out honoured).                                                                                                                     |
| R4  | Health information leaks through email, SMS or calendar invites (shared inbox, lock-screen preview, forwarded email)                                | 3×3 = 9      | No clinical content in notifications. Lane 2 schema. No Daily token in email or ICS. Join grant per booking and person, valid only in the window. Quiet hours.                                                                                                                                                                                                                                                                                                                                                | 2×2 = 4             | Keep subjects and bodies generic: "your session with {expert}" without the clinical specialty where possible. Move Twilio to IE1 (founder).                                                                           |
| R5  | An unauthorised person joins a video session (forwarded link, guessed room)                                                                         | 2×4 = 8      | Eleva join page. Signed grant. One meeting token per invitee. Two-person base cap for the assigned expert and the booking member; each active delegate adds one place. `enforce_unique_user_ids`. Grant window. Revocation ejects.                                                                                                                                                                                                                                                                            | 1×3 = 3             | Expert UI shows who is in the room. Staging two-browser webhook exit gate (engineering).                                                                                                                              |
| R6  | Video content is captured or retained by the provider; US access to call metadata                                                                   | 2×4 = 8      | Recording off (`enable_recording: false`). EU call server (`geo: "eu-central-1"`). Daily DPA. DPF and SCCs.                                                                                                                                                                                                                                                                                                                                                                                                   | 1×3 = 3             | Production clinical video under the §2.6 gate. Recheck Daily on the DPF list on or after 2026-11-16. Daily DPA in the company's name (founder).                                                                       |
| R7  | Transcription captures more than intended (third parties, unrelated disclosures), is inaccurate, or happens without a valid choice                  | 3×3 = 9      | Off by default. Member's explicit `ai_processing` consent. Withdrawal closes all rows. Live only, no audio. EU processing (`transcription_geo: "eu"`). Stored encrypted in the record.                                                                                                                                                                                                                                                                                                                        | 2×3 = 6             | Show a visible "transcribing" indicator to both parties; let either party stop it; the expert confirms consent before starting (engineering). Retention follows the record.                                           |
| R8  | AI drafts: provider retains or trains on clinical content; data leaves the EU; inaccurate drafts influence care                                     | 3×4 = 12     | `ff.ai_reports_beta` off. Approved-model allowlist. EU inference zone. Fail-closed ZDR attestation, checked live every 6 hours. Consent check. Drafts never shown to the member. 90-day purge. Human review.                                                                                                                                                                                                                                                                                                  | 1×3 = 3 (while off) | **Before turning on:** company-held Vercel Pro with ZDR; review the provider's abuse-monitoring retention; TIA for OpenAI; AI Act art. 50 labels; expert attestation on review; update this DPIA (founder).           |
| R9  | Health data ends up in logs or error monitoring (Sentry, Vercel logs) where it is unencrypted and broadly accessible                                | 3×3 = 9      | `pnpm check:no-phi-logs` CI grep. Sentry PHI and JWT redaction. EU Sentry. Audit payload allowlist.                                                                                                                                                                                                                                                                                                                                                                                                           | 2×3 = 6             | Staging log review to prove logs carry no health data (engineering). Keep Sentry at 90 days.                                                                                                                          |
| R10 | Loss of availability or integrity of records: ransomware, vendor outage, loss of the KEK                                                            | 2×4 = 8      | Neon managed storage with point-in-time restore. Encrypted DEKs. Versioned KEKs. **Adopted 2026-11-07:** backup, restore and KEK escrow runbook ([`backup-restore-kek-escrow.md`](../operator-tasks/backup-restore-kek-escrow.md)): restore window raised to at least 7 days (main) and 30 days (audit) before launch, two sealed offline KEK copies in the founder's custody, fingerprint check at each rotation, quarterly restore drill.                                                                   | 1×4 = 4             | Run the first drill and record it in the runbook log (founder). Expert record export so experts meet their own record duties (engineering).                                                                           |
| R11 | Excessive retention, or erasure that destroys a record the expert must keep                                                                         | 3×3 = 9      | Retention sweep. D-12 pseudonymisation of expert-authored records. Deletion of member-authored rows. 14-day grace period.                                                                                                                                                                                                                                                                                                                                                                                     | 2×2 = 4             | Schedule the hard delete of expert-authored records; notify the expert before deletion (engineering, retention schedule §4).                                                                                          |
| R12 | Data subjects cannot exercise rights or are not told about access to their health data (Lei 58/2019 art. 29(6)); controller role unclear to members | 3×3 = 9      | DSAR export. Deletion. Consent withdrawal. Health-data notice explains the expert-controller role. Every read of a record is logged, by staff, the member and the expert who wrote it (owning-expert reads were a 1% sample until 2026-11-11). **Position adopted 2026-11-07:** the art. 29(6) duty to notify access sits with the expert-controller; Eleva, as processor, gives the expert the audit evidence on request.                                                                                    | 2×3 = 6             | Build a full (not sampled) owning-expert access log and an access view for experts, so each expert can meet art. 29(6)–(7) without asking Eleva (engineering). Revisit with the DPO's advice.                         |
| R13 | Minors' data processed without valid consent or safeguards                                                                                          | 2×4 = 8      | **Adopted 2026-11-07: adults only for the public beta.** Terms and privacy state that accounts and bookings are for people aged 18 or over, booking for themselves. The booking funnel requires the per-booking `adult_confirmation` ("I am 18 or older and I am booking this session for myself, as set out in the booking terms"), stored with its version. Experts treat the person who booked; if a session is found to be for a minor, the expert may decline to start it and Eleva cancels and refunds. | 1×4 = 4             | Add the matching clause to the expert agreement (founder). Opening the platform to minors is a review trigger and needs a new assessment of who books and consents.                                                   |
| R14 | Account takeover reveals bookings, published reports and documents                                                                                  | 3×3 = 9      | Better Auth. Rate limits. Optional 2FA and passkeys. Secure cookies. Magic link. Session cookie on `.eleva.care`. Owner-first account linking (2026-11-06).                                                                                                                                                                                                                                                                                                                                                   | 2×3 = 6             | Make 2FA mandatory for experts (they hold records). Notify new sign-ins. BotID in production (AUD-017) (engineering).                                                                                                 |
| R15 | An unlicensed or impersonating professional gets health data                                                                                        | 2×4 = 8      | Only regulated professionals with an Ordem-verified licence (decision 4). Licence check before listing (RoPA C2 procedure). Stripe Connect KYC.                                                                                                                                                                                                                                                                                                                                                               | 1×4 = 4             | Yearly re-check of every listed expert's registration (founder).                                                                                                                                                      |
| R16 | Processor terms do not bind vendors to the company; DPAs accepted in a personal name                                                                | 3×2 = 6      | Vendor DPAs exist and are listed in the fact sheet.                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 2×2 = 4             | Move each vendor account and DPA into the company's name, health-data vendors first (Neon, Vercel, Daily, Cloudflare, Resend), before the beta opens to members outside the team (founder).                           |

## 5. Measures in place (art. 35(7)(d))

| Area                     | Measure                                                                                                                                                             | Where                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Encryption at rest (app) | AES-256-GCM envelope. Per-organisation DEK wrapped by a versioned KEK. Crypto-shred by deleting the DEK. Fails closed on an unknown version.                        | `packages/encryption`, ADR-020                                  |
| Key custody              | KEK escrow (two sealed offline copies, founder custody), fingerprint record, rotation and restore drill.                                                            | `docs/eleva-v3/operator-tasks/backup-restore-kek-escrow.md`     |
| Environment isolation    | Preview on its own Neon branch with its own KEK and auth secret; boot guard refuses a preview pointed at production.                                                | Decision log 2026-11-07                                         |
| Tenant isolation         | RLS on every tenant table. `withOrgContext`. Cross-org CI test.                                                                                                     | `packages/db/src/rls/policies.ts`, ADR-003                      |
| Clinical access model    | Author-only records. Member reads shared documents only. Clinic share inactive. Member opt-out.                                                                     | D-11, migrations 0061, `/me/record-access-optouts`              |
| Audit                    | `withAudit` outbox in the same transaction. Drainer to a separate append-only Neon project. `record.decrypted` read events.                                         | `packages/audit`, `packages/records/src/decrypt-audit.ts`       |
| Video                    | Signed join grants. Per-invitee tokens. Two-person base cap (active delegates add places). Unique ids. Recording off. EU geo.                                       | `packages/video`, Phase 09                                      |
| AI                       | Feature flag off. Model allowlist. EU zone. Live ZDR attestation (fails closed). Consent check.                                                                     | `packages/ai`, `packages/flags` (`ff.ai_reports_beta`), ADR-009 |
| Consent                  | Versioned consents (`CONSENT_DOCUMENT_VERSION`). Funnel: `terms`, `privacy`, `health_data_processing`, `adult_confirmation`. `ai_processing` opt-in and withdrawal. | `packages/compliance`                                           |
| Retention                | Daily sweep: AI drafts 90 days, documents 7×365 days, notification logs 365 days. D-12 pseudonymisation.                                                            | `packages/compliance/src/retention.ts`                          |
| Rights                   | DSAR zip in private R2 with an HMAC link valid 24 hours. Deletion with 14-day grace.                                                                                | `compliance-data-governance.md` DSAR runbook                    |
| Logging hygiene          | Health-data log grep in CI. Sentry and JWT redaction.                                                                                                               | `packages/observability`                                        |
| Abuse                    | Upstash rate limits. BotID on reserve, confirm and payment routes. Dual control for refunds above €200.                                                             | `apps/api/src/lib/rate-limit.ts`, AUD-017, AUD-022              |
| Storage separation       | Private R2 bucket for health files, public bucket for avatars and marketing only, with separate credentials (boundary lint).                                        | `packages/storage`                                              |
| Incident response        | Breach procedure adopted 2026-11-07 with named owner, alert routing and CNPD 72-hour clock.                                                                         | [`breach-response.md`](./breach-response.md)                    |

These measures match the CNPD's general security guidance (Diretriz/2023/1):
MFA for remote access, audit logs, encryption, and access logs recording date,
time, user and data accessed. Since 2026-11-11 every read of a session record
is logged, including the owning expert's (R12).

## 6. Consultation

- **DPO (art. 35(2)):** Eleva is appointing an external DPO
  ([`dpo-appointment.md`](./dpo-appointment.md)). The founder adopted this
  assessment as controller on 2026-11-07; the DPO's advice is recorded here
  when given, and the assessment is reviewed against it (review trigger).
- **Data subjects (art. 35(9)):** the co-founder pilot (decision log
  2026-11-06) is the first consultation of an expert. During the first three
  months of the beta, Eleva asks the first members and experts for feedback on
  the booking, consent and transcription copy and records the outcome at the
  next review.
- **Processors:** the Daily, Vercel, Neon, Stripe and Inth documentation was
  relied on. Vendor answers are filed with the DPAs.

## 7. Conclusion and adoption (art. 35(7), art. 36)

**Conclusion.** With the measures in §5, no residual risk is rated high (8 or
more). The highest residual ratings are medium (6): R7, R9, R12 and R14. Each
has a named follow-up measure in §4. **Prior consultation with the CNPD under
art. 36(1) is not required.**

**Scope of the conclusion.**

- It covers the public beta frame in §2.1: adults booking for themselves,
  regulated experts, booking, payment, notifications, in-person sessions,
  encrypted session records, consent-based transcription.
- It covers production clinical video on Daily from the date of the §2.6
  decision-log entry.
- It does not cover AI drafting. Turning on `ff.ai_reports_beta` requires the
  R8 measures and an update of this DPIA first.

**Prior consultation becomes necessary** if:

- minors are admitted without a new assessment and safeguards;
- AI drafting is switched on without the R8 measures;
- a residual risk is re-rated 8 or more at a review.

**Residual risks accepted by the controller.** The controller accepts the
residual risks in §4 as rated, with the follow-up measures and owners listed
there. Medium residual risks R7, R9, R12 and R14 are accepted for the beta and
re-assessed at the next review or at the first incident touching them.

**Adoption.**

| Role                 | Name                                          | Decision                                                         | Date           |
| -------------------- | --------------------------------------------- | ---------------------------------------------------------------- | -------------- |
| Controller (founder) | Rodrigo Barona, for BÚZIOS E TARTARUGAS - LDA | Adopts this DPIA, its conclusion and the accepted residual risks | 2026-11-07     |
| DPO (art. 35(2))     | External DPO, on appointment                  | Advice recorded in §6; review triggered                          | On appointment |

## 8. Follow-up actions

| #   | Action                                                                                                     | Owner                 | Due                                        |
| --- | ---------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------ |
| 1   | KEK escrow and first restore drill; raise Neon restore windows (backup runbook)                            | Founder               | Before members outside the team book       |
| 2   | Move health-data vendor accounts and DPAs into the company's name (R16)                                    | Founder               | Before members outside the team book       |
| 3   | Ship `adult_confirmation` in the funnel and reserve schema (R13); add the matching expert-agreement clause | Engineering / founder | With the 2026-11-07 consent version        |
| 4   | Ship `sweepUnclaimedGuestAccounts` (12 months after the last booking ends)                                 | Engineering           | Before the first account reaches 12 months |
| 5   | Full owning-expert access log and expert access view (R12)                                                 | Engineering           | Next review                                |
| 6   | Transcription indicator and stop control (R7); staging log review (R9); mandatory expert 2FA (R14)         | Engineering           | Next review                                |
| 7   | Daily DPF recheck and §2.6 decision-log entry                                                              | Founder               | On or after 2026-11-16                     |
| 8   | TIAs for OpenAI (before R8) and Beehiiv (before the newsletter embed)                                      | Founder               | Before each feature ships                  |
| 9   | Record the external DPO's art. 35(2) advice and review this DPIA                                           | Founder               | On appointment                             |

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
