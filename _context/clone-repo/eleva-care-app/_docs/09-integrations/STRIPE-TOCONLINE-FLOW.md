# Stripe + TOConline Payment & Invoicing Flow

> **Status:** Planned Architecture  
> **Created:** December 16, 2025  
> **Platform:** Eleva Care

## Overview

This document describes the complete flow from patient payment through Stripe to automatic invoice generation in TOConline for platform fees charged to experts.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PAYMENT FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Patient                                                                    │
│      │                                                                       │
│      │ 1. Books appointment (€100)                                          │
│      ▼                                                                       │
│   ┌──────────────────────┐                                                  │
│   │   Eleva Platform     │                                                  │
│   │   (Next.js App)      │                                                  │
│   └──────────┬───────────┘                                                  │
│              │                                                               │
│              │ 2. Create Checkout Session                                    │
│              ▼                                                               │
│   ┌──────────────────────┐                                                  │
│   │      Stripe          │                                                  │
│   │  (Payment Gateway)   │                                                  │
│   └──────────┬───────────┘                                                  │
│              │                                                               │
│              │ 3. Split Payment                                              │
│              ├────────────────────────────────────┐                          │
│              │                                    │                          │
│              ▼                                    ▼                          │
│   ┌──────────────────────┐         ┌──────────────────────┐                 │
│   │  Eleva Stripe Acct   │         │ Expert Connect Acct   │                │
│   │  (Platform Fee 15%)  │         │ (Expert Share 85%)    │                │
│   │       €15.00         │         │       €85.00          │                │
│   └──────────────────────┘         └──────────┬───────────┘                 │
│                                               │                              │
│                                               │ 4. Payout                    │
│                                               ▼                              │
│                                    ┌──────────────────────┐                 │
│                                    │   Expert Bank Acct   │                 │
│                                    │       €85.00         │                 │
│                                    └──────────────────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                             INVOICING FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Stripe                                                                     │
│      │                                                                       │
│      │ 5. Webhook: checkout.session.completed                               │
│      ▼                                                                       │
│   ┌──────────────────────┐                                                  │
│   │   Eleva Platform     │                                                  │
│   │   Webhook Handler    │                                                  │
│   └──────────┬───────────┘                                                  │
│              │                                                               │
│              │ 6. Extract platform fee & expert data                         │
│              ▼                                                               │
│   ┌──────────────────────┐                                                  │
│   │   TOConline Client   │                                                  │
│   │   (API Integration)  │                                                  │
│   └──────────┬───────────┘                                                  │
│              │                                                               │
│              │ 7. Create Invoice                                             │
│              ▼                                                               │
│   ┌──────────────────────┐         ┌──────────────────────┐                 │
│   │      TOConline       │────────▶│  Expert Email        │                 │
│   │   (Invoice €15+VAT)  │  8. PDF │  (Invoice received)  │                 │
│   └──────────┬───────────┘         └──────────────────────┘                 │
│              │                                                               │
│              │ 9. SAF-T Report                                               │
│              ▼                                                               │
│   ┌──────────────────────┐                                                  │
│   │ Autoridade Tributária│                                                  │
│   │   (Tax Authority)    │                                                  │
│   └──────────────────────┘                                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Sequence Diagram

```
Patient          Eleva           Stripe          TOConline         Expert
   │                │               │                │               │
   │ Book €100      │               │                │               │
   │───────────────▶│               │                │               │
   │                │               │                │               │
   │                │ Create Session│                │               │
   │                │──────────────▶│                │               │
   │                │               │                │               │
   │                │◀──────────────│                │               │
   │                │  Session URL  │                │               │
   │                │               │                │               │
   │◀───────────────│               │                │               │
   │ Redirect to    │               │                │               │
   │ Checkout       │               │                │               │
   │                │               │                │               │
   │ Pay €100       │               │                │               │
   │───────────────────────────────▶│                │               │
   │                │               │                │               │
   │                │               │ Split €15/€85  │               │
   │                │               │────────────────────────────────▶
   │                │               │                │               │
   │                │ Webhook       │                │               │
   │                │◀──────────────│                │               │
   │                │               │                │               │
   │                │ Get Expert Data               │               │
   │                │──────────────▶│                │               │
   │                │               │                │               │
   │                │ Create Invoice│                │               │
   │                │───────────────────────────────▶│               │
   │                │               │                │               │
   │                │               │                │ Invoice PDF   │
   │                │               │                │──────────────▶│
   │                │               │                │               │
   │◀───────────────│               │                │               │
   │ Confirmation   │               │                │               │
   │                │               │                │               │
```

