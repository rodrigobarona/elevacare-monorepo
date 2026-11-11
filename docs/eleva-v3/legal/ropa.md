# Record of processing activities (RoPA)

> **Adopted by the controller on 2026-11-07.** Version 1.0. This is Eleva's
> record under GDPR art. 30. It is kept up to date as processing changes and is
> produced to the CNPD on request (art. 30(4)).

- Controller: BÚZIOS E TARTARUGAS - LDA (Eleva.care), NIPC 515001708, Rua Gil
  Vicente 2, 2775-198 Parede, Portugal. Contact `privacy@eleva.care`.
- Data protection contact: Rodrigo Barona, founder, `privacy@eleva.care`
  (interim contact and owner of this record, adopted 2026-11-07).
- Data protection officer: Eleva decided on 2026-10-29 to appoint an external
  DPO service (art. 37(1)(c)). Until the appointment takes effect, the founder
  is the contact point and `privacy@eleva.care` routes to the DPO once
  appointed. On appointment, add the DPO's name, contact and start date here
  and notify the CNPD. See [`dpo-appointment.md`](./dpo-appointment.md).
- Representative (art. 27): not applicable, because the controller is established in the EU.
- Legal basis for keeping this record: Regulation (EU) 2016/679 (GDPR) art. 30(1)
  as controller and art. 30(2) as processor. Art. 30(5) does not exempt Eleva. It
  has fewer than 250 staff, but its processing is not occasional and includes
  art. 9 health data.
- Facts SSOT: [`fact-sheet.md`](./fact-sheet.md). Sub-processors, regions,
  transfer mechanisms and retention periods below are copied from it. When the
  fact sheet changes, update this record in the same PR.
- Version: 1.0, adopted 2026-11-07 (working version 2026-10-29). Next
  review: 2027-05-07, on DPO appointment if sooner, and whenever a processing
  activity, vendor or retention period changes.

## How to read this record

Eleva has two GDPR roles (founder decision 2026-10-29; fact sheet §1):

- **Controller (art. 4(7))** for platform data: accounts, bookings, payments,
  payouts, Eleva's own invoices, notifications, support, security, marketing
  and cookies.
- **Processor (art. 4(8), art. 28)** for clinical content that independent
  experts create or receive in their professional relationship with a member:
  intake, session notes, transcripts, internal and published reports, AI
  drafts, session documents and the expert's CRM. Each expert, or each clinic
  organisation, is the controller.

Abbreviations: **M** = member (an adult who books care), **E** = expert (independent
regulated health professional), **C** = clinic staff, **G** = guest (a member
who booked without an account), **V** = website visitor.

