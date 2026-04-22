# Stripe Pricing Products Review

**Date:** November 13, 2025  
**Reviewer:** AI Assistant using Stripe MCP

---

## 📊 Current Expert Subscription Products

### **Community Expert Annual Subscription**

- **Product ID:** `prod_TNHmsNWSOqt7M3`
- **Annual Price:** `price_1SQXF5K5Ap4Um3SpekZpC9fQ`
  - Amount: $490/year ($40.83/month equivalent)
  - Commission: 12%
  - Metadata: `tier: "community"`, `planType: "annual"`, `commissionRate: "1200"`
- **Monthly Price:** `price_1SQbV5K5Ap4Um3SpD65qOwZB` ✅
  - Amount: $49/month
  - Commission: 12%
  - Metadata: `tier: "community"`, `planType: "monthly"`, `commissionRate: "1200"`

**Annual Savings:** $49 × 12 = $588/year → $490/year = **$98 saved (2 months free!)**

---

### **Top Expert Annual Subscription**

- **Product ID:** `prod_TNHnHt7MHvboaP`
- **Annual Price:** `price_1SQXF5K5Ap4Um3SpzT4S3agl`
  - Amount: $1,490/year ($124.17/month equivalent)
  - Commission: 8%
  - Metadata: `tier: "top"`, `planType: "annual"`, `commissionRate: "800"`
- **Monthly Price:** `price_1SQbV6K5Ap4Um3SpwFKRCoJo` ⚠️ **NEEDS REVIEW**
  - Amount: $155/month ❌ **Should be $177 according to documentation**
  - Commission: 8%
  - Metadata: `tier: "top"`, `planType: "monthly"`, `commissionRate: "800"`

**Issue:** Monthly price is $155 but should be $177/month according to:

- `_docs/02-core-systems/THREE-PARTY-CLINIC-REVENUE-MODEL.md` (line 196)
- `_docs/02-core-systems/ROLE-PROGRESSION-SYSTEM.md` design docs

**Annual Savings (if corrected to $177):**  
$177 × 12 = $2,124/year → $1,490/year = **$634 saved (~3.5 months free!)**

**Annual Savings (current $155):**  
$155 × 12 = $1,860/year → $1,490/year = **$370 saved (~2.4 months free)**

**Recommended Action:** Create new monthly price at $177/month with metadata.

---

### **Lecturer Module Annual Add-on**

- **Product ID:** `prod_TNHnIkS4cWC4MW`
- **Annual Price:** `price_1SQXF5K5Ap4Um3SpQCBwSFml`
  - Amount: $490/year ($40.83/month equivalent)
  - Commission: 3% on course sales
  - Metadata: `addon: "lecturer"`, `planType: "annual"`, `commissionRate: "300"`

---

## 💳 Pay-as-you-go Model (Commission-Only)

### **Stripe Best Practice Research**

**Question:** Should we create a Stripe subscription product for pay-as-you-go (commission-only) plans?

**Answer:** **NO** - Commission-only plans do NOT need a Stripe subscription product.

**Best Practice Implementation:**

1. **Accept payments** via Checkout Sessions or Payment Intents
2. **Calculate commission** in your application logic (20% for Community, 15% for Top)
3. **Transfer funds** to connected accounts using:
   - **Destination Charges** (recommended for single connected account per transaction)
   - **Separate Charges and Transfers** (for holding funds or multiple connected accounts)
4. **Application fees** are automatically deducted by Stripe

**Why no product needed:**

- No recurring subscription
- Commission is per-transaction
- Handled via Stripe Connect's application fees
- No billing schedule to manage

**Sources:**

- [Stripe Connect Marketplace Documentation](https://docs.stripe.com/connect/marketplace)
- [Destination Charges](https://docs.stripe.com/connect/destination-charges)
- [Separate Charges and Transfers](https://docs.stripe.com/connect/separate-charges-and-transfers)

**Implementation Example:**

```typescript
// Pay-as-you-go: No subscription, just per-booking commission
const commissionRate = expert.tier === 'community' ? 0.2 : 0.15;
const platformFee = bookingAmount * commissionRate;

// Stripe Connect handles the transfer automatically
const charge = await stripe.charges.create({
  amount: bookingAmount,
  currency: 'usd',
  customer: customerId,
  destination: {
    account: expertConnectedAccountId,
    amount: bookingAmount - platformFee, // Expert receives this
  },
  application_fee_amount: platformFee, // Platform keeps this
});
```

---

## 📝 Summary of Pricing Options

### **Community Expert**

1. **Pay-as-you-go:** $0/month + 20% commission _(No Stripe product)_
2. **Monthly Plan:** $49/month + 12% commission ✅
3. **Annual Plan:** $490/year + 12% commission (Save $98) ✅

### **Top Expert**

1. **Pay-as-you-go:** $0/month + 15% commission _(No Stripe product)_
2. **Monthly Plan:** $177/month + 8% commission ⚠️ **Needs creation/update**
3. **Annual Plan:** $1,490/year + 8% commission (Save $634) ✅

---

## ✅ Action Items

### **Immediate:**

1. ✅ Document current pricing structure
2. ✅ Clarify pay-as-you-go doesn't need Stripe product
3. ⚠️ **Verify** if Top Expert monthly should be $155 or $177
4. ❌ **Create** new Top Expert monthly price at $177 (if needed)

### **For Development:**

1. Add monthly price IDs to `.env`:

   ```bash
   STRIPE_PRICE_COMMUNITY_MONTHLY=price_1SQbV5K5Ap4Um3SpD65qOwZB
   STRIPE_PRICE_TOP_MONTHLY=price_1SQbV6K5Ap4Um3SpwFKRCoJo  # Or new price ID
   ```

2. Update pricing page to reference these IDs

3. Implement Stripe Connect for pay-as-you-go commission handling

---

## 🔗 References

**Documentation:**

- `_docs/02-core-systems/ROLE-PROGRESSION-SYSTEM.md`
- `_docs/02-core-systems/STRIPE-SUBSCRIPTION-SETUP.md`
- `_docs/02-core-systems/THREE-PARTY-CLINIC-REVENUE-MODEL.md`

**Stripe Products:**

- Community: https://dashboard.stripe.com/products/prod_TNHmsNWSOqt7M3
- Top Expert: https://dashboard.stripe.com/products/prod_TNHnHt7MHvboaP
- Lecturer: https://dashboard.stripe.com/products/prod_TNHnIkS4cWC4MW

---

**Document Version:** 1.0  
**Status:** ✅ Complete - Awaiting price verification  
**Created:** November 13, 2025
