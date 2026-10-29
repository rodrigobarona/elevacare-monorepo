# Legal fact sheet

The single source for every fact quoted in the public legal and trust pages
(`packages/content/content/legal/*`, `packages/content/content/trust/*`).
When a fact here changes, update the affected MDX in all three locales
(Portuguese is the reference text) and bump `lastUpdated` in its frontmatter.

Last verified: 2026-10-29.

## 1. Controller and operator

| Fact                                | Value                                                                                                                              | Source                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Legal name (firma)                  | BÚZIOS E TARTARUGAS - LDA                                                                                                          | Certidão Permanente, valid to 2027-04-06 |
| Brand                               | Eleva.care                                                                                                                         | —                                        |
| Legal form                          | Sociedade por quotas                                                                                                               | Certidão Permanente                      |
| NIPC / matrícula                    | 515001708                                                                                                                          | Certidão Permanente                      |
| Registered office                   | Rua Gil Vicente 2, 2775-198 Parede (União das Freguesias de Carcavelos e Parede, Cascais), Portugal                                | Certidão Permanente                      |
| Commercial registry                 | Conservatória do Registo Comercial de Cascais                                                                                      | Certidão Permanente                      |
| Share capital                       | €200.00                                                                                                                            | Certidão Permanente                      |
| Incorporated                        | 2018-07-13                                                                                                                         | Certidão Permanente                      |
| Financial year                      | 1 January to 31 December                                                                                                           | Certidão Permanente                      |
| Activity codes (CAE)                | 55201, 55204, 62201, 86950, 62900, 85591                                                                                           | Certidão Permanente                      |
| Contact addresses used in the pages | `support@eleva.care` (support), `privacy@eleva.care` (data protection requests), `legal@eleva.care` (legal notices and complaints) | Product decision                         |
| Lead supervisory authority          | Comissão Nacional de Proteção de Dados (CNPD), Av. D. Carlos I, 134, 1.º, 1200-651 Lisboa, <https://www.cnpd.pt>                   | GDPR art. 55–56                          |

Never publish or commit the shareholders' or managers' names, their NIFs,
marital status, or the Certidão access code.

### Open founder inputs

These are decisions, not drafting gaps. The pages state the configured
behaviour and do not name a value that does not exist yet.

- **DPO.** Founder decision 2026-10-29: an **external** DPO is being
  appointed; no name yet. The privacy notice says a DPO is being appointed
  and gives `privacy@eleva.care` meanwhile. When appointed, publish the DPO's
  contact in the privacy notice and notify the CNPD (GDPR art. 37(7)). Never
  publish a placeholder name or a `dpo@` address that is not set up.
- **ERS.** CAE 86950 is a care-provision activity. If the company itself
  delivers care (rather than only intermediating independent professionals),
  it must register with the Entidade Reguladora da Saúde (ERS Statutes,
  DL 126/2014 art. 26; DL 127/2014) and the ERS number must appear on the
  site. Founder decision 2026-10-29: Eleva is an intermediary only; experts
  hold their own ERS registration.
- **Contracting entity.** Vendor accounts are held in a personal name on
  free/Hobby tiers. DPAs must be accepted in the company's name; Vercel AI
  Gateway zero data retention requires a Pro plan.

## 2. Sub-processors

"Region" is where Eleva's data is stored or processed for that service.
"Transfer" is the GDPR chapter V mechanism when the vendor or its staff
access data from outside the EEA.

