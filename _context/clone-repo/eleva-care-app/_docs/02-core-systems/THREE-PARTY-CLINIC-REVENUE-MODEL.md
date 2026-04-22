# Three-Party Clinic Revenue Model (Option B)

**Date:** 2025-11-07  
**Status:** 📋 Documented (Implementation: Q2 2025 - Phase 2)  
**Model:** Industry-Standard Marketplace Model

---

## Executive Summary

Eleva will implement a **three-party revenue model** for clinics, where:

1. **Patient** → Pays full booking amount
2. **Eleva (Platform)** → Takes platform commission (8-15% from expert)
3. **Clinic (Organization)** → Takes marketing/brand fee (10-25% from expert)
4. **Expert (Service Provider)** → Receives net amount (minimum 60%)

**Key Principle:** Platform charges the **service provider (expert)**, not the intermediary (clinic).

**Industry Examples:**

- Upwork: Freelancer pays platform 10-20%, then agency takes their cut
- Airbnb: Host pays platform 3%, then property manager takes 10-25%
- Cal.com: Team members pay based on their individual plan tier

---

## 🎯 The Three-Party Model

### Revenue Flow

```
Patient Books Appointment ($100)
         ↓
┌────────────────────────────────────────────────────────┐
│                    REVENUE SPLIT                       │
├────────────────────────────────────────────────────────┤
│                                                        │
│  1️⃣  ELEVA (Platform Fee)                            │
│      • Based on expert's tier (community/top)         │
│      • Community: 12-20%                              │
│      • Top: 8-15%                                     │
│      • Pays for: Platform, tech, payment processing   │
│                                                        │
│  2️⃣  CLINIC (Marketing Fee)                          │
│      • Set by clinic (10-25%)                         │
│      • Pays for: Patient acquisition, brand,          │
│        marketing, administrative support              │
│      • Clinic's value proposition to experts          │
│                                                        │
│  3️⃣  EXPERT (Net Payment)                            │
│      • Minimum 60% guaranteed                         │
│      • Expert receives for service delivery           │
│      • Directly deposited to expert's Stripe account  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Example Calculation: Top Expert in Clinic

```typescript
Booking Amount: $100.00
├─ Eleva Platform Fee: $8.00 (8% - expert_top + annual plan)
├─ Clinic Marketing Fee: $15.00 (15% - clinic's rate)
└─ Expert Net: $77.00 (77% - expert receives)

Breakdown:
• Expert pays 8% to Eleva (for platform/tech)
• Expert pays 15% to Clinic (for patients/marketing)
• Expert keeps 77% ($77)
• Total fees: 23% (within 40% maximum)
```

### Example Calculation: Community Expert in Clinic

```typescript
Booking Amount: $100.00
├─ Eleva Platform Fee: $12.00 (12% - expert_community + monthly plan)
├─ Clinic Marketing Fee: $20.00 (20% - clinic's rate)
└─ Expert Net: $68.00 (68% - expert receives)

Breakdown:
• Expert pays 12% to Eleva (for platform/tech)
• Expert pays 20% to Clinic (for patients/marketing)
• Expert keeps 68% ($68)
• Total fees: 32% (within 40% maximum)
```

---

## 💡 Why This Model Works

### For Experts

**Benefits:**

- ✅ Access to clinic's existing patient base
- ✅ Clinic's brand recognition and marketing
- ✅ Administrative support (scheduling, billing)
- ✅ Keep their tier benefits (top experts pay less)
- ✅ Clear, transparent pricing
- ✅ Option to work solo (no clinic fee) or join clinic

**Trade-off:**

- Pay clinic fee (10-25%) for patient acquisition
- Still cheaper than traditional physical clinics (30-50%)

**Example Decision:**

```
Solo Top Expert:
• Gross: $100
• Eleva: -$8 (8%)
• Net: $92

Same Expert in Clinic:
• Gross: $100
• Eleva: -$8 (8%)
• Clinic: -$15 (15%)
• Net: $77

Difference: -$15 per appointment
Value: Clinic brings patients, marketing, brand
```

### For Clinics

**Benefits:**

- ✅ Revenue from patient acquisition (10-25% per booking)
- ✅ Attract top talent (experts keep their tier)
- ✅ Flexible pricing (set own marketing fee)
- ✅ Clear value proposition to experts
- ✅ Scalable business model

**Responsibilities:**

- Marketing and patient acquisition
- Brand building and reputation
- Administrative support
- Expert onboarding and retention

**Example Revenue:**

```
Clinic with 5 Experts:
• Average 20 appointments/month per expert
• Average booking: $100
• Clinic fee: 15%

Monthly Revenue:
5 experts × 20 appointments × $100 × 15% = $1,500/month

Annual Revenue: $18,000/year
(Plus optional workspace subscription fee: $99-199/month)
```

### For Eleva

**Benefits:**

- ✅ Platform fee from every booking (8-15%)
- ✅ Optional workspace subscription fee ($99-199/month)
- ✅ Fair commission preserved regardless of org type
- ✅ Industry-standard model (easy to explain)
- ✅ Scalable for B2B expansion

**Revenue:**

```
Example Clinic Revenue:
• 5 experts, 20 bookings/month each, $100 average

From Platform Fees:
100 bookings × $100 × 10% avg = $1,000/month

From Workspace Subscription:
$99/month (optional)

Total: $1,099-1,099/month per clinic
```

---

## 📊 Pricing Structure

### Eleva Platform Fees (From Expert)

| Expert Tier   | Plan Type       | Commission Rate | Monthly Fee |
| ------------- | --------------- | --------------- | ----------- |
| **Community** | Commission-only | 20%             | $0          |
| **Community** | Monthly         | 12%             | $49         |
| **Community** | Annual          | 12%             | $490        |
| **Top**       | Commission-only | 15%             | $0          |
| **Top**       | Monthly         | 8%              | $177        |
| **Top**       | Annual          | 8%              | $1,774      |

### Clinic Marketing Fees (From Expert)

| Clinic Tier  | Marketing Fee | Expert Minimum | Max Total Fees |
| ------------ | ------------- | -------------- | -------------- |
| **Basic**    | 10-15%        | 70%            | 30%            |
| **Standard** | 15-20%        | 65%            | 35%            |
| **Premium**  | 20-25%        | 60%            | 40%            |

**Hard Rules:**

- Expert MUST receive at least **60%** of booking amount
- Combined fees (Eleva + Clinic) cannot exceed **40%**
- Clinic sets their own fee within allowed range

### Workspace Subscriptions (Optional)

| Plan           | Monthly Fee | Features                             |
| -------------- | ----------- | ------------------------------------ |
| **Basic**      | $99/month   | Up to 3 experts, basic analytics     |
| **Pro**        | $199/month  | Up to 10 experts, advanced analytics |
| **Enterprise** | Custom      | Unlimited experts, white-label, API  |

---

## 🏗️ Technical Architecture

### Database Schema

```typescript
// Clinic Settings Table (New)
export const ClinicSettingsTable = pgTable('clinic_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .unique()
    .references(() => OrganizationsTable.id),

  // Clinic commission structure
  clinicCommissionRate: integer('clinic_commission_rate').notNull(), // Basis points (1500 = 15%)
  clinicCommissionType: text('clinic_commission_type').$type<'fixed' | 'tiered'>(),

  // Protection rules
  expertMinimumShare: integer('expert_minimum_share').default(6000), // 60% minimum
  clinicMaximumShare: integer('clinic_maximum_share').default(4000), // 40% maximum

  // Marketing features
  clinicBrandingEnabled: boolean('clinic_branding_enabled').default(true),
  clinicMarketingToolsEnabled: boolean('clinic_marketing_tools_enabled').default(false),

  createdAt,
  updatedAt,
});

// Updated Transaction Commissions Table
export const TransactionCommissionsTable = pgTable('transaction_commissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workosUserId: text('workos_user_id').notNull(),
  orgId: uuid('org_id').notNull(),
  meetingId: uuid('meeting_id').notNull(),

  // Gross transaction
  grossAmount: integer('gross_amount').notNull(), // $100.00 = 10000
  currency: text('currency').notNull().default('eur'),

  // Platform commission (Eleva)
  platformCommissionRate: integer('platform_commission_rate').notNull(), // 800 = 8%
  platformCommissionAmount: integer('platform_commission_amount').notNull(), // $8.00 = 800

  // Clinic commission (if applicable)
  clinicCommissionRate: integer('clinic_commission_rate'), // 1500 = 15%
  clinicCommissionAmount: integer('clinic_commission_amount'), // $15.00 = 1500

  // Expert net payment
  expertNetAmount: integer('expert_net_amount').notNull(), // $77.00 = 7700

  // Stripe references
  stripePaymentIntentId: text('stripe_payment_intent_id').notNull(),
  stripeTransferId: text('stripe_transfer_id'), // Transfer to expert
  clinicTransferId: text('clinic_transfer_id'), // Transfer to clinic (future)

  // Metadata
  planTypeAtTransaction: text('plan_type_at_transaction').$type<
    'commission' | 'monthly' | 'annual'
  >(),
  tierLevelAtTransaction: text('tier_level_at_transaction').$type<'community' | 'top'>(),
  organizationType: text('organization_type').$type<'expert_individual' | 'clinic'>(),

  createdAt,
  updatedAt,
});
```

### Commission Calculation Logic

```typescript
/**
 * Calculate commission for a booking (supports both solo and clinic)
 *
 * @param booking - The booking transaction
 * @returns Commission breakdown with platform and clinic fees
 */
