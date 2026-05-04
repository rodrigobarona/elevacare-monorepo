# TOConline API Endpoints Reference

Base URL: `https://api33.toconline.pt`

## API Format

| Style      | URL pattern          | Body format                               | Content-Type               |
| ---------- | -------------------- | ----------------------------------------- | -------------------------- |
| **v1**     | `/api/v1/{resource}` | Flat JSON                                 | `application/json`         |
| **Legacy** | `/api/{resource}`    | JSON:API `{ data: { type, attributes } }` | `application/vnd.api+json` |

Prefer v1 for sales documents (single-call creation with lines).

---

## Customers

| Method   | Path                       | Description                |
| -------- | -------------------------- | -------------------------- |
| `POST`   | `/api/customers`           | Create customer            |
| `PATCH`  | `/api/customers`           | Update (include `data.id`) |
| `GET`    | `/api/customers`           | List all                   |
| `GET`    | `/api/customers/:clientId` | Get by ID                  |
| `DELETE` | `/api/customers/:clientId` | Delete                     |

### Create

```json
{
  "data": {
    "type": "customers",
    "attributes": {
      "tax_registration_number": "221976302",
      "business_name": "Empresa de Contabilidade",
      "contact_name": "Contact Name",
      "website": "https://example.pt",
      "phone_number": 309867004,
      "mobile_number": 939038342,
      "email": "cliente@email.pt",
      "observations": "",
      "internal_observations": ""
    }
  }
}
```

### Update

```json
{
  "data": {
    "type": "customers",
    "id": "62",
    "attributes": {
      "business_name": "Updated Name",
      "email": "new@email.pt"
    }
  }
}
```

---

## Addresses

Polymorphic — linked via `addressable_type` (`Customer` or `Supplier`).

| Method   | Path                 | Description                |
| -------- | -------------------- | -------------------------- |
| `POST`   | `/api/addresses`     | Create                     |
| `PATCH`  | `/api/addresses`     | Update (include `data.id`) |
| `GET`    | `/api/addresses`     | List all                   |
| `GET`    | `/api/addresses/:id` | Get by ID                  |
| `DELETE` | `/api/addresses/:id` | Delete                     |

### Create

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

## Contacts

Email contacts for customers or suppliers.

| Method  | Path                       | Description                |
| ------- | -------------------------- | -------------------------- |
| `POST`  | `/api/contacts`            | Create                     |
| `PATCH` | `/api/contacts`            | Update (include `data.id`) |
| `GET`   | `/api/contacts`            | List all                   |
| `GET`   | `/api/contacts/:contactId` | Get by ID                  |

### Create

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

## Suppliers

| Method   | Path                         | Description                |
| -------- | ---------------------------- | -------------------------- |
| `POST`   | `/api/suppliers`             | Create                     |
| `PATCH`  | `/api/suppliers`             | Update (include `data.id`) |
| `GET`    | `/api/suppliers`             | List all                   |
| `GET`    | `/api/suppliers/:supplierId` | Get by ID                  |
| `DELETE` | `/api/suppliers/:supplierId` | Delete                     |

### Create

```json
{
  "data": {
    "type": "suppliers",
    "attributes": {
      "tax_registration_number": "533186331",
      "business_name": "A Empresa",
      "is_taxable": false,
      "is_tax_exempt": false,
      "tax_country_region": "PT",
      "is_independent_worker": false,
      "country_iso_alpha_2": "PT"
    }
  }
}
```

---

## Products

| Method   | Path                 | Description                  |
| -------- | -------------------- | ---------------------------- |
| `POST`   | `/api/products`      | Create                       |
| `PATCH`  | `/api/products`      | Update / associate to family |
| `GET`    | `/api/products`      | List all                     |
| `DELETE` | `/api/products/{id}` | Delete                       |

### Create

```json
{
  "data": {
    "type": "products",
    "attributes": {
      "type": "Product",
      "item_code": 777777,
      "item_description": "Product Name",
      "sales_price": 100,
      "sales_price_includes_vat": false,
      "tax_code": "NOR",
      "item_family_id": 4
    }
  }
}
```

---

## Services

| Method   | Path            | Description                  |
| -------- | --------------- | ---------------------------- |
| `POST`   | `/api/services` | Create (supports array body) |
| `PATCH`  | `/api/services` | Update (include `data.id`)   |
| `GET`    | `/api/services` | List all                     |
| `DELETE` | `/api/services` | Delete                       |

### Create (array body)