| Vendor                                              | Purpose                                                                                                                         | Region                                                                                                                                                                                             | Transfer mechanism                                                                                    | DPA                                                                                                                                                                                         | Source                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Vercel Inc.                                         | Hosting, serverless functions, Blob storage, AI Gateway                                                                         | Workloads pinned to `fra1` (Frankfurt) and Blob stores `elevacare-private` and `elevacare-pubic` in `fra1`; edge network, control plane, build logs and support are global/US                      | EU-US DPF (next due 2027-04-29) + SCCs                                                                | <https://vercel.com/legal/dpa>, incorporated in Vercel's terms for every plan                                                                                                               | Vercel dashboard, 2026-10-21                                                    |
| Neon, LLC (Databricks, Inc.)                        | Primary Postgres database                                                                                                       | `aws-eu-central-1` (Frankfurt)                                                                                                                                                                     | EU-US DPF (next due 2027-08-10) + SCCs                                                                | Incorporated in the terms of service                                                                                                                                                        | Neon console                                                                    |
| Upstash, Inc.                                       | Redis (rate limits, caches) and QStash (scheduled jobs)                                                                         | Redis `eu-central-1`; QStash `eu-central-1` (`QSTASH_URL` set in all Vercel environments)                                                                                                          | EU-US DPF (next due 2027-04-29) + SCCs                                                                | Incorporated in the terms of service                                                                                                                                                        | Upstash console, Vercel env                                                     |
| Stripe Payments Europe, Ltd. (Ireland); Stripe, LLC | Payments, Connect payouts, fraud prevention                                                                                     | EEA entity; data replicated to the US                                                                                                                                                              | EU-US DPF (Stripe, LLC, next due 2027-05-11) + SCCs                                                   | <https://stripe.com/legal/dpa>                                                                                                                                                              | DPF list                                                                        |
| Daily.co, Inc.                                      | Video sessions; live transcription when opted in                                                                                | No dashboard region setting: each room is created with `geo: "eu-central-1"` (Frankfurt call server) and transcription starts with `transcription_geo: "eu"`; account and usage metadata in the US | EU-US DPF (**next due 2026-11-16 — recheck**) + SCCs                                                  | <https://www.daily.co/legal/data-processing-addendum/> (online DPA)                                                                                                                         | DPF list; <https://docs.daily.co/reference/rest-api/rooms/config>               |
| Deepgram, Inc. (Daily sub-processor)                | Speech-to-text for live transcription                                                                                           | EU processing via Daily `transcription_geo: "eu"`                                                                                                                                                  | Covered by Daily's DPA                                                                                | —                                                                                                                                                                                           | <https://docs.daily.co/reference/daily-js/instance-methods/start-transcription> |
| Plus Five Five, Inc. (Resend)                       | Transactional email                                                                                                             | Sending domain `notifications.eleva.care` in `eu-west-1` (Ireland); primary processing in the US                                                                                                   | EU-US DPF (re-certification under review, next due 2027-03-03) + SCCs Module 2 (Irish law and courts) | DPA updated 2025-12-31, binding on acceptance of Resend's terms; countersigned by Resend 2026-01-14 (account currently held in a personal name)                                             | Resend dashboard; signed DPA                                                    |
| Functional Software, Inc. (Sentry)                  | Error monitoring                                                                                                                | EU data storage (Germany, `ingest.de.sentry.io`), org `prood`                                                                                                                                      | EU-US DPF (next due 2027-05-28) + SCCs                                                                | <https://sentry.io/legal/dpa/>                                                                                                                                                              | Sentry org settings; DSN host                                                   |
| Inth (c15t)                                         | Cookie consent records                                                                                                          | Europe (Frankfurt), runtime `https://eleva-care-eleva.inth.app/`                                                                                                                                   | None needed (EEA)                                                                                     | **Not live yet.** Listed on the public pages only once the consent banner ships and the Inth DPA is signed in the company's name                                                            | Inth dashboard                                                                  |
| Vercel AI Gateway → OpenAI                          | Editor assist and translation drafts for expert-authored public copy (no member or health data)                                 | EU inference zone (`inferenceRegion: { scope: "zone", geoRegion: "eu" }`)                                                                                                                          | Vercel DPA (Vercel Inc., DPF + SCCs); OpenAI is not on the DPF list                                   | Provider-level zero data retention requires a Pro or Enterprise plan and is **not active** on the current Hobby plan; the pages do not claim it until the company-held Pro plan is in place | <https://vercel.com/docs/ai-gateway/security-and-compliance/regional-inference> |
| Twilio Inc.                                         | SMS verification and reminders                                                                                                  | US1 today; IE1 (Ireland) required before an EU-residency claim                                                                                                                                     | EU-US DPF (next due 2027-04-20) + SCCs                                                                | <https://www.twilio.com/legal/data-protection-addendum>                                                                                                                                     | Phase 08 smoke                                                                  |
| Ordem dos Contabilistas Certificados (TOConline)    | Invoicing and accounting                                                                                                        | Lisbon data centre, replicated to Porto                                                                                                                                                            | None needed (EEA)                                                                                     | TOConline terms                                                                                                                                                                             | <https://manual.toconline.pt/support/solutions/articles/3000123206>             |
| Google LLC                                          | Sign-in with Google (independent controller, chosen by the user); expert calendar sync on the expert's own Google account       | US and Google's global infrastructure                                                                                                                                                              | EU-US DPF (next due 2027-09-13); Google's SCCs for non-DPF locations                                  | Google terms and privacy policy apply to the user's Google account                                                                                                                          | DPF list                                                                        |
| Microsoft Corporation                               | Sign-in with Microsoft (independent controller, chosen by the user); expert calendar sync on the expert's own Microsoft account | US and Microsoft's global infrastructure (EU Data Boundary for EU commercial tenants)                                                                                                              | EU-US DPF (next due 2027-08-31); Microsoft's SCCs for non-DPF locations                               | Microsoft terms and privacy statement apply to the user's Microsoft account                                                                                                                 | DPF list                                                                        |