export async function calculateCommission(booking: {
  expertId: string;
  orgId: string;
  amount: number;
  currency: string;
}): Promise<CommissionBreakdown> {
  // 1. Get expert's role (determines platform commission)
  const expert = await getExpert(booking.expertId);

  // 2. Get organization details
  const org = await getOrganization(booking.orgId);

  // 3. Get expert's subscription plan
  const subscription = await getOrgSubscription(booking.orgId);

  // 4. Calculate Eleva platform commission
  const platformRate = getCommissionRate(
    expert.role, // 'expert_community' or 'expert_top'
    subscription.planType, // 'commission', 'monthly', or 'annual'
  );
  const platformFee = booking.amount * platformRate;

  // 5. Check if this is a clinic (three-party model)
  if (org.type === 'clinic') {
    // Get clinic's marketing fee
    const clinicSettings = await getClinicSettings(booking.orgId);
    const clinicRate = clinicSettings.clinicCommissionRate / 10000; // Convert basis points
    const clinicFee = booking.amount * clinicRate;

    // Calculate expert's net payment
    const expertNet = booking.amount - platformFee - clinicFee;

    // 🔒 VALIDATION: Ensure expert gets minimum 60%
    const minExpertShare = booking.amount * 0.6;
    if (expertNet < minExpertShare) {
      throw new CommissionError(
        `Expert would receive ${formatCurrency(expertNet)} but minimum is ${formatCurrency(minExpertShare)}. ` +
          `Clinic fee too high (${clinicRate * 100}%).`,
      );
    }

    // 🔒 VALIDATION: Total fees cannot exceed 40%
    const totalFeesRate = platformRate + clinicRate;
    if (totalFeesRate > 0.4) {
      throw new CommissionError(
        `Total fees (${totalFeesRate * 100}%) exceed maximum 40%. ` +
          `Platform: ${platformRate * 100}%, Clinic: ${clinicRate * 100}%.`,
      );
    }

    return {
      grossAmount: booking.amount,
      platformCommissionRate: platformRate,
      platformCommissionAmount: platformFee,
      clinicCommissionRate: clinicRate,
      clinicCommissionAmount: clinicFee,
      expertNetAmount: expertNet,
      currency: booking.currency,
      organizationType: 'clinic',
    };
  }

  // Solo expert (two-party model)
  const expertNet = booking.amount - platformFee;

  return {
    grossAmount: booking.amount,
    platformCommissionRate: platformRate,
    platformCommissionAmount: platformFee,
    clinicCommissionRate: 0,
    clinicCommissionAmount: 0,
    expertNetAmount: expertNet,
    currency: booking.currency,
    organizationType: 'expert_individual',
  };
}