## Data Flow Details

### Step 1: Patient Books Appointment

**Input:**
```json
{
  "eventId": "evt_123",
  "expertId": "exp_456",
  "price": 10000,
  "currency": "eur",
  "meetingData": {
    "guestEmail": "patient@example.com",
    "guestName": "João Silva",
    "startTime": "2025-12-20T10:00:00Z",
    "timezone": "Europe/Lisbon"
  }
}
```

### Step 2: Create Stripe Checkout Session

**Current Implementation:** [`src/app/api/create-payment-intent/route.ts`](../../src/app/api/create-payment-intent/route.ts)

```typescript
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card', 'multibanco'],
  line_items: [{
    price_data: {
      currency: 'eur',
      product_data: {
        name: `${event.name} with ${expertName}`,
        description: `${duration} minute session...`
      },
      unit_amount: price, // 10000 (€100.00)
    },
    quantity: 1,
  }],
  mode: 'payment',
  payment_intent_data: {
    application_fee_amount: platformFee, // 1500 (€15.00)
    transfer_data: {
      destination: expertStripeAccountId,
    },
  },
  // ... metadata
});
```

### Step 3: Stripe Splits Payment

Stripe automatically:
- Charges patient €100.00
- Keeps €15.00 in Eleva's Stripe account (application fee)
- Transfers €85.00 to expert's Connect account

### Step 4: Expert Receives Payout

**Current Implementation:** [`src/app/api/cron/process-expert-transfers/route.ts`](../../src/app/api/cron/process-expert-transfers/route.ts)

Expert receives €85.00 in their bank account after:
- Session completion
- 7-day payment aging requirement
- 24-hour post-appointment window

### Step 5: Stripe Webhook Received

**Current Handler:** [`src/app/api/webhooks/stripe/route.ts`](../../src/app/api/webhooks/stripe/route.ts)

```typescript
// checkout.session.completed event
{
  "id": "evt_123",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_123",
      "amount_total": 10000,
      "metadata": {
        "meeting": "{...}",
        "payment": "{\"amount\":\"10000\",\"fee\":\"1500\",\"expert\":\"8500\"}",
        "transfer": "{...}"
      }
    }
  }
}
```

### Step 6-7: Create TOConline Invoice (TO BE IMPLEMENTED)

**Proposed Handler:** `src/app/api/webhooks/stripe/handlers/toconline.ts`

```typescript
export async function handleCheckoutForInvoicing(
  session: Stripe.Checkout.Session
) {
  // 1. Extract payment data
  const paymentData = JSON.parse(session.metadata.payment);
  const platformFee = parseInt(paymentData.fee); // 1500 cents = €15.00
  
  // 2. Get expert fiscal data
  const expert = await getExpertWithFiscalData(session.metadata.expertId);
  
  // 3. Determine VAT treatment
  const vatConfig = calculateVAT(expert.fiscalCountry, expert.isCompany);
  
  // 4. Create invoice in TOConline
  const invoice = await toconline.createInvoice({
    documentType: 'FT',
    date: new Date().toISOString().split('T')[0],
    customerNif: expert.fiscalNif,
    customerName: expert.fiscalBusinessName,
    customerCountry: expert.fiscalCountry,
    seriesPrefix: 'ELEVA',
    items: [{
      description: `Serviço de plataforma Eleva Care - ${session.metadata.eventName}`,
      quantity: 1,
      unitPrice: platformFee / 100, // Convert cents to euros
      vatRate: vatConfig.rate,
      exemptionReason: vatConfig.exemptionId,
    }],
    notes: `Appointment ID: ${session.metadata.eventId}`,
  });
  
  // 5. Store invoice reference
  await db.update(PaymentTransfersTable).set({
    toconlineInvoiceId: invoice.id,
    toconlineInvoiceNumber: invoice.documentNo,
    toconlineInvoiceStatus: 'finalized',
  }).where(eq(PaymentTransfersTable.stripeSessionId, session.id));
  
  return invoice;
}
```

