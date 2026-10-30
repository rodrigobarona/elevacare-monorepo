# Expert processor terms: GDPR art. 28 checklist and gap list

> **Draft for review by a Portuguese lawyer and the external DPO. Not legal advice. This is a gap list only. It does not edit `packages/content/content/trust/pt/dpa.mdx`; another agent owns the public pages.**

## Scope

**Relationship covered.** Eleva acts as **processor** for each expert and each
clinic organisation, who are the **controllers**. The processing is RoPA
P1–P6:

- session records: intake, notes, internal and published reports;
- transcripts;
- AI drafts;
- session documents;
- the expert's CRM;
- the live video stream.

The current text is `packages/content/content/trust/pt/dpa.mdx`, "Acordo de
Tratamento de Dados (DPA)", effective 2025-12-31, `lastUpdated` 2026-10-22,
read on 2026-10-29. It is incorporated by reference in the expert agreement
§3 (`legal/pt/expert-agreement.mdx`).

**Clinics.** The expert agreement is the only incorporation path. There is no
clinic agreement in `packages/content/content/legal/` and no clinic acceptance
path, so a clinic cannot be treated as having accepted these terms yet. Add a
clinic agreement with its own DPA-version acceptance record before any clinic
acts as controller on Eleva (Phase 11).

**Legal test.** GDPR art. 28(3) requires a contract or other legal act,
binding on the processor, that sets out:

- the subject matter, duration, nature and purpose of the processing;
- the type of personal data and the categories of data subjects;
- the controller's obligations and rights;
- the eight duties (a)–(h).

Art. 28(9) requires it in writing, which includes electronic form. The
Commission's SCCs for art. 28 (Decision (EU) 2021/915) are an optional
template that would close most gaps at once.

Status key: ✅ covered · 🟡 partial · ❌ missing.

## 1. Art. 28(3) checklist

