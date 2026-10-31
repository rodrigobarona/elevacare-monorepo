# Personal data breach response procedure

> **Draft for review by a Portuguese lawyer and the external DPO. Not legal advice. Not yet adopted. Run a tabletop exercise before relying on it.**

- **Scope:** every suspected personal data breach at Eleva or at one of its
  sub-processors. This covers:
  - Eleva's role as **controller** (GDPR arts. 33–34);
  - Eleva's role as **processor** for experts (art. 33(2): notify the
    controller "without undue delay").
- **Definition (art. 4(12)):** "a breach of security leading to the accidental
  or unlawful destruction, loss, alteration, unauthorised disclosure of, or
  access to, personal data". Three kinds count:
  - **confidentiality** breaches (data seen by someone who should not see it);
  - **integrity** breaches (data altered);
  - **availability** breaches (data lost, or out of reach long enough to
    matter, e.g. records unavailable during care).
- **Related:**
  - [`dpia.md`](./dpia.md) (risk register);
  - [`ropa.md`](./ropa.md) (what data lives where);
  - `docs/eleva-v3/ops-observability-spec.md`;
  - `docs/eleva-v3/support-escalation-matrix.md`;
  - `docs/eleva-v3/security-hardening-checklist.md`.

## 1. Deadlines at a glance

| Duty                                              | Deadline                                                                                                                                                       | Source                                           |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Notify the CNPD (Eleva as controller)             | **Without undue delay and, where feasible, within 72 hours of becoming aware**, unless the breach is unlikely to result in a risk. Give reasons for any delay. | GDPR art. 33(1)                                  |
| Phased notification                               | Allowed when not all facts are known. Send what you have and complete it later ("alterar notificação" on the CNPD form).                                       | Art. 33(4). EDPB Guidelines 9/2022 ¶56–57.       |
| Notify the expert-controller (Eleva as processor) | **Without undue delay**, with no prior risk assessment by Eleva. Eleva's DPA promises **24 hours** for clinical data.                                          | Art. 33(2). EDPB 9/2022 ¶44–45. `/trust/dpa` §4. |
| Tell the data subjects                            | **Without undue delay** when the breach is likely to result in a **high** risk, unless an art. 34(3) exception applies                                         | Art. 34                                          |
| Internal register                                 | **Every** breach, notified or not: facts, effects, remedial action                                                                                             | Art. 33(5). EDPB 9/2022 ¶121–123.                |
| Sub-processor notifying Eleva                     | Under each vendor DPA. Eleva is aware once the vendor tells Eleva.                                                                                             | Art. 28(3)(f). Vendor DPAs.                      |

**When the clock starts.** The 72 hours start when Eleva is "aware", that is,
when it has "a reasonable degree of certainty that a security incident has
occurred that has led to personal data being compromised" (EDPB 9/2022 ¶31). A
short investigation to establish this is allowed and must start immediately
(¶34).

**Lead authority (Eleva as controller).** For Eleva's controller-role
processing the CNPD is the competent authority. Eleva's main establishment is
in Portugal, so the CNPD is also the lead supervisory authority for
cross-border processing, even when members in other EU states are affected
(arts. 55 and 56(1); EDPB 9/2022 ¶67–69).

**Eleva as processor.** Eleva notifies the expert-controller, not the CNPD.
Which authority the controller must notify depends on that controller's
establishment and processing, so this procedure does not settle it. Confirm it
per expert-controller with the DPO.

## 2. Roles

