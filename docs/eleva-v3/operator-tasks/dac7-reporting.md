# DAC7: reporting experts' income to the tax authority

> **Draft, 2026-11-14. Not adopted.** Owner: Rodrigo Barona, founder, with the
> accountant. Review: when the accountant answers §8, and again before the
> first live payout.

Eleva is a reporting platform operator under Directive (EU) 2021/514 (DAC7),
transposed by Law 36/2023 of 26 July, which amended Decree-Law 61/2013.
Experts and clinics that are paid for sessions through Eleva are reportable
sellers. The expert agreement already tells them so
(`packages/content/content/legal/en/expert-agreement.mdx` §16).

**State today: nothing in this runbook is built or done.** There is no seller
tax profile in the database, no reminder process and no report. §7 lists the
engineering work. Until it ships, this runbook is the manual procedure.

Related: [`../legal/ropa.md`](../legal/ropa.md) C5,
[`../legal/fact-sheet.md`](../legal/fact-sheet.md) §5,
[`../legal/retention-schedule.md`](../legal/retention-schedule.md),
[`../decision-log.md`](../decision-log.md) 2026-10-12 "Platform commission FT
customer is invoicing entity, not Identity" (the expert billing profile, PR
07.3, that these fields belong on).

## 1. What applies to Eleva

- **Relevant activity.** Providing a personal service for payment. There is no
  small-seller exclusion for services: the "fewer than 30 sales and at most
  €2,000" rule covers goods only.
- **Every paid seller is reportable**, whether an individual or a company, and
  wherever in the EU they are resident.
- **A nil report is required** for a year with no reportable sellers.

## 2. Calendar

| When                                              | What                                                                                                                   | Source                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Before the first live payout (see §8, question 1) | Register as a platform operator: **Modelo 61**, filed on Portal das Finanças. The AT assigns an identification number. | Portaria 455-D/2023                   |
| When an expert or clinic starts selling           | Collect and check their details (§3 and §4).                                                                           | DL 61/2013, Annex II arts. 4 and 7    |
| By 31 December of each year                       | Due diligence complete for every seller paid in that year.                                                             | Annex II art. 10                      |
| By 31 January of the following year               | File the annual report (§5), and send each seller what was reported about them (§6).                                   | Annex II art. 10; Portaria 455-C/2023 |
| For 10 years after the end of each reported year  | Keep the records.                                                                                                      | Annex II art. 14                      |

Sellers already registered when Eleva first becomes a reporting operator have
until 31 December of the second year. Collected details can be relied on for
36 months.

## 3. What to collect from each seller

| For an individual                                          | For a company                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| First and last name                                        | Legal name                                                   |
| Primary address                                            | Primary address                                              |
| Tax number (NIF or foreign) and the country that issued it | Tax number and the country that issued it                    |
| Place of birth, only when there is no tax number           | Commercial registration number                               |
| VAT number, if any                                         | VAT number, if any                                           |
| Date of birth                                              | Any permanent establishment in the EU through which it sells |