### Step 8: Expert Receives Invoice PDF

TOConline automatically sends invoice PDF to expert's email (configured in customer settings).

### Step 9: SAF-T Reporting

TOConline includes the invoice in monthly SAF-T export for Autoridade Tributária.

---

## VAT Calculation Logic

```typescript
// src/lib/integrations/toconline/vat.ts

interface VATConfig {
  rate: number;           // 23, 0
  code: string;           // 'NOR', 'ISE'
  exemptionId?: number;   // M07, M99
  exemptionText?: string;
}

export function calculateVAT(
  country: string,
  isCompany: boolean
): VATConfig {
  // Portuguese experts - standard 23% VAT
  if (country === 'PT') {
    return {
      rate: 23,
      code: 'NOR',
    };
  }
  
  // EU B2B - Reverse charge
  const euCountries = ['ES', 'FR', 'DE', 'IT', 'NL', 'BE', ...];
  if (euCountries.includes(country) && isCompany) {
    return {
      rate: 0,
      code: 'ISE',
      exemptionId: 7, // M07
      exemptionText: 'IVA - Autoliquidação (Art. 6º RITI)',
    };
  }
  
  // EU B2C - Portuguese VAT applies
  if (euCountries.includes(country) && !isCompany) {
    return {
      rate: 23,
      code: 'NOR',
    };
  }
  
  // Non-EU - Export exempt
  return {
    rate: 0,
    code: 'ISE',
    exemptionId: 99, // M99
    exemptionText: 'IVA - Não sujeito (Art. 6º CIVA)',
  };
}
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ERROR HANDLING                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Webhook Received                                                           │
│         │                                                                    │
│         ▼                                                                    │
│   ┌─────────────┐                                                           │
│   │ Try Create  │                                                           │
│   │  Invoice    │                                                           │
│   └──────┬──────┘                                                           │
│          │                                                                   │
│    ┌─────┴─────┐                                                            │
│    │           │                                                            │
│    ▼           ▼                                                            │
│ Success     Error                                                           │
│    │           │                                                            │
│    │     ┌─────┴─────┐                                                      │
│    │     │  Retry?   │                                                      │
│    │     └─────┬─────┘                                                      │
│    │     ┌─────┴─────┐                                                      │
│    │     │           │                                                      │
│    │     ▼           ▼                                                      │
│    │  Retry      Max Retries                                                │
│    │   (3x)      Exceeded                                                   │
│    │     │           │                                                      │
│    │     │           ▼                                                      │
│    │     │    ┌──────────────┐                                              │
│    │     │    │ Queue for    │                                              │
│    │     │    │ Manual Review│                                              │
│    │     │    └──────┬───────┘                                              │
│    │     │           │                                                      │
│    │     │           ▼                                                      │
│    │     │    ┌──────────────┐                                              │
│    │     │    │ Alert Admin  │                                              │
│    │     │    │ (Sentry/Slack│                                              │
│    │     │    └──────────────┘                                              │
│    │     │                                                                   │
│    ▼     ▼                                                                   │
│ ┌──────────────┐                                                            │
│ │ Update DB    │                                                            │
│ │ with status  │                                                            │
│ └──────────────┘                                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database State Tracking

### PaymentTransfersTable Extended

```sql
-- Invoice tracking columns
toconline_invoice_id        TEXT     -- TOConline internal ID
toconline_invoice_number    TEXT     -- "ELEVA FT 2025/123"
toconline_invoice_status    TEXT     -- 'pending', 'created', 'finalized', 'error'
toconline_invoice_error     TEXT     -- Error message if failed
toconline_invoice_retries   INTEGER  -- Number of retry attempts
toconline_invoice_created_at TIMESTAMP
```

### Status Flow

```
pending → created → finalized
    │         │
    │         └──▶ error (retry)
    │
    └──────────▶ error (fatal)
