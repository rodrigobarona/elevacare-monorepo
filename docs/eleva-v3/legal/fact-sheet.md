# Eleva.care legal fact sheet

Status: **working pre-launch** — legal/trust MDX is written from this sheet. Do not treat as DPO sign-off until `CONSENT_DOCUMENT_VERSION` in `@eleva/compliance` is bumped to the publication date.

Each row should carry a **source URL** and **checked on** date when updated. Sub-processors public copy: `packages/content/content/trust/*/sub-processors.mdx`.

## Controller (to confirm on site per DL 7/2004)

| Field                  | Value                                         | Source / checked      |
| ---------------------- | --------------------------------------------- | --------------------- |
| Legal name             | BÚzios e Tartarugas, Lda (brand Eleva.care)   | Legacy repo + founder |
| NIPC                   | 515001708                                     | Legacy repo           |
| Address                | Rua Gil Vicente, 2, 2775-198 Parede, Portugal | Legacy repo           |
| Support                | support@eleva.care                            | Product               |
| Legal                  | legal@eleva.care                              | Product               |
| DPO contact            | dpo@eleva.care                                | Product               |
| Phone                  | +351 931 897 950                              | Legacy repo           |
| Share capital          | **TBD — founder**                             | CSC art. 171          |
| Commercial registry    | **TBD — founder**                             | CSC art. 171          |
| DPO named person       | **TBD — founder**                             | GDPR art. 37          |
| ERS registration       | **TBD — founder**                             | If applicable         |
| RAL arbitration centre | **TBD — founder**                             | Lei 144/2015          |

## Sub-processors (Article 28 GDPR)

