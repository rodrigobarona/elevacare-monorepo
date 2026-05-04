# TOConline Open API Reference

> **Source**: Postman collection `_context/Postman OAuth2 Credentials.json`
> **API version**: v1 (current) + legacy JSON:API endpoints
> **Last updated**: 2026-05-04
> **Related**: [ADR-013 — Accounting Integration](adrs/ADR-013-accounting-integration.md)

## Base URLs

| Environment | API base                     | OAuth base                         |
| ----------- | ---------------------------- | ---------------------------------- |
| Production  | `https://api33.toconline.pt` | `https://app33.toconline.pt/oauth` |

> **Warning**: older internal docs reference `api.toconline.pt` — that is incorrect.
> The correct production host is `api33.toconline.pt`.

## Authentication — OAuth 2.0 Authorization Code + PKCE

TOConline uses **Authorization Code** flow with PKCE (S256), not client credentials.

### Flow

```
1. Redirect user to:
   https://app33.toconline.pt/oauth/auth
     ?response_type=code
     &client_id={TOCONLINE_CLIENT_ID}
     &redirect_uri={TOCONLINE_REDIRECT_URI}
     &scope=commercial
     &code_challenge={challenge}
     &code_challenge_method=S256

2. User authorizes → callback receives ?code=...

3. Exchange code for token:
   POST https://app33.toconline.pt/oauth/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &code={code}
   &redirect_uri={TOCONLINE_REDIRECT_URI}
   &client_id={TOCONLINE_CLIENT_ID}
   &client_secret={TOCONLINE_CLIENT_SECRET}
   &code_verifier={verifier}

4. Response: { access_token, refresh_token, expires_in, token_type }
```

### Key details

| Parameter            | Value                           |
| -------------------- | ------------------------------- |
| Grant type           | `authorization_code`            |
| Scope                | `commercial`                    |
| PKCE challenge       | S256                            |
| Client auth location | Request body (not Basic header) |
| Token delivery       | Bearer header                   |

### Request headers (all authenticated calls)

```
Authorization: Bearer {access_token}
Content-Type: application/json          # for v1 endpoints
Content-Type: application/vnd.api+json  # for legacy JSON:API endpoints
Accept: application/json
```

## Environment Variables

```bash
TOCONLINE_API_URL=https://api33.toconline.pt
TOCONLINE_OAUTH_URL=https://app33.toconline.pt/oauth
TOCONLINE_CLIENT_ID=           # from TOConline API access request
TOCONLINE_CLIENT_SECRET=       # from TOConline API access request
TOCONLINE_REDIRECT_URI=        # your app's OAuth callback
TOCONLINE_SERIES_PREFIX=ELEVA  # already configured in TOConline
```

## API Format: v1 vs Legacy

TOConline exposes two API styles that coexist:

| Style      | URL pattern          | Request body                              | Used for                                                      |
| ---------- | -------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| **v1**     | `/api/v1/{resource}` | Flat JSON                                 | Sales documents, purchase documents, receipts, payments       |
| **Legacy** | `/api/{resource}`    | JSON:API `{ data: { type, attributes } }` | Customers, suppliers, addresses, contacts, products, services |

### v1 flat JSON example (sales document)

```json
{
  "document_type": "FT",
  "date": "2026-01-15",
  "customer_tax_registration_number": "123456789",
  "customer_business_name": "Dr. Maria Silva",
  "lines": [{}]
}
```

### Legacy JSON:API example (customer)

```json
{
  "data": {
    "type": "customers",
    "attributes": {
      "tax_registration_number": "123456789",
      "business_name": "Dr. Maria Silva"
    }
  }
}
```

---

## Eleva Document Series

Prefix `ELEVA` is already configured in TOConline. Look up the series ID:

```
GET /api/commercial_document_series?filter[prefix]=ELEVA
```

Platform fee invoices are numbered `ELEVA FT {YYYY}/{N}`.

---

## Endpoint Catalogue

### Customers (`/api/customers`)

