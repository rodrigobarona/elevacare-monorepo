# Legal memo: Eleva and payment-services regulation

> **Draft for review by a Portuguese lawyer. Not legal advice. It frames a question Eleva has not yet put to counsel; it does not answer it.**

- To: founder; external counsel; accountant (for information)
- From: legal drafting (internal)
- Date: 2026-11-14
- Re: whether collecting members' payments and transferring the expert's
  share makes BÚZIOS E TARTARUGAS - LDA (Eleva.care) a payment-service
  provider, and what would change that

## 1. Question and short answer

**Question.** Members pay for sessions on Eleva. The money is charged on
Eleva's Stripe account and Eleva later transfers the expert's share. Does that
make Eleva a provider of payment services that needs authorisation under the
Portuguese payment-services regime (RJSPME, annexed to Decree-Law 91/2018,
which transposes Directive (EU) 2015/2366, "PSD2")?

**Short answer.** Probably not, on two separate grounds that counsel should
test. Neither has been confirmed by a lawyer, by Stripe in writing or by Banco
de Portugal.

1. **Eleva never holds the money.** Stripe, a licensed institution, receives
   and safeguards the funds. Eleva gives Stripe instructions that follow rules
   published in advance. This is Stripe's own stated position for platforms
   (§3.4).
2. **Eleva collects only for the expert.** The terms give Eleva a mandate to
   collect on the expert's behalf, which is the shape of the commercial-agent
   exclusion in RJSPME art. 5(1)(b).

The second ground is the weaker one. The European Commission has said that a
platform receiving payment for the payee is **not** excluded by default, and
the regulation that will replace PSD2 narrows the exclusion further (§3.5).
The first ground should therefore carry the position, and the product should
be kept in a shape that supports it (§5).

**This is a retroactive check.** Payouts are already built (Phase 06). No live
payment has been taken. The memo should be answered before the first one.

## 2. The funds flow as built

| Step                 | What happens                                                                                                                                                                                              | Evidence                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Charge               | The member pays through Stripe Checkout. The payment is created on Eleva's platform account as a separate charge: no `transfer_data`, no `application_fee_amount`, no `on_behalf_of`.                     | `payments-payouts-spec.md`; no `on_behalf_of` in `packages/billing/src` |
| Statement            | Eleva is the business of record, so Eleva's name is on the member's card statement.                                                                                                                       | `ers-position.md` §4(3)                                                 |
| Where the money sits | In Eleva's Stripe balance. It never reaches a bank account in Eleva's name before the expert is paid.                                                                                                     | Stripe Connect, separate charges and transfers                          |
| Transfer             | Eleva's system creates a Transfer of the amount less the platform fee to the expert's connected account. The share becomes available on the later of 7 days after payment and 24 hours after the session. | `packages/content/content/legal/en/payments.mdx`                        |
| Fee                  | 15% of the list price, or 8% with a Top Expert subscription. Clinics pay a seat subscription and no booking fee.                                                                                          | `expert-agreement.mdx` §8; founder decisions 2026-10-29                 |
| Refunds              | Paid from Eleva's Stripe balance under the service's cancellation tier (D-06). After a transfer, the expert's share is recovered by a transfer reversal.                                                  | `positions-d06-d11-d12.md`; `payments-payouts-spec.md`                  |
| Chargebacks          | Debited from Eleva's balance. If the session was not delivered, the amount is recovered from the expert's transfer.                                                                                       | Founder decision 3 of 2026-10-29                                        |
| Promotion codes      | Eleva-funded. The expert's share is computed on the list price, so part of a transfer can come from Eleva's own money.                                                                                    | Founder decision 5 of 2026-10-29                                        |
| Withholding          | Eleva can hold a transfer: a dispute, a hold reason on the payout, or missing tax-reporting data (expert agreement §16).                                                                                  | `packages/db/src/schema/main/payouts.ts` (`holdReasons`)                |

**What the contract says.** The terms say Eleva "collects the payment on the
expert's behalf" and that "paying Eleva counts as paying the expert: once your
payment is confirmed, you owe the expert nothing more for that session"
(`terms.mdx`). The expert agreement says Eleva "only acts on your behalf when
it collects and transfers payments" and that the agreement creates no agency
relationship otherwise (`expert-agreement.mdx` §1 and §8).

## 3. Legal framework

### 3.1 RJSPME art. 5(1)(b): the commercial-agent exclusion

The regime does not apply to:

> "Operações de pagamento do ordenante para o beneficiário através de um agente
> comercial autorizado por contrato a negociar ou a concluir a venda ou a
> aquisição de bens ou serviços exclusivamente em nome do ordenante ou
> exclusivamente em nome do beneficiário"

In English: payment transactions from the payer to the payee through a
commercial agent authorised by contract to negotiate or conclude the sale or
purchase of goods or services on behalf of only the payer or only the payee.

### 3.2 PSD2 recital 11