For both: each country of residence, and the identifier of the account the
money is paid to (with the holder's name when it is not the seller).

**Today only the tax number is stored**, as a single `expert_profiles.nif`
with no issuing country. Stripe holds the bank account; Eleva sees only its
last digits (§8, question 5).

## 4. Checking the details and chasing missing ones

1. Check the tax number and the VAT number against the free official tools:
   the AT's NIF check for Portugal, and VIES for EU VAT numbers. Record the
   date and the result.
2. If a seller has not given the details, ask. Send a first reminder and a
   second reminder.
3. After two reminders, and once at least 60 days have passed, Eleva **must**
   do one of two things: close the seller's account and prevent a new
   registration, or hold their transfers until the details arrive. The expert
   agreement §16 says Eleva "may" do so; the law leaves the choice between the
   two, not the choice to do neither (§8, question 8). The agreement says the
   60 days run from the first request, which matches the law's wording. The
   AT's FAQ counts them from the second reminder (§8, question 3).
4. Log every request, reminder and hold, with dates.

## 5. The annual report

- **Format.** An XML file, not a "Modelo". The AT publishes the schema
  (`DPIXML_v1.0.xsd`, with `isodpitypes_v1.0.xsd` and `oecddpitypes_v1.0.xsd`)
  and a user guide under "AEOI – DAC7/DPI" on Portal das Finanças.
- **Where.** Portal das Finanças, after signing in as the company.
- **Per seller, per quarter:**
  - the total paid or credited to the seller, **net of Eleva's fee**;
  - the number of paid sessions;
  - the fees and commissions Eleva kept, reported separately.
- **Working rule until the accountant confirms** (§8, question 2): the
  expert's share (85%, or 92% with Top Expert) is the consideration, Eleva's
  fee is the commission, and each booking falls in the quarter of its
  transfer. Refunded bookings and reversed transfers reduce the quarter they
  are reversed in.

Source for the figures today: `payout_states` and `booking_payments` in the
main database. There is no query or export for this yet (§7).

## 6. The statement to each seller

By 31 January, send each seller the information reported about them. Keep a
copy and the date sent.

## 7. What is not built

This is planned work, not shipped work. Each item is its own slice.

1. **Seller tax profile.** The fields in §3 belong on the expert billing
   profile planned as PR 07.3 (personal versus company identity). Do not add
   them to `expert_profiles`: the decision log (2026-10-12) says the single
   `expert_profiles.nif` is not that model. Clinics
   need the company fields. The API and the expert setup flow collect them;
   the date of birth and tax number are personal data and are stored as such.
2. **Checks and reminders.** Tax-number and VIES checks with their results;
   the request, two reminders and the 60-day clock; a `holdReasons` value on
   the payout so a hold is visible to the expert and to the operator.
3. **The yearly export.** A quarterly aggregation per seller, the XML file in
   the AT's schema, the nil report, and the seller statement.

Until slice 1 ships, an expert cannot give Eleva the details the agreement
says Eleva collects. That is the reason this runbook is not adopted.

## 8. Questions for the accountant

1. Does a registration deadline apply to an operator resident in Portugal,
   and when should Modelo 61 be filed given that no payout has been made?
2. Is the reporting basis in §5 right: the expert's share as consideration,
   Eleva's fee as commission, in the quarter of the transfer?
3. Do the 60 days run from the first request (the law) or from the second
   reminder (the AT's FAQ)?
4. How do Eleva-funded promotion codes count? The expert is paid on the list
   price while the member paid less.
5. Is the account identifier "available" to Eleva when Stripe holds the IBAN
   and shows Eleva only its last digits?
6. Which schema version will the AT accept for the January filing?
7. Clinics pay a seat subscription and no booking fee. When members pay a
   clinic through Eleva, is the clinic a reportable seller in the same way as
   a solo expert?
8. For the lawyer: expert agreement §16 says Eleva "may" close the account or
   hold transfers when details are missing. Should it say Eleva will do one
   of the two?

## 9. Penalties, for scale

Under the RGIT as amended by Law 26/2026: €2,000 to €22,500 for not
registering or not reporting; €1,000 to €22,500 for late filing; €500 to
€11,250 for omissions or inaccuracies; €1,000 to €22,500 for due-diligence or
record-keeping failures. The limits double for a company.

## Sources

- Law 36/2023:
  <https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/legislacao/diplomas_legislativos/Documents/Lei_36_2023.pdf>
- Portaria 455-D/2023 (Modelo 61, registration):
  <https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/legislacao/diplomas_legislativos/Documents/Portaria_455_D_2023.pdf>
- Portaria 455-C/2023 (the annual file):
  <https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/legislacao/diplomas_legislativos/Documents/Portaria_455_C_2023.pdf>
- AT schema and user guide:
  <https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Outras_entidades/Suporte_tecnologico/Trocas_Info_Internacionais/AEOI_DAC7_DPI>
- AT FAQ on DAC7:
  <https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/questoes_frequentes/pages/faqs-00213.aspx>
- RGIT art. 117 and art. 119-B:
  <https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/rgit/Pages/rgit117.aspx>,
  <https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/rgit/Pages/rgit119b.aspx>

The sources were read on 2026-11-14 by an AI research pass. The accountant
should confirm each figure before Eleva relies on it.

## 10. Log

| Date       | Action          | Result                          | By  |
| ---------- | --------------- | ------------------------------- | --- |
| 2026-11-14 | Runbook drafted | Not adopted; §8 with accountant | —   |
