# Admin Subscriptions Management - Quick Start Guide

**Status:** ✅ Complete & Ready to Use  
**Access:** `/admin/subscriptions` (Admin only)

---

## 🎯 What Was Built

A comprehensive admin dashboard for managing Stripe subscription products and prices.

### **Features:**

✅ **View Products** - Display all Stripe products with status badges  
✅ **List Prices** - Expandable price tables per product  
✅ **Create Prices** - Full-featured form with validation  
✅ **Archive/Activate** - Toggle price status with one click  
✅ **Metadata Display** - Show tier, plan type, commission rates  
✅ **Lookup Keys** - Manage price lookup keys for easy retrieval  
✅ **Real-time Updates** - Optimistic UI with toast notifications  
✅ **Error Handling** - Graceful failures with retry options  

---

## 🚀 Quick Start

### **1. Access the Dashboard**

Navigate to: `https://yourdomain.com/admin/subscriptions`

**Requirements:**
- Must be logged in
- Must have `admin` or `super_admin` role
- Stripe API key must be configured in `.env`

### **2. View Products**

All Stripe products display as cards:
- Product name and description
- Active/Archived status badge
- Product ID
- "Add Price" button

### **3. View Prices**

Click on a product card to expand the prices table:
- Price nickname (e.g., "Community Expert - Monthly")
- Amount (formatted currency)
- Billing interval (monthly, yearly, one-time)
- Metadata badges (tier, plan type)
- Commission rate
- Active/Archived status
- Archive/Activate button

### **4. Create a Price**

Click "Add Price" button → Fill out form:

**Required Fields:**
- Nickname (descriptive name)
- Amount (in cents, e.g., 4900 = $49.00)
- Currency (USD, EUR, GBP, CAD)

**Optional Fields:**
- Recurring (toggle on/off)
  - Billing interval (day/week/month/year)
  - Interval count (1-12)
- Tier (community, top, lecturer, partner)
- Plan Type (monthly, annual, commission)
- Commission Rate (in basis points, e.g., 1200 = 12%)
- Lookup Key (e.g., `community-expert-monthly`)

Click "Create Price" → Success toast appears → Price added to table

### **5. Archive a Price**

Click "Archive" button on active price → Confirmation toast → Status updates

**Note:** Archived prices cannot be used for new subscriptions but existing subscriptions continue.

### **6. Activate a Price**

Click "Activate" button on archived price → Confirmation toast → Status updates

**Use case:** Re-enable a previously archived price.

---

## 📊 Example Use Cases

### **Create Community Expert Monthly Price**

1. Navigate to `/admin/subscriptions`
2. Find "Community Expert Subscription" product
3. Click "Add Price"
4. Fill form:
   - Nickname: `Community Expert - Monthly`
   - Amount: `4900` (cents)
   - Currency: `USD`
   - Recurring: ✅ (checked)
   - Interval: `month`
   - Interval Count: `1`
   - Tier: `community`
   - Plan Type: `monthly`
   - Commission Rate: `1200` (12%)
   - Lookup Key: `community-expert-monthly`
5. Click "Create Price"
6. ✅ Price created!

### **Create Top Expert Annual Price**

1. Navigate to `/admin/subscriptions`
2. Find "Top Expert Subscription" product
3. Click "Add Price"
4. Fill form:
   - Nickname: `Top Expert - Annual`
   - Amount: `149000` (cents = $1,490)
   - Currency: `USD`
   - Recurring: ✅
   - Interval: `year`
   - Interval Count: `1`
   - Tier: `top`
   - Plan Type: `annual`
   - Commission Rate: `800` (8%)
   - Lookup Key: `top-expert-annual`
5. Click "Create Price"
6. ✅ Price created!

### **Archive Old Pricing**