```

---

## Monitoring & Alerts

### Sentry Tracking

```typescript
import * as Sentry from '@sentry/nextjs';

// Track invoice creation
Sentry.startSpan({
  name: 'toconline.invoice.create',
  op: 'invoice',
}, async (span) => {
  try {
    const invoice = await createInvoice(data);
    span.setStatus({ code: 1, message: 'ok' }); // Success
    return invoice;
  } catch (error) {
    span.setStatus({ code: 2, message: error.message }); // Error
    Sentry.captureException(error, {
      tags: {
        component: 'toconline',
        operation: 'create_invoice',
      },
      extra: {
        expertId: data.expertId,
        amount: data.amount,
      },
    });
    throw error;
  }
});
```

### Alert Conditions

| Condition | Severity | Alert |
|-----------|----------|-------|
| Invoice creation failed (retryable) | Warning | Log only |
| Invoice creation failed (3+ retries) | Error | Slack + Sentry |
| No invoices created in 24h | Warning | Daily digest |
| TOConline API unreachable | Critical | Immediate alert |

---

## Testing Scenarios

### Scenario 1: Portuguese Expert

```
Input:
- Expert country: PT
- Expert NIF: 123456789
- Platform fee: €15.00

Expected:
- VAT: 23% (€3.45)
- Invoice total: €18.45
- Document: ELEVA FT 2025/X
```

### Scenario 2: Spanish Expert (EU B2B)

```
Input:
- Expert country: ES
- Expert VAT: ESB12345678
- Platform fee: €15.00

Expected:
- VAT: 0% (reverse charge)
- Invoice total: €15.00
- Exemption: M07
- Text: "IVA - Autoliquidação"
```

### Scenario 3: Brazilian Expert (Non-EU)

```
Input:
- Expert country: BR
- Expert NIF: 12345678000190
- Platform fee: €15.00

Expected:
- VAT: 0% (export)
- Invoice total: €15.00
- Exemption: M99
- Text: "IVA - Não sujeito"
```

### Scenario 4: Refund (Credit Note)

```
Input:
- Original invoice: ELEVA FT 2025/123
- Refund amount: €15.00

Expected:
- Document type: NC
- Document: ELEVA NC 2025/X
- Reference: ELEVA FT 2025/123
- Amount: -€15.00
```

---

## Implementation Checklist

### Phase 1: Prerequisites
- [ ] Obtain TOConline API credentials
- [ ] Create ELEVA document series in TOConline
- [ ] Add fiscal data fields to expert profile
- [ ] Update expert registration form

### Phase 2: Core Integration
- [ ] Create TOConline API client (`src/lib/integrations/toconline/`)
- [ ] Implement VAT calculation logic
- [ ] Create invoice webhook handler
- [ ] Add database columns for tracking

### Phase 3: Testing
- [ ] Test PT expert invoice (23% VAT)
- [ ] Test EU expert invoice (reverse charge)
- [ ] Test non-EU expert invoice (export)
- [ ] Test refund/credit note flow
- [ ] Verify SAF-T export

### Phase 4: Production
- [ ] Deploy to staging
- [ ] Run end-to-end tests
- [ ] Deploy to production
- [ ] Monitor first invoices
- [ ] Set up alerts

---

## Related Documentation

- [TOConline Integration Guide](./04-toconline-integration.md)
- [Portuguese Invoicing Requirements](./PORTUGUESE-INVOICING-REQUIREMENTS.md)
- [Stripe Recommendations](./02-stripe-recommendations.md)