Manages customer records (experts/clinics in Eleva's context).

| Method   | Path                       | Description                         |
| -------- | -------------------------- | ----------------------------------- |
| `POST`   | `/api/customers`           | Create customer                     |
| `PATCH`  | `/api/customers`           | Update customer (include `data.id`) |
| `GET`    | `/api/customers`           | List all customers                  |
| `GET`    | `/api/customers/:clientId` | Get customer by ID                  |
| `DELETE` | `/api/customers/:clientId` | Delete customer                     |

#### Create customer body

```json
{
  "data": {
    "type": "customers",
    "attributes": {
      "tax_registration_number": "221976302",
      "business_name": "Empresa de Contabilidade",
      "contact_name": "Cliente OCC",
      "website": "https://toconline.pt",
      "phone_number": 309867004,
      "mobile_number": 939038342,
      "email": "cliente@email.pt",
      "observations": "",
      "internal_observations": ""
    }
  }
}
```

#### Update customer body

```json
{
  "data": {
    "type": "customers",
    "id": "62",
    "attributes": {
      "tax_registration_number": "238241904",
      "business_name": "Updated Name",
      "contact_name": "New Contact",
      "email": "new@email.pt"
    }
  }
}
```

---

### Addresses (`/api/addresses`)

Addresses are polymorphic — linked to customers or suppliers via `addressable_type`.

| Method   | Path                 | Description                        |
| -------- | -------------------- | ---------------------------------- |
| `POST`   | `/api/addresses`     | Create address                     |
| `PATCH`  | `/api/addresses`     | Update address (include `data.id`) |
| `GET`    | `/api/addresses`     | List all addresses                 |
| `GET`    | `/api/addresses/:id` | Get address by ID                  |
| `DELETE` | `/api/addresses/:id` | Delete address                     |

#### Create address body

```json
{
  "data": {
    "type": "addresses",
    "attributes": {
      "addressable_type": "Customer",
      "addressable_id": 62,
      "address_detail": "Rua Example 123",
      "city": "Lisboa",
      "postcode": "1000-001",
      "region": "Lisboa",
      "country_id": "1"
    }
  }
}
```

---

### Contacts (`/api/contacts`)

Email contacts linked to customers or suppliers.

| Method  | Path                       | Description                        |
| ------- | -------------------------- | ---------------------------------- |
| `POST`  | `/api/contacts`            | Create contact                     |
| `PATCH` | `/api/contacts`            | Update contact (include `data.id`) |
| `GET`   | `/api/contacts`            | List all contacts                  |
| `GET`   | `/api/contacts/:contactId` | Get contact by ID                  |

#### Create contact body

```json
{
  "data": {
    "type": "contacts",
    "attributes": {
      "is_primary": true,
      "name": "Maria Silva",
      "email": "maria@example.pt",
      "categories": ["general"],
      "contactable_id": 61,
      "contactable_type": "Customer"
    }
  }
}
```

---

### Suppliers (`/api/suppliers`)

| Method   | Path                         | Description                         |
| -------- | ---------------------------- | ----------------------------------- |
| `POST`   | `/api/suppliers`             | Create supplier                     |
| `PATCH`  | `/api/suppliers`             | Update supplier (include `data.id`) |
| `GET`    | `/api/suppliers`             | List all suppliers                  |
| `GET`    | `/api/suppliers/:supplierId` | Get supplier by ID                  |
| `DELETE` | `/api/suppliers/:supplierId` | Delete supplier                     |

#### Create supplier body

```json
{
  "data": {
    "type": "suppliers",
    "attributes": {
      "tax_registration_number": "533186331",
      "business_name": "A Empresa",
      "website": "www.example.pt",
      "is_taxable": false,
      "is_tax_exempt": false,
      "tax_exemption_reason_id": null,
      "tax_country_region": "PT",
      "is_independent_worker": false,
      "country_iso_alpha_2": "PT"
    }
  }
}
```

---

### Products (`/api/products`)

| Method   | Path                 | Description                          |
| -------- | -------------------- | ------------------------------------ |
| `POST`   | `/api/products`      | Create product                       |
| `PATCH`  | `/api/products`      | Update product / associate to family |
| `GET`    | `/api/products`      | List all products                    |
| `GET`    | `/api/products`      | Get product by ID (query)            |
| `DELETE` | `/api/products/{id}` | Delete product                       |

#### Create product body

```json
{
  "data": {
    "type": "products",
    "attributes": {
      "type": "Product",
      "item_code": 777777,
      "item_description": "Product with a family",
      "sales_price": 100,
      "sales_price_includes_vat": false,
      "tax_code": "NOR",
      "item_family_id": 4
    }
  }
}
```

---

### Services (`/api/services`)

| Method   | Path            | Description                        |
| -------- | --------------- | ---------------------------------- |
| `POST`   | `/api/services` | Create service (supports array)    |
| `PATCH`  | `/api/services` | Update service (include `data.id`) |
| `GET`    | `/api/services` | List all services                  |
| `DELETE` | `/api/services` | Delete service                     |

#### Create service body

```json
{
  "data": [
    {
      "type": "services",
      "attributes": {
        "type": "Service",
        "item_code": "333333",
        "item_description": "Serviço NOR",
        "sales_price": 10,
        "sales_price_2": 20,
        "sales_price_3": 30,
        "purchase_price": 0,
        "ean_barcode": "",
        "financial_cost": 0,
        "transport_cost": 0,
        "other_cost": 0,
        "customs_cost": 0,
        "estimated_total_cost": 0
      }
    }
  ]
}
```

---

### Sales Documents — v1 (`/api/v1/commercial_sales_documents`)

The primary API for creating invoices (FT), credit notes (NC), etc. Uses flat JSON.

| Method | Path                                                  | Description                            |
| ------ | ----------------------------------------------------- | -------------------------------------- |
| `POST` | `/api/v1/commercial_sales_documents`                  | Create sales document (header + lines) |
| `GET`  | `/api/v1/commercial_sales_documents/`                 | List all sales documents               |
| `GET`  | `/api/v1/commercial_sales_documents/:salesDocumentId` | Get by ID                              |
| `GET`  | `/api/commercial_sales_documents?filter[status]=1`    | List finalized documents               |

#### Create sales document body (v1)

```json
{
  "document_type": "FT",
  "date": "2026-01-15",
  "finalize": 0,
  "customer_tax_registration_number": "229659179",
  "customer_business_name": "Ricardo Ribeiro",
  "customer_address_detail": "Praceta da Liberdade n5",
  "customer_postcode": "1000-101",
  "customer_city": "Lisboa",
  "customer_country": "PT",
  "due_date": "2026-02-15",
  "settlement_expression": "7.5",
  "payment_mechanism": "MO",
  "vat_included_prices": false,
  "operation_country": "PT-MA",
  "currency_iso_code": "EUR",
  "currency_conversion_rate": 1.0,
  "retention": 7.5,
  "retention_type": "IRS",
  "apply_retention_when_paid": true,
  "notes": "Notas ao documento",
  "external_reference": "Referência externa",
  "lines": [{}]
}
```

Key fields:

- `document_type`: `FT` (fatura), `NC` (nota de crédito), `FR` (fatura-recibo), etc.
- `finalize`: `0` = draft, `1` = finalize immediately
- `lines`: array of line items (can be empty to add lines later)
- `vat_included_prices`: whether unit prices include VAT
- `payment_mechanism`: `MO` (dinheiro), `CC` (cartão crédito), `TB` (transferência bancária), etc.

---

### Sales Documents — Legacy (`/api/commercial_sales_documents`)

Older JSON:API style. Header and lines are separate calls.

| Method   | Path                                                        | Description                |
| -------- | ----------------------------------------------------------- | -------------------------- |
| `POST`   | `/api/commercial_sales_documents`                           | Create header              |
| `POST`   | `/api/commercial_sales_document_lines`                      | Add line                   |
| `PATCH`  | `/api/commercial_sales_documents`                           | Update header              |
| `PATCH`  | `/api/commercial_sales_document_lines`                      | Update line                |
| `PATCH`  | `/api/commercial_sales_documents`                           | Finalize (set `status: 1`) |
| `GET`    | `/api/commercial_sales_documents`                           | List all                   |
| `GET`    | `/api/commercial_sales_documents/:salesDocumentId`          | Get by ID                  |
| `GET`    | `/api/commercial_sales_documents/:id/lines`                 | Get lines                  |
| `GET`    | `/api/commercial_sales_documents?filter[status]=1`          | List finalized             |
| `DELETE` | `/api/commercial_sales_documents/:id`                       | Delete document            |
| `DELETE` | `/api/commercial_sales_document_lines/:salesDocumentLineId` | Delete line                |

#### Create header (legacy)

```json
{
  "data": {
    "type": "commercial_sales_documents",
    "attributes": {
      "document_type": "FT",
      "date": "2026-01-15",
      "customer_id": 2,
      "due_date": "2026-02-15",
      "settlement_expression": "7.5",
      "payment_mechanism": "MO",
      "vat_included_prices": false,
      "operation_country": "PT-MA",
      "currency_iso_code": "EUR",
      "notes": "Notas ao documento"
    }
  }
}
```

#### Add service line (legacy)

```json
{
  "data": {
    "type": "commercial_sales_document_lines",
    "attributes": {
      "document_id": 66,
      "item_type": "Service",
      "quantity": 1,
      "unit_price": 9.99,
      "settlement_expression": "3",
      "item_id": 7,
      "unit_of_measure_id": 2,
      "tax_id": 2
    }
  }
}
```

Other line types: `Product`, `TaxDescriptor`, description-only (no value).

#### Finalize document (legacy)

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

---

### Sales Receipts — v1 (`/api/v1/commercial_sales_receipts`)

| Method   | Path                                                     | Description           |
| -------- | -------------------------------------------------------- | --------------------- |
| `POST`   | `/api/v1/commercial_sales_receipts`                      | Create receipt header |
| `POST`   | `/api/commercial_sales_receipt_lines`                    | Add receipt line      |
| `PATCH`  | `/api/v1/commercial_sales_receipts/:salesReceiptId`      | Update receipt        |
| `PATCH`  | `/api/v1/commercial_sales_receipts/:salesReceiptId/void` | Void receipt          |
| `GET`    | `/api/v1/commercial_sales_receipts/:salesReceiptId`      | Get by ID             |
| `GET`    | `/api/v1/commercial_sales_receipts`                      | List all              |
| `DELETE` | `/api/v1/commercial_sales_receipts/:salesReceiptId`      | Delete receipt        |
| `DELETE` | `/api/v1/commercial_sales_receipt_lines/`                | Delete receipt lines  |

#### Create receipt header (v1)

```json
{
  "date": "2026-02-24",
  "payment_mechanism": "MO",
  "gross_total": 10.69,
  "net_total": 9.25,
  "standalone": true,
  "observations": ""
}
```

#### Add receipt line

```json
{
  "data": {
    "type": "commercial_sales_receipt_lines",
    "attributes": {
      "receipt_id": 13,
      "receivable_type": "Document",
      "receivable_id": 12,
      "received_value": 10.69,
      "settlement_percentage": 0,
      "gross_total": 10.69,
      "net_total": 9.27,
      "retention_total": 0.72
    }
  }
}
```

---

### PDF Download (`/api/url_for_print`)

| Method | Path                                                                     | Description                    |
| ------ | ------------------------------------------------------------------------ | ------------------------------ |
| `GET`  | `/api/url_for_print/:salesDocumentId?filter[type]=Document`              | Download sales document PDF    |
| `GET`  | `/api/url_for_print/:purchasesDocumentId?filter[type]=PurchasesDocument` | Download purchase document PDF |

---

### AT Communication (`/api/send_document_at_webservice`)

Report documents to Autoridade Tributaria.

| Method  | Path                               | Description           |
| ------- | ---------------------------------- | --------------------- |
| `PATCH` | `/api/send_document_at_webservice` | Submit document to AT |

```json
{
  "data": {
    "id": "<document_id>",
    "type": "send_document_at_webservice",
    "attributes": {
      "communication_message": "<message>",
      "communication_code": "<code>",
      "communication_status": "<status>"
    }
  }
}
```

---

### Email Sending (`/api/email/document`)

| Method  | Path                  | Description            |
| ------- | --------------------- | ---------------------- |
| `PATCH` | `/api/email/document` | Send document by email |
| `PATCH` | `/api/email/document` | Send receipt by email  |

```json
{
  "data": {
    "type": "email/document",
    "id": 3,
    "attributes": {
      "type": "Document",
      "to_email": "recipient@example.pt",
      "from_email": "sender@eleva.care",
      "from_name": "Eleva Care",
      "subject": "Your invoice"
    }
  }
}
```

For receipts, set `"type": "Receipt"` in attributes.

---

### Purchase Documents — v1 (`/api/v1/commercial_purchases_documents`)

| Method | Path                                                      | Description                            |
| ------ | --------------------------------------------------------- | -------------------------------------- |
| `POST` | `/api/v1/commercial_purchases_documents`                  | Create purchase document               |
| `POST` | `/api/v1/commercial_purchases_document_lines/`            | Add line (product or expense category) |
| `GET`  | `/api/v1/commercial_purchases_documents/`                 | List all                               |
| `GET`  | `/api/v1/commercial_purchases_documents?filter[status]=1` | List finalized                         |

#### Create purchase document (v1)

```json
{
  "document_type": "FC",
  "date": "2026-01-01",
  "document_series_id": 1,
  "supplier_id": 1,
  "supplier_tax_registration_number": "999999990",
  "supplier_business_name": "Nome do fornecedor",
  "supplier_address_detail": "Morada",
  "supplier_postcode": "0000-000",
  "supplier_city": "Cidade",
  "supplier_country": "PT",
  "due_date": "2026-02-01",
  "vat_included_prices": false
}
```

#### Add purchase line (v1)

```json
{
  "data": {
    "type": "commercial_purchases_document_lines",
    "attributes": {
      "quantity": 1,
      "unit_price": 20,
      "item_type": "Product",
      "item_code": "PTEST",
      "settlement_expression": "3"
    },
    "relationships": {
      "document": {
        "data": {
          "type": "commercial_purchases_documents",
          "id": "<document_id>"
        }
      }
    }
  }
}
```

---

### Payments (`/api/v1/commercial_purchases_payments`)

| Method   | Path                                          | Description               |
| -------- | --------------------------------------------- | ------------------------- |
| `POST`   | `/api/v1/commercial_purchases_payments`       | Create payment header     |
| `POST`   | `/api/commercial_purchases_payment_lines`     | Add payment line          |
| `PATCH`  | `/api/v1/commercial_purchases_payments/`      | Finalize / update payment |
| `GET`    | `/api/v1/commercial_purchases_payments/:id`   | Get by ID                 |
| `GET`    | `/api/v1/commercial_purchases_payments`       | List all                  |
| `DELETE` | `/api/v1/commercial_purchases_payments/`      | Delete payment            |
| `DELETE` | `/api/v1/commercial_purchases_payment_lines/` | Delete payment lines      |

---

### Auxiliary APIs

#### Tax Descriptors (`/api/tax_descriptors`)

| Method   | Path                                    | Description              |
| -------- | --------------------------------------- | ------------------------ |
| `GET`    | `/api/tax_descriptors`                  | List all tax descriptors |
| `GET`    | `/api/tax_descriptors/:taxDescriptorId` | Get by ID                |
| `POST`   | `/api/tax_descriptors`                  | Create tax descriptor    |
| `DELETE` | `/api/tax_descriptors/:taxDescriptorId` | Delete tax descriptor    |

#### Item Families (`/api/item_families`)

| Method   | Path                     | Description   |
| -------- | ------------------------ | ------------- |
| `GET`    | `/api/item_families`     | List all      |
| `GET`    | `/api/item_families/:id` | Get by ID     |
| `POST`   | `/api/item_families`     | Create family |
| `DELETE` | `/api/item_families/:id` | Delete family |

#### Countries (`/api/countries`)

| Method | Path                                    | Description        |
| ------ | --------------------------------------- | ------------------ |
| `GET`  | `/api/countries`                        | List all countries |
| `GET`  | `/api/countries?filter[iso_alpha_2]=PT` | Filter by ISO code |
| `GET`  | `/api/oss_countries`                    | List OSS countries |

#### Units of Measure (`/api/units_of_measure`)

| Method   | Path                                                  | Description    |
| -------- | ----------------------------------------------------- | -------------- |
| `GET`    | `/api/units_of_measure`                               | List all       |
| `GET`    | `/api/units_of_measure/:unitsOfMeasureId`             | Get by ID      |
| `GET`    | `/api/units_of_measure?filter[unit_of_measure]=horas` | Filter by name |
| `POST`   | `/api/units_of_measure`                               | Create unit    |
| `DELETE` | `/api/units_of_measure/:unitsOfMeasureId`             | Delete unit    |

#### Bank Accounts (`/api/bank_accounts`)

| Method   | Path                                | Description                                |
| -------- | ----------------------------------- | ------------------------------------------ |
| `POST`   | `/api/bank_accounts`                | Create (entity_type: `User` or `Supplier`) |
| `GET`    | `/api/bank_accounts`                | List all                                   |
| `GET`    | `/api/bank_accounts/:bankAccountId` | Get by ID                                  |
| `DELETE` | `/api/bank_accounts/:bankAccountId` | Delete                                     |

#### Cash Accounts (`/api/cash_accounts`)

| Method | Path                     | Description |
| ------ | ------------------------ | ----------- |
| `POST` | `/api/cash_accounts`     | Create      |
| `GET`  | `/api/cash_accounts`     | List all    |
| `GET`  | `/api/cash_accounts/:id` | Get by ID   |

#### Taxes (`/api/taxes`)

| Method | Path                                                                                      | Description                          |
| ------ | ----------------------------------------------------------------------------------------- | ------------------------------------ |
| `GET`  | `/api/taxes`                                                                              | List all taxes                       |
| `GET`  | `/api/taxes?filter[tax_country_region]=PT&filter[tax_code]=NOR`                           | Filter by region + code              |
| `GET`  | `/api/taxes?filter[tax_code]=NOR&filter[tax_country_region]=PT&filter[tax_percentage]=23` | Filter by region + code + percentage |
| `GET`  | `/api/oss_taxes`                                                                          | List OSS taxes                       |

#### Currencies (`/api/currencies`)

| Method | Path                          | Description |
| ------ | ----------------------------- | ----------- |
| `GET`  | `/api/currencies`             | List all    |
| `GET`  | `/api/currencies/:currencyId` | Get by ID   |

#### Expense Categories (`/api/expense_categories`)

| Method | Path                          | Description |
| ------ | ----------------------------- | ----------- |
| `GET`  | `/api/expense_categories`     | List all    |
| `GET`  | `/api/expense_categories/:id` | Get by ID   |

#### Document Series (`/api/commercial_document_series`)

| Method | Path                                                                            | Description               |
| ------ | ------------------------------------------------------------------------------- | ------------------------- |
| `GET`  | `/api/commercial_document_series`                                               | List all series           |
| `GET`  | `/api/commercial_document_series?filter[document_type]=FT&filter[prefix]=ELEVA` | Filter by type and prefix |

---

## VAT Treatment for Eleva Platform Fees

| Expert location     | VAT rate | Tax code | Exemption | Invoice note                         |
| ------------------- | -------- | -------- | --------- | ------------------------------------ |
| PT (valid NIF)      | 23%      | `NOR`    | —         | —                                    |
| EU B2B (valid VIES) | 0%       | `ISE`    | M07       | "IVA - Autoliquidacao (Art. 6 RITI)" |
| EU (no valid VIES)  | 23%      | `NOR`    | —         | —                                    |
| Non-EU              | 0%       | `ISE`    | M99       | "IVA - Nao sujeito (Art. 6 CIVA)"    |

Look up tax IDs via:

```
GET /api/taxes?filter[tax_code]=NOR&filter[tax_country_region]=PT&filter[tax_percentage]=23
GET /api/taxes?filter[tax_code]=ISE&filter[tax_country_region]=PT
```

---

## Eleva Platform Fee Invoice Flow (v1 API)

```
1. Ensure customer exists
   GET /api/customers  (search by NIF)
   POST /api/customers (create if missing)

2. Create sales document with lines
   POST /api/v1/commercial_sales_documents
   {
     "document_type": "FT",
     "finalize": 1,
     "customer_tax_registration_number": "{expert_nif}",
     "customer_business_name": "{expert_name}",
     "customer_address_detail": "...",
     "customer_postcode": "...",
     "customer_city": "...",
     "customer_country": "{PT|ES|BR|...}",
     "date": "2026-01-15",
     "due_date": "2026-02-15",
     "payment_mechanism": "TB",
     "vat_included_prices": true,
     "currency_iso_code": "EUR",
     "notes": "Servico de plataforma Eleva Care - Consulta {booking_id}",
     "external_reference": "{stripe_session_id}",
     "lines": [{
       "item_type": "Service",
       "description": "Servico de plataforma Eleva Care",
       "quantity": 1,
       "unit_price": 15.00,
       "tax_code": "NOR",
       "tax_percentage": 23
     }]
   }

3. (Optional) Send by email
   PATCH /api/email/document
   { data: { type: "email/document", id: {doc_id}, attributes: { type: "Document", to_email: "..." } } }

4. Download PDF
   GET /api/url_for_print/{doc_id}?filter[type]=Document
```

Set `finalize: 1` to finalize in a single call. The document number (e.g. `ELEVA FT 2026/1`) and ATCUD are assigned upon finalization.

---

## References

- [TOConline API docs](https://api-docs.toconline.pt/llms.txt)
- [ADR-013 — Accounting Integration](adrs/ADR-013-accounting-integration.md)
- [Stripe + TOConline Flow](../_context/clone-repo/eleva-care-app/_docs/09-integrations/STRIPE-TOCONLINE-FLOW.md)
- [Portuguese VAT Code (CIVA)](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/)
