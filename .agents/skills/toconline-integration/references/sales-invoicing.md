# TOConline Sales Invoicing and VAT Rules

## Invoice Creation Flow

### v1 API (preferred — single-call)

Create a sales document with header + lines in one request:

```
POST /api/v1/commercial_sales_documents
```

```json
{
  "document_type": "FT",
  "finalize": 1,
  "date": "2026-01-15",
  "customer_tax_registration_number": "229659179",
  "customer_business_name": "Dr. Maria Silva, Unip. Lda",
  "customer_address_detail": "Rua Example 123",
  "customer_postcode": "1000-001",
  "customer_city": "Lisboa",
  "customer_country": "PT",
  "due_date": "2026-02-15",
  "payment_mechanism": "TB",
  "vat_included_prices": true,
  "currency_iso_code": "EUR",
  "notes": "Servico de plataforma Eleva Care - Consulta NUT-2026-001",
  "external_reference": "cs_stripe_session_id",
  "lines": [
    {
      "item_type": "Service",
      "description": "Servico de plataforma Eleva Care",
      "quantity": 1,
      "unit_price": 15.0,
      "tax_code": "NOR",
      "tax_percentage": 23
    }
  ]
}
```

Key fields:

| Field                              | Description                                                           |
| ---------------------------------- | --------------------------------------------------------------------- |
| `document_type`                    | `FT` (fatura), `NC` (nota de credito), `FR` (fatura-recibo)           |
| `finalize`                         | `0` = draft, `1` = finalize immediately (assigns number + ATCUD)      |
| `customer_tax_registration_number` | Expert's NIF / VAT number                                             |
| `payment_mechanism`                | `TB` (transferencia bancaria), `CC` (cartao credito), `MO` (dinheiro) |
| `vat_included_prices`              | `true` if unit_price includes VAT                                     |
| `external_reference`               | Stripe session ID for traceability                                    |
| `lines[].tax_code`                 | `NOR` (normal), `ISE` (isento/exempt)                                 |
| `lines[].tax_percentage`           | `23`, `13`, `6`, or `0`                                               |

### Legacy API (multi-step)

If v1 is unavailable, use the legacy JSON:API flow:

```
1. POST /api/commercial_sales_documents       → create header (returns document_id)
2. POST /api/commercial_sales_document_lines   → add each line
3. PATCH /api/commercial_sales_documents       → finalize (set status: 1)
```

#### Step 1: Create header

```json
{
  "data": {
    "type": "commercial_sales_documents",
    "attributes": {
      "document_type": "FT",
      "date": "2026-01-15",
      "customer_id": 62,
      "due_date": "2026-02-15",
      "payment_mechanism": "TB",
      "vat_included_prices": true,
      "currency_iso_code": "EUR",
      "notes": "Servico de plataforma Eleva Care"
    }
  }
}
```

#### Step 2: Add service line

```json
{
  "data": {
    "type": "commercial_sales_document_lines",
    "attributes": {
      "document_id": 67,
      "item_type": "Service",
      "quantity": 1,
      "unit_price": 15.0,
      "tax_id": 2
    }
  }
}
```

#### Step 3: Finalize

```json
{
  "data": {
    "type": "commercial_sales_documents",
    "id": "67",
    "attributes": {
      "status": 1
    }
  }
}
```

## Eleva Platform Fee Invoice

When Stripe fires `checkout.session.completed`:

```typescript
async function issuePlatformFeeInvoice(
  bookingId: string,
  session: StripeSession
) {
  // 1. Check idempotency
  const existing = await db
    .select()
    .from(platformFeeInvoices)
    .where(eq(platformFeeInvoices.bookingId, bookingId))

  if (existing.length && existing[0].status === "finalized") return

  // 2. Get expert fiscal data
  const expert = await getExpertFiscalData(session.metadata.expertId)

  // 3. Determine VAT
  const vat = getVatConfig(expert.fiscalCountry, expert.hasValidVies)

  // 4. Ensure customer exists in TOConline
  await ensureCustomer(expert)

  // 5. Create invoice
  const platformFee = parseInt(session.metadata.platformFee) / 100
  const invoice = await toconline.post("/api/v1/commercial_sales_documents", {
    document_type: "FT",
    finalize: 1,
    date: new Date().toISOString().split("T")[0],
    customer_tax_registration_number: expert.fiscalNif,
    customer_business_name: expert.fiscalBusinessName,
    customer_address_detail: expert.fiscalAddress,
    customer_postcode: expert.fiscalPostcode,
    customer_city: expert.fiscalCity,
    customer_country: expert.fiscalCountry,
    payment_mechanism: "TB",
    vat_included_prices: true,
    currency_iso_code: "EUR",
    notes: `Servico de plataforma Eleva Care - ${session.metadata.eventName}`,
    external_reference: session.id,
    lines: [
      {
        item_type: "Service",
        description: "Servico de plataforma Eleva Care",
        quantity: 1,
        unit_price: platformFee,
        tax_code: vat.code,
        tax_percentage: vat.rate,
      },
    ],
  })

  // 6. Record in DB
  await db.insert(platformFeeInvoices).values({
    bookingId,
    toconlineDocumentId: invoice.id,
    toconlineDocumentNo: invoice.document_no,
    status: "finalized",
    amount: platformFee,
    vatRate: vat.rate,
    createdAt: new Date(),
  })
}
```