Not on the DPF list as of 2026-10-21: OpenAI, Beehiiv, Inth. Inth is EEA-only.
Beehiiv is added only when the newsletter embed ships, with its DPA and SCCs.

### Vendor evidence on file (not committed)

- Resend: SOC 2 Type II, period 2025-02-01 to 2026-02-01, auditor Advantage
  Partners, unqualified opinion with an exception noted; subservice providers
  AWS and Vercel.
- Resend: Oneleet penetration test of the dashboard and API,
  2025-11-11 to 2025-11-25, letter dated 2026-02-12, zero unresolved findings.
- Resend DPA, Exhibit A: "sensitive data — not applicable". Email content
  must never carry clinical notes, session records, or other health data
  beyond what a booking confirmation needs.

SOC 2 reports are confidential to the customer. Keep them out of the repo;
the trust pages may say a vendor holds a SOC 2 Type II report, not quote it.

### Recheck calendar

Before publishing and then every January, recheck each vendor on
<https://www.dataprivacyframework.gov/list>. Dated rechecks:

- 2026-11-16 — Daily.co
- 2027-03-03 — Resend (re-certification under review)
- 2027-04-20 — Twilio
- 2027-04-29 — Upstash, Vercel
- 2027-05-11 — Stripe
- 2027-05-28 — Sentry
- 2027-08-10 — Neon (Databricks)
- 2027-08-31 — Microsoft
- 2027-09-13 — Google

## 3. Cookies and similar technologies

| Name                                                                       | Set by      | Purpose                                                                          | Duration                                                                                          | Category                                     |
| -------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `__Secure-better-auth.session_token` (`better-auth.session_token` on http) | Eleva       | Keeps you signed in                                                              | 30 days, renewed daily while active                                                               | Strictly necessary                           |
| `better-auth.session_data`                                                 | Eleva       | Short-lived signed copy of the session to avoid a database read on every request | 5 minutes                                                                                         | Strictly necessary                           |
| `ELEVA_LOCALE`                                                             | Eleva       | Remembers your language across eleva.care                                        | 1 year                                                                                            | Strictly necessary (functionality you chose) |
| `ELEVA_THEME`                                                              | Eleva       | Remembers light, dark or system theme                                            | 1 year                                                                                            | Strictly necessary (functionality you chose) |
| `eleva-last-org`                                                           | Eleva       | Reopens the last workspace you used                                              | 1 year                                                                                            | Strictly necessary                           |
| `sidebar_state`                                                            | Eleva       | Remembers whether the dashboard sidebar is open                                  | 7 days                                                                                            | Strictly necessary                           |
| `__stripe_mid`, `__stripe_sid`                                             | Stripe      | Fraud prevention on checkout pages                                               | 1 year; 30 minutes                                                                                | Strictly necessary                           |
| c15t consent cookie (planned)                                              | Inth (c15t) | Stores your cookie choices                                                       | Set when the consent banner ships; publish its name and duration from the c15t configuration then | Strictly necessary                           |

No analytics or advertising cookies are set. Pre-consent mode is strict: no
optional request runs before opt-in. The homepage hero video is a muted
Vercel Blob progressive WebM + MP4 with no third-party player or tracking (Mux was removed,
ADR-024). Daily sets no cookie on eleva.care pages.

## 4. Product facts the pages quote