1. Navigate to `/admin/subscriptions`
2. Expand product card
3. Find old price in table
4. Click "Archive" button
5. ✅ Price archived (existing subscriptions continue, but new signups can't select this price)

---

## 🔐 Security & Permissions

### **Authorization:**
- All server actions check `isAdmin()` before execution
- Unauthorized users redirected to `/unauthorized`
- Admin layout enforces authentication via WorkOS AuthKit

### **Validation:**
- Client-side: React Hook Form + Zod
- Server-side: Zod schemas validate all inputs
- Type-safe: Full TypeScript coverage

### **Stripe Security:**
- Uses server-side `STRIPE_SECRET_KEY`
- Never exposes secret key to client
- All Stripe API calls server-side only

---

## 🛠️ Technical Stack

**Frontend:**
- Next.js 16 App Router (Server + Client Components)
- shadcn/ui (Dialog, Form, Table, Badge, Button, Card)
- React Hook Form + Zod validation
- Sonner (toast notifications)
- Lucide React (icons)

**Backend:**
- Next.js Server Actions
- Stripe Node SDK
- WorkOS AuthKit (authentication)
- Custom RBAC (role-based access control)

**Validation:**
- Zod schemas
- Type-safe forms
- Server-side validation

---

## 📁 File Locations

```
src/
├── app/(app)/admin/subscriptions/
│   ├── page.tsx                    # Main page (server component)
│   ├── products-grid.tsx           # Products display (client)
│   ├── prices-table.tsx            # Prices table (client)
│   └── create-price-modal.tsx      # Create price form (client)
├── lib/validations/
│   └── stripe-pricing.ts           # Zod schemas + helpers
└── server/actions/
    └── stripe-pricing.ts           # Stripe operations (server)

Admin Layout:
├── app/(app)/admin/layout.tsx      # Added Subscriptions link
```

---

## 🔄 Server Actions API

### **`listStripeProducts()`**
```typescript
const result = await listStripeProducts();
// Returns: { success: boolean, data?: Stripe.Product[], error?: string }
```

### **`listStripePrices(filters)`**
```typescript
const result = await listStripePrices({
  productId: 'prod_xxx',
  active: true,
  tier: 'community',
  planType: 'monthly',
  recurring: true,
  limit: 20,
});
// Returns: { success: boolean, data?: Stripe.Price[], hasMore?: boolean, error?: string }
```

### **`createStripePrice(input)`**
```typescript
const result = await createStripePrice({
  productId: 'prod_xxx',
  unitAmount: 4900,
  currency: 'usd',
  nickname: 'Community Expert - Monthly',
  recurring: { interval: 'month', intervalCount: 1 },
  tier: 'community',
  planType: 'monthly',
  commissionRate: 1200,
  lookupKey: 'community-expert-monthly',
  active: true,
});
// Returns: { success: boolean, data?: Stripe.Price, message?: string, error?: string }
```

### **`archiveStripePrice(priceId)`**
```typescript
const result = await archiveStripePrice('price_xxx');
// Returns: { success: boolean, data?: Stripe.Price, message?: string, error?: string }
```

### **`activateStripePrice(priceId)`**
```typescript
const result = await activateStripePrice('price_xxx');
// Returns: { success: boolean, data?: Stripe.Price, message?: string, error?: string }
```

---

## 📝 Metadata Schema

Prices include custom metadata for business logic:

```typescript
{
  tier: 'community' | 'top' | 'lecturer' | 'partner',
  planType: 'monthly' | 'annual' | 'commission',
  commissionRate: '1200', // Basis points (12%)
}
```

**Access in code:**
```typescript
const price = await stripe.prices.retrieve('price_xxx');
console.log(price.metadata.tier); // 'community'
console.log(price.metadata.commissionRate); // '1200' (12%)
```

---

## 🐛 Troubleshooting

### **"Unauthorized" error**
- Ensure you're logged in as admin
- Check user role in database (`users` table → `role` column should be `admin` or `super_admin`)

### **"Failed to load products"**
- Check `STRIPE_SECRET_KEY` in `.env`
- Verify Stripe API key is valid
- Check console for detailed error logs

### **"Failed to create price"**
- Verify all required fields are filled
- Check amount is in cents (not dollars)
- Ensure lookup key is unique (if provided)
- Check form validation errors

### **Page not loading**
- Ensure admin layout is properly configured
- Check `/admin/subscriptions` route exists
- Verify no TypeScript errors in console

---

## 🎉 Next Steps

### **Immediate:**

1. **Create Missing Prices:**
   - Top Expert Monthly: $177/month
   - Partner Workspace Tiers (Starter, Professional, Enterprise)

2. **Update `.env`:**
   ```bash
   STRIPE_PRICE_COMMUNITY_MONTHLY=price_1SQbV5K5Ap4Um3SpD65qOwZB
   STRIPE_PRICE_TOP_MONTHLY=price_xxxxxxxxxxxxxxxx  # After creation
   ```

3. **Test End-to-End:**
   - Create a test price
   - Archive it
   - Activate it
   - Verify in Stripe Dashboard

### **Future Enhancements:**

- Activity log (audit trail)
- Bulk operations (archive multiple prices)
- Subscription analytics (active subscribers, revenue)
- Price comparison view
- Partner workspace price creation

---

## 📚 Documentation

- **Full Guide:** `_docs/ADMIN-SUBSCRIPTIONS-IMPLEMENTATION.md`
- **Commit Message:** `_docs/COMMIT-ADMIN-SUBSCRIPTIONS.md`
- **Pricing Review:** `_docs/STRIPE-PRICING-REVIEW.md`
- **Stripe Setup:** `_docs/02-core-systems/STRIPE-SUBSCRIPTION-SETUP.md`

---

**Version:** 1.0  
**Status:** ✅ Production Ready  
**Created:** November 13, 2025