## Credit Note (Refund)

For refunds, create a `NC` (nota de credito) referencing the original invoice:

```json
{
  "document_type": "NC",
  "finalize": 1,
  "date": "2026-01-20",
  "customer_tax_registration_number": "229659179",
  "customer_business_name": "Dr. Maria Silva",
  "notes": "Anulacao - Ref. ELEVA FT 2026/1",
  "lines": [
    {
      "item_type": "Service",
      "description": "Anulacao de servico de plataforma Eleva Care",
      "quantity": 1,
      "unit_price": 15.0,
      "tax_code": "NOR",
      "tax_percentage": 23
    }
  ]
}
```

## VAT Matrix

| Expert location     | VAT rate | Tax code | Exemption ID | Invoice note                         |
| ------------------- | -------- | -------- | ------------ | ------------------------------------ |
| PT (valid NIF)      | 23%      | `NOR`    | —            | —                                    |
| EU B2B (valid VIES) | 0%       | `ISE`    | 7 (M07)      | "IVA - Autoliquidacao (Art. 6 RITI)" |
| EU (no valid VIES)  | 23%      | `NOR`    | —            | —                                    |
| Non-EU              | 0%       | `ISE`    | 99 (M99)     | "IVA - Nao sujeito (Art. 6 CIVA)"    |

### Implementation

```typescript
interface VatConfig {
  rate: number
  code: "NOR" | "ISE"
  exemptionId?: number
  note?: string
}

const EU_COUNTRIES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
] as const

function getVatConfig(country: string, hasValidVies: boolean): VatConfig {
  if (country === "PT") {
    return { rate: 23, code: "NOR" }
  }

  if (EU_COUNTRIES.includes(country as (typeof EU_COUNTRIES)[number])) {
    if (hasValidVies) {
      return {
        rate: 0,
        code: "ISE",
        exemptionId: 7,
        note: "IVA - Autoliquidacao (Art. 6 RITI)",
      }
    }
    return { rate: 23, code: "NOR" }
  }

  return {
    rate: 0,
    code: "ISE",
    exemptionId: 99,
    note: "IVA - Nao sujeito (Art. 6 CIVA)",
  }
}
```

### Look up tax IDs from TOConline

```
GET /api/taxes?filter[tax_code]=NOR&filter[tax_country_region]=PT&filter[tax_percentage]=23
GET /api/taxes?filter[tax_code]=ISE&filter[tax_country_region]=PT
```

## Reconciliation

Monthly QStash cron job:

1. Query Stripe for all application fees in the period
2. Query TOConline for all finalized documents in `ELEVA` series for the period
3. Compare totals — mismatches go to `/admin/accounting`
4. Flag any bookings with `platform_fee_invoices.status = 'error'`

## Idempotency Tables (Neon)

### `platform_fee_invoices`

| Column                  | Type      | Description                                |
| ----------------------- | --------- | ------------------------------------------ |
| `booking_id`            | text PK   | Booking that generated the fee             |
| `toconline_document_id` | text      | TOConline internal ID                      |
| `toconline_document_no` | text      | e.g. `ELEVA FT 2026/1`                     |
| `status`                | text      | `pending`, `created`, `finalized`, `error` |
| `amount`                | numeric   | Fee amount in EUR                          |
| `vat_rate`              | integer   | Applied VAT percentage                     |
| `error_message`         | text      | Last error if status = error               |
| `retry_count`           | integer   | Number of retry attempts                   |
| `created_at`            | timestamp |                                            |

### `clinic_saas_invoices`

| Column                  | Type      | Description    |
| ----------------------- | --------- | -------------- |
| `subscription_period`   | text PK   | e.g. `2026-01` |
| `clinic_id`             | text      |                |
| `toconline_document_id` | text      |                |
| `toconline_document_no` | text      |                |
| `status`                | text      |                |
| `amount`                | numeric   |                |
| `created_at`            | timestamp |                |

## Error Handling

| HTTP | Meaning            | Action                                             |
| ---- | ------------------ | -------------------------------------------------- |
| 401  | Token expired      | Refresh token, retry once                          |
| 422  | Validation error   | Log details, set status = error, alert admin       |
| 404  | Customer not found | Run customer upsert, retry                         |
| 409  | Duplicate          | Check idempotency table, skip if already finalized |
| 5xx  | Server error       | Exponential backoff, max 3 retries                 |

After 3 failed retries: set `status = 'error'`, capture exception in Sentry (`packages/observability`), surface in `/admin/accounting`.