Transfer wording in public docs: **EU SCCs in the vendor DPA**, plus **EU–US Data Privacy Framework** certification where the vendor maintains it (checked periodically on [dataprivacyframework.gov](https://www.dataprivacyframework.gov/list)).

| Vendor                         | Purpose                                        | Location (product config)          | Transfer basis            | DPA / trust                                                                                     | DPF (checked 2026-10-21)                               |
| ------------------------------ | ---------------------------------------------- | ---------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Vercel                         | Hosting, Functions (`fra1`), AI Gateway, BotID | EU compute; US group               | DPA + SCCs                | [vercel.com/legal/dpa](https://vercel.com/legal/dpa) (2026-03-17, eff. 2026-03-31)              | Vercel Inc., due 2027-04-29                            |
| Neon                           | PostgreSQL (main + audit project)              | `aws-eu-central-1` (Frankfurt)     | DPA + SCCs                | [neon.com/pdf/DPA.pdf](https://neon.com/pdf/DPA.pdf)                                            | Databricks Inc., due 2027-08-10                        |
| Upstash                        | Redis rate limits, QStash                      | EU region when configured          | DPA + SCCs                | [upstash.com/trust/dpa.pdf](https://upstash.com/trust/dpa.pdf) (Apr 2025)                       | Upstash Inc., due 2027-04-29                           |
| Resend                         | Transactional email                            | US storage; send `eu-west-1`       | DPA Module 2 + SCCs       | [resend.com/security/gdpr](https://www.resend.com/security/gdpr)                                | PLUS FIVE FIVE — re-cert under review, due 2027-03-03  |
| Stripe                         | Payments, Connect                              | Stripe Payments Europe Ltd (IE)    | DPA (IE) + SCCs           | [stripe.com/ie/legal/dpa](https://stripe.com/ie/legal/dpa)                                      | Stripe LLC, due 2027-05-11                             |
| Daily                          | Video (recording off, not HIPAA)               | EU media geo when set; US metadata | DPA + DPF                 | [daily.co/legal/data-processing-addendum](https://www.daily.co/legal/data-processing-addendum/) | Daily Co., due **2026-11-16** — recheck before publish |
| Sentry                         | Error monitoring                               | EU (`de.sentry.io`)                | DPA + DPF                 | Sentry EU region (org `prood`, project `eleva-care`)                                            | Functional Software Inc., due 2027-05-28               |
| Inth (c15t)                    | Consent records                                | Europe (Frankfurt)                 | DPA when executed         | Inth dashboard `eleva` / `eleva-care`                                                           | N/A (EU runtime)                                       |
| OpenAI (via Vercel AI Gateway) | Editor assist, i18n draft                      | EU inference + ZDR when configured | OpenAI Ireland Ltd + SCCs | Vercel AI Gateway docs                                                                          | Not on DPF list — SCCs                                 |
| Beehiiv                        | Newsletter / community subscribers             | US                                 | DPA Module 2 (2026-07-16) | beehiiv DPA                                                                                     | Not listed — SCCs                                      |
| Twilio                         | SMS (IE1 when live)                            | Ireland to carrier edge            | DPA + DPF                 | [SMS EU residency](https://www.twilio.com/docs/global-infrastructure/sms-eu-data-residency)     | Twilio Inc., due 2027-04-20                            |
| TOConline                      | Certified invoicing (PT)                       | Portugal / EU                      | **Verify DPA**            | Product OAuth `GET /accounting/callback`                                                        | EU processing expected                                 |
| Vercel Blob                    | Public + private object storage                | Region fixed at store creation     | Same as Vercel            | [vercel.com/docs/vercel-blob](https://vercel.com/docs/vercel-blob)                              | Confirm both store regions in dashboard                |

**Independent controllers (not Eleva sub-processors):** Google and Microsoft calendar OAuth at the expert's request.

**Not in production code (do not claim in legal until live):** PostHog, GA4, BetterStack. **Removed from product:** Mux marketing video (replaced with Vercel Blob MP4, ADR-024).

## Verified infrastructure (2026-10-21)

- Neon project `elevacare` (`raspy-mouse-18304810`): `aws-eu-central-1`, Postgres 17, HIPAA off.
- Vercel team projects: Functions pinned `fra1` in app `vercel.json`.
- Sentry org `prood`: data region EU; deploy DSN must use `*.ingest.de.sentry.io`.
- Inth consent runtime: Europe (Frankfurt). Trusted origins: `eleva.care`, `*.eleva.care`, `localhost:3000`–`3008`.

**Contracting gap (operations, not copy-only):** Vercel/Neon accounts should bill Búzios e Tartarugas, Lda on commercial plans for art. 28 DPAs to bind the controller.

## Cookies (inventory — rescan before publish)

| Cookie / storage             | Category                 | Purpose                                             |
| ---------------------------- | ------------------------ | --------------------------------------------------- |
| Better Auth session          | Essential                | Sign-in                                             |
| `ELEVA_LOCALE`               | Essential                | Language preference                                 |
| `ELEVA_THEME`                | Essential                | Theme preference                                    |
| BotID                        | Essential                | Abuse protection on public POSTs                    |
| Stripe                       | Essential                | Checkout                                            |
| Daily                        | Essential                | Video session                                       |
| c15t / Inth                  | Essential (consent tool) | Stores consent choice                               |
| Optional marketing/analytics | Optional                 | Beehiiv embed, future analytics — **gated by c15t** |

## EU / PT law mapping (non-exhaustive)

| Instrument             | Use in Eleva docs                                 |
| ---------------------- | ------------------------------------------------- |
| GDPR + Lei 58/2019     | Privacy, health data, processors, transfers, CNPD |
| Lei 41/2004            | Cookie policy + c15t categories                   |
| DL 7/2004              | Service provider identification on site           |
| DL 24/2014, Lei 24/96  | Terms, withdrawal exceptions for services         |
| DL 156/2005            | Livro de Reclamações link (footer)                |
| Lei 144/2015           | RAL notice (**centre TBD**)                       |
| Reg. 2022/2065 (DSA)   | Terms, complaints contact                         |
| Reg. 2019/1150 (P2B)   | Expert agreement                                  |
| Reg. 2024/1689 art. 50 | AI processing notice                              |
| DL 82/2022             | Accessibility statement                           |
| DL 238/2015 / ERS      | Marketing and expert profiles (ERS page)          |

## Engineering pins tied to this sheet

- AI Gateway: `inferenceRegion: { scope: "zone", geoRegion: "eu" }` and `zeroDataRetention: true` in `@eleva/ai` (requires Vercel Pro for ZDR).
- Daily rooms: EU `geo` in `@eleva/video` room creation.
- Consent: `@eleva/consent` on all user-facing apps; strict opt-in; manual checklist `docs/eleva-v3/audits/consent-inth-manual-checklist.md`.

## Recheck reminders

- Daily DPF due **2026-11-16** before go-live.
- Resend DPF re-certification status before go-live.
- Yearly DPF due dates per vendor row above.