| Role            | Who                                                                                                                                                                                              | Responsibilities                                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Incident lead   | `[[FOUNDER INPUT: name/role — default the founder]]`                                                                                                                                             | Owns the incident end to end. Decides on containment. Signs notifications.                                                                                                                                           |
| Technical lead  | `[[FOUNDER INPUT: engineering owner]]`                                                                                                                                                           | Investigation, containment, evidence preservation, root cause.                                                                                                                                                       |
| DPO             | External DPO ([`dpo-appointment.md`](./dpo-appointment.md)) once appointed. Until then the interim data protection contact: `[[FOUNDER INPUT: interim contact name/role]]`, `privacy@eleva.care` | Advises on risk and the duty to notify. Contact point for the CNPD. Reviews notices. Keeps the register with the incident lead. Must be reachable within 4 hours. Advises only: the incident lead decides for Eleva. |
| Communications  | Founder                                                                                                                                                                                          | Member, expert and public messaging. Support macros.                                                                                                                                                                 |
| Legal counsel   | `[[FOUNDER INPUT: law firm]]`                                                                                                                                                                    | Criminal complaint, police and Ministério Público, contractual claims against vendors.                                                                                                                               |
| Vendor contacts | Vercel, Neon, Upstash, Stripe, Daily, Resend, Sentry, Twilio, TOConline                                                                                                                          | Security and support channels listed in the private ops vault, not in this repo.                                                                                                                                     |

No DPO is appointed yet. Until one is, read "the DPO" in this procedure as the
interim data protection contact, supported by legal counsel. Art. 33(3)(b)
allows a DPO or another contact point.

Lei 58/2019 art. 11(b) gives the DPO the task of making staff aware that
incidents must be detected promptly and reported **immediately** to the
security lead. **Anyone at Eleva who suspects a breach reports it at once** to
the incident lead and to `privacy@eleva.care`. Reporting does not wait for
proof.

## 3. Detection sources

- **Sentry** (EU, org `prood`): error spikes and authorisation failures.
  PHI and JWT redaction are applied by `packages/observability`.
- **Vercel** function and edge logs on the `elevacare-api` and app projects:
  unusual traffic and 401/403/429 spikes.
- **Upstash rate-limit counters**: credential stuffing and enumeration.
- **Audit stream** (`audit_events` in the audit Neon project):
  - unusual `record.decrypted` volume;
  - staff reads (100% audited);
  - `org_data_key` events (`rotated`, `shredded`);
  - membership and role changes;
  - refunds above the dual-control threshold.
- **Stripe** Radar and dispute alerts. **Daily** webhooks: unexpected
  participants in a room.
- **Vendor security notices**, received by email at the addresses on vendor
  accounts. Today some of these are personal addresses; see the fact sheet,
  "Contracting entity".
- **Reports** from members, experts or researchers to `support@`, `privacy@`
  or `legal@`.

## 4. Procedure

### Step 0. Report (minute 0)

Open an incident record in the breach register (§8). Note the time Eleva
became aware, or the time of the first report if awareness is not yet
established.

### Step 1. Triage (target: within 4 hours)

- Is personal data involved? Which data (see the RoPA), whose, and how many
  people?
- Is Eleva the controller (platform data), the processor (clinical content:
  RoPA P1–P6), or both?
- Is the breach ongoing? Bring in the DPO.

### Step 2. Contain (immediately, in parallel)

| Scenario               | Action                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leaked secret          | Rotate it in Vercel env and redeploy. For KEK suspicion, run `rotateKek` (ADR-020); never delete an old KEK while rows reference it. Rotate `BETTER_AUTH_SECRET` (invalidates sessions and DSAR links), `RETENTION_PSEUDONYM_KEY` only with the DPO (it breaks pseudonym linkage), Stripe, Daily, Resend and Blob tokens. |
| Compromised account    | Revoke Better Auth sessions. Force a password reset. Disable API keys.                                                                                                                                                                                                                                                    |
| Exposed storage object | Delete through `@eleva/storage` and rotate the bucket token. Confirm the object was in the **private** bucket.                                                                                                                                                                                                            |
| Join link misuse       | Revoke the participant, which ejects them. Delete the room.                                                                                                                                                                                                                                                               |
| Misdirected email      | Ask the recipient to delete it. Suppress the address. Fix the template.                                                                                                                                                                                                                                                   |
| Vendor breach          | Get the vendor's facts in writing. Assess Eleva's exposure through the RoPA.                                                                                                                                                                                                                                              |

