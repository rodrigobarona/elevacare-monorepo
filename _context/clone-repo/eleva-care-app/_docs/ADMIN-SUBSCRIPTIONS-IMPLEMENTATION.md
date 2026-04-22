# Admin Subscriptions Management Implementation

**Date:** November 13, 2025  
**Status:** ✅ Complete  
**Feature:** Admin interface for managing Stripe subscription products and prices

---

## 🎯 Overview

Built a comprehensive admin dashboard for managing Stripe subscription products and prices. This interface allows admins to:

- View all Stripe products (Expert, Partner, Lecturer subscriptions)
- List prices per product with metadata filtering
- Create new prices with full form validation
- Archive/activate prices
- Edit metadata (tier, plan type, commission rates)
- Use lookup keys for easy price retrieval

---

## 📁 File Structure

```
src/
├── app/(app)/admin/subscriptions/
│   ├── page.tsx                    # Main subscriptions page
│   ├── products-grid.tsx           # Products grid with expand/collapse
│   ├── prices-table.tsx            # Prices table with actions
│   └── create-price-modal.tsx      # Create price form with validation
├── lib/validations/
│   └── stripe-pricing.ts           # Zod schemas + helpers
└── server/actions/
    └── stripe-pricing.ts           # Server actions for Stripe operations
```

---

## 🧩 Components

### **1. Main Page** (`page.tsx`)

Server component that fetches products and renders the grid:

```typescript
export default async function SubscriptionsPage() {
  const productsResult = await listStripeProducts();
  
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1>Subscription Management</h1>
        <p>Manage Stripe products, prices, and subscription plans...</p>
      </div>
      
      <ProductsGrid products={productsResult.data || []} />
    </div>
  );
}
```

**Features:**
- Server-side data fetching
- Error handling with fallback UI
- Optimized with Next.js caching

---

### **2. Products Grid** (`products-grid.tsx`)

Displays all Stripe products with expandable price tables:

```typescript
export function ProductsGrid({ products }: ProductsGridProps) {
  // Product cards with:
  // - Product name, description, status
  // - "Add Price" button
  // - Embedded PricesTable component
  // - Create Price Modal
}
```

**Features:**
- Product status badges (Active/Archived)
- Product ID display
- Create price modal trigger
- Empty state handling

---

### **3. Prices Table** (`prices-table.tsx`)

Client component with interactive price management:

```typescript
export function PricesTable({ productId }: PricesTableProps) {
  // Features:
  // - Load prices for specific product
  // - Display pricing details (amount, billing, metadata)
  // - Archive/activate buttons
  // - Refresh functionality
  // - Loading and error states
}
```

**Features:**
- Real-time price fetching
- Archive/activate actions with optimistic updates
- Metadata display (tier, plan type, commission)
- Responsive table layout
- Toast notifications for actions

---

### **4. Create Price Modal** (`create-price-modal.tsx`)

Comprehensive form for creating new Stripe prices:

```typescript
export function CreatePriceModal({ open, onOpenChange, product }: CreatePriceModalProps) {
  // Form fields:
  // - Nickname (required)
  // - Amount in cents (required)
  // - Currency (required, default: USD)
  // - Recurring toggle
  // - Billing interval (month/year/week/day)
  // - Interval count (1-12)
  // - Metadata: tier, plan type, commission rate, lookup key
}
```

**Features:**
- Zod form validation
- Conditional recurring fields
- Currency selection (USD, EUR, GBP, CAD)
- Metadata fields for filtering
- Real-time validation feedback
- Submit with loading state

---

## 🔧 Server Actions

### **`listStripeProducts()`**

Fetches all active Stripe products with default prices.

```typescript
const result = await listStripeProducts();
// Returns: { success: true, data: Stripe.Product[] }
```

---

### **`listStripePrices(filters?)`**

Lists prices with optional filtering:

```typescript
const result = await listStripePrices({
  productId: 'prod_xxx',
  active: true,
  tier: 'community',
  planType: 'monthly',
  recurring: true,
  limit: 20,
});
```

**Filters:**
- `productId`: Filter by specific product
- `active`: Show only active/archived prices
- `tier`: Filter by tier (community, top, lecturer, partner)
- `planType`: Filter by plan type (monthly, annual, commission)
- `currency`: Filter by currency code
- `recurring`: Filter recurring vs one-time prices
- `limit`: Max results (1-100, default: 20)

---

### **`createStripePrice(input)`**

Creates a new Stripe price with validation:

```typescript
const result = await createStripePrice({
  productId: 'prod_xxx',
  unitAmount: 4900, // $49.00 in cents
  currency: 'usd',
  nickname: 'Community Expert - Monthly',
  recurring: {
    interval: 'month',
    intervalCount: 1,
  },
  tier: 'community',
  planType: 'monthly',
  commissionRate: 1200, // 12% in basis points
  lookupKey: 'community-expert-monthly',
  active: true,
});
```

**Validation:**
- Product ID format (`prod_*`)
- Amount range (0-999,999,999 cents)
- Currency (3-letter ISO code)
- Interval count (1-12)
- Commission rate (0-10000 basis points)
- Lookup key (alphanumeric, hyphens, underscores only)

---

### **`updateStripePrice(input)`**

Updates limited fields (Stripe restriction):

```typescript
const result = await updateStripePrice({
  priceId: 'price_xxx',
  active: false,
  nickname: 'Updated Name',
  lookupKey: 'new-lookup-key',
  metadata: { customKey: 'customValue' },
});
```

**Note:** Stripe doesn't allow changing amount or billing after creation.

---

### **`archiveStripePrice(priceId)`**