| Fact                      | Value                                                                                                                       | Source                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Currency                  | EUR only                                                                                                                    | Payments spec D-02                                                       |
| Payment methods at launch | Card (including Apple Pay and Google Pay), Link, MB WAY                                                                     | Payments spec D-14                                                       |
| Checkout hold             | 5 minutes; 10 minutes while an MB WAY payment is processing                                                                 | Payments spec                                                            |
| Solo expert service fee   | 15% of the booking price, VAT included when due; €100 booking → €15 fee → €85 to the expert, no other deductions            | `packages/billing/src/server/commission.ts`; accountant reply 2026-09-15 |
| Payment processing fees   | Absorbed by Eleva out of its fee                                                                                            | `SETTLEMENT_FEE_BEARER`                                                  |
| Clinic bookings           | No booking fee; clinics pay a seat subscription                                                                             | Payments spec                                                            |
| Payout eligibility        | The later of 7 days after payment or 24 hours after the session ends, released at 04:00 Lisbon time                         | `computeEligibleAt` in `payout-math.ts`                                  |
| Cancellation tiers        | Flexible: 100% ≥24 h, else 0%. Moderate: 100% ≥48 h, 50% 24–48 h, else 0%. Strict: 100% ≥7 days, 50% 48 h–7 days, else 0%   | `@eleva/config/cancellation-policy.ts`                                   |
| Grace period              | Full refund within 24 hours of booking when the session is at least 48 hours away                                           | `@eleva/config/cancellation-policy.ts`                                   |
| Policy snapshot           | The policy shown at booking applies to that booking                                                                         | Reservation snapshot                                                     |
| Video                     | Two participants per session (plus delegates), unique per-person tokens, cloud recording off                                | Phase 09                                                                 |
| Join window               | From 15 minutes before start to 30 minutes after end                                                                        | Join grant                                                               |
| Transcription             | Off unless the member opts in; live only; stored in the encrypted session record                                            | Phase 10.1                                                               |
| Encryption                | Session records encrypted at the application layer; staff cannot read them in plaintext                                     | Phase 10.1                                                               |
| HIPAA                     | Not claimed                                                                                                                 | D-07 deferred                                                            |
| Who may sell              | Regulated health professionals only, licence verified by Eleva with their Ordem before listing; expert must keep it current | Founder decision 2026-10-29                                              |
| Session invoice           | Issued by the expert from their own certified software; Eleva does not invoice the session or charge VAT on it              | Founder decision 2026-10-29                                              |
| Member NIF                | Optional at Stripe Checkout; collected by Eleva and passed to the expert for the invoice                                    | Founder decision 2026-10-29                                              |
| Promotion codes           | Funded by Eleva; the expert's share is computed on the list price                                                           | Founder decision 2026-10-29                                              |
| Member no-show            | Treated as a cancellation at session start under the service tier (no refund in all three tiers)                            | D-06, founder decision 2026-10-29                                        |
| Expert cancel or no-show  | 100% refund to the member including Eleva's fee, plus a rebook offer; repeated no-shows may lead to suspension              | D-06, founder decision 2026-10-29                                        |
| Chargebacks               | Session not delivered: recovered from the expert's payout. Delivered: Eleva contests with join/attendance logs              | D-06, founder decision 2026-10-29                                        |
| Ranking                   | Filters; text relevance; default alphabetical; price sort; "rating" sort puts active Top Expert (paid) subscribers first    | `listExperts`, `public-offers.ts`                                        |
| DPO                       | External DPO being appointed; `privacy@eleva.care` meanwhile                                                                | Founder decision 2026-10-29                                              |

Implementation status of the 2026-10-29 rows: member NIF and promotion codes
are wired in Stripe Checkout (`tax_id_collection`, `allow_promotion_codes` in
`packages/billing/src/server/booking-checkout-session.ts`). Expert cancel and
no-show refunds, the member no-show outcome and chargeback recovery are
**policy only**: there is no expert-cancel or no-show path in code yet, so
support applies them manually (`support@eleva.care`) until they ship. The
pages state them as contractual rules and tell members and experts to contact
support; they must not describe an in-product expert-cancel button.

### Retention

| Data                                                       | Period                                                                                                         | Basis                                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Account data                                               | While the account exists; deleted or anonymised after a deletion request, except what the law requires to keep | GDPR art. 17                                                          |
| Session records (intake, notes, transcript, expert report) | 7 years after the last session                                                                                 | `data-retention-export-matrix.md`; clinical record duty of the expert |
| Invoices, receipts and payment records                     | 10 years                                                                                                       | CIRC art. 123                                                         |
| AI drafts not accepted by the expert                       | 90 days                                                                                                        | Retention sweep                                                       |
| Notification delivery logs                                 | 365 days                                                                                                       | Retention sweep                                                       |
| Consent records                                            | For as long as the consent is relied on plus the limitation period                                             | GDPR art. 7(1)                                                        |
| Security logs                                              | Up to 1 year                                                                                                   | Legitimate interest                                                   |

## 5. Law the pages rely on

