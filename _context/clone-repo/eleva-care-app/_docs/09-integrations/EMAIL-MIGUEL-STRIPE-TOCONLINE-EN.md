# Email to Miguel – Eleva.care business model and Stripe + TOConline integration

> **Language:** en-US  
> **Recipient:** Miguel (Tax Manager – Búzios e Tartarugas, Lda)  
> **Purpose:** Explain the Eleva.care marketplace model, the Stripe implementation (Connect + Identity + payouts), and the TOConline integration plan for Portuguese tax compliance.

---

Subject: Eleva.care business model and Stripe + TOConline integration for commission invoicing

Hi Miguel,

I hope you’re doing well.  
After our recent meeting, I’ve been consolidating the technical architecture of Eleva.care and its tax position in Portugal, to ensure that the marketplace model and the commissions we charge experts are fully aligned with the obligations of Búzios e Tartarugas, Lda.

I’d like to share with you the full picture and the planned integration with TOConline, so you can review it and validate it with us.

---

## 1. Context: what Eleva.care is and our business model

Eleva.care is a digital **health marketplace** operated by Búzios e Tartarugas, Lda (a Portuguese company), which:

- Connects **health experts** (nutrition, menopause, sexual health, etc.) with **patients**;
- Allows experts to configure services (consultations, sessions, etc.), schedule and pricing;
- Allows patients to book and pay for consultations online.

In the current and planned model:

- The **patient pays the full consultation price** (e.g. €100);
- This amount is considered a **service provided by the expert to the patient**;
- Eleva.care charges the expert a **15% commission / service fee** on the consultation amount;
  - In the €100 example, Eleva.care invoices €15 to the expert;
  - The remaining €85 is the expert’s revenue.

In other words, we **do not want to be the “merchant of record” vis-à-vis the patient**. Instead, we want to operate as a marketplace that provides a B2B service to the expert (marketing, technology, payment, etc.) and charges a **platform/intermediation fee**.

---

## 2. How the payment flow is implemented with Stripe

Technically, we use Stripe as our PSP (Payment Service Provider), and in particular **Stripe Connect**:

1. **Patient payment**
   - The patient visits the consultation page, selects a time slot and pays via **Stripe Checkout** (card and, in Portugal, also Multibanco).
   - Stripe creates a `payment_intent` for the full amount (e.g. €100).

2. **Platform account and experts’ accounts**
   - Búzios e Tartarugas, Lda has a **main Stripe account**.
   - Each expert, after identity verification, has a **Stripe Connect account** (sub-account) where their fees are received.
   - Identity verification is done using **Stripe Identity** (documents, KYC, etc.), and only then do we allow the creation of the Connect account.

3. **Automatic split of the payment**
   - When creating the payment, we use Stripe’s native mechanisms:
     - `application_fee_amount` to define the **Eleva commission** (15%);
     - `transfer_data[destination]` to route the **remaining amount to the expert’s Connect account**.
   - In the example:
     - €100 paid by the patient;
     - €15 kept in the Stripe account of Búzios e Tartarugas (commission);
     - €85 transferred to the expert’s account.

4. **Payouts to the expert**
   - We have scheduled jobs (cron) that:
     - Enforce a **minimum aging period** (e.g. 7 days) and a **24-hour buffer after the appointment** to allow for complaints – similar to Airbnb’s model;
     - Check balances in the Connect account;
     - Create **payouts** to the expert’s bank account via Stripe.

In summary, **Stripe already handles the PSP and split payment layer**, in a robust and auditable way. From an accounting perspective, Búzios e Tartarugas only recognises as revenue the **commission (15%)**.

---

## 3. Tax position we want to adopt

From a Portuguese accounting and tax perspective, the model we want to ensure is:

1. **Between expert and patient**
   - The **expert (or clinic)** is the one providing the service to the patient (e.g. a €100 consultation);
   - The expert is responsible for **issuing the €100 invoice to the patient**, using their own invoice series and VAT rules (healthcare exemptions, etc., as applicable);
   - Eleva.care does not intend to invoice the patient for the full amount.

2. **Between Eleva.care (Búzios e Tartarugas, Lda) and the expert**
   - Eleva provides the expert with a **platform/intermediation service**;
   - For each consultation, Eleva charges a **15% commission** (in the example, €15);
   - Búzios e Tartarugas, Lda must **issue an invoice of €15 to the expert**, with the correct VAT treatment:
     - Expert in Portugal (B2B): 23% VAT on the €15;
     - EU B2B expert with valid VAT number: 0% VAT, **reverse charge**;
     - Non-EU expert: 0% VAT, **export of services**.