Soft-delete a price (set active = false):

```typescript
const result = await archiveStripePrice('price_xxx');
```

---

### **`activateStripePrice(priceId)`**

Reactivate an archived price:

```typescript
const result = await activateStripePrice('price_xxx');
```

---

## 🔐 Security

### **Admin Authorization:**

All server actions and the page route enforce admin-only access:

```typescript
const userIsAdmin = await isAdmin();
if (!userIsAdmin) {
  return { success: false, error: 'Unauthorized - Admin access required' };
}
```

### **Input Validation:**

All inputs validated with Zod schemas:

```typescript
const validatedInput = createPriceSchema.parse(input);
```

### **RBAC:**

Only users with `admin` or `super_admin` roles can access `/admin/subscriptions`.

---

## 🎨 UI/UX Features

### **Shadcn/UI Components:**
- Dialog (modals)
- Form + Form Fields
- Input, Select, Checkbox
- Table
- Badge
- Button
- Card

### **Loading States:**
- Skeleton loaders
- Spinner animations
- Disabled buttons during actions

### **Error Handling:**
- Graceful error messages
- Retry buttons
- Fallback UI for failures

### **Responsive Design:**
- Mobile-friendly tables
- Adaptive grid layouts
- Touch-friendly buttons

---

## 📊 Metadata Schema

Prices include custom metadata for filtering and business logic:

```typescript
interface PriceMetadata {
  tier?: 'community' | 'top' | 'lecturer' | 'partner';
  planType?: 'monthly' | 'annual' | 'commission';
  commissionRate?: string; // Basis points (e.g., "1200" = 12%)
}
```

**Usage Example:**

```typescript
// Create price with metadata
const price = await createStripePrice({
  // ... other fields
  tier: 'community',
  planType: 'monthly',
  commissionRate: 1200, // 12%
});

// Filter prices by metadata
const communityPrices = await listStripePrices({
  tier: 'community',
  planType: 'monthly',
});
```

---

## 🧪 Testing Checklist

### **Manual Testing:**

1. ✅ **View Products:**
   - Navigate to `/admin/subscriptions`
   - Verify all products display correctly
   - Check product badges (Active/Archived)

2. ✅ **View Prices:**
   - Expand product cards
   - Verify prices table loads
   - Check price formatting (currency, intervals)
   - Verify metadata displays correctly

3. ✅ **Create Price:**
   - Click "Add Price" button
   - Fill out form with valid data
   - Toggle recurring on/off
   - Submit and verify success toast
   - Check price appears in table

4. ✅ **Archive Price:**
   - Click "Archive" on active price
   - Verify price status changes
   - Check badge updates to "Archived"

5. ✅ **Activate Price:**
   - Click "Activate" on archived price
   - Verify price status changes back

6. ✅ **Form Validation:**
   - Try submitting with empty fields (should show errors)
   - Try invalid amounts (negative, too large)
   - Try invalid lookup keys (special characters)
   - Verify error messages display

7. ✅ **Error Handling:**
   - Disconnect internet (simulate API failure)
   - Verify error messages display
   - Check retry button works

8. ✅ **Authorization:**
   - Test as non-admin user (should redirect to unauthorized)
   - Test as admin (should load correctly)

---

## 🔄 Integration with Existing System

### **Stripe Integration:**

Uses existing `@/lib/integrations/stripe` client:

```typescript
import { stripe } from '@/lib/integrations/stripe';

const products = await stripe.products.list({ ... });
const prices = await stripe.prices.list({ ... });
const price = await stripe.prices.create({ ... });
```

### **Admin RBAC:**

Integrated with existing `@/lib/auth/roles.server`:

```typescript
import { isAdmin } from '@/lib/auth/roles.server';
```

### **Admin Layout:**

Added to existing admin sidebar navigation:

```tsx
<Link href="/admin/subscriptions">
  <CreditCard className="mr-2 h-4 w-4" />
  <span>Subscriptions</span>
</Link>
```

---

## 🚀 Next Steps

### **Immediate:**
- ✅ Create monthly Top Expert price in Stripe Dashboard ($177/month)
- ✅ Add price IDs to `.env`:
  ```bash
  STRIPE_PRICE_COMMUNITY_MONTHLY=price_1SQbV5K5Ap4Um3SpD65qOwZB
  STRIPE_PRICE_TOP_MONTHLY=price_xxxxxxxxxxxxxxxx  # To be created
  ```

### **Future Enhancements:**

1. **Bulk Operations:**
   - Archive multiple prices at once
   - Bulk metadata updates

2. **Activity Log:**
   - Track who created/updated/archived prices
   - Audit trail for compliance

3. **Price Comparison:**
   - Side-by-side price comparisons
   - Highlight recommended plans

4. **Subscription Analytics:**
   - Active subscribers per price
   - Revenue breakdown by tier
   - Churn rate tracking

5. **Partner Workspace Prices:**
   - Create products for partner workspace tiers
   - Implement multi-seat pricing

---

## 📚 References

- **Stripe API Docs:** https://docs.stripe.com/api/prices
- **Zod Validation:** https://zod.dev/
- **Shadcn/UI:** https://ui.shadcn.com/
- **React Hook Form:** https://react-hook-form.com/
- **Project Docs:**
  - `_docs/02-core-systems/STRIPE-SUBSCRIPTION-SETUP.md`
  - `_docs/02-core-systems/ROLE-PROGRESSION-SYSTEM.md`
  - `_docs/STRIPE-PRICING-REVIEW.md`

---

**Document Version:** 1.0  
**Status:** ✅ Complete  
**Created:** November 13, 2025  
**Contributors:** AI Assistant + User