```json
{
  "data": [
    {
      "type": "services",
      "attributes": {
        "type": "Service",
        "item_code": "SVC001",
        "item_description": "Service Name",
        "sales_price": 10,
        "sales_price_2": 20,
        "sales_price_3": 30
      }
    }
  ]
}
```

---

## Sales Documents — v1 (preferred)

| Method | Path                                               | Description                         |
| ------ | -------------------------------------------------- | ----------------------------------- |
| `POST` | `/api/v1/commercial_sales_documents`               | Create (header + lines in one call) |
| `GET`  | `/api/v1/commercial_sales_documents/`              | List all                            |
| `GET`  | `/api/v1/commercial_sales_documents/:id`           | Get by ID                           |
| `GET`  | `/api/commercial_sales_documents?filter[status]=1` | List finalized                      |

### Create (flat JSON)

```json
{
  "document_type": "FT",
  "finalize": 1,
  "date": "2026-01-15",
  "customer_tax_registration_number": "229659179",
  "customer_business_name": "Name",
  "customer_address_detail": "Address",
  "customer_postcode": "1000-001",
  "customer_city": "Lisboa",
  "customer_country": "PT",
  "due_date": "2026-02-15",
  "payment_mechanism": "TB",
  "vat_included_prices": true,
  "currency_iso_code": "EUR",
  "notes": "Invoice notes",
  "external_reference": "stripe_session_id",
  "lines": [
    {
      "item_type": "Service",
      "description": "Service description",
      "quantity": 1,
      "unit_price": 15.0,
      "tax_code": "NOR",
      "tax_percentage": 23
    }
  ]
}
```

---

## Sales Documents — Legacy (multi-step)

| Method   | Path                                        | Description                     |
| -------- | ------------------------------------------- | ------------------------------- |
| `POST`   | `/api/commercial_sales_documents`           | Create header                   |
| `POST`   | `/api/commercial_sales_document_lines`      | Add line                        |
| `PATCH`  | `/api/commercial_sales_documents`           | Update / finalize (`status: 1`) |
| `PATCH`  | `/api/commercial_sales_document_lines`      | Update line                     |
| `GET`    | `/api/commercial_sales_documents`           | List all                        |
| `GET`    | `/api/commercial_sales_documents/:id`       | Get by ID                       |
| `GET`    | `/api/commercial_sales_documents/:id/lines` | Get lines                       |
| `DELETE` | `/api/commercial_sales_documents/:id`       | Delete                          |
| `DELETE` | `/api/commercial_sales_document_lines/:id`  | Delete line                     |

---

## Sales Receipts — v1

| Method   | Path                                         | Description   |
| -------- | -------------------------------------------- | ------------- |
| `POST`   | `/api/v1/commercial_sales_receipts`          | Create header |
| `POST`   | `/api/commercial_sales_receipt_lines`        | Add line      |
| `PATCH`  | `/api/v1/commercial_sales_receipts/:id`      | Update        |
| `PATCH`  | `/api/v1/commercial_sales_receipts/:id/void` | Void          |
| `GET`    | `/api/v1/commercial_sales_receipts/:id`      | Get by ID     |
| `GET`    | `/api/v1/commercial_sales_receipts`          | List all      |
| `DELETE` | `/api/v1/commercial_sales_receipts/:id`      | Delete        |

---

## PDF Download

| Method | Path                                                       | Description           |
| ------ | ---------------------------------------------------------- | --------------------- |
| `GET`  | `/api/url_for_print/:docId?filter[type]=Document`          | Sales document PDF    |
| `GET`  | `/api/url_for_print/:docId?filter[type]=PurchasesDocument` | Purchase document PDF |

---

## AT Communication

| Method  | Path                               | Description           |
| ------- | ---------------------------------- | --------------------- |
| `PATCH` | `/api/send_document_at_webservice` | Report document to AT |

```json
{
  "data": {
    "id": "<document_id>",
    "type": "send_document_at_webservice",
    "attributes": {
      "communication_message": "...",
      "communication_code": "...",
      "communication_status": "..."
    }
  }
}
```

---

## Email Sending

| Method  | Path                  | Description                       |
| ------- | --------------------- | --------------------------------- |
| `PATCH` | `/api/email/document` | Send document or receipt by email |

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

Set `"type": "Receipt"` for receipts.

---

## Purchase Documents — v1

| Method | Path                                                      | Description    |
| ------ | --------------------------------------------------------- | -------------- |
| `POST` | `/api/v1/commercial_purchases_documents`                  | Create         |
| `POST` | `/api/v1/commercial_purchases_document_lines/`            | Add line       |
| `GET`  | `/api/v1/commercial_purchases_documents/`                 | List all       |
| `GET`  | `/api/v1/commercial_purchases_documents?filter[status]=1` | List finalized |