| Instrument                                                                      | Used for                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regulation (EU) 2016/679 (GDPR)                                                 | Privacy, health data, rights, transfers                                                                                                                                                                                                                                                                                                                           |
| Lei 58/2019                                                                     | Portuguese GDPR execution law (art. 29 health data, art. 16 minors' consent at 13)                                                                                                                                                                                                                                                                                |
| Lei 41/2004 (as amended by Lei 46/2012)                                         | Cookies and electronic communications (ePrivacy)                                                                                                                                                                                                                                                                                                                  |
| DL 7/2004                                                                       | Electronic commerce, service-provider information duties                                                                                                                                                                                                                                                                                                          |
| DL 24/2014                                                                      | Distance contracts and pre-contractual information for Eleva's own services to members and professionals. Healthcare services provided by health professionals are excluded from its scope (art. 2(2)); the expert's session is a healthcare service. Withdrawal exception for services fully performed with the consumer's prior express consent (art. 17(1)(a)) |
| Lei 24/96                                                                       | Consumer protection                                                                                                                                                                                                                                                                                                                                               |
| DL 156/2005                                                                     | Livro de Reclamações (electronic complaints book)                                                                                                                                                                                                                                                                                                                 |
| Lei 144/2015                                                                    | Consumer alternative dispute resolution (RAL)                                                                                                                                                                                                                                                                                                                     |
| DL 109-G/2021 and DL 84/2021                                                    | Consumer sale and digital services conformity                                                                                                                                                                                                                                                                                                                     |
| Regulation (EU) 2022/2065 (DSA)                                                 | Notice and action, trader traceability on the marketplace                                                                                                                                                                                                                                                                                                         |
| Regulation (EU) 2019/1150 (P2B)                                                 | Ranking transparency and terms for experts and clinics                                                                                                                                                                                                                                                                                                            |
| Directive (EU) 2021/514 (DAC7), transposed by Lei 36/2023 (amending DL 61/2013) | Reporting of sellers' income to the tax authority (personal services are a relevant activity; report by 31 January)                                                                                                                                                                                                                                               |
| Regulation (EU) 2024/1689 (AI Act), art. 50                                     | Transparency for AI-generated content                                                                                                                                                                                                                                                                                                                             |
| DL 82/2022                                                                      | European Accessibility Act: accessibility of e-commerce services from 2025-06-28; microenterprises (fewer than 10 staff and turnover or balance sheet up to €2 million) are exempt for services. Eleva publishes an accessibility statement voluntarily. DL 83/2018 covers public-sector websites only and does not apply                                         |
| DL 238/2015 and ERS Regulamento 1058/2016                                       | Advertising of health services (profile must show name, cédula number and issuing Ordem, qualifications, ERS number, address for in-person)                                                                                                                                                                                                                       |
| DL 126/2014 (ERS Statutes, arts. 4 and 26) and DL 127/2014                      | ERS registration of care providers, including telemedicine                                                                                                                                                                                                                                                                                                        |
| Regulation (EU) 2024/3228                                                       | Closed the EU ODR platform on 2025-07-20; no ODR link is shown                                                                                                                                                                                                                                                                                                    |

### Consumer dispute resolution

Lei 144/2015 art. 18 requires a trader to name the RAL entities available to
it and its website, and to say whether it has adhered to any. Eleva has not
adhered to a RAL entity and no arbitration is mandatory for its services. The
entities available to a member of an Eleva contract are:

- **CACCL — Centro de Arbitragem de Conflitos de Consumo de Lisboa**, Rua dos
  Douradores, 116, 2.º, 1100-207 Lisboa, <https://www.centroarbitragemlisboa.pt>.
  Territorial competence: contracts concluded in the Lisbon Metropolitan Area,
  which includes Cascais (Eleva's registered office). Value limit: €5,000.
- **CNIACC — Centro Nacional de Informação e Arbitragem de Conflitos de
  Consumo**, Rua D. Afonso Henriques, 1, 4700-030 Braga, <https://www.cniacc.pt>.
  Territorial competence: national, supplementary to the regional centres. No
  value limit.
- More information: <https://www.consumidor.gov.pt>.

Source: <https://www.gov.pt/servicos/realizar-uma-arbitragem-de-conflitos-de-consumo-atraves-dos-centros-de-arbitragem-apoiados-pelo-ministerio-da-justica>
(updated 2026-03-27).

## 6. Publication switch

`CONSENT_DOCUMENT_VERSION` in `@eleva/compliance` is **`2026-10-29`**
(founder-approved publication; previous publication `2026-10-24`). New funnel and account consents record against
this version. A future legal revision bumps the constant to a new
`YYYY-MM-DD` (never reintroduce a `dev-` prefix on production).
