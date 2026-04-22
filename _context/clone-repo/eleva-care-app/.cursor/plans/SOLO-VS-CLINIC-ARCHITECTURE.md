# Solo Expert vs. Clinic Architecture

**Date:** 2025-11-06  
**Status:** ✅ Documented & Implemented (Phase 1 - Solo Experts)  
**Future:** 🔮 Phase 2 - Clinics

---

## Executive Summary

Eleva supports two organization types with different subscription behaviors:

1. **Solo Experts** (Current - Phase 1): 1 expert = 1 org, role determines subscription tier
2. **Clinics** (Future - Phase 2): Multi-expert orgs, each expert keeps individual commission rate

**Key Decision:** Commission rates are ALWAYS based on individual expert's role, never the organization's subscription tier.

---

## 1️⃣ Solo Expert Model (Current - Phase 1)

### Architecture

```
Expert Signs Up
  ↓
Creates Account (role: expert_community or expert_top)
  ↓
Personal Organization Created (type: 'expert_individual')
  ↓
Subscription matches Expert Level
  ↓
1 Member in Org: The Expert (owner)
```

### Example: Community Expert

```typescript
{
  user: {
    role: 'expert_community',
    workosUserId: 'user_123'
  },
  organization: {
    type: 'expert_individual',
    members: 1, // Only the expert
    name: "Dr. João's Practice"
  },
  subscription: {
    orgId: 'org_456',
    tierLevel: 'community', // Matches user role
    planType: 'monthly', // Can be commission/monthly/annual
    monthlyFee: 4900, // $49/month
    commissionRate: 1200 // 12% (basis points)
  },
  commission: {
    // When patient books $100 appointment:
    grossAmount: 10000, // $100.00
    commissionRate: 1200, // 12%
    commissionAmount: 1200, // $12.00
    netAmount: 8800, // $88.00 to expert
    tierLevelAtTransaction: 'community',
    planTypeAtTransaction: 'monthly'
  }
}
```

### Commission Rates

| Expert Level  | Commission-Only | Monthly      | Annual         |
| ------------- | --------------- | ------------ | -------------- |
| **Community** | 20%             | 12% ($49/mo) | 12% ($490/yr)  |
| **Top**       | 15%             | 8% ($177/mo) | 8% ($1,774/yr) |

### Key Characteristics

- ✅ User role = Subscription tier (1:1 mapping)
- ✅ Simple and clear pricing model
- ✅ Expert fully controls their own subscription
- ✅ No complexity around multi-member billing

---

## 2️⃣ Clinic Model (Future - Phase 2)

### Architecture: Three-Party Revenue Model (Option B)

**Model Type:** Marketplace Model (Industry Standard)  
**Key Principle:** Platform charges the service provider (expert), not the organization (clinic)

```
Clinic Admin Creates Organization
  ↓
Clinic Org (type: 'clinic')
  ↓
Invites Multiple Experts
  ├─ Dr. Maria (expert_top)
  ├─ Dr. João (expert_community)
  └─ Dr. Ana (expert_community)
  ↓
Clinic subscribes to Workspace Plan ($99-199/month)
  ↓
Clinic sets Marketing Fee (10-25%)
  ↓
Each expert keeps INDIVIDUAL commission rate
  ↓
THREE-PARTY REVENUE SPLIT:
  Patient → Eleva (Platform Fee) → Clinic (Marketing Fee) → Expert (Net)
```

**Real-World Examples:**

- **Upwork:** Freelancer pays platform 10-20%, then agency takes their cut (20-30%)
- **Airbnb:** Host pays platform 3%, then property manager takes their cut (10-25%)
- **Cal.com:** Team members pay based on their individual plan tier

### Example: Multi-Expert Clinic with Three-Party Model