---

## Payments — v1

| Method   | Path                                        | Description       |
| -------- | ------------------------------------------- | ----------------- |
| `POST`   | `/api/v1/commercial_purchases_payments`     | Create header     |
| `POST`   | `/api/commercial_purchases_payment_lines`   | Add line          |
| `PATCH`  | `/api/v1/commercial_purchases_payments/`    | Finalize / update |
| `GET`    | `/api/v1/commercial_purchases_payments/:id` | Get by ID         |
| `GET`    | `/api/v1/commercial_purchases_payments`     | List all          |
| `DELETE` | `/api/v1/commercial_purchases_payments/`    | Delete            |

---

## Auxiliary APIs

### Taxes

| Method | Path                                                                                      | Description            |
| ------ | ----------------------------------------------------------------------------------------- | ---------------------- |
| `GET`  | `/api/taxes`                                                                              | List all               |
| `GET`  | `/api/taxes?filter[tax_code]=NOR&filter[tax_country_region]=PT`                           | Filter                 |
| `GET`  | `/api/taxes?filter[tax_code]=NOR&filter[tax_country_region]=PT&filter[tax_percentage]=23` | Filter with percentage |
| `GET`  | `/api/oss_taxes`                                                                          | OSS taxes              |

### Tax Descriptors

| Method   | Path                       | Description |
| -------- | -------------------------- | ----------- |
| `GET`    | `/api/tax_descriptors`     | List all    |
| `GET`    | `/api/tax_descriptors/:id` | Get by ID   |
| `POST`   | `/api/tax_descriptors`     | Create      |
| `DELETE` | `/api/tax_descriptors/:id` | Delete      |

### Countries

| Method | Path                                    | Description   |
| ------ | --------------------------------------- | ------------- |
| `GET`  | `/api/countries`                        | List all      |
| `GET`  | `/api/countries?filter[iso_alpha_2]=PT` | Filter by ISO |
| `GET`  | `/api/oss_countries`                    | OSS countries |

### Currencies

| Method | Path                  | Description |
| ------ | --------------------- | ----------- |
| `GET`  | `/api/currencies`     | List all    |
| `GET`  | `/api/currencies/:id` | Get by ID   |

### Units of Measure

| Method   | Path                                                  | Description |
| -------- | ----------------------------------------------------- | ----------- |
| `GET`    | `/api/units_of_measure`                               | List all    |
| `GET`    | `/api/units_of_measure/:id`                           | Get by ID   |
| `GET`    | `/api/units_of_measure?filter[unit_of_measure]=horas` | Filter      |
| `POST`   | `/api/units_of_measure`                               | Create      |
| `DELETE` | `/api/units_of_measure/:id`                           | Delete      |

### Item Families

| Method   | Path                     | Description |
| -------- | ------------------------ | ----------- |
| `GET`    | `/api/item_families`     | List all    |
| `GET`    | `/api/item_families/:id` | Get by ID   |
| `POST`   | `/api/item_families`     | Create      |
| `DELETE` | `/api/item_families/:id` | Delete      |

### Document Series

| Method | Path                                                                            | Description |
| ------ | ------------------------------------------------------------------------------- | ----------- |
| `GET`  | `/api/commercial_document_series`                                               | List all    |
| `GET`  | `/api/commercial_document_series?filter[document_type]=FT&filter[prefix]=ELEVA` | Filter      |

### Bank Accounts

| Method   | Path                     | Description                                  |
| -------- | ------------------------ | -------------------------------------------- |
| `POST`   | `/api/bank_accounts`     | Create (`entity_type`: `User` or `Supplier`) |
| `GET`    | `/api/bank_accounts`     | List all                                     |
| `GET`    | `/api/bank_accounts/:id` | Get by ID                                    |
| `DELETE` | `/api/bank_accounts/:id` | Delete                                       |

### Cash Accounts

| Method | Path                     | Description |
| ------ | ------------------------ | ----------- |
| `POST` | `/api/cash_accounts`     | Create      |
| `GET`  | `/api/cash_accounts`     | List all    |
| `GET`  | `/api/cash_accounts/:id` | Get by ID   |

### Expense Categories

| Method | Path                          | Description |
| ------ | ----------------------------- | ----------- |
| `GET`  | `/api/expense_categories`     | List all    |
| `GET`  | `/api/expense_categories/:id` | Get by ID   |
