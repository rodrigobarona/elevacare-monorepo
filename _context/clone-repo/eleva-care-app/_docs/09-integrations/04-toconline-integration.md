# TOConline Integration Guide

> **Status:** Planned for Implementation  
> **Created:** December 16, 2025  
> **Last Updated:** December 16, 2025

## Overview

This document describes the integration between Eleva Care platform and TOConline ERP for automated invoice generation. This integration is required to comply with Portuguese tax regulations, which mandate that all sales be documented with legal invoices containing NIF and proper fiscal details.

## Why TOConline?

TOConline is Eleva Care's chosen ERP system. Key reasons:

- **AT Certified:** Approved by Autoridade Tributária (Portuguese Tax Authority)
- **SAF-T Compliant:** Automatic generation of required tax reports
- **REST API:** Full API access for automation
- **Zapier Support:** Alternative integration path if needed
- **Portuguese Focus:** Built for Portuguese business requirements

## Business Context

### The Invoicing Requirement

When a patient pays €100 for an appointment:

```
Patient Payment: €100.00
    ├── Platform Fee (15%): €15.00 → Eleva (Búzios e Tartarugas, Lda)
    └── Expert Share (85%): €85.00 → Expert's Stripe Connect Account
```

**Eleva must invoice the expert €15.00 for the platform service fee.**

This invoice must be:
1. Generated in certified software (TOConline)
2. Include proper VAT treatment based on expert location
3. Reported to Autoridade Tributária via SAF-T

---

## Prerequisites

### 1. TOConline Account Setup

Before implementing the integration:

1. **Contact TOConline Support**
   - Email: suporte@toconline.pt
   - Request API access credentials

2. **Required Information for API Access:**
   - Company NIF (Búzios e Tartarugas: [YOUR_NIF])
   - TOConline account email
   - Purpose: "Automated invoice generation for platform fees"

3. **Credentials You'll Receive:**
   - `client_id` - API client identifier
   - `client_secret` - API secret key
   - API documentation access

### 2. Document Series Setup

Create dedicated invoice series in TOConline:

| Series | Type | Purpose | Example Number |
|--------|------|---------|----------------|
| `ELEVA` | FT (Fatura) | Platform fee invoices | ELEVA FT 2025/1 |
| `ELEVA-NC` | NC (Nota de Crédito) | Refund credit notes | ELEVA NC 2025/1 |

**Steps to create series in TOConline:**

1. Log in to TOConline Dashboard
2. Go to **Configurações > Séries de Documentos**
3. Click **Nova Série**
4. Configure:
   - **Prefixo:** `ELEVA`
   - **Tipo de Documento:** `FT` (Fatura)
   - **Ano:** `2025`
   - **Numeração Automática:** Sim
5. Save and note the `document_series_id` returned

### 3. Expert Fiscal Data Requirements

Experts must provide fiscal data for proper invoicing:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `fiscalNif` | Yes | Tax ID number | `123456789` (PT), `ESB12345678` (ES) |
| `fiscalBusinessName` | Yes | Legal business name | `Dr. Maria Silva, Unip. Lda` |
| `fiscalAddress` | Yes | Full address | `Rua Example 123, 1o Dto` |
| `fiscalPostcode` | Yes | Postal code | `1000-001` |
| `fiscalCity` | Yes | City | `Lisboa` |
| `fiscalCountry` | Yes | ISO country code | `PT`, `ES`, `BR`, `US` |
| `isCompany` | Yes | B2B vs B2C | `true` / `false` |

---

## API Reference

### Base URL

```
Production: https://api.toconline.pt
Sandbox: https://sandbox.api.toconline.pt (if available)
```

### Authentication

TOConline uses OAuth 2.0 Client Credentials flow:

```typescript
// Get access token
const getAccessToken = async () => {
  const response = await fetch('https://api.toconline.pt/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: process.env.TOCONLINE_CLIENT_ID,
      client_secret: process.env.TOCONLINE_CLIENT_SECRET,
    }),
  });

  const data = await response.json();
  return data.access_token;
};
```

### API Headers

All requests must include:

```typescript
const headers = {
  'Content-Type': 'application/vnd.api+json',
  'Accept': 'application/json',
  'Authorization': `Bearer ${accessToken}`,
};
```

---

## Invoice Creation Flow

### Step 1: Get or Create Customer

Check if expert exists as customer in TOConline:

```typescript
// Search for existing customer by NIF
GET /customers?filter[tax_registration_number]=123456789
```

If not found, create new customer:

```typescript
POST /api/v1/customers
{
  "tax_registration_number": "123456789",
  "business_name": "Dr. Maria Silva, Unip. Lda",
  "address_detail": "Rua Example 123, 1o Dto",
  "postcode": "1000-001",
  "city": "Lisboa",
  "country": "PT"
}
```

### Step 2: Create Invoice Header

```typescript
POST /api/commercial_sales_documents
{
  "document_type": "FT",
  "date": "2025-12-16",
  "customer_tax_registration_number": "123456789",
  "customer_business_name": "Dr. Maria Silva, Unip. Lda",
  "customer_address_detail": "Rua Example 123, 1o Dto",
  "customer_postcode": "1000-001",
  "customer_city": "Lisboa",
  "customer_country": "PT",
  "document_series_prefix": "ELEVA",
  "due_date": "2025-12-30",
  "vat_included_prices": true,
  "currency_iso_code": "EUR",
  "notes": "Platform service fee - Appointment APT-12345"
}
```

### Step 3: Add Line Item