```typescript
{
  organization: {
    type: 'clinic',
    name: "Family Health Clinic",
    members: 3
  },
  subscription: {
    orgId: 'org_clinic_789',
    tierLevel: 'top', // Clinic's primary tier (for features)
    planType: 'monthly',
    monthlyFee: 9900, // $99/month workspace fee
  },
  clinicSettings: {
    clinicCommissionRate: 1500, // 15% marketing fee (basis points)
    expertMinimumShare: 6000, // 60% minimum to expert
    clinicMaximumShare: 4000, // 40% maximum total fees
  },
  members: [
    {
      // Dr. Maria - Top Expert (Annual Plan)
      user: {
        role: 'expert_top',
        workosUserId: 'user_maria'
      },
      commission: {
        // THREE-PARTY SPLIT (Patient pays $100):
        platformRate: 800,     // 8% to Eleva ($8)
        clinicRate: 1500,      // 15% to Clinic ($15)
        expertNet: 7700,       // 77% to Dr. Maria ($77)
      }
    },
    {
      // Dr. João - Community Expert (Monthly Plan)
      user: {
        role: 'expert_community',
        workosUserId: 'user_joao'
      },
      commission: {
        // THREE-PARTY SPLIT (Patient pays $100):
        platformRate: 1200,    // 12% to Eleva ($12)
        clinicRate: 1500,      // 15% to Clinic ($15)
        expertNet: 7300,       // 73% to Dr. João ($73)
      }
    },
    {
      // Dr. Ana - Community Expert (Commission-only)
      user: {
        role: 'expert_community',
        workosUserId: 'user_ana'
      },
      commission: {
        // THREE-PARTY SPLIT (Patient pays $100):
        platformRate: 2000,    // 20% to Eleva ($20)
        clinicRate: 1500,      // 15% to Clinic ($15)
        expertNet: 6500,       // 65% to Dr. Ana ($65)
      }
    }
  ]
}
```

**Key Insight:** Each expert pays:

1. **Platform fee** (Eleva) - Based on their individual tier + subscription
2. **Clinic fee** (Organization) - Fixed rate set by clinic (10-25%)
3. **Keeps remaining** (minimum 60% guaranteed)

### Commission Calculation Flow (Three-Party Model)

```typescript
// When patient books with Dr. Maria (expert_top) in clinic:
1. Patient pays $100 for appointment
   ↓
2. System looks up Dr. Maria's role: 'expert_top'
   ↓
3. System looks up clinic subscription: planType: 'annual'
   ↓
4. Calculate Eleva platform fee: 8% = $8
   (Based on Dr. Maria's role + subscription)
   ↓
5. Get clinic's marketing fee: 15% = $15
   (Set by clinic admin)
   ↓
6. Validate: Total fees (8% + 15% = 23%) < 40% ✅
   Validate: Expert net (77%) > 60% ✅
   ↓
7. Revenue split:
   • Eleva receives: $8 (platform fee)
   • Clinic receives: $15 (marketing/brand fee)
   • Dr. Maria receives: $77 (net payment)
   ↓
8. Record transaction with full breakdown

// When patient books with Dr. João (expert_community) in clinic:
1. Patient pays $100 for appointment
   ↓
2. System looks up Dr. João's role: 'expert_community'
   ↓
3. System looks up clinic subscription: planType: 'monthly'
   ↓
4. Calculate Eleva platform fee: 12% = $12
   ↓
5. Get clinic's marketing fee: 15% = $15
   ↓
6. Validate: Total fees (12% + 15% = 27%) < 40% ✅
   Validate: Expert net (73%) > 60% ✅
   ↓
7. Revenue split:
   • Eleva receives: $12
   • Clinic receives: $15
   • Dr. João receives: $73
```

**Compare to Solo Expert:**

```typescript
// Solo Dr. Maria (expert_top, annual):
Patient pays: $100
├─ Eleva: $8 (8%)
└─ Dr. Maria: $92 (92%)

// Clinic Dr. Maria (expert_top, annual):
Patient pays: $100
├─ Eleva: $8 (8%)
├─ Clinic: $15 (15% - for patient acquisition)
└─ Dr. Maria: $77 (77%)

Difference: -$15 per booking
Value for expert: Clinic brings patients, marketing, brand recognition
```

### Key Characteristics

- ✅ Each expert keeps their individual tier for commission
- ✅ Fair compensation (top experts earned their lower rates)
- ✅ Talent retention (experts maintain benefits in clinics)
- ✅ Growth incentive (community experts can upgrade to top)
- ✅ Workspace subscription is separate from commissions
- ✅ Industry standard (Cal.com, Vercel use similar models)

---

## 🔑 Critical Design Decisions