Common security measures are referred to as **[SEC-*]**, defined in
[§3](#3-common-technical-and-organisational-measures-art-321). Transfers are
described per vendor in [§4](#4-transfers-to-third-countries-chapter-v).

## Summary

| #   | Activity                                   | Eleva's role     | Art. 6 basis     | Art. 9 condition                        |
| --- | ------------------------------------------ | ---------------- | ---------------- | --------------------------------------- |
| C1  | Accounts and identity                      | Controller       | 6(1)(b), 6(1)(f) | —                                       |
| C2  | Expert onboarding and licence verification | Controller       | 6(1)(b), 6(1)(f) | —                                       |
| C3  | Booking and scheduling                     | Controller       | 6(1)(b)          | 9(2)(h)+(3) and 9(2)(a) — see note      |
| C4  | Payments, refunds, disputes and payouts    | Controller       | 6(1)(b), 6(1)(c) | 9(2)(h)+(3) as C3; 9(2)(f) for disputes |
| C5  | Invoicing, accounting and DAC7 reporting   | Controller       | 6(1)(c)          | —                                       |
| C6  | Transactional notifications (email, SMS)   | Controller       | 6(1)(b)          | 9(2)(h)+(3) as C3                       |
| C7  | Video session delivery and attendance      | Controller (+P6) | 6(1)(b), 6(1)(f) | 9(2)(h)+(3) (care is the expert's)      |
| C8  | Customer support and complaints            | Controller       | 6(1)(b), 6(1)(c) | 9(2)(f) only if the member raises it    |
| C9  | Security, audit and error logs             | Controller       | 6(1)(c), 6(1)(f) | —                                       |
| C10 | Data subject rights handling               | Controller       | 6(1)(c)          | 9(2)(f)/(g) where needed                |
| C11 | Marketing newsletter                       | Controller       | 6(1)(a)          | —                                       |
| C12 | Cookies and consent records                | Controller       | 6(1)(c), 6(1)(a) | —                                       |
| C13 | AI assistance for expert public copy       | Controller       | 6(1)(b), 6(1)(f) | — (no health data)                      |
| P1  | Session records (intake, notes, reports)   | Processor        | Expert's basis   | Expert: 9(2)(h)+(3)                     |
| P2  | Session documents (private R2)             | Processor        | Expert's basis   | Expert: 9(2)(h)+(3)                     |
| P3  | Live transcription                         | Processor        | Expert's basis   | 9(2)(a) explicit consent (member)       |
| P4  | AI report drafts (flag off)                | Processor        | Expert's basis   | 9(2)(a) explicit consent (member)       |
| P5  | Expert CRM (contacts, tags, follow-ups)    | Processor        | Expert's basis   | Expert: 9(2)(h)+(3) where health-linked |
| P6  | Real-time video stream (transient)         | Processor        | Expert's basis   | Expert: 9(2)(h)+(3)                     |

**Note on C3, the art. 9 condition for booking data (adopted 2026-11-07).** A
booking with a psychologist or physiotherapist reveals health information about
the member, so it is art. 9 data even before any intake is written. Eleva
relies on two conditions, as published in the privacy notice §4:

1. **Art. 9(2)(h) read with art. 9(3) and Lei 58/2019 art. 29** for booking,
   payment, attendance and notification data that reveal care with a health
   professional. Processing is necessary to arrange and deliver care under a
   contract with a professional bound by secrecy, and Lei 58/2019 art. 29(4)
   extends that secrecy duty to Eleva and its staff. This condition carries
   every booking and its legal records.
2. **Explicit consent, art. 9(2)(a)**, recorded as the funnel consent
   `health_data_processing` (`FUNNEL_CONSENT_KINDS`, `packages/compliance/src/consents.ts`),
   for the health information Eleva handles as intermediary: the booking itself
   and the text the member writes before the session (intake) that Eleva passes
   to the expert. The member can withdraw it in Privacy settings; withdrawal is
   refused while a confirmed future booking exists (`HEALTH_DATA_CONSENT_IN_USE`),
   so the member cancels that booking first. Condition 1 continues to carry the
   records Eleva must keep.

Because condition 1 carries the booking, the service does not depend on the
consent alone, which keeps the consent meaningful under art. 7(4). Optional
processing (P3, P4) relies on the separate `ai_processing` consent.

**Adults only (adopted 2026-11-07).** Members must be 18 or over and book for
themselves. Each booking stores the `adult_confirmation` funnel item ("I am 18
or older and I am booking this session for myself, as set out in the booking
terms"), versioned and linked to the terms. See DPIA R13.

---

## 1. Processing as controller (art. 30(1))

### C1 — Accounts and identity

- **Purpose:**
  - create and secure user accounts for members, experts and clinic staff;
  - sign-in (email, Google, Microsoft, magic link, password, passkey,
    optional 2FA);
  - personal "Spaces" and work organisations, including the unverified
    member account and Space created after a guest booking;
  - memberships and roles;
  - language and theme preferences.
- **Data subjects:** M, E, C, G. A guest gets an unverified account and a
  personal Space after a booking is confirmed (`guest-activation`). No
  separate sign-in email is sent; the guest can claim the account by email
  link or Google with the same address. This is disclosed in privacy notice
  §3 and terms §4.
- **Data categories:**
  - name and email;
  - phone, if given;
  - password hash and passkey public keys;
  - OAuth account identifiers;
  - encrypted OAuth tokens for calendar sync (Better Auth
    `encryptOAuthTokens`);
  - avatar URL;
  - organisation and membership records;
  - locale;
  - session cookies;
  - IP address and user agent of each session.
- **Lawful basis:**
  - art. 6(1)(b), contract (terms of use);
  - art. 6(1)(f), legitimate interest in securing accounts.
  - Google or Microsoft sign-in is chosen by the user. Those providers act as
    independent controllers.
- **Recipients and sub-processors:**
  - Neon (database);
  - Vercel (hosting);
  - Upstash (rate limits and session-related caching);
  - Resend (sign-in and verification email);
  - Twilio (SMS verification);
  - Sentry (errors, scrubbed).
  - Google and Microsoft are independent controllers.
- **Transfers:** see §4 (Vercel, Neon, Upstash, Resend, Twilio, Sentry).
- **Retention:**
  - While the account exists.
  - After a deletion request, a 14-day grace period
    (`ACCOUNT_DELETION_GRACE_DAYS`), then erasure or pseudonymisation under
    D-12. See [`retention-schedule.md`](./retention-schedule.md).
  - Guest accounts never used (unverified, no session ever): deleted 12
    months after the last booking reaches a terminal state, through the same
    erasure path as account deletion (published in privacy notice §7;
    `sweepUnclaimedGuestAccounts`, engineering). Booking and payment rows stay
    for their own period without a login attached.
  - Session records (sign-in sessions, IP address, user agent): the session
    expires 30 days after last use.
- **Security:** [SEC-ACCESS], [SEC-ENC-TRANSIT], [SEC-AUTH], [SEC-RATE],
  [SEC-AUDIT].

### C2 — Expert onboarding and licence verification

- **Purpose:**
  - admit only **regulated** health professionals whose licence has been
    checked against their Ordem (founder decision 4, 2026-10-29);
  - publish the expert's public profile;
  - meet the identification duties of DL 238/2015 (health advertising)
    art. 4(1);
  - onboard the expert to Stripe Connect.
- **Data subjects:** E and C.
- **Data categories:**
  - name and professional title;
  - Ordem and cédula profissional (licence) number;
  - licence verification result and date;
  - ERS registration number (`ers_registration_number`; see
    [`ers-position.md`](./ers-position.md));
  - public profile content (bio, photo, services, prices, languages,
    locations);
  - professional billing profile (personal or company NIF, address);
  - Stripe Connect account id and status flags (`details_submitted`,
    `payouts_enabled`, `capabilities.transfers`).
- **Lawful basis:**
  - art. 6(1)(b), the expert agreement;
  - art. 6(1)(f), Eleva's legitimate interest in not listing unlicensed
    providers and in avoiding liability as an "interveniente" under DL
    238/2015 art. 2(a);
  - art. 6(1)(c) for identification duties in health advertising.
- **Recipients:**
  - Neon, Vercel;
  - public R2 bucket (avatars only);
  - Stripe, which runs its own KYC as an independent controller for its
    regulatory duties;
  - the public, for profile fields only.
- **Transfers:** §4 (Vercel, Neon, Stripe).
- **Retention:**
  - Profile: while the expert account is active.
  - Licence verification evidence: for the duration of the relationship, then
    the limitation period for claims: 5 years after the account closes
    (retention schedule §3.2).
- **Security:** [SEC-ACCESS], [SEC-AUDIT].
- **Licence verification procedure (adopted 2026-11-07):**
  - **Who:** an Eleva staff member with the `applications:review` capability
    (today the founder). Nobody reviews their own application
    (`403 SELF_REVIEW`).
  - **How:** in `apps/admin` `/partners`, the reviewer opens the expert's
    application, searches the licence number and name on the public register
    of the Ordem named by the expert (official sites in
    `@eleva/config/professional-bodies`), and confirms the ERS registration
    number with the ERS. Approval requires every item of
    `LICENCE_CHECKLIST_ITEMS`: `register_checked`, `name_matches`,
    `ers_checked`. A database CHECK refuses an approval without reviewer,
    date and the full checklist.
  - **Evidence kept:** the `become_partner_applications` row (reviewer,
    `reviewed_at`, checklist results, decision and reason) and the audited
    decision event. Licence numbers are copied to the profile on approval.
  - **Outcome:** only `active` profiles with an approved application are
    listed. Needs changes and reject require a reason and email the expert.
  - **Re-check:** every listed expert yearly, and at once when Eleva learns of
    a change in registration status. If the registration can no longer be
    confirmed, the profile stops accepting bookings (terms §3).

### C3 — Booking and scheduling

- **Purpose:**
  - availability search and slot holds (5 minutes; 10 for MB WAY);
  - reservation and confirmation;
  - Instant Book vs Request to Book;
  - rescheduling and cancellation under the per-service policy;
  - the policy snapshot taken at booking;
  - funnel consent records;
  - busy-time sync with the expert's external calendar;
  - ICS invites.
- **Data subjects:** M, G, E.
- **Data categories:**
  - member name, email, phone;
  - booked expert, service and modality (online or in person);
  - date and time;
  - cancellation policy version;
  - booking status;
  - consent rows (kind, version, timestamp), including the per-booking
    `adult_confirmation`;
  - expert calendar busy times (no event content);
  - the fact of a booking with a given profession. **This is art. 9 data
    because it reveals health information.**
- **Lawful basis:**
  - art. 6(1)(b), the contract with the member and with the expert;
  - art. 6(1)(f) and art. 6(1)(b) for the adult self-declaration;
  - art. 9(2)(h) read with art. 9(3) and Lei 58/2019 art. 29;
  - explicit consent `health_data_processing` under art. 9(2)(a). See the
    note under the summary table.
- **Recipients:**
  - the booked expert (or clinic);
  - Neon, Vercel, Upstash (holds and queues);
  - Resend and Twilio (confirmations, see C6);
  - Google and Microsoft calendar APIs, for the expert's own account.
- **Transfers:** §4.
- **Retention:**
  - Booking metadata: 10 years, because it is the source document for
    payments and invoices (CIRC art. 123(4); CIVA art. 52(1)).
  - Booking-scope consents, including `adult_confirmation`: pseudonymised on
    account deletion and kept for the clinical-record period (D-12).
- **Security:** [SEC-ACCESS], [SEC-RLS], [SEC-AUDIT], [SEC-RATE], [SEC-BOT].

### C4 — Payments, refunds, disputes and payouts

- **Purpose:**
  - collect booking payments through Stripe Checkout Sessions (card, Apple
    Pay, Google Pay, Link, MB WAY);
  - apply Eleva-funded promotion codes (founder decision 5);
  - refunds under the cancellation tiers and D-06;
  - chargebacks and disputes;
  - Stripe Connect transfers and payouts to experts;
  - the platform fee (15%).
- **Data subjects:** M, G, E.
- **Data categories:**
  - Stripe customer, payment and charge ids;
  - amounts;
  - payment method type and last four digits as returned by Stripe (Eleva
    never stores the full card number);
  - member VAT/NIF where given at checkout (`tax_id_collection`);
  - refund and dispute records;
  - join and attendance evidence used in disputes (from C7);
  - Connect account ids, transfers and payouts.
- **Lawful basis:**
  - art. 6(1)(b) for payment and payout;
  - art. 6(1)(c) for accounting (CIRC art. 123; CIVA art. 52);
  - art. 6(1)(f) for fraud prevention and defending chargebacks (art. 17(3)(e)
    applies to retention).
  - art. 9(2)(h)+(3) as C3 where a record reveals a booking with a health
    professional; art. 9(2)(f) for disputes and chargebacks.
- **Recipients:**
  - Stripe Payments Europe, Ltd. and Stripe, LLC. Stripe is a processor for
    payment processing and an independent controller for its own AML, KYC
    and fraud duties.
  - Neon;
  - the accountant (C5).
- **Transfers:** §4 (Stripe).
- **Retention:** 10 years (fact sheet §4; CIRC art. 123(4); CIVA art. 52(1)).
- **Security:**
  - [SEC-ACCESS], [SEC-AUDIT];
  - refunds above `ADMIN_DUAL_CONTROL_REFUND_CENTS` (default €200) need dual
    control (AUD-022);
  - signature verification on Stripe webhooks.

### C5 — Invoicing, accounting and DAC7 reporting

- **Purpose:**
  - issue Eleva's own platform-fee invoices (series ELEVA-FEE) and clinic SaaS
    invoices through TOConline;
  - communicate them to the AT (Autoridade Tributária);
  - keep the books;
  - report seller income as a platform operator under DAC7 (Directive (EU)
    2021/514, transposed by Lei 36/2023).
  - Live issuance stays closed in code (`issueInvoice()`) until the agreed
    path is wired.
- **Data subjects:** E, C, and members only where a document names them.
- **Data categories:**
  - name, NIF, address;
  - invoice lines (Airbnb-style service-fee descriptions with the session
    date);
  - amounts and VAT;
  - for DAC7: the seller's identification, TIN, address, IBAN or payout
    account identifier, and consideration paid per quarter.
- **Lawful basis:** art. 6(1)(c), legal obligation (CIVA, CIRC, DL 28/2019,
  DAC7 transposition).
- **Recipients:**
  - TOConline (Ordem dos Contabilistas Certificados), as processor;
  - the company's certified accountant (contabilista certificado), acting as
    an independent professional bound by the secrecy duty of the Estatuto da
    Ordem dos Contabilistas Certificados, under the engagement letter kept in
    the company records. Only Eleva's own fiscal documents and DAC7 data are
    shared; no health data;
  - Autoridade Tributária, as recipient by law.
- **Transfers:** none (EEA).
- **Retention:**
  - Invoices and books: 10 years (CIRC art. 123(4); CIVA art. 52(1); Código
    Comercial art. 40).
  - DAC7 records: 10 years after the end of the reporting period, aligned
    with the tax records and within the 5-to-10-year range of Directive (EU)
    2021/514.
- **Security:** [SEC-ACCESS], [SEC-AUDIT]. TOConline OAuth tokens are
  encrypted with `@eleva/encryption`.

### C6 — Transactional notifications (email, SMS, in-app)

- **Purpose:**
  - booking confirmations, reminders and reschedules;
  - signed `/join/{bookingId}?g=` links and ICS files;
  - account security mail;
  - payout and invoice notices;
  - the in-app inbox.
  - Quiet hours silence non-urgent SMS (AUD-004).
- **Data subjects:** M, G, E, C.
- **Data categories:**
  - email address and phone;
  - message type;
  - booking date and time;
  - expert display name;
  - signed join link (an Eleva grant, never a Daily token);
  - delivery and bounce status;
  - suppression list.
  - **No clinical content.** The Resend DPA Exhibit A states "sensitive data —
    not applicable". The expert's name and profession can still reveal health
    information, so this is minimised rather than eliminated.
- **Lawful basis:**
  - art. 6(1)(b). Account security mail is also art. 6(1)(f);
  - art. 9(2)(h)+(3) as C3 where a message reveals a booking with a health
    professional.
- **Recipients:**
  - Resend (sending domain `notifications.eleva.care` in `eu-west-1`);
  - Twilio (US1 today; IE1 required before any EU-residency claim);
  - Neon, Upstash (QStash).
- **Transfers:** §4 (Resend, Twilio).
- **Retention:**
  - Delivery logs: 365 days (`NOTIFICATION_DELIVERY_RETENTION_DAYS`,
    retention sweep).
  - Suppressions: while needed to honour the suppression.
- **Security:**
  - [SEC-AUDIT]: org-scoped deliveries are audited. User-scoped auth mail is
    not audited yet (AUD-037 open gap).
  - Lane 2 schema enforces PHI-free payloads.

### C7 — Video session delivery and attendance

- **Purpose:**
  - create a Daily room per session (`geo: "eu-central-1"`, recording off);
  - mint one meeting token per invitee, with unique user ids. The base cap is
    two: the assigned expert and the booking member. Each active delegate is an
    additional participant with their own token and raises Daily
    `max_participants` by one;
  - control the join window (15 minutes before start to 30 minutes after end);
  - record `meeting.started`, `meeting.ended` and `participant.*` webhooks
    to establish attendance.
  - Attendance is used for:
    - D-06 no-show outcomes;
    - payout eligibility;
    - chargeback evidence (founder decision 3).
- **Data subjects:** M, G, E.
- **Data categories:**
  - display names;
  - Daily participant ids (`guest:{bookingId}` for guests);
  - join and leave timestamps;
  - room ids;
  - IP addresses and device metadata seen by Daily.
  - The audio and video stream is P6 (processor). Eleva does not record it.
- **Lawful basis:**
  - art. 6(1)(b), to provide the booked online service;
  - art. 6(1)(f), to keep attendance evidence for refunds and chargebacks.
    Retention relies on art. 17(3)(e).
  - Attendance of a health session is health-related data. The condition is
    art. 9(2)(h)+(3), read with art. 9(2)(f) for defending legal claims.
- **Recipients:** Daily.co, Inc. (call server in Frankfurt; account and usage
  metadata in the US); Neon.
- **Transfers:** §4 (Daily, **DPF due for recheck 2026-11-16**).
- **Retention:** attendance metadata is kept with the booking (10 years,
  financial record). Rooms are deleted after inactivity.
- **Security:**
  - [SEC-VIDEO], [SEC-AUDIT].
  - Cloud recording is off.

### C8 — Customer support and complaints

- **Purpose:**
  - answer support requests (`support@eleva.care`);
  - handle legal notices and complaints (`legal@eleva.care`);
  - respond to the Livro de Reclamações Eletrónico (DL 156/2005) and to
    regulators.
- **Data subjects:** M, G, E, C, V.
- **Data categories:**
  - contact details;
  - the content of the message, which may include health information the
    member volunteers;
  - account and booking references.
- **Lawful basis:**
  - art. 6(1)(b);
  - art. 6(1)(c) for complaints-book replies;
  - art. 9(2)(f) only when a complaint involves a legal claim and health data.
  - Otherwise, staff are instructed not to request health data. Clinical
    questions are redirected to the expert.
- **Recipients:**
  - the mailbox provider for `support@`, `privacy@` and `legal@`: Apple
    iCloud Mail with the eleva.care custom domain (MX
    `mx01.mail.icloud.com`, `mx02.mail.icloud.com`; checked 2026-11-07),
    provided in the EU by Apple Distribution International Ltd (Ireland);
  - the expert concerned, where the complaint is about the session.
- **Transfers:** Apple may process mail in the United States; Apple Inc. is
  on the EU-US DPF, and Apple's standard terms include SCCs. Staff do not ask
  for health data by email and redirect clinical questions to the expert.
- **Retention:** 3 years after the matter closes (Código Civil art. 498(1)),
  longer while a dispute is open. Published in privacy notice §7.
- **Security:** [SEC-ACCESS]; secrecy duty of staff (Lei 58/2019 art. 29(4)).

### C9 — Security, audit and error logs

- **Purpose:**
  - detect and investigate incidents;
  - rate-limit abuse;
  - keep the accountability trail (art. 5(2)) through `withAudit` →
    `audit_outbox` → `audit_events` in the separate audit Neon project;
  - error monitoring.
- **Data subjects:** all users and visitors.
- **Data categories:**
  - IP address, user agent, request ids, correlation ids;
  - actor id, entity, action, entity id;
  - redacted payloads (allowlist; free text replaced by `REDACTED`);
  - Sentry error events with PHI and JWT redaction;
  - Vercel function logs.
- **Lawful basis:**
  - art. 6(1)(f), security and fraud prevention (recital 49);
  - art. 6(1)(c), art. 32 security and art. 5(2) accountability.
  - Lei 58/2019 art. 29(7) requires an electronic log of access to health
    data.
- **Recipients:** Neon (main and audit projects); Sentry (EU, `ingest.de.sentry.io`); Vercel; Upstash.
- **Transfers:** §4.
- **Retention:**
  - Audit events: 10 years, redacted allowlist only.
  - Shipped outbox rows: 90 days.
  - Sentry and operational logs: 90 days (vendor setting).
  - Security logs (rate-limit and auth events): up to 12 months, as published
    in privacy notice §7.
  - These are the periods of [`retention-schedule.md`](./retention-schedule.md) §3.2.
- **Security:**
  - [SEC-AUDIT], [SEC-LOGS].
  - The audit stream is append-only and no runtime role has UPDATE or DELETE.

### C10 — Data subject rights handling

- **Purpose:** handle requests under arts. 15–22:
  - DSAR export (`POST /privacy/dsar` → private R2 zip, signed link valid
    24 hours);
  - account deletion (D-12);
  - consent withdrawal;
  - rectification;
  - objection;
  - the record-access opt-out (`/me/record-access-optouts`).
- **Data subjects:** M, G, E, C.
- **Data categories:**
  - the request;
  - identity verification;
  - the export package (the subject's own data);
  - the outcome.
- **Lawful basis:** art. 6(1)(c) (arts. 12–22).
- **Recipients:** Neon, Cloudflare R2 (private bucket, EU jurisdiction).
- **Transfers:** §4 (Vercel, Cloudflare).
- **Retention:**
  - Export zip: deleted when the request expires.
  - Request log: 3 years after closure, to evidence compliance (Lei 58/2019
    art. 21(3)). Published in privacy notice §7.
- **Procedure for requests by email (including guests):** intake at
  `privacy@eleva.care`; identity confirmed by a reply from, or a link sent to,
  the email on the booking or account; reply within one month (art. 12(3));
  requests about clinical content forwarded to the expert-controller within 5
  working days, with Eleva's help to answer.
- **Security:** HMAC-signed download, private store, [SEC-AUDIT].

### C11 — Marketing newsletter

- **Purpose:** Eleva's own newsletter and product news (Lane 2 marketing
  contacts). The editorial newsletter is Femme Focus on Beehiiv. Its embed is
  consent-gated (marketing) and loads only when `ELEVA_NEWSLETTER_EMBED_URL`
  is set; Beehiiv is added to the sub-processor list
  only when it ships (fact sheet §2).
- **Data subjects:** M, E, V who opt in.
- **Data categories:** email, name (optional), locale, consent record,
  engagement events (opens and clicks, if enabled).
- **Lawful basis:**
  - art. 6(1)(a), consent (Lei 41/2004 art. 13-A, unsolicited communications);
  - existing-customer soft opt-in under art. 13-A(3) only for similar Eleva
    services, with an opt-out in every message.
- **Recipients:** Resend (audiences/broadcasts, if used); Beehiiv, once the embed is live.
- **Transfers:** §4. Beehiiv is not on the DPF list, so SCCs are needed before
  launch.
- **Retention:** until consent is withdrawn. Then the address goes on the
  suppression list. Consent proof is kept for the limitation period.
- **Security:** marketing payloads contain no health data (Lane 2 schema).

### C12 — Cookies and consent records

- **Purpose:**
  - strictly necessary cookies (session, locale, theme, last Space or
    practice, sidebar, Stripe fraud prevention), listed by name in the public
    [cookie policy](/legal/cookies);
  - store the visitor's cookie choices through c15t / Inth (`c15t` cookie and
    local-storage copy, 12 months). The consent banner is **live** on web,
    docs, app, expert, team, academy and account;
  - optional category in use: marketing, for the Beehiiv newsletter embed;
  - no analytics or advertising cookies.
- **Data subjects:** V, M, E.
- **Data categories:** cookie identifiers, consent choice, consent version,
  timestamp, pseudonymous subject id.
- **Lawful basis:**
  - strictly necessary cookies are exempt from consent (Lei 41/2004
    art. 5(2));
  - optional categories require consent under art. 5(1), art. 6(1)(a);
  - keeping proof of consent is art. 6(1)(c) (art. 7(1)).
- **Recipients:** Inth (c15t), live, with its DPA in the company's name as
  part of DPIA follow-up 2; Stripe for its own cookies.
- **Transfers:** none (Inth is EEA-only).
- **Retention:** the cookie choice lasts 12 months, then the visitor is asked
  again; proof of the choice is kept 3 years. Cookie durations are in the
  public cookie policy and fact sheet §3.
- **Security:** pre-consent mode is strict; no optional request runs before
  opt-in.

### C13 — AI assistance for expert public copy

- **Purpose:** editor assist and translation drafts for expert-authored
  **public** profile and service copy (`editorAssist`, `pnpm i18n:draft`).
- **Data subjects:** E (their own public copy).
- **Data categories:** public marketing text. **No member or health data.**
- **Lawful basis:** art. 6(1)(b) (feature requested by the expert); art.
  6(1)(f).
- **Recipients:** Vercel AI Gateway → OpenAI, in the EU inference zone.
- **Transfers:** §4. OpenAI is not on the DPF list. Provider-level zero data
  retention is **not active** on the Hobby plan.
- **Retention:** nothing is stored by Eleva beyond the accepted text. The
  provider's retention follows its terms until ZDR is active.
- **Security:** the request fails if EU inference is unavailable.

---

## 2. Processing as processor (art. 30(2))

**Controllers on whose behalf Eleva processes:**

- each expert who is an independent professional;
- each clinic organisation, for its members' records.

The list of controllers is the list of active expert and clinic organisations
in the production database, which can be exported on request (art. 30(4)).

**Contact of each controller:** held in the organisation and billing profile.

**Processor terms:** the expert agreement and the DPA (`/trust/dpa`). Gaps
against art. 28(3) are listed in
[`experts-dpa-checklist.md`](./experts-dpa-checklist.md).

### P1 — Session records

- **Categories of processing:**
  - store, encrypt, display and export records that the expert writes or
    receives:
    - booking-form intake and pre-agenda;
    - in-call notes;
    - the unpublished internal report;
    - the published report shown to the member;
    - record templates (no personal data).
  - Author-only reads (D-11, migration 0061).
  - Clinic-shared reads are compiled but inactive (`clinic_shared_records`
    is off by default; Phase 11).
  - Eleva staff never read plaintext. Break-glass decrypt is a Phase 12
    dual-control action that is not built.
- **Data subjects:** M, G. Third parties named in notes may be incidental.
- **Data categories:** health data (art. 9) and identification data.
- **Sub-processors:** Neon (ciphertext), Vercel (runtime), Upstash (no record
  content).
- **Transfers:** §4. Ciphertext only at rest. Vendor staff outside the EEA
  could reach ciphertext but not the keys.
- **Retention:**
  - Controller's instruction.
  - Platform default set in
    [`retention-schedule.md`](./retention-schedule.md): 7 years after the
    last session with that expert.
  - On member account deletion:
    - records the member wrote are deleted;
    - expert-authored records are pseudonymised (`subject_pseudonym`) and
      kept under the clinical exception.
- **Security:** [SEC-ENC-APP], [SEC-RLS], [SEC-AUDIT].
  - Reads are audited as `record.decrypted`: every read, by members, staff
    and the owning expert (since 2026-11-11). See the DPIA on Lei 58/2019
    art. 29(6)–(7).

### P2 — Session documents

- **Categories of processing:**
  - upload, store and serve files attached to a booking. Envelope-encrypted
    filename metadata; bytes in the **private** R2 bucket
    (EU jurisdiction).
  - Downloads use a 15-minute Eleva grant, are streamed by the API and are
    audited.
  - Uploader-only writes.
- **Data subjects:** M, G.
- **Data categories:** health data in documents (reports, exams, worksheets).
- **Sub-processors:** Cloudflare (R2), Neon.
- **Transfers:** §4.
- **Retention:**
  - The sweep hard-deletes 7×365 days after **upload**
    (`SESSION_DOCUMENT_RETENTION_DAYS`, `createdAt`). This differs from the
    "after last session" rule in the fact sheet; see the retention schedule.
  - Member erasure deletes member-uploaded and shared files.
- **Security:** [SEC-ENC-APP], private store, signed grants, [SEC-AUDIT].

### P3 — Live transcription

- **Categories of processing:**
  - when the member has opted in (`ai_processing` consent) and the expert
    starts it, speech is transcribed live through Daily (`transcription_geo: "eu"`) by Deepgram;
  - the transcript is stored encrypted in the session record;
  - there is no audio recording.
- **Data subjects:** M, G, E (both voices are transcribed).
- **Data categories:** the content of the conversation, which is health data.
- **Sub-processors:** Daily.co → Deepgram (Daily's sub-processor); Neon.
- **Transfers:** §4. EU processing via Daily, with US account metadata.
- **Retention:** as P1. The transcript is part of the record.
- **Legal condition:**
  - The expert remains controller.
  - The member's explicit consent under art. 9(2)(a) is collected by Eleva on
    the expert's behalf.
  - Withdrawing consent closes every active consent row and stops future
    transcription.
- **Security:** [SEC-ENC-APP], [SEC-VIDEO].

### P4 — AI report drafts (feature flag off)

- **Categories of processing:**
  - send the transcript and notes to an approved model to draft a session
    report, which the expert must review;
  - drafts are never shown to the member until the expert publishes them.
  - Gated by:
    - `ff.ai_reports_beta` (default false);
    - `hasActiveAiProcessingConsent`;
    - a fail-closed zero-retention and EU-inference attestation
      (`packages/ai/src/zero-retention-attestation.ts`, ADR-009).
- **Data subjects:** M, G, E.
- **Data categories:** health data.
- **Sub-processors:** Vercel AI Gateway → model provider (currently OpenAI)
  with the EU inference zone; Neon.
- **Transfers:** §4. **This is blocked until the gateway's ZDR is available on
  a company-held Pro plan and the provider's terms are reviewed.**
- **Retention:** unpublished drafts are deleted 90 days after their last
  change (`AI_DRAFT_RETENTION_DAYS`). Published content becomes part of P1.
- **Security:** [SEC-ENC-APP], [SEC-AI].

### P5 — Expert CRM

- **Categories of processing:**
  - lifecycle stage, tags and follow-ups that the expert keeps about members;
  - manual leads (name plus encrypted email and phone);
  - follow-up notes encrypted (`note_encrypted`).
- **Data subjects:** M, and leads entered by the expert.
- **Data categories:** identification data. Notes may contain health data.
- **Sub-processors:** Neon, Vercel, Resend (due reminders to the expert, with
  no note content).
- **Retention:**
  - Controller's instruction.
  - Member contacts and follow-ups are deleted on member account deletion.
  - Manual leads stay with the expert.
- **Security:**
  - [SEC-ENC-APP], [SEC-RLS].
  - `crm_follow_ups` is in `ADMIN_BYPASS_TABLES`, so platform-admin callers
    can read ciphertext but not plaintext.

### P6 — Real-time video stream

- **Categories of processing:**
  - relay the audio and video of the expert's session through Daily's
    Frankfurt call server;
  - the content is transient and not recorded (`enable_recording: false`).
- **Data subjects:** M, G, E.
- **Data categories:** image, voice, conversation content (health data).
- **Sub-processors:** Daily.co.
- **Retention:** none. Cloud recording is out of scope until Phase 16.8 and
  D-08.

---

## 3. Common technical and organisational measures (art. 32(1))

- **[SEC-ENC-TRANSIT]** TLS on every public endpoint. Security headers and CSP
  on product surfaces.
- **[SEC-ENC-APP]** Application-layer AES-256-GCM envelope encryption.
  - Each organisation has its own DEK, wrapped by a versioned KEK held in an
    environment variable (`@eleva/encryption`, ADR-020).
  - Crypto-shred deletes the DEK.
  - Staff cannot read clinical plaintext.
- **[SEC-RLS]** Postgres row-level security on every tenant table
  (`withOrgContext`, ADR-003).
  - Author-only policies on `records` (D-11).
  - CI test: insert as org A, select as org B returns zero rows.
- **[SEC-ACCESS]** Capability-based RBAC in code (`permissions.ts`, ADR-021).
  Least privilege on vendor consoles: production console access to Vercel,
  Neon, Stripe, Daily, Resend, Sentry, Cloudflare, Upstash and Twilio is held
  by the founder, Rodrigo Barona, with MFA required on each console. Anyone
  else is added only by the founder, after signing a secrecy undertaking, and
  is recorded in the secrets inventory of the
  [backup runbook](../operator-tasks/backup-restore-kek-escrow.md) §6.
  Preview deployments use their own database branch, KEK and auth secret
  (decision log 2026-11-07).
- **[SEC-AUTH]** Better Auth:
  - session cookies are `Secure`, `HttpOnly`, `SameSite=Lax`;
  - 2FA and passkeys are available;
  - from Phase 12 the admin host uses a host-only cookie.
- **[SEC-RATE]** Upstash rate limits on every non-internal route
  (`RATE_LIMITS.public` 10/min).
- **[SEC-BOT]** Vercel BotID `deepAnalysis` on `bookings/reserve`,
  `bookings/confirm`, `payments/checkout-session` and `payments/intent`
  (`apps/web/src/instrumentation-client.ts`; production enforcement AUD-017).
- **[SEC-AUDIT]** `withAudit` writes an outbox row in the same transaction as
  the domain write.
  - A drainer ships rows to the append-only `audit_events` in a separate Neon
    project.
  - The payload allowlist excludes free text and PHI.
- **[SEC-LOGS]** `pnpm check:no-phi-logs` CI grep; Sentry and JWT redaction
  (`packages/observability`). A staging log review confirms this in
  production conditions (DPIA R9 follow-up).
- **[SEC-VIDEO]**
  - Join through Eleva pages only.
  - Signed per-person grants.
  - One meeting token per invitee, two-person base cap (active delegates add
    places), unique user ids.
  - Recording off.
  - EU call server.
- **[SEC-AI]**
  - Approved-model allowlist, EU inference zone, fail-closed ZDR attestation.
  - Feature flag off.
  - Consent check.
  - Human review before publication.
  - AI Act art. 50 labelling.
- **Backups and availability:** Neon point-in-time restore. The configured
  restore window on 2026-11-07 is 6 hours; the operator raises it to at least
  7 days for the main project and 30 days for the audit project before
  members outside the team book. KEK escrow (two sealed offline copies,
  founder custody), restore drill before beta and then quarterly, and the
  R2 private-bucket restore path are set out in
  [`backup-restore-kek-escrow.md`](../operator-tasks/backup-restore-kek-escrow.md).
- **Organisational:**
  - secrecy undertakings for anyone with production access (Lei 58/2019
    art. 29(4));
  - the breach procedure, adopted 2026-11-07, with the founder as incident
    lead ([`breach-response.md`](./breach-response.md));
  - the interim data protection contact (founder) until the DPO is
    appointed.

## 4. Transfers to third countries (chapter V)

All primary storage is in the EEA (Frankfurt, Ireland, Lisbon). Transfers arise
from US-based vendors, their control planes and their support staff:

| Vendor              | What may leave the EEA                                 | Mechanism (art. 45 / 46)                                 |
| ------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| Vercel Inc.         | Edge network, control plane, build logs, support       | EU-US DPF (adequacy decision 2023/1795) + SCCs           |
| Cloudflare, Inc.    | Support and network access; objects stay in the EU     | SCCs (DPF not verified)                                  |
| Neon (Databricks)   | Support and operations access                          | DPF + SCCs                                               |
| Upstash             | Support and operations access                          | DPF + SCCs                                               |
| Stripe              | Payment data replicated to the US                      | DPF (Stripe, LLC) + SCCs                                 |
| Daily.co            | Account and usage metadata                             | DPF (**recheck 2026-11-16**) + SCCs                      |
| Resend              | Primary processing in the US                           | DPF (re-certification under review) + SCCs Module 2      |
| Sentry              | Support access; data stored in Germany                 | DPF + SCCs                                               |
| Twilio              | SMS processed in US1                                   | DPF + SCCs                                               |
| OpenAI (via Vercel) | Prompt content where EU zone or ZDR is not enforced    | Vercel DPA; SCCs; TIA before AI drafts go live           |
| Google, Microsoft   | Sign-in and calendar sync (independent controllers)    | DPF; their SCCs                                          |
| Beehiiv             | Newsletter subscribers (embed after marketing consent) | **Not on DPF** — SCCs and TIA before the embed goes live |
| Apple (iCloud Mail) | Support, privacy and legal mailboxes                   | DPF (Apple Inc.) + SCCs in Apple's terms                 |

A transfer impact assessment is carried out for each SCC-only transfer under
EDPB Recommendations 01/2020 before that transfer starts: OpenAI before AI
drafts are turned on, Beehiiv before the newsletter embed goes live.

## 5. Decisions recorded in this version (2026-11-07)

1. **Art. 9 condition for booking data:** 9(2)(h)+(3) with Lei 58/2019
   art. 29, plus explicit `health_data_processing` consent for what Eleva
   handles as intermediary (note under the summary table; privacy notice §4).
2. **Adults only:** per-booking `adult_confirmation` (C3; DPIA R13).
3. **Guest accounts:** disclosed, retained until claimed or 12 months after
   the last booking ends (C1).
4. **Licence verification procedure:** C2.
5. **Interim data protection contact and breach owner:** the founder.
6. **Backups and KEK escrow:** §3 and the backup runbook.
7. **Video stream (P6) vs attendance (C7):** Eleva is processor for the live
   stream and controller for attendance metadata used in refunds and
   chargebacks.
8. **Transcription consent (P3):** collected by Eleva for the
   expert-controller; withdrawal stops future transcription and does not delete
   a transcript already in the clinical record (art. 7(3)).

## 6. Follow-up actions

| #   | Action                                                                                       | Owner       | Due                                        |
| --- | -------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------ |
| 1   | Move vendor accounts and DPAs into the company's name; Twilio to IE1                         | Founder     | Before members outside the team book       |
| 2   | Move the support, privacy and legal mailboxes to a business mail service with an art. 28 DPA | Founder     | Before members outside the team book       |
| 3   | Raise Neon restore windows; KEK escrow; first restore drill                                  | Founder     | Before members outside the team book       |
| 4   | Recheck Daily on the DPF list                                                                | Founder     | On or after 2026-11-16                     |
| 5   | Full owning-expert access log (P1; DPIA R12)                                                 | Engineering | Next review                                |
| 6   | `sweepUnclaimedGuestAccounts` (C1)                                                           | Engineering | Before the first account reaches 12 months |
| 7   | Record the DPO appointment here and notify the CNPD                                          | Founder     | On appointment                             |

The record is produced to the CNPD on request (art. 30(4)) as this document
exported to PDF, together with the list of active expert and clinic
organisations from the production database (§2).

## Sources

- GDPR arts. 4, 6, 7, 9, 17, 28, 30, 32, 45–46:
  <https://eur-lex.europa.eu/eli/reg/2016/679/oj>
- Lei 58/2019 (arts. 21, 29):
  <https://diariodarepublica.pt/dr/detalhe/lei/58-2019-123815982>
- Lei 41/2004 (ePrivacy), as amended by Lei 46/2012:
  <https://diariodarepublica.pt/dr/detalhe/lei/41-2004-480710>
- CIRC art. 123:
  <https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/circ_rep/Pages/irc123.aspx>
- CIVA art. 52:
  <https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/Pages/iva52.aspx>
- EU-US DPF list: <https://www.dataprivacyframework.gov/list>
- EDPB Recommendations 01/2020 (supplementary measures):
  <https://www.edpb.europa.eu/our-work-tools/our-documents/recommendations/recommendations-012020-measures-supplement-transfer_en>