| Requirement                                                                                                                                                                         | dpa.mdx today                                                                                                                                                                                                              | Status | Gap → what the terms must add                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Subject matter and duration**                                                                                                                                                     | §1 and §3 describe roles. No duration.                                                                                                                                                                                     | 🟡     | Duration = the term of the expert agreement plus the retention and return period (§6 of the terms). Subject matter = hosting and supporting the expert's clinical records and session tools on Eleva.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Nature and purpose**                                                                                                                                                              | "armazenamos em segurança sob instruções" (§1, §3)                                                                                                                                                                         | 🟡     | List the operations: storage, encryption, display, export, live video relay, optional live transcription, optional AI drafting, retention sweeps, deletion.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Type of personal data**                                                                                                                                                           | "notas/ficheiros clínicos"                                                                                                                                                                                                 | 🟡     | Add intake, internal and published reports, transcripts, AI drafts, session documents, CRM contacts, tags and follow-ups, and the video stream. Mark health data (art. 9).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Categories of data subjects**                                                                                                                                                     | Not stated                                                                                                                                                                                                                 | ❌     | Members, guests, leads entered by the expert, third parties mentioned in records, and the expert's own voice in transcripts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Controller's obligations and rights**                                                                                                                                             | §8 lists the expert's duties: consents, art. 9(2)(h), retention, rights, accuracy                                                                                                                                          | 🟡     | Add: the right to instruct and to audit (see (h)); the duty to set the retention period at or above the Ordem floor; the duty to inform members (arts. 13–14) about their own processing; who notifies the CNPD and members in a breach.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **(a) Only on documented instructions**, including on transfers to third countries, unless EU or Member State law requires otherwise (then inform first)                            | §3 "Atuamos apenas com instruções documentadas". Transfers in §5.                                                                                                                                                          | 🟡     | Define the documented instructions: the terms, the product configuration and settings the expert chooses (retention, transcription, AI drafting, clinic sharing), and written requests. Add "unless required by law, in which case Eleva informs the controller before processing unless the law prohibits it".                                                                                                                                                                                                                                                                                                                                                            |
| **Art. 28(3), last subparagraph: inform the controller if an instruction infringes the GDPR**                                                                                       | Missing                                                                                                                                                                                                                    | ❌     | Add the clause.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **(b) Persons authorised are bound by confidentiality**                                                                                                                             | §9 "confidencialidade" (one word)                                                                                                                                                                                          | 🟡     | State that staff and contractors with access are under written confidentiality and the secrecy duty of Lei 58/2019 art. 29(4). State that staff have **no plaintext access** (D-11).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **(c) Art. 32 security measures**                                                                                                                                                   | §4: TLS 1.3, AES-256-GCM at rest, least privilege, RBAC, optional MFA, audit, encrypted backups, DR plans                                                                                                                  | 🟡     | Move the measures to an **annex of technical and organisational measures** that matches the code: per-organisation envelope encryption (ADR-020), RLS, author-only access (D-11), private Blob, signed grants, recording off, audit outbox. Remove claims not evidenced (TLS 1.3 everywhere, "DR plans") or evidence them. Make MFA mandatory for experts (DPIA R14).                                                                                                                                                                                                                                                                                                      |
| **(d) Sub-processors**: prior specific or general written authorisation; notice of changes and right to object; the same obligations flowed down (art. 28(4)); Eleva remains liable | §12: general authorisation, 30 days' notice, objection with a termination right. §3 lists Neon, Vercel, Upstash for clinical data. §12 table: Neon, Vercel, Upstash, Resend, "Eleva notifications", "Better Auth", Stripe. | 🟡     | (1) **The list is wrong and incomplete.** Better Auth is self-hosted, not a sub-processor. "Eleva notifications" is Eleva itself. Missing for clinical data: **Daily.co and Deepgram** (video and transcription), **Vercel Blob** (private store), **Vercel AI Gateway → model provider** (AI drafts, when enabled), Sentry (scrubbed errors). Use the fact sheet §2 as SSOT, or link `/trust/sub-processors`. (2) Add the **flow-down clause** (same data-protection obligations by contract). (3) Add **Eleva's liability** for sub-processors (art. 28(4), last sentence). (4) Name the notification channel for changes (email to the expert's account plus the page). |
| **(e) Assist with data subject rights** (arts. 12–22)                                                                                                                               | §7 "Fornecemos ferramentas para que os especialistas cumpram pedidos"                                                                                                                                                      | 🟡     | Specify: an export of a member's full record, including internal reports and transcripts; rectification by the author; deletion; forwarding requests that Eleva receives to the expert within N days; the D-12 default retention on member account deletion and the expert's right to delete early. Add access-log support for Lei 58/2019 art. 29(6) (see D-11).                                                                                                                                                                                                                                                                                                          |
| **(f) Assist with arts. 32–36**: security, breach notification, DPIA, prior consultation                                                                                            | §9 "apoiar … DPIAs; notificar violações sem demora". §4 "SLA de notificação de violação … 24h".                                                                                                                            | 🟡     | Add: breach notice content (art. 33(3) items) and the 24-hour target ([`breach-response.md`](./breach-response.md)); provision of Eleva's DPIA ([`dpia.md`](./dpia.md)) to experts; assistance with **art. 36 prior consultation**.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **(g) Delete or return all data at the end, at the controller's choice**, unless law requires storage                                                                               | §6 "Em término/instrução, exportamos e eliminamos após período de graça e janela de backups". Clinical retention "definida pelo especialista (p. ex., 10 anos em PT)".                                                     | 🟡     | (1) Make it **at the controller's choice**: return (export) or delete. (2) State the grace and backup windows in days. (3) Remove "10 anos em PT", which has no statutory basis ([`retention-schedule.md`](./retention-schedule.md)). Replace it with the platform default (7 years after the last session, proposed) and per-organisation settings. (4) Cover what happens if the expert neither exports nor instructs. (5) Cover the expert's death or incapacity (Ordem custody rules).                                                                                                                                                                                 |
| **(h) Make available all information needed to demonstrate compliance; allow and contribute to audits and inspections**                                                             | Missing                                                                                                                                                                                                                    | ❌     | Add an audit clause: documentation first (this pack, SOC 2 reports of vendors under NDA); on-site or remote audits with reasonable notice, at the controller's cost, at most once a year unless there is a breach or a regulator request; confidentiality.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Art. 28(9): in writing, including electronic form, and accepted**                                                                                                                 | Online page; incorporated through the expert agreement                                                                                                                                                                     | 🟡     | No acceptance record was found in the code on 2026-10-30: `CONSENT_KINDS` has no expert-agreement or DPA kind. Add a record of each expert's acceptance of the agreement and DPA **version** at onboarding, and re-accept on material change. **Define the version mapping first.** `CONSENT_DOCUMENT_VERSION` versions the published legal pages, while the DPA has its own effective date, and nothing maps one to the other. Either state that the DPA uses the same identifier, or add a DPA-specific version.                                                                                                                                                         |

## 2. Other gaps and inconsistencies in dpa.mdx

1. **Regulatory wording.** The DPA says Eleva's status "por ex., registo como
   plataforma de telemedicina" is distinct from its GDPR roles. This conflicts
   with founder decision 1: intermediary, no ERS registration. It may be read
   as an admission that Eleva is a telemedicine unit. See
   [`ers-position.md`](./ers-position.md) §4.
2. **"Os seus dados permanecem na UE por padrão."** Storage is in the EU, but
   some vendors process or access data from the US:
   - Resend (primary processing in the US);
   - Twilio (US1);
   - Daily (account metadata in the US);
   - Stripe (replication to the US).

   Qualify the claim, as the fact sheet does.

3. **Transfers (§5).** Name the mechanisms per vendor: DPF plus SCCs. Note
   that clinical content at rest is ciphertext.
4. **Analytics** listed among controller processing ("product analytics when
   enabled and consented"). No analytics is live (fact sheet §3). Keep it only
   if future-proofing is intended, and mark it "not active".
5. **DPO contact `dpo@eleva.care`.** The public DPA still publishes this
   address and labels it the DPO contact, but no DPO is appointed yet.
   **Proposed replacement, not yet live:** `privacy@eleva.care` as the single
   interim and published data protection contact (fact sheet §1), routed to the
   DPO after the appointment
   ([`dpo-appointment.md`](./dpo-appointment.md) §6). The same address is on the
   expert agreement, privacy and security pages. This handoff to the public
   pages is recorded in the decision log (2026-10-30).
6. **Effective date 2025-12-31 vs `lastUpdated` 2026-10-22.** Make sure the
   effective date reflects the version experts accepted.
7. **Clinic organisations.** For a clinic, the **clinic** is the controller,
   not each expert. The terms should say who the controller is for clinic
   records, and how clinic-shared reads (D-11, Phase 11) are instructed.
8. **Transcription and AI.** Add specific instructions:
   - transcription only with the member's `ai_processing` consent, which
     Eleva collects on the expert's behalf;
   - AI drafts only when enabled, with EU inference and zero-retention, never
     used for training, deleted after 90 days if unpublished.
9. **Video.** State that live audio and video are relayed through Daily in the
   EU (Frankfurt), are not recorded, and are not HIPAA-covered.
10. **Liability (§10).** No allocation under art. 82 between controller and
    processor, and no cap. The lawyer should align this with the expert
    agreement §9.
11. **Lei 58/2019 art. 29.** No reference to the Portuguese health-data rules:
    secrecy, electronic access, access notification. Add a clause that Eleva
    supports the expert's compliance with them.
12. **Governing law (§11).** Portugal is fine. Consider naming a court
    (comarca de Lisboa Oeste – Cascais or Lisboa).

## 3. Recommended structure for the rewritten terms

1. Parties and roles (expert or clinic = controller; Eleva = processor).
2. Annex 1, description of processing: subject matter, duration, nature,
   purpose, data types, data subjects. Use RoPA P1–P6.
3. Instructions, including the in-product settings; the infringement notice.
4. Confidentiality and secrecy (Lei 58/2019 art. 29(4)).
5. Annex 2, security measures, generated from the code facts.
6. Sub-processors: general authorisation, a link to `/trust/sub-processors`,
   30 days' notice, objection, flow-down, liability.
7. Data subject rights: the assistance, the forwarding SLA, export tools,
   access logs.
8. Breach notification: 24 hours, content, cooperation.
9. DPIA and prior consultation assistance.
10. Transfers: mechanisms; encryption as a supplementary measure.
11. Retention, return and deletion: platform default, per-organisation
    setting, export window, backups, the expert's departure, death or
    incapacity.
12. Audits and information.
13. Liability and indemnity.
14. Term, changes and acceptance; the prevailing language is Portuguese.

Alternatively, adopt the **Commission SCCs under art. 28(7)** (Decision (EU)
2021/915) as the core text and keep Eleva-specific annexes.

## Points for lawyer/DPO review

1. Whether to adopt the Commission's art. 28 SCCs (2021/915) as the base text.
2. Controller identity for clinic records (the clinic vs the individual
   expert), and joint-controller risk where a clinic and an expert both
   decide.
3. Whether the platform-default retention can lawfully be a **default
   instruction** that the expert accepts by agreeing to the terms (D-12).
4. The audit-clause scope and cost allocation for a micro-enterprise
   processor.
5. Liability allocation and caps between Eleva and experts (art. 82(4)–(5)).
6. How acceptance of the DPA version is evidenced (art. 28(9)), and whether the
   DPA shares `CONSENT_DOCUMENT_VERSION` or gets its own version.
7. How a clinic organisation accepts the terms as controller.

## Sources

- GDPR art. 28: <https://eur-lex.europa.eu/eli/reg/2016/679/oj>
- Commission Implementing Decision (EU) 2021/915 (art. 28 SCCs):
  <https://eur-lex.europa.eu/eli/dec_impl/2021/915/oj>
- EDPB Guidelines 07/2020 on the concepts of controller and processor:
  <https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-072020-concepts-controller-and-processor-gdpr_en>
- Lei 58/2019 art. 29:
  <https://diariodarepublica.pt/dr/detalhe/lei/58-2019-123815982>