3. **Certified software and SAF-T**
   - As a Portuguese company, Búzios e Tartarugas, Lda must:
     - Issue invoices through **certified invoicing software** (hence using **TOConline**);
     - Ensure sequential numbering, ATCUD, and inclusion in **SAF-T PT**.

---

## 4. Integration plan with TOConline (via API)

To comply with these requirements in a fully automated way, we designed a **direct API integration** between Eleva.care and TOConline:

1. **When Stripe confirms payment** (`checkout.session.completed`):
   - Our backend receives a **Stripe webhook** with:
     - Total amount (€100);
     - Commission amount (€15);
     - Expert and appointment identifiers.

2. **Collecting the expert’s fiscal data**
   - During expert onboarding we will collect:
     - NIF / VAT number;
     - Legal name;
     - Full address, postal code, city;
     - Country (PT, ES, BR, US, etc.);
     - Whether they are a company (B2B) or an individual (B2C);
     - For EU B2B, the VAT number will be validated via VIES.

3. **Automatic customer creation in TOConline**
   - If the expert does not yet exist in TOConline, Eleva will:
     - Call TOConline’s `customers` API;
     - Create a customer with the expert’s NIF/VAT, name and address.

4. **Automatic issuance of Eleva’s invoice (FT)**
   - Then, Eleva will call TOConline’s `commercial_sales_documents` API to create:
     - An **FT (Invoice)** in a dedicated series (e.g. `ELEVA` prefix), used only for platform commissions;
     - A service line such as:
       - Description: “Eleva Care platform service – Appointment [ID/Description]”;
       - Quantity: 1;
       - Unit price: €15 (or the applicable commission amount);
       - VAT code:
         - PT: 23% NOR;
         - EU B2B: 0% ISE with reason `M07 – Reverse charge`;
         - Non-EU: 0% ISE with reason `M99 – Export of services`.
   - This invoice will have sequential numbering, e.g. `ELEVA FT 2025/123`.

5. **Finalisation and SAF-T**
   - The invoice is **finalised** via API, which:
     - Generates the definitive invoice number and ATCUD;
     - Ensures that the document is included in the **SAF-T files** generated and submitted by TOConline to the tax authority.

6. **Invoice access in the expert/clinic portal**
   - In Eleva’s front-end (e.g. `/account/billing` and other “billing/finance” areas in `src/app/(app)`), we will provide:
     - A list of **consultations/commissions**;
     - Links to **download the PDF invoice issued by TOConline** (via API).
   - The goal is that experts and clinics have an experience similar to **Airbnb**, where they can download the invoices for service fees charged by the platform.

---

## 5. What we’d like you to validate with us

To ensure this design is solid from a tax perspective, I’d really appreciate your validation and guidance on the following points:

1. **Base model**
   - Do you confirm that the model “expert invoices €100 to the patient” + “Eleva invoices €15 to the expert” is the most appropriate for a marketplace like ours?
   - Do you see any risks or alternative models (e.g. full “merchant of record”) that we should consider?

2. **VAT treatment by expert location**
   - Portugal: 23% VAT on the commission – does that seem correct to you?
   - EU B2B with valid VAT number: 0% VAT with reverse charge (`M07`), under Art. 6 RITI – do you agree with this framework?
   - Non-EU: 0% VAT as export of services (`M99`, Art. 6 CIVA) – do you confirm this is the correct interpretation?

3. **Additional obligations**
   - Are there any additional obligations (EU recapitulative statements, specific forms, etc.) we should be aware of, given the digital and cross-border nature of the platform?
   - Do you recommend any specific wording that should appear on the invoices (legal mentions, notes, etc.)?

4. **Technical implementation**
   - Do you have any concerns with invoices being generated 100% automatically via TOConline’s API (as long as we respect series, ATCUD, SAF-T, etc.)?
   - Would you suggest any manual/periodic control (e.g. monthly reconciliation of a sample of invoices) for audit purposes?

I’m also attaching/including internal technical documentation I’ve prepared (Stripe + TOConline flows and Portuguese invoicing requirements), in case you’d like to see the details.

Thank you very much for your help. If you prefer, I can schedule a follow-up meeting after you review this email, so we can adjust the model together before we move ahead with the technical implementation.

Best regards,  
Rodrigo

16 December 2025