A platform that acts for both the payer and the payee is excluded only if it
never comes into possession or control of client funds.

### 3.3 European Commission answers (EBA Single Rulebook Q&A)

- **Q&A 2020_5354.** Does it matter that the payer's debt is settled when the
  platform receives the money? Answer: a platform receiving payment for the
  payee is not excluded by default, and debt settlement is not in itself a
  reason to exclude it.
- **Q&A 2020_5355.** When does a consumer-facing platform fit the exclusion?
  Answer: only if the payee authorises it to negotiate or conclude the sale
  and it does not also act for the payer. The competent authority assesses
  the business model case by case.

### 3.4 Stripe's stated position

- **Licensed entity.** Stripe Technology Europe, Limited is an e-money
  institution authorised by the Central Bank of Ireland (C187865), passported
  across the EEA. The fact sheet names Stripe Payments Europe, Ltd. as the
  sub-processor; counsel should confirm which entity is the contracting party
  for a Portuguese platform.
- **Who holds the funds.** Stripe says that under separate charges and
  transfers the funds sit in a Stripe-titled safeguarding account, and that
  the platform gives pre-agreed instructions and has no discretionary
  authority over them (guide last updated 18 January 2024).
- **Licence.** Stripe says a marketplace needs a licence or agent status only
  if it provides regulated payment services or holds or controls user funds.
- **`on_behalf_of`.** Setting it makes the connected account the settlement
  merchant: its statement descriptor, country of settlement and fee structure
  apply. When it is omitted, "the platform is the business of record".
- **Holding period.** Stripe advises against holding funds "arbitrarily" and
  lists a 90-day holding period for connected-account balances on manual
  payouts. No separate published limit was found for a platform balance before
  transfer.

This is Stripe's own view, written for platforms in general. It is not an
opinion on Eleva's flow.

### 3.5 What is coming: the Payment Services Regulation (PSR)

PSD3 and the PSR are not yet adopted. The Council's first-reading position
reached Parliament on 5 November 2026, with a plenary vote forecast for
December 2026. The April 2026 compromise text applies the PSR 21 months after
it enters into force. Its art. 2(2)(b) keeps the commercial-agent exclusion
only where the agent acts for "only the payer or only the payee, but not
both", with "a real scope to negotiate", **regardless of whether it holds
funds**. The final wording may differ.

### 3.6 Banco de Portugal

No public guidance on marketplaces and art. 5(1)(b) was found. The
notification duty in RJSPME art. 6 covers limited networks and telecom
operators, not commercial agents.

## 4. Analysis

### 4.1 Ground one: Eleva does not hold or control the funds

**For.** The money is received and safeguarded by Stripe. Eleva has no bank
account that receives members' money on the way to experts. The rules that
decide when and how much is transferred are published in the terms, the
payment policies and the expert agreement, and they run in code.

**Against.** "Control" is the contestable word. Eleva's system decides when a
transfer is created, can delay it (the 7-day rule), can withhold it (hold
reasons, a dispute, missing tax data) and can reverse it. The balance the
money sits in is Eleva's Stripe balance, which also holds Eleva's own fee
income. Promotion codes mean Eleva sometimes pays part of the expert's share
from its own money.

### 4.2 Ground two: the commercial-agent exclusion

**For.** The contract gives Eleva a collection mandate from the expert, and
payment to Eleva discharges the member's debt to the expert. Eleva takes no
mandate from the member to pay.

**Against.**

1. **Both sides.** Members accept Eleva's terms, pay through Eleva's checkout
   and get refunds decided under Eleva's published tiers. Under Q&A 2020_5355
   a platform that also acts for the payer falls outside the exclusion.
2. **"Negotiate or conclude the sale."** With Instant Book, Eleva's system
   concludes the booking on terms the expert set. Whether that is concluding
   the sale _on the expert's behalf_ in the sense of the exclusion is a
   question for counsel. The expert agreement says no agency relationship is
   created except for collection.
3. **Debt settlement is not enough** (Q&A 2020_5354).
4. **The PSR text** would require "a real scope to negotiate". Eleva sets no
   prices and negotiates nothing.

### 4.3 How this sits with the ERS memo

[`ers-position.md`](./ers-position.md) §4(3) recommends the collection mandate
so that the expert, not Eleva, is seen as the seller of the session. That
wording helps this memo's second ground too, because it places Eleva on the
payee's side only. The tension is elsewhere: to fit the exclusion Eleva needs
authority to _conclude the sale_ for the expert, while the ERS position is
strongest when Eleva does as little as possible in the care relationship. One
lawyer should read both memos together.

## 5. Options