/**
 * Get commission rate based on expert tier and subscription plan
 */
function getCommissionRate(
  role: 'expert_community' | 'expert_top',
  planType: 'commission' | 'monthly' | 'annual',
): number {
  const rates = {
    expert_community: {
      commission: 0.2, // 20%
      monthly: 0.12, // 12%
      annual: 0.12, // 12%
    },
    expert_top: {
      commission: 0.15, // 15%
      monthly: 0.08, // 8%
      annual: 0.08, // 8%
    },
  };

  return rates[role][planType];
}
```

---

## 🔄 User Flows

### Expert Joining Clinic

```
1. Expert has solo practice (expert_top, paying 8% to Eleva)
   ↓
2. Clinic invites expert to join
   ↓
3. Expert reviews clinic terms:
   • Clinic fee: 15%
   • Total fees: 23% (8% Eleva + 15% Clinic)
   • Net payment: 77% per booking
   • Benefits: Patient acquisition, marketing, brand
   ↓
4. Expert accepts invitation
   ↓
5. Expert's commission updates automatically:
   • Platform: Still 8% (keeps their tier!)
   • Clinic: Now 15% (new fee)
   • Net: 77% instead of 92%
   ↓
6. Expert can still see breakdown in dashboard
```

### Clinic Setting Marketing Fee

```
1. Clinic admin goes to Settings → Pricing
   ↓
2. Sets clinic marketing fee: 15%
   ↓