### 1. Per-Expert Commission Rates

**Decision:** Commission rates are based on individual expert's role, not organization subscription.

**Why?**

- **Fair Compensation:** Top experts earned their lower commission through achievement
- **Talent Retention:** Experts keep their benefits when joining clinics
- **Growth Incentive:** Community experts have clear path to top tier
- **Industry Standard:** Cal.com, Vercel, Dub all use per-member pricing

**Alternative Considered (Rejected):**

- Org-level commission (all experts pay same rate)
- **Problem:** Unfair to top experts who earned their tier
- **Problem:** No growth incentive for community experts
- **Problem:** Makes clinics less attractive to top talent

### 2. Organization Owns Subscription

**Decision:** Organizations own subscriptions (one per org), not users.

**Why?**

- Industry standard (Cal.com, Vercel, Dub)
- Enables team billing for clinics
- Subscription persists if billing admin leaves
- Clear ownership model for data and compliance

**See:** `.cursor/plans/subscription-billing-entity-analysis.md`

### 3. Role Determines Commission Tier

**Decision:** User role (`expert_community` or `expert_top`) determines commission rate.

**Why?**

- Simplifies logic (single source of truth)
- Works for both solo experts and clinics
- Clear eligibility criteria
- Easy to understand and communicate

**Future Consideration:**
Separate roles into two concepts:

- **Permission Roles:** What they can DO (expert, lecturer, admin)
- **Qualification Badges:** Achievement status (verified, top_rated, featured)

---

## 📊 Implementation Reference

### Database Schema

See detailed documentation in:

- `drizzle/schema-workos.ts` - OrganizationType enum (lines 54-88)
- `drizzle/schema-workos.ts` - UsersTable role field (lines 167-196)
- `drizzle/schema-workos.ts` - SubscriptionPlansTable (lines 710-774)
- `drizzle/schema-workos.ts` - TransactionCommissionsTable (lines 839-895)

### Server Actions

- `server/actions/commissions.ts` - Commission calculation logic (lines 1-54)
- `server/actions/commissions.ts` - Tier determination (lines 216-238)
- `server/actions/subscriptions.ts` - Subscription management

### Configuration

- `config/subscription-pricing.ts` - Pricing tiers and rates (lines 1-45)

---

## 🚀 Future Phases

### Phase 2: Clinic Support (Q2 2025)

**Features:**

- Multi-member organization creation
- Clinic admin dashboard
- Member invitation system
- Per-expert commission tracking
- Unified clinic billing

**Migration Path:**

- No changes to solo experts
- New clinic subscription plans
- Workspace fee + per-expert commissions
- Existing solo experts can join clinics while keeping their tier

### Phase 3: Advanced Features (Q3 2025)

**Potential Features:**

- Qualification badge system (separate from roles)
- Custom commission agreements
- Revenue sharing models
- Clinic analytics dashboard
- Multi-location support

---

## 📚 Related Documentation

- `.cursor/plans/subscription-billing-entity-analysis.md` - Why orgs own subscriptions
- `.cursor/plans/SUBSCRIPTION-PRICING-MASTER.md` - Complete pricing strategy
- `docs/02-core-systems/THREE-PARTY-CLINIC-REVENUE-MODEL.md` - ⭐ **Detailed Option B documentation**
- `docs/02-core-systems/ROLE-PROGRESSION-SYSTEM.md` - Role progression details
- `docs/02-core-systems/SUBSCRIPTION-IMPLEMENTATION-STATUS.md` - Implementation status
- `drizzle/schema-workos.ts` - Database schema with Option B JSDoc comments

---

## ✅ Verification

**Solo Expert Implementation:**

- [x] OrganizationType enum documented
- [x] User role field documented
- [x] SubscriptionPlansTable documented
- [x] TransactionCommissionsTable documented
- [x] Commission calculation logic documented
- [x] Subscription pricing config documented

**Clinic Implementation:**

- [ ] Multi-member org creation
- [ ] Clinic subscription plans
- [ ] Per-expert commission logic (already ready in code!)
- [ ] Clinic admin UI
- [ ] Member invitation flow

---

**Last Updated:** 2025-02-06  
**Next Review:** Q2 2025 (before clinic Phase 2)
