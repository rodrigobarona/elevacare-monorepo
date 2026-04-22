# Adding Lookup Keys via Stripe Dashboard

**Status:** Alternative Method (No CLI Required)  
**Time:** 5 minutes  
**Method:** Manual via Stripe Dashboard

---

## 🎯 Why This Method?

The automatic script requires Stripe CLI authentication. Instead, you can add lookup keys directly via the Stripe Dashboard - it's just as fast and more reliable.

---

## 📝 Step-by-Step Instructions

### **1. Open Stripe Dashboard**

Navigate to: https://dashboard.stripe.com/prices

---

### **2. Update Each Price (5 prices total)**

For each price below, follow these steps:

#### **Price 1: Community Expert Monthly**

- **Find:** `price_1SQbV5K5Ap4Um3SpD65qOwZB` ($49.00/month)
- **Click:** The price in the dashboard
- **Click:** "⋮" (three dots) → "Update price"
- **Add Lookup Key:** `community-expert-monthly`
- **Save**

---

#### **Price 2: Community Expert Annual**

- **Find:** `price_1SQXF5K5Ap4Um3SpekZpC9fQ` ($490.00/year)
- **Click:** The price in the dashboard
- **Click:** "⋮" (three dots) → "Update price"
- **Add Lookup Key:** `community-expert-annual`
- **Save**

---

#### **Price 3: Top Expert Monthly**

- **Find:** `price_1SQbV6K5Ap4Um3SpwFKRCoJo` ($155.00/month) ⚠️
- **Click:** The price in the dashboard
- **Click:** "⋮" (three dots) → "Update price"
- **Add Lookup Key:** `top-expert-monthly`
- **Save**

**Note:** This price is $155 but should be $177. You can either:

- Update this lookup key and create a new $177 price later
- Create a new $177 price now with the lookup key

---

#### **Price 4: Top Expert Annual**

- **Find:** `price_1SQXF5K5Ap4Um3SpzT4S3agl` ($1,490.00/year)
- **Click:** The price in the dashboard
- **Click:** "⋮" (three dots) → "Update price"
- **Add Lookup Key:** `top-expert-annual`
- **Save**

---

#### **Price 5: Lecturer Module Annual**

- **Find:** `price_1SQXF5K5Ap4Um3SpQCBwSFml` ($490.00/year)
- **Click:** The price in the dashboard
- **Click:** "⋮" (three dots) → "Update price"
- **Add Lookup Key:** `lecturer-module-annual`
- **Save**

---

## ✅ Verification

After adding all lookup keys, verify by searching:

1. In the Stripe Dashboard search bar, type: `community-expert-monthly`
2. You should see the price appear
3. Repeat for all 5 lookup keys

---

## 🚀 Alternative: Use Stripe API

If you prefer to use the Stripe API directly, here's a curl command template:

```bash
curl https://api.stripe.com/v1/prices/price_1SQbV5K5Ap4Um3SpD65qOwZB \
  -u "sk_live_YOUR_KEY:" \
  -d "lookup_key=community-expert-monthly"
```

Replace `sk_live_YOUR_KEY` with your actual Stripe secret key.

---

## 📊 Quick Reference Table

| Price ID                         | Amount    | Lookup Key                 | Status          |
| -------------------------------- | --------- | -------------------------- | --------------- |
| `price_1SQbV5K5Ap4Um3SpD65qOwZB` | $49/mo    | `community-expert-monthly` | ⏳ Pending      |
| `price_1SQXF5K5Ap4Um3SpekZpC9fQ` | $490/yr   | `community-expert-annual`  | ⏳ Pending      |
| `price_1SQbV6K5Ap4Um3SpwFKRCoJo` | $155/mo   | `top-expert-monthly`       | ⚠️ Wrong amount |
| `price_1SQXF5K5Ap4Um3SpzT4S3agl` | $1,490/yr | `top-expert-annual`        | ⚠️ Wrong amount |
| `price_1SQXF5K5Ap4Um3SpQCBwSFml` | $490/yr   | `lecturer-module-annual`   | ⏳ Pending      |

**Note:** Prices marked with ⚠️ need amounts corrected:

- Top Expert Monthly: $155 → $177
- Top Expert Annual: $1,490 → $1,774

---

## 🎯 Next Steps

**After adding lookup keys:**

1. **Verify in Dashboard** - Search for each lookup key
2. **Test in Application** - Try the subscription upgrade flow
3. **Create Corrected Prices** - Use `/admin/subscriptions` to create $177 and $1,774 prices
4. **Deploy** - Push the code changes

---

## 💡 Why Lookup Keys Can Be Added Later

**Good news:** Your application will work fine even without lookup keys for now!

**How?**

- Your database already stores actual price IDs ✅
- Your existing code uses price IDs directly ✅
- Lookup keys are optional for existing flows ✅

**When you need them:**

- Creating new subscriptions via the new code
- Using the `/admin/subscriptions` dashboard
- A/B testing different prices

**Priority:** Low urgency - can be added anytime before production deployment of new subscription code.

---

**Time to Complete:** 5 minutes  
**Complexity:** Low  
**Can Skip for Now:** Yes (optional for existing flows)