```typescript
POST /api/commercial_sales_document_lines
{
  "commercial_sales_document_id": "<document_id from step 2>",
  "item_type": "S",
  "description": "Serviço de plataforma Eleva Care - Consulta de Nutrição",
  "quantity": 1,
  "unit_price": 15.00,
  "tax_code": "NOR",
  "tax_percentage": 23
}
```

### Step 4: Finalize Document

```typescript
POST /api/commercial_sales_documents/<document_id>/finalize
```

After finalization:
- Document number is assigned (e.g., `ELEVA FT 2025/1`)
- Invoice becomes legally binding
- Automatically reported to AT

---

## VAT Treatment by Expert Location

### Portuguese Experts (PT)

Standard 23% VAT applies:

```typescript
{
  "tax_code": "NOR",
  "tax_percentage": 23,
  "tax_exemption_reason_id": null
}
```

### EU Experts (ES, DE, FR, IT, etc.)

**Reverse Charge Mechanism** - 0% VAT, buyer declares VAT:

```typescript
{
  "tax_code": "ISE",
  "tax_percentage": 0,
  "tax_exemption_reason_id": 7  // M07 - Reverse charge
}
```

Invoice must include text:
> "IVA - Autoliquidação (Art. 6º RITI)"

### Non-EU Experts (BR, US, etc.)

**Export of Services** - 0% VAT:

```typescript
{
  "tax_code": "ISE",
  "tax_percentage": 0,
  "tax_exemption_reason_id": 99  // M99 - Other exemptions
}
```

Invoice must include text:
> "IVA - Não sujeito (Art. 6º CIVA)"

---

## Environment Variables

Add to `.env.local`:

```bash
# TOConline API Configuration
TOCONLINE_API_URL=https://api.toconline.pt
TOCONLINE_CLIENT_ID=your_client_id_here
TOCONLINE_CLIENT_SECRET=your_client_secret_here

# Document Series IDs (get from TOConline after creating series)
TOCONLINE_SERIES_FT_ID=123
TOCONLINE_SERIES_NC_ID=124

# Optional: Sandbox mode for testing
TOCONLINE_SANDBOX_MODE=false
```

---

## Database Schema Updates

Track invoice generation in `PaymentTransfersTable`:

```sql
-- Add columns to track TOConline invoices
ALTER TABLE payment_transfers 
ADD COLUMN toconline_invoice_id TEXT,
ADD COLUMN toconline_invoice_number TEXT,
ADD COLUMN toconline_invoice_status TEXT DEFAULT 'pending',
ADD COLUMN toconline_invoice_created_at TIMESTAMP,
ADD COLUMN toconline_invoice_error TEXT;
```

Or in Drizzle schema:

```typescript
// In drizzle/schema.ts - PaymentTransfersTable
toconlineInvoiceId: text('toconline_invoice_id'),
toconlineInvoiceNumber: text('toconline_invoice_number'),
toconlineInvoiceStatus: text('toconline_invoice_status').default('pending'),
toconlineInvoiceCreatedAt: timestamp('toconline_invoice_created_at'),
toconlineInvoiceError: text('toconline_invoice_error'),
```

---

## Proposed File Structure

```
src/
├── lib/
│   └── integrations/
│       └── toconline/
│           ├── index.ts           # Main exports
│           ├── client.ts          # API client with auth
│           ├── types.ts           # TypeScript types
│           ├── invoice.ts         # Invoice creation logic
│           ├── customer.ts        # Customer management
│           └── vat.ts             # VAT calculation helpers
├── app/
│   └── api/
│       └── webhooks/
│           └── stripe/
│               └── handlers/
│                   └── toconline.ts  # Webhook handler
└── config/
    └── toconline.ts               # Configuration
```

---

## Error Handling

### Common Errors

| Error Code | Meaning | Action |
|------------|---------|--------|
| `401` | Invalid/expired token | Refresh access token |
| `422` | Validation error | Check field values |
| `404` | Customer/document not found | Create customer first |
| `409` | Duplicate document | Check idempotency |

### Retry Strategy

```typescript
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function createInvoiceWithRetry(data: InvoiceData) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await createInvoice(data);
    } catch (error) {
      if (attempt === MAX_RETRIES) throw error;
      if (error.status === 401) {
        await refreshToken();
      }
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
}
```

---

## Testing Checklist

Before going live:

- [ ] TOConline API credentials obtained
- [ ] Document series created (FT, NC)
- [ ] Test invoice creation for PT expert
- [ ] Test invoice creation for EU expert (reverse charge)
- [ ] Test invoice creation for non-EU expert (export)
- [ ] Test credit note creation (refund scenario)
- [ ] Verify SAF-T export includes invoices
- [ ] Test email delivery of invoice PDFs
- [ ] Load test for concurrent invoice creation
- [ ] Error handling for API failures

---

## References

- [TOConline API Documentation](https://api-docs.toconline.pt/llms.txt)
- [TOConline Manual - Zapier Integration](https://manual.toconline.pt/support/solutions/articles/3000132192)
- [Portuguese VAT Code (CIVA)](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/)
- [Zapier Stripe + TOConline](https://zapier.com/apps/stripe/integrations/toconline)

---

## Next Steps

1. **Obtain TOConline API credentials** - Contact TOConline support
2. **Create document series** - Set up ELEVA series in TOConline
3. **Update expert registration** - Add fiscal data fields
4. **Implement API client** - Build the integration
5. **Test thoroughly** - All expert locations and scenarios
6. **Deploy and monitor** - Watch for errors in Sentry

