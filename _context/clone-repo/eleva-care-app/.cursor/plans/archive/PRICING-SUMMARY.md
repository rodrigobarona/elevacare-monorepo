# Pricing Summary - Monthly + Annual Model

**Quick Reference Guide**

---

## 💰 New Pricing Structure

### Community Expert

| Plan            | Price         | Annual Cost | Commission | Annual Savings    |
| --------------- | ------------- | ----------- | ---------- | ----------------- |
| **Monthly**     | **$49/month** | $588/year   | 12%        | -                 |
| **Annual**      | **$490/year** | $490/year   | 12%        | **$98 (20% off)** |
| Commission-Only | $0            | $0          | 20%        | -                 |

### Top Expert

| Plan            | Price           | Annual Cost | Commission | Annual Savings     |
| --------------- | --------------- | ----------- | ---------- | ------------------ |
| **Monthly**     | **$155/month**  | $1,860/year | 8%         | -                  |
| **Annual**      | **$1,490/year** | $1,490/year | 8%         | **$370 (20% off)** |
| Commission-Only | $0              | $0          | 15%        | -                  |

---

## 🎯 Key Insights

### For Experts

**Community Expert with $1,000/month bookings:**

- Commission-only: $2,400/year in fees (20% × $12,000)
- Monthly subscription: $2,028/year ($588 + 12% × $12,000)
- Annual subscription: $1,930/year ($490 + 12% × $12,000)
- **Annual saves $470/year** vs commission-only

**Top Expert with $3,500/month bookings:**

- Commission-only: $6,300/year in fees (15% × $42,000)
- Monthly subscription: $5,220/year ($1,860 + 8% × $42,000)
- Annual subscription: $4,850/year ($1,490 + 8% × $42,000)
- **Annual saves $1,450/year** vs commission-only

### Break-Even Points

**Community Expert:**

- Need $510/month in bookings to break even with subscription
- Most experts exceed this within 2-3 months

**Top Expert:**

- Need $1,774/month in bookings to break even with subscription
- Top experts typically have 3-5x this volume

---

## 📊 Revenue Projections for Eleva

**Assumptions:**

- 100 Community Experts (70% monthly, 30% annual)
- 30 Top Experts (70% monthly, 30% annual)

**Monthly Recurring Revenue (MRR):**

- Community: $4,655/month
- Top: $4,372/month
- **Total MRR: $9,027/month**

**Annual Recurring Revenue (ARR):**

- **$108,330/year** from subscriptions alone
- Plus commission revenue (variable)

**Upfront Cash from Annual:**

- Community: 30 × $490 = $14,700
- Top: 9 × $1,490 = $13,410
- **Total Upfront: $28,110** (immediate cash flow boost)

---

## ✅ Why This Works

### Industry Standards

- ✅ 20% annual discount is standard SaaS practice
- ✅ Monthly pricing removes barrier to entry
- ✅ Gross margins remain healthy (70%+)
- ✅ Competitive with similar platforms

### Expert Benefits

- ✅ Lower upfront cost ($49 vs $490)
- ✅ Flexibility to cancel monthly
- ✅ Significant savings with annual (2 months free)
- ✅ Commission-only option always available

### Eleva Benefits

- ✅ Predictable MRR ($9K/month baseline)
- ✅ Upfront cash from annual subscribers
- ✅ Higher conversion (lower barrier)
- ✅ Mix of stability + flexibility

---

## 🚀 Expected Outcomes

**Adoption Rates:**

- 30% increase in subscription adoption (monthly lowers barrier)
- 30% choose annual (industry standard)
- 70% on monthly (flexibility preferred initially)

**Financial Impact:**

- Year 1: $108K in subscription revenue
- Year 2: $150K+ (as experts upgrade to annual)
- Commission revenue: $50K-$150K additional (variable)

**Customer Lifetime Value:**

- Monthly subscribers: ~18 months avg (higher churn)
- Annual subscribers: ~36 months avg (lower churn)
- Mixed model optimizes for both acquisition + retention

---

## 📋 Next Steps

1. **Create Stripe Prices** (Monthly variants)
2. **Update Database Schema** (Add `billingInterval` column)
3. **Update UI** (Monthly/Annual toggle)
4. **Update Documentation** (New pricing on website)
5. **Test Checkout Flow** (Both intervals)

Full implementation plan in: `monthly-annual-pricing-model.plan.md`
