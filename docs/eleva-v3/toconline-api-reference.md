# TOConline Open API Reference

> **Source of truth for field names:** https://api-docs.toconline.pt
> (and `/llms.txt` / `/llms-full.txt`). How to query:
> `_context/TOConline-api/toconline-docs.md`. Do not invent fields.
> Do not vendor the full GitBook corpus (gitleaks + size).
> **API version**: v1 (current, auto-finalize) + previous JSON:API (drafts)
> **Last updated**: 2026-09-15
> **Related**: [ADR-013 — Accounting Integration](adrs/ADR-013-accounting-integration.md)

> **07.0 (2026-09-14):** Official docs treat `API_URL` / `OAUTH_URL` as
> **per-company credentials** from Empresa → Configurações → Dados API
> (https://api-docs.toconline.pt/autenticacao-detalhada), not literals to
> paste into `packages/accounting/src`. The table below is a historical Eleva
> snapshot. Spike 07.0 proved official `/auth` + `/token` (HTTP Basic),
> refresh grant, TEST series lookup (`at_status=uncommunicated` **by design**),
> customer and service upsert. TEST FT/PDF/NC are not issued: founder will
> not communicate TEST to AT. Live invoicing uses `ELEVA` at go-live.
> Evidence: `docs/eleva-v3/spikes/07-toconline.md`.

> **07.2.1 (2026-09-15):** v1 `POST /api/v1/commercial_sales_documents`
> **auto-finalizes on submit**. After create, finalize / cancel / update /
> delete are impossible on this API version. Drafts use the previous API
> (`POST /api/commercial_sales_documents` → lines → `status: 1`). Eleva
> `issueInvoice()` refuses the v1 POST by default (accountant: no fictitious
> finalized docs; no Comunicar série TEST). Lookups GET series / taxes /
> customers / exemption reasons / currencies / services / countries / OSS
> taxes. Do not start Phase 07.1 Tier 1.

## Base URLs

Current hosts come from the per-company Dados API credential
(`TOCONLINE_API_BASE_URL` / `TOCONLINE_OAUTH_BASE_URL`). Do not copy the
row below into env or source.

| Environment         | API base                     | OAuth base                         |
| ------------------- | ---------------------------- | ---------------------------------- |
| Historical snapshot | `https://api33.toconline.pt` | `https://app33.toconline.pt/oauth` |

> **Warning**: `api33.toconline.pt` and `app33.toconline.pt/oauth` are a
> **historical Eleva snapshot**, not hosts to copy as current. Configure the
> per-company `API_URL` / `OAUTH_URL` from Empresa → Configurações → Dados API.
> Older notes that used `api.toconline.pt` are also incorrect.

## Authentication — OAuth 2.0 Authorization Code (simplified)

TOConline uses **Authorization Code**, not client credentials (`grant_type=client_credentials`
returns 501). Spike 07.0 proved the official simplified flow
(https://api-docs.toconline.pt/autenticacao-simplificada): no PKCE, no browser
follow. Hostnames come from `{TOCONLINE_OAUTH_BASE_URL}` (alias `TOCONLINE_OAUTH_URL`).

### Flow (proven 2026-09-14)

```
1. GET {TOCONLINE_OAUTH_BASE_URL}/auth
     ?response_type=code
     &client_id={TOCONLINE_CLIENT_ID}
     &redirect_uri={TOCONLINE_OAUTH_REDIRECT}
     &scope=commercial
   Do **not** follow the 302.

2. Read `code` from Location: {redirect}?code=…

3. POST {TOCONLINE_OAUTH_BASE_URL}/token
   Authorization: Basic base64(client_id:client_secret)
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &code={code}
   &redirect_uri={TOCONLINE_OAUTH_REDIRECT}
   &scope=commercial

4. Response: { access_token, refresh_token, expires_in: 14400, token_type: Bearer }

5. Refresh: POST /token grant_type=refresh_token + HTTP Basic
   (also returns expires_in=14400).
```

The detailed/interactive docs still mention PKCE S256. 07.1 should implement the
**proven simplified** contract first. Do not require `code_challenge` unless a
future interactive login forces it.

### Key details

| Parameter            | Value                                           |
| -------------------- | ----------------------------------------------- |
| Grant type           | `authorization_code`                            |
| Scope                | `commercial`                                    |
| PKCE                 | Not required on the proven simplified flow      |
| Client auth location | HTTP Basic `client_id:secret` (official + 07.0) |
| Token delivery       | Bearer header                                   |

### Request headers (all authenticated calls)

```
Authorization: Bearer {access_token}
Content-Type: application/json          # for v1 endpoints
Content-Type: application/vnd.api+json  # for legacy JSON:API endpoints
Accept: application/json
```

## Environment Variables

Copy values from Empresa → Configurações → Dados API. Do **not** paste the
historical `api33` / `app33` hosts from the table above into application source.

Canonical names (Phase 07). Empty canonical keys fall through to the aliases.

```bash
TOCONLINE_CLIENT_ID=
TOCONLINE_CLIENT_SECRET=
TOCONLINE_API_BASE_URL=       # from Dados API; alias TOCONLINE_API_URL
TOCONLINE_OAUTH_BASE_URL=     # from Dados API; alias TOCONLINE_OAUTH_URL
TOCONLINE_OAUTH_REDIRECT=     # alias TOCONLINE_URI_REDIRECT; required, no Postman fallback
TOCONLINE_SERIES_PREFIX=ELEVA # production. TEST is TOConline-only sandbox; never communicate TEST to AT.
TOCONLINE_ALLOW_V1_AUTO_FINALIZE= # must stay unset. v1 POST auto-finalizes.
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

Flat JSON. **On submit the document is automatically finalized.** There is no
`finalize` field. After create, these operations are impossible on this API
version: finalize, cancel, update, delete. If you need drafts, use the
previous API below (`/api/commercial_sales_documents`).

`document_type` on this page: `FT` | `FS` | `FR`. Credit/debit notes (`NC` |
`ND`) use the same v1 path under **Documentos Retificativos**, plus
`parent_documents_ids` / `parent_document_reference`.

| Method | Path                                                  | Description                                     |
| ------ | ----------------------------------------------------- | ----------------------------------------------- |
| `POST` | `/api/v1/commercial_sales_documents`                  | Create + auto-finalize (header + lines)         |
| `GET`  | `/api/v1/commercial_sales_documents/`                 | List all sales documents                        |
| `GET`  | `/api/v1/commercial_sales_documents/:salesDocumentId` | Get by ID                                       |
| `GET`  | `/api/commercial_sales_documents?filter[status]=1`    | List finalized documents (previous-API listing) |

Required header fields: `document_type`, `customer_business_name`, `lines`.

Optional header fields: `date`, `document_series_id`, `document_series_prefix`,
`customer_id`, `customer_tax_registration_number`, `customer_address_detail`,
`customer_postcode` (`0000-000`), `customer_city`, `customer_country` (default
`PT`; extra values `PT-AC` Açores and `PT-MA` Madeira), `due_date`,
`settlement_expression`, `payment_mechanism`, `bank_account_id`,
`cash_account_id`, `vat_included_prices` (default `false`),
`tax_exemption_reason_id`, `operation_country`, `currency_id`,
`currency_iso_code`, `currency_conversion_rate`, `retention`,
`retention_type` (`IRS` \| `IRC`, default `IRS`),
`apply_retention_when_paid`, `notes`, `external_reference`.

Required line fields: `item_type` (`Service` \| `Product` \| `TaxDescriptor`),
`description`, `quantity`, `unit_price`.

Optional line fields: `item_id`, `item_code`, `unit_of_measure_id`,
`unit_of_measure`, `settlement_expression`, `tax_id`, `tax_code`,
`tax_percentage`, `tax_country_region`.

FR: the associated receipt is created automatically when the FR is finalized
(and v1 finalizes on create).

```json
{
  "document_type": "FT",
  "date": "2026-01-15",
  "document_series_id": "337",
  "customer_tax_registration_number": "229659179",
  "customer_business_name": "Ricardo Ribeiro",
  "customer_address_detail": "Praceta da Liberdade n5",
  "customer_postcode": "1000-101",
  "customer_city": "Lisboa",
  "customer_country": "PT",
  "due_date": "2026-02-15",
  "payment_mechanism": "MO",
  "vat_included_prices": false,
  "operation_country": "PT-MA",
  "currency_iso_code": "EUR",
  "notes": "Notas ao documento",
  "external_reference": "Referência externa",
  "lines": [
    {
      "item_type": "Service",
      "description": "Consulta",
      "quantity": 1,
      "unit_price": 50,
      "tax_code": "NOR",
      "tax_percentage": 23
    }
  ]
}
```

`payment_mechanism`: official codes are `MO`, `TR`, `CC`/`DC`, `MB`, `CH`,
`DDA`. SAF-T `TB` is rejected (spike 07.0).

**Lookups (GET only — never Comunicar série):**

1. Series: `GET /api/commercial_document_series?filter[document_type]=<type>&filter[prefix]=<prefix>` (optional `filter[number]`)
2. Customer: `GET /api/customers?filter[tax_registration_number]=<NIF>`
3. Countries: `GET /api/countries?filter[iso_alpha_2]=<code>` (`PT-AC` / `PT-MA` are extra “countries”; example attributes use `iso_alpha_2: "PT-MA"`, `tax_country_region: "PT-MA"`)
4. Bank: `GET /api/company_bank_accounts?filter[iban]=` or `filter[name]=`
5. Cash: `GET /api/cash_accounts?filter[name]=`
6. Exemption reason: `GET /api/tax_exemption_reasons?filter[code]=<legal code>`
7. Currency: `GET /api/currencies?filter[iso_code]=`
8. Item: `GET /api/services?filter[item_code]=` or `/products?filter[item_code]=` or `/tax_descriptors?filter[notation]=`
9. UoM: `GET /api/units_of_measure?filter[unit_of_measure]=`
10. Tax: `GET /api/taxes?filter[tax_code]=&filter[tax_country_region]=` and optionally `filter[tax_percentage]=`

---

### Sales Documents — previous API / drafts (`/api/commercial_sales_documents`)

Previous JSON:API. Header, lines, and finalize are **separate** calls. Use
this only when a draft is required. v1 cannot create an unfinalized document.

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

| Method | Path                                    | Description                                  |
| ------ | --------------------------------------- | -------------------------------------------- |
| `GET`  | `/api/countries`                        | List all countries                           |
| `GET`  | `/api/countries?filter[iso_alpha_2]=PT` | Filter by ISO code (`PT-AC` / `PT-MA` extra) |
| `GET`  | `/api/oss_countries`                    | List OSS countries                           |

#### Units of Measure (`/api/units_of_measure`)

| Method   | Path                                                  | Description    |
| -------- | ----------------------------------------------------- | -------------- |
| `GET`    | `/api/units_of_measure`                               | List all       |
| `GET`    | `/api/units_of_measure/:unitsOfMeasureId`             | Get by ID      |
| `GET`    | `/api/units_of_measure?filter[unit_of_measure]=horas` | Filter by name |
| `POST`   | `/api/units_of_measure`                               | Create unit    |
| `DELETE` | `/api/units_of_measure/:unitsOfMeasureId`             | Delete unit    |

#### Bank Accounts (`/api/bank_accounts` and `/api/company_bank_accounts`)

| Method   | Path                                       | Description                                |
| -------- | ------------------------------------------ | ------------------------------------------ |
| `POST`   | `/api/bank_accounts`                       | Create (entity_type: `User` or `Supplier`) |
| `GET`    | `/api/bank_accounts`                       | List all                                   |
| `GET`    | `/api/bank_accounts/:bankAccountId`        | Get by ID                                  |
| `DELETE` | `/api/bank_accounts/:bankAccountId`        | Delete                                     |
| `GET`    | `/api/company_bank_accounts?filter[iban]=` | Company IBAN lookup (v1 sales note 4)      |
| `GET`    | `/api/company_bank_accounts?filter[name]=` | Company account name lookup                |

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

| Method | Path                                   | Description        |
| ------ | -------------------------------------- | ------------------ |
| `GET`  | `/api/currencies`                      | List all           |
| `GET`  | `/api/currencies/:currencyId`          | Get by ID          |
| `GET`  | `/api/currencies?filter[iso_code]=EUR` | Filter by ISO code |

#### Tax exemption reasons (`/api/tax_exemption_reasons`)

| Method | Path                                       | Description          |
| ------ | ------------------------------------------ | -------------------- |
| `GET`  | `/api/tax_exemption_reasons?filter[code]=` | Legal exemption code |

#### Expense Categories (`/api/expense_categories`)

| Method | Path                          | Description |
| ------ | ----------------------------- | ----------- |
| `GET`  | `/api/expense_categories`     | List all    |
| `GET`  | `/api/expense_categories/:id` | Get by ID   |

#### Document Series (`/api/commercial_document_series`)

| Method | Path                                                                                            | Description               |
| ------ | ----------------------------------------------------------------------------------------------- | ------------------------- |
| `GET`  | `/api/commercial_document_series`                                                               | List all series           |
| `GET`  | `/api/commercial_document_series?filter[document_type]=FT&filter[prefix]=ELEVA`                 | Filter by type and prefix |
| `GET`  | `/api/commercial_document_series?filter[document_type]=FT&filter[prefix]=2023&filter[number]=3` | Type + prefix + number    |

---

## VAT Treatment for Eleva Platform Fees

**Unsigned / not for issuance.** The table below is a pre-accountant sketch.
Do not copy 23/13/6, `NOR`/`ISE`, or exemption codes into production issuance
until remaining fiscal parameters are confirmed (accountant 2026-09-15
conditions). EU without VIES is not automatically a consumer; extra-EU is
not an indiscriminate zero-rate.

| Expert location     | VAT rate | Tax code | Exemption | Invoice note                         |
| ------------------- | -------- | -------- | --------- | ------------------------------------ |
| PT (valid NIF)      | 23%      | `NOR`    | —         | —                                    |
| EU B2B (valid VIES) | 0%       | `ISE`    | M07       | "IVA - Autoliquidacao (Art. 6 RITI)" |
| EU (no valid VIES)  | 23%      | `NOR`    | —         | —                                    |
| Non-EU              | 0%       | `ISE`    | M99       | "IVA - Nao sujeito (Art. 6 CIVA)"    |

Look up tax IDs via `GET /api/taxes` (do not hardcode TEST company ids 7/99
as production-signed). Response shape:

```json
{
  "data": [
    {
      "type": "taxes",
      "id": "103",
      "attributes": {
        "tax_country_region": "BE",
        "tax_code": "NOR",
        "description": "Normal",
        "tax_percentage": "21",
        "tax_expiration_date": null,
        "vat_tax_id": null
      }
    }
  ]
}
```

```
GET /api/taxes?filter[tax_code]=NOR&filter[tax_country_region]=PT&filter[tax_percentage]=23
GET /api/taxes?filter[tax_code]=ISE&filter[tax_country_region]=PT
GET /api/oss_taxes
```

Tax codes on services: `NOR`, `INT`, `RED`, `ISE`. Exemption legal codes
(M07 / M99) are **pending accountant confirmation** before production.

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
     "customer_tax_registration_number": "{expert_nif}",
     "customer_business_name": "{expert_name}",
     "customer_address_detail": "...",
     "customer_postcode": "...",
     "customer_city": "...",
     "customer_country": "{PT|ES|BR|...}",
     "date": "2026-01-15",
     "due_date": "2026-02-15",
     "payment_mechanism": "MO",
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

v1 assigns the document number (e.g. `ELEVA FT 2026/1`) and ATCUD on create
because the document is already finalized. Phase 07.2.1 keeps this POST
unconditionally blocked in `assertV1SalesDocumentPostAllowed()`. Do not
enable it with a flag, a TEST prefix, or `TOCONLINE_ALLOW_V1_AUTO_FINALIZE`.
Do not create fictitious TEST fiscal documents. Re-open only after accountant
fiscal params are signed.

---

## References

- [TOConline API docs](https://api-docs.toconline.pt/llms.txt)
- [How to query TOConline docs](../../_context/TOConline-api/toconline-docs.md)
- [ADR-013 — Accounting Integration](adrs/ADR-013-accounting-integration.md)
- [Stripe + TOConline Flow](../_context/clone-repo/eleva-care-app/_docs/09-integrations/STRIPE-TOCONLINE-FLOW.md)
- [Portuguese VAT Code (CIVA)](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/)