| Option                                                                                                                      | Effect on this question                                                                                                                      | Cost                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **A. Keep the flow, document the position.** Get counsel's view and Stripe's written confirmation of who holds the funds.   | Relies on ground one as built.                                                                                                               | Small: this memo, one letter to Stripe.                                                                                 |
| **B. Add `on_behalf_of`.** The expert becomes the settlement merchant; their name is on the member's statement.             | Weakens the "Eleva is the merchant" reading here and in the ERS memo (§4(3)). The money still sits in Eleva's Stripe balance until transfer. | Medium: connected accounts need the `card_payments` capability; statement, fees and MB WAY behaviour must be re-tested. |
| **C. Move to destination charges.** Funds settle to the expert's connected account at once; Eleva takes an application fee. | Strongest on "never holds or controls": any delay happens in the expert's own Stripe balance, under a payout schedule.                       | Large: the refund, reversal and hold-expiry contract in Phase 06 is built on separate charges and transfers.            |
| **D. Bound the holding time.** State a maximum time between payment and transfer and enforce it in code.                    | Shows the instructions are pre-agreed rather than discretionary. Works with A, B or C.                                                       | Small.                                                                                                                  |

**Drafting recommendation, for counsel to confirm or replace:** A and D before
the first live payment; B as the next step, because it also answers the ERS
memo's statement risk; C only if counsel or Stripe says B is not enough, or
once the PSR's final text makes the agent exclusion unusable.

## 6. What would change the answer

- Members' money reaches a bank account in Eleva's name before experts are
  paid.
- Eleva pays experts from its own bank account rather than by Stripe Transfer.
- Eleva delays or withholds transfers at its discretion, outside rules the
  expert and the member accepted in advance.
- Eleva offers stored value: credits, wallets, gift cards or pre-paid packs.
  These raise e-money and limited-network questions of their own.
- Eleva pays out on someone's instruction other than under a booking (for
  example, splitting a payment between experts at a member's request).
- The PSR is published. Re-assess against its final art. 2(2)(b).

The retention schedule already records the linked point for anti-money
laundering: Eleva is not an obliged entity, and "this changes if Eleva itself
ever holds client funds" ([`retention-schedule.md`](./retention-schedule.md)
§1.6).

## 7. Points for lawyer review

1. Does the flow in §2 amount to a payment service under the RJSPME (money
   remittance, or acquiring), given that the funds are held by Stripe?
2. If it does, does art. 5(1)(b) apply, given the two Commission answers and
   that members also contract with Eleva?
3. Is the collection mandate best framed as _mandato sem representação_ or as
   commercial agency, and does the answer differ for the ERS position? The
   accountant confirms the VAT treatment (already asked in the ERS memo).
4. Do Eleva-funded promotion codes, transfer reversals or payout holds amount
   to "control" of the funds?
5. Should Eleva ask Banco de Portugal for an informal view, or is counsel's
   opinion on file enough?
6. Does option B or C materially improve the position, and is either needed
   before the first live payment?
7. What should change in the terms, payment policies and expert agreement?

## 8. Questions for Stripe (in writing)

1. Which Stripe entity provides the regulated service and contracts with a
   Portuguese platform on Connect?
2. Under separate charges and transfers, who holds and safeguards the funds in
   the platform balance, and in whose name?
3. Is there a maximum time a platform may hold funds before transferring them
   to a connected account in Portugal?
4. Does Stripe confirm that a platform operating this flow needs no payment
   authorisation of its own, and under which exclusion or analysis?
5. With `on_behalf_of` on separate charges and transfers: who is liable for
   refunds and disputes, and does it work with every payment method Eleva
   offers (cards, wallets, Link, MB WAY)?

## Sources

- RJSPME (annex to DL 91/2018), art. 5 and art. 6:
  <https://www.bportugal.pt/sites/default/files/anexos/legislacoes/335415275_3.docx.pdf>
- EBA Q&A 2020_5354:
  <https://www.eba.europa.eu/single-rule-book-qa/qna/view/publicId/2020_5354>
- EBA Q&A 2020_5355:
  <https://www.eba.europa.eu/single-rule-book-qa/qna/view/publicId/2020_5355>
- Stripe Technology Europe, Limited: <https://stripe.com/legal/stel>
- Stripe, "Frequently asked questions about Stripe Connect and PSD2":
  <https://stripe.com/guides/frequently-asked-questions-about-stripe-connect-and-psd2>
- Stripe, separate charges and transfers:
  <https://docs.stripe.com/connect/separate-charges-and-transfers>
- Stripe, account balances and manual payouts:
  <https://docs.stripe.com/connect/account-balances>,
  <https://docs.stripe.com/connect/manual-payouts>
- PSR procedure file 2023/0210(COD):
  <https://oeil.europarl.europa.eu/oeil/en/procedure-file?reference=2023/0210(COD)>
- Council compromise text ST 8221/2026:
  <https://data.consilium.europa.eu/doc/document/ST-8221-2026-INIT/en/pdf>

The sources were read on 2026-11-14 by an AI research pass. PSD2 recital 11
was read on a UK-hosted copy of the directive. Counsel should re-check each
one before relying on it.