3. System validates:
   • Within allowed range (10-25%)? ✅
   • Combined with expert fees < 40%? ✅
   • Expert gets minimum 60%? ✅
   ↓
4. Fee saved and applied to all future bookings
   ↓
5. Existing experts notified of fee (if changed)
```

### Patient Booking with Clinic Expert

```
1. Patient finds Dr. Maria on Eleva
   • Profile shows: "Family Health Clinic"
   • Price: $100 per session
   ↓
2. Patient books appointment
   ↓
3. Payment processed ($100 charged)
   ↓
4. System calculates commission:
   • Platform: $8 (8% - Dr. Maria is expert_top)
   • Clinic: $15 (15% - clinic's marketing fee)
   • Dr. Maria: $77 (77% net)
   ↓
5. Funds distributed:
   • Eleva: Receives $8 (platform fee)
   • Dr. Maria: Receives $77 (via Stripe Connect)
   • Clinic: Receives $15 (future: via Stripe Connect)
   ↓
6. Transaction recorded in database with full breakdown
```

---

## 🛡️ Protection Rules

### Expert Protection

```typescript
// Hard limits enforced at database and application level

const EXPERT_PROTECTIONS = {
  // Minimum percentage expert must receive
  EXPERT_MINIMUM_NET: 0.6, // 60%

  // Maximum combined fees (platform + clinic)
  MAXIMUM_TOTAL_FEES: 0.4, // 40%

  // Clinic fee limits
  CLINIC_FEE_MINIMUM: 0.1, // 10%
  CLINIC_FEE_MAXIMUM: 0.25, // 25%

  // Validation on every transaction
  validateCommission(breakdown: CommissionBreakdown): void {
    const expertNetPercent = breakdown.expertNetAmount / breakdown.grossAmount;

    if (expertNetPercent < this.EXPERT_MINIMUM_NET) {
      throw new Error(
        `Expert would receive ${(expertNetPercent * 100).toFixed(1)}% ` +
          `but minimum is ${this.EXPERT_MINIMUM_NET * 100}%`,
      );
    }

    const totalFeesPercent =
      breakdown.platformCommissionRate + (breakdown.clinicCommissionRate || 0);

    if (totalFeesPercent > this.MAXIMUM_TOTAL_FEES) {
      throw new Error(
        `Total fees ${(totalFeesPercent * 100).toFixed(1)}% ` +
          `exceed maximum ${this.MAXIMUM_TOTAL_FEES * 100}%`,
      );
    }
  },
};
```

### Clinic Validation

```typescript
// When clinic sets their marketing fee

async function setClinicCommission(
  orgId: string,
  clinicRate: number, // e.g., 0.15 for 15%
): Promise<void> {
  // Validate clinic rate is within allowed range
  if (clinicRate < 0.1 || clinicRate > 0.25) {
    throw new Error('Clinic commission must be between 10% and 25%');
  }

  // Get all experts in clinic and validate against their platform rates
  const experts = await getClinicExperts(orgId);

  for (const expert of experts) {
    const platformRate = getCommissionRate(expert.role, expert.planType);
    const totalFees = platformRate + clinicRate;

    if (totalFees > 0.4) {
      throw new Error(
        `Clinic rate ${clinicRate * 100}% too high for expert ${expert.name}. ` +
          `Their platform rate is ${platformRate * 100}%, ` +
          `total would be ${totalFees * 100}% (max 40%).`,
      );
    }
  }

  // All validations passed, save clinic settings
  await saveClinicSettings(orgId, {
    clinicCommissionRate: Math.round(clinicRate * 10000), // Convert to basis points
  });
}
```

---

## 📈 Pricing Examples

### Scenario 1: Community Expert in Clinic (Monthly Plan)

```
Expert: Dr. João (expert_community, monthly plan)
Clinic: Family Health Clinic (15% marketing fee)
Booking: $100 consultation

Commission Breakdown:
├─ Gross Amount: $100.00
├─ Platform Fee: $12.00 (12% - community + monthly)
├─ Clinic Fee: $15.00 (15% - clinic's rate)
└─ Expert Net: $73.00 (73%)

Expert Dashboard View:
"You received $73.00 from this booking"
  Platform fee: -$12.00 (tech & payment processing)
  Clinic fee: -$15.00 (patient acquisition & marketing)
```

### Scenario 2: Top Expert in Clinic (Annual Plan)

```
Expert: Dr. Maria (expert_top, annual plan)
Clinic: Premium Mental Health Center (20% marketing fee)
Booking: $150 therapy session

Commission Breakdown:
├─ Gross Amount: $150.00
├─ Platform Fee: $12.00 (8% - top + annual)
├─ Clinic Fee: $30.00 (20% - clinic's rate)
└─ Expert Net: $108.00 (72%)

Expert Dashboard View:
"You received $108.00 from this booking"
  Platform fee: -$12.00 (tech & payment processing)
  Clinic fee: -$30.00 (patient acquisition & marketing)

Monthly Savings vs Commission-Only:
  Current: 8% platform fee ($12)
  Without subscription: 15% platform fee ($22.50)
  Savings: $10.50 per booking
```

### Scenario 3: Mixed Clinic Example

```
Clinic: Wellness Center (18% marketing fee)
Monthly Revenue: 100 appointments × $100 avg = $10,000

Expert Breakdown:
├─ Dr. Ana (community, annual): 50 appointments
│   ├─ Gross: $5,000
│   ├─ Platform: -$600 (12%)
│   ├─ Clinic: -$900 (18%)
│   └─ Net: $3,500 (70%)
│
├─ Dr. Carlos (top, monthly): 30 appointments
│   ├─ Gross: $3,000
│   ├─ Platform: -$240 (8%)
│   ├─ Clinic: -$540 (18%)
│   └─ Net: $2,220 (74%)
│
└─ Dr. Sofia (top, annual): 20 appointments
    ├─ Gross: $2,000
    ├─ Platform: -$160 (8%)
    ├─ Clinic: -$360 (18%)
    └─ Net: $1,480 (74%)

Clinic Revenue:
  Marketing fees: $1,800/month ($21,600/year)
  Workspace subscription: $199/month ($2,388/year)
  Total: $23,988/year

Eleva Revenue:
  Platform fees: $1,000/month ($12,000/year)
  Workspace subscription share: $199/month
  Total: $14,388/year
```

---

## 🚀 Implementation Plan

### Phase 1: Database & Backend (Week 1-2)

- [ ] Create `ClinicSettingsTable` schema
- [ ] Update `TransactionCommissionsTable` with clinic fields
- [ ] Implement commission calculation logic
- [ ] Add validation rules
- [ ] Write comprehensive tests
- [ ] Create database migrations

### Phase 2: Server Actions (Week 3)

- [ ] `createClinicSettings()` - Initialize clinic
- [ ] `updateClinicCommission()` - Set/update clinic fee
- [ ] `calculateThreePartyCommission()` - New calculation
- [ ] `recordClinicTransaction()` - Save commission breakdown
- [ ] `getClinicRevenue()` - Analytics
- [ ] `getExpertEarnings()` - Expert view

### Phase 3: Admin UI (Week 4-5)

- [ ] Clinic settings page
- [ ] Commission rate configurator
- [ ] Expert list with commission preview
- [ ] Revenue analytics dashboard
- [ ] Expert invitation system
- [ ] Fee change notification system

### Phase 4: Expert UI (Week 6)

- [ ] Updated earnings dashboard
- [ ] Detailed commission breakdown
- [ ] Clinic comparison tool ("Solo vs Clinic")
- [ ] Historical earnings with filters
- [ ] Export reports

### Phase 5: Testing & Launch (Week 7-8)

- [ ] End-to-end testing
- [ ] Beta launch with 3-5 clinics
- [ ] Monitor revenue splits
- [ ] Gather feedback
- [ ] Public launch
- [ ] Documentation & training

---

## 📚 Related Documentation

- `.cursor/plans/SOLO-VS-CLINIC-ARCHITECTURE.md` - Architecture overview
- `.cursor/plans/SUBSCRIPTION-PRICING-MASTER.md` - Complete pricing strategy
- `docs/02-core-systems/SUBSCRIPTION-IMPLEMENTATION-STATUS.md` - Current status
- `config/subscription-pricing.ts` - Pricing configuration
- `server/actions/commissions.ts` - Commission logic

---

## ✅ Success Criteria

### For Experts

- [ ] Clear understanding of fee breakdown
- [ ] Minimum 60% net payment guaranteed
- [ ] Keep tier benefits when joining clinics
- [ ] Easy comparison: solo vs clinic

### For Clinics

- [ ] Simple fee configuration (10-25%)
- [ ] Clear revenue reporting
- [ ] Attract top talent
- [ ] Fair compensation model

### For Eleva

- [ ] Platform fee on every transaction
- [ ] Industry-standard model
- [ ] Scalable for B2B growth
- [ ] Transparent and trustworthy

---

**Last Updated:** 2025-11-07  
**Next Review:** Before Phase 2 implementation (Q2 2025)  
**Owner:** Product & Engineering Teams