**Preserve evidence.** Export the relevant logs and audit rows before any
retention purge. Sentry and Vercel log retention is short.

### Step 3. Assess risk (target: within 24 hours)

Use the severity matrix (§5). Factors to weigh (EDPB 9/2022 §IV):

- type of breach;
- nature, sensitivity and volume of the data;
- how easily individuals can be identified;
- severity of consequences;
- vulnerable individuals;
- number of people affected.

**Health data: default rule.** EDPB 9/2022 ¶102: where a breach involves
health data, damage "should be considered likely to occur". Every breach
involving health data is classified **S3 or S4** (notify the CNPD and the data
subjects) **unless** one of the two low-risk exceptions in §5 (E1, E2) applies
and its evidence is recorded in the register. The same exception decides
**both** duties: if it applies, the breach is "unlikely to result in a risk"
(no CNPD notification under art. 33(1)) and no communication to data
subjects is needed (art. 34). If the evidence is incomplete, or the DPO advises
against relying on the exception, the default rule applies.

**Reclassification does not reset the clock.** If new facts undermine the
evidence (for example, the keys turn out to be exposed), re-classify at once
and notify without further delay. Art. 33(1) runs from awareness of the breach,
not from a later change in its risk rating. Keep the original awareness time in
the register and add the time the new facts were found. If notification now
falls more than 72 hours after the original awareness time, give the reasons
for the delay. If the new facts reveal a separate breach, open a separate entry
with its own awareness time.

### Step 4. Notify the expert-controllers (processor role, within 24 hours)

For incidents touching clinical content (P1–P6), notify every affected expert
or clinic. Use template B. Give them what they need to meet their own duties
under arts. 33 and 34. Offer to prepare the CNPD notice and the member notices
for their approval.

Record the date and time of each notice in the register. In principle the
controller becomes aware once Eleva informs them (EDPB 9/2022 ¶44), but an
earlier independent discovery counts, so the template states the notice time
and asks the controller to use their actual awareness time. Eleva may file for
a controller only with proper authorisation in the contract, and the legal
responsibility to notify stays with the controller (¶48).

Where Eleva is also controller for the same incident (for example a database
breach covering both booking data and records), coordinate one message to
members. The incident lead decides, on the DPO's advice.

### Step 5. Notify the CNPD (controller role, within 72 hours of awareness)

Notify unless the breach is "unlikely to result in a risk". If in doubt,
notify.

- Start from the CNPD guidance page
  <https://www.cnpd.pt/organizacoes/outras-obrigacoes/violacao-de-dados-ou-data-breach/>
  and follow its link to the online notification form,
  <https://www.cnpd.pt/databreach/> (checked 2026-10-30). The form is an
  ASP.NET page that needs **cookies enabled**. Without cookies, its
  cookie-detection redirect (`?AspxAutoDetectCookieSupport=1`) loops. Use a
  normal browser session, not a privacy mode that blocks cookies.
- Choose a new notification, or "alterar notificação" to complete a phased
  one.
- The form is only for art. 33 notifications. Its detailed fields were not
  captured in this draft; template A covers the art. 33(3) content.
- Save the submission receipt in the register.

### Step 6. Communicate to data subjects (if high risk)

Use template C, in the member's locale (EN/PT/ES). Use clear and plain
language (art. 34(2)). Communicate directly by email, plus an in-app notice.

Use a public communication only where individual contact would involve
disproportionate effort (art. 34(3)(c)). **Never put clinical details in the
notice.**

### Step 7. Other notifications (case by case)

- **Police / Ministério Público** for criminal attacks.
- **Card networks via Stripe** if payment data is affected.
- **Vendors** under their DPAs.
- **Insurers** `[[FOUNDER INPUT: cyber insurance policy, if any]]`.
- **CNCS** (Centro Nacional de Cibersegurança): only if Eleva is in scope of
  the NIS2 transposition. Not assessed in this pack; see Points for review.

### Step 8. Close (within 30 days)

- Root cause and lessons learned.
- Update the DPIA risk register and this procedure.
- Complete the register entry (art. 33(5)).
- Fix tickets with owners and dates.

## 5. Severity matrix

| Severity        | Typical facts                                                                                                                                                                                    | CNPD (art. 33)                    | Data subjects (art. 34)                           | Experts (processor)                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------- | --------------------------------------------- |
| **S1 Low**      | Personal data, no health data. Few people. Contained at once, no evidence of access. E.g. one booking confirmation sent to the wrong address of the same member, or a short availability outage. | Usually no. Record the reasoning. | No                                                | If clinical content is involved, yes (inform) |
| **S2 Medium**   | Contact or account data of many people, or a small number of people with non-clinical data that reveals a health relationship (expert name or profession).                                       | **Yes**                           | Case by case (incident lead, on the DPO's advice) | Yes                                           |
| **S3 High**     | Health data in plaintext for any number of people: notes, transcripts, documents, intake. Or credentials enabling access to records. Or a prolonged availability loss of records during care.    | **Yes**                           | **Yes**, unless art. 34(3) applies                | Yes, within 24 hours                          |
| **S4 Critical** | S3 at scale, a KEK compromise, an ongoing exfiltration, or publication of health data                                                                                                            | **Yes**, phased if needed         | **Yes**, plus a public statement if needed        | Yes, immediately                              |

**Low-risk exceptions for health-data incidents.** These are the only ways a
health-data incident can fall below S3. Each needs the listed evidence in the
register, the DPO's written advice and the incident lead's recorded decision.
Each applies to the CNPD (art. 33)
and data-subject (art. 34) decisions together.

| ID     | Exception                                                                                                                                                    | Required evidence (in the register)                                                                                                                                                                                                                                                                                                                                             | CNPD (art. 33)                                    | Data subjects (art. 34)     | Experts (processor) |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------- | ------------------- |
| **E1** | **Unintelligible data.** Only application-encrypted ciphertext was exposed (AES-256-GCM, per-organisation DEK, ADR-020). Confidentiality only.               | (1) Which tables or objects were exposed, and that the content fields were ciphertext. (2) Why the KEK (`ELEVA_KEK_V<n>`) and the `org_data_keys` DEKs were **not** compromised: no env-var or secret exposure, Vercel and Neon access logs reviewed. (3) No plaintext copies exposed (logs, Sentry, DSAR zips). (4) An intact backup exists, so there is no availability loss. | **No** (art. 33(1): unlikely to result in a risk) | **No** (art. 34(3)(a))      | Inform (template B) |
| **E2** | **Contained disclosure to a trusted recipient.** Minor health information (EDPB 01/2021 ¶115) about one or very few people, sent to an identified recipient. | (1) The recipient is identified and trusted (e.g. a health professional bound by secrecy). (2) Written confirmation that the data was deleted and not used or forwarded, received within 24 hours. (3) The information is minor: no mental-health content, notes, transcripts or diagnoses. (4) No further exposure (e.g. the message was not forwarded).                       | **No**                                            | **No** (art. 34(1) not met) | Inform (template B) |

E1 and E2 do **not** apply to:

- availability breaches of records during care, where no backup can restore
  them in time;
- KEK or DEK exposure (S4);
- plaintext notes, transcripts, documents or intake reaching anyone outside
  the expert's practice.

**Worked examples, adapted from EDPB Guidelines 01/2021:**

- **Ransomware with good backups and no exfiltration** (case 03, hospital):
  notify the SA. Tell patients who are affected by delays.
- **Stolen log book with health data** (case 12): notify the SA and the data
  subjects.
- **Health data, minor nature** (¶115, lactose intolerance): low risk only if
  exception E2 applies with its evidence. Otherwise use the default rule.

## 6. Templates

### A. CNPD notification (art. 33(3) content)

Submitted through the online form. This text prepares the answers.

```text
1. Controller: BÚZIOS E TARTARUGAS - LDA (Eleva.care), NIPC 515001708, Rua Gil Vicente 2,
   2775-198 Parede. Contact point: [DPO name once appointed, otherwise the interim data
   protection contact], privacy@eleva.care, [phone].
   Role in this breach: controller [and/or processor on behalf of N health professionals].
2. Timeline: occurred [date/time or window]; detected [date/time] via [source];
   aware [date/time]; contained [date/time]. [If >72h: reasons for delay.]
3. Nature of the breach: [confidentiality / integrity / availability]; cause [e.g. leaked
   API token / misconfigured access / vendor incident at X / human error].
4. Categories and approximate number of data subjects: [members ~N; experts ~N; guests ~N];
   [countries].
5. Categories and approximate number of records: [account data; booking metadata;
   health data (art. 9): notes/transcripts/documents — N]; encrypted at rest with
   per-organisation keys: [yes/no; were keys exposed?].
6. Likely consequences: [e.g. disclosure of the fact of a psychology appointment;
   disclosure of clinical content; phishing risk].
7. Measures taken or proposed: [containment; credential rotation; forced logouts;
   vendor actions; monitoring]; measures to mitigate adverse effects on individuals: [...].
8. Communication to data subjects: [done on date, by email + in-app / planned / not
   required because art. 34(3)(a|b|c) — reasons].
9. Cross-border: [members in other EU states? list].
10. This is an [initial / follow-up] notification; further information expected by [date].
```

### B. Notice to an expert-controller (processor role)

```text
Subject: Eleva security incident affecting records you control — action may be needed

Dear [expert],

We are writing as your processor under our data processing terms (GDPR art. 28 and 33(2)).
On [date/time] we became aware of an incident affecting [describe data, e.g. session
documents uploaded for N of your bookings between X and Y].
Time of this notice: [date/time, Europe/Lisbon].

What happened: [plain facts].
Data involved: [categories; number of your members affected — list available in your
dashboard / attached securely].
Encryption: [the content was / was not encrypted with your organisation's key; the key
was / was not exposed].
What we have done: [containment].
What you may need to do: as controller you decide whether to notify your supervisory
authority (the CNPD if you are established in Portugal), without undue delay and, where
feasible, within 72 hours of becoming aware. In principle you become aware when you receive
this notice. If you knew of this incident earlier, your time runs from that earlier moment.
Any short check of your own should start at once. If the risk to your members is high, you
must also inform them. We have prepared a draft notice and member message for your approval
and can file or send them on your written instruction.

Contact: our data protection contact [DPO name once appointed, otherwise the interim
contact], privacy@eleva.care, [phone]. We will update you by [date/time].
```

### C. Notice to members (art. 34)

Translate into PT and ES. Keep the clinical detail out.

```text
Subject: Important: a security incident involving your Eleva account

Hello [first name],

On [date] we found that [plain description, e.g. "an unauthorised person was able to
access some files stored with your bookings"]. We are telling you because this may affect
you.

What information was involved: [e.g. your name, email and the date of a session with
[expert]; documents you or your expert uploaded]. [Your payment card details were not
involved.]

What we have done: [e.g. closed the access, reset sign-in links, informed the data
protection authority (CNPD) and your expert].

What you can do: [e.g. be careful with emails that ask for your password; sign in and
review your account; contact your expert if you have questions about your care].

If you have questions, write to our data protection contact at privacy@eleva.care or reply to
this email. You also have the right to complain to the CNPD (www.cnpd.pt).

Eleva.care — BÚZIOS E TARTARUGAS - LDA
```

## 7. Commitments to align with

- **`/trust/dpa` §4 promises a 24-hour notice to controllers for clinical
  data.** Keep it achievable. The DPO should confirm the SLA, or change the
  DPA wording to "without undue delay and in any case within 24 hours of
  confirmation".
- **Vendor DPAs.** Keep each vendor's breach-notice clause, security contact
  and Eleva's receiving address in the ops vault. Vendor notices must go to a
  company mailbox, not a personal one.

## 8. Breach register (art. 33(5))

Keep it as a restricted spreadsheet or table in the compliance folder, not in
this repo. Columns:

| ID  | Aware (date/time) | New facts found (date/time) | Reported by | Description | Data categories | Data subjects (number) | Role (C/P) | Severity | Risk reasoning | CNPD notified (date, receipt) | Reasons for any delay | Subjects told (date, channel) / exception | Experts told (date/time) | Containment and remedy | Root cause | Closed |
| --- | ----------------- | --------------------------- | ----------- | ----------- | --------------- | ---------------------- | ---------- | -------- | -------------- | ----------------------------- | --------------------- | ----------------------------------------- | ------------------------ | ---------------------- | ---------- | ------ |

Retention: **5 years** after closure. This is a proposal, not a statutory
period: art. 33(5) sets none. The register evidences accountability (art.
5(2)). Lei 58/2019 art. 21(3) allows data needed to prove compliance to be kept
until the limitation period for the corresponding rights has expired; it does
not fix five years. Counsel must name the limitation period or other legal
basis that supports the proposal.

## Points for lawyer/DPO review

1. **Default classification of health-data incidents as high risk**, and the
   two low-risk exceptions (E1 ciphertext with keys safe; E2 contained
   disclosure to a trusted recipient). Confirm the evidence required, and that
   one exception may decide both the art. 33 and the art. 34 question.
2. **The 24-hour processor SLA** in the public DPA. Keep it or reword it?
3. **NIS2 / CNCS.** Is Eleva in scope of the Portuguese NIS2 transposition
   (health sector, digital providers, size thresholds)? Eleva is probably
   below the size thresholds. If it is in scope, parallel CNCS reporting
   deadlines apply (24h early warning, 72h notification).
4. **Templates.** Approve the PT and ES versions of template C, and the
   wording on CNPD complaints.
5. **Who files for the expert.** EDPB 9/2022 ¶48 allows a processor to notify
   for a controller with proper contractual authorisation, and the controller
   stays legally responsible. Confirm the clause for the expert terms, and
   whether the CNPD form accepts such a filing.
6. **Register retention.** Name the limitation period or other legal basis for
   the 5-year proposal. Lei 58/2019 art. 21(3) sets no number.
7. **Authority in processor-role incidents.** Which authority each
   expert-controller must notify, and whether that affects template B.

## Sources

- GDPR arts. 4(12), 5(2), 33, 34, 55, 56:
  <https://eur-lex.europa.eu/eli/reg/2016/679/oj>
- CNPD breach page:
  <https://www.cnpd.pt/organizacoes/outras-obrigacoes/violacao-de-dados-ou-data-breach/>.
  Form (linked from that page; needs cookies): <https://www.cnpd.pt/databreach/>
- EDPB Guidelines 9/2022 on personal data breach notification, v2.0:
  <https://www.edpb.europa.eu/system/files/documents/2023-04/edpb_guidelines_202209_personal_data_breach_notification_v2.0_en.pdf>.
  PT version:
  <https://www.cnpd.pt/media/vfhpxp3p/edpb_guidelines_202209_personal_data_breach_notification_v2-0_pt.pdf>
- EDPB Guidelines 01/2021 on examples of breach notification:
  <https://www.edpb.europa.eu/system/files/documents/2022-01/edpb_guidelines_012021_pdbnotification_adopted_en.pdf>
- Lei 58/2019 arts. 11, 21:
  <https://diariodarepublica.pt/dr/detalhe/lei/58-2019-123815982>
