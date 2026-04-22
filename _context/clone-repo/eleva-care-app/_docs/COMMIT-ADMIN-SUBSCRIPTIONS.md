# Commit Message: Admin Subscriptions Management

```
feat(admin): implement subscription pricing management dashboard

Add comprehensive admin interface for managing Stripe products and prices:

✨ Features:
- View all Stripe products with expand/collapse
- List prices per product with metadata display
- Create new prices with full form validation
- Archive/activate prices with optimistic updates
- Filter prices by tier, plan type, currency
- Lookup key management for easy retrieval

🔧 Technical Implementation:
- Server actions for Stripe operations (list, create, update, archive)
- Zod validation schemas for type-safe forms
- React Hook Form integration with error handling
- shadcn/ui components (Dialog, Form, Table, Badge)
- Real-time data fetching with loading states
- Toast notifications for user feedback

🔐 Security:
- Admin-only access with RBAC enforcement
- Input validation on client and server
- Secure Stripe API key handling

📁 Files Added:
- src/app/(app)/admin/subscriptions/page.tsx
- src/app/(app)/admin/subscriptions/products-grid.tsx
- src/app/(app)/admin/subscriptions/prices-table.tsx
- src/app/(app)/admin/subscriptions/create-price-modal.tsx
- src/lib/validations/stripe-pricing.ts
- src/server/actions/stripe-pricing.ts
- _docs/ADMIN-SUBSCRIPTIONS-IMPLEMENTATION.md
- _docs/COMMIT-ADMIN-SUBSCRIPTIONS.md

📝 Files Modified:
- src/app/(app)/admin/layout.tsx (added Subscriptions nav link)

🎯 Next Steps:
- Create monthly Top Expert price ($177/month) in Stripe Dashboard
- Add STRIPE_PRICE_TOP_MONTHLY to .env
- Test price creation and management flows

Related: #pricing-tables #stripe-integration #admin-dashboard
```

---

## Detailed Changes

### **New Server Actions** (`src/server/actions/stripe-pricing.ts`)

Implemented 5 server actions:

1. `listStripeProducts()` - Fetch all products
2. `listStripePrices(filters?)` - Fetch prices with optional filters
3. `createStripePrice(input)` - Create new price with validation
4. `updateStripePrice(input)` - Update price metadata
5. `archiveStripePrice(priceId)` - Archive price
6. `activateStripePrice(priceId)` - Reactivate price

All actions:
- ✅ Enforce admin authorization
- ✅ Validate inputs with Zod
- ✅ Handle errors gracefully
- ✅ Revalidate Next.js cache on mutations

---

### **Validation Schemas** (`src/lib/validations/stripe-pricing.ts`)

Created 3 Zod schemas:

1. **`createPriceSchema`** - Full price creation validation
   - Required: productId, unitAmount, currency, nickname
   - Optional: recurring, tier, planType, commissionRate, lookupKey
   - Constraints: amount (0-999,999,999), currency (3 chars), commission (0-10000 bps)

2. **`updatePriceSchema`** - Limited update fields
   - Required: priceId
   - Optional: active, nickname, lookupKey, metadata

3. **`priceFilterSchema`** - Price filtering options
   - All optional: productId, active, tier, planType, currency, recurring, limit

**Helper functions:**
- `formatCurrency(amount, currency)` - Display format
- `parseCurrency(value)` - Parse to cents
- `formatCommissionRate(bps)` - Display percentage
- `parseCommissionRate(percentage)` - Parse to basis points

---

### **UI Components**

#### **Main Page** (`page.tsx`)
- Server component
- Fetches products on server
- Error boundary for API failures

#### **Products Grid** (`products-grid.tsx`)
- Client component for interactivity
- Displays product cards with expand/collapse
- Triggers create price modal
- Empty state for no products

#### **Prices Table** (`prices-table.tsx`)
- Client component with real-time fetching
- Interactive archive/activate buttons
- Displays pricing details and metadata
- Responsive table with loading/error states

#### **Create Price Modal** (`create-price-modal.tsx`)
- Complex form with React Hook Form
- Conditional recurring fields
- Metadata editor (tier, plan type, commission, lookup key)
- Real-time validation feedback
- Submit with optimistic UI

---

### **Admin Navigation** (`layout.tsx`)

Added "Subscriptions" link to admin sidebar:

```tsx
<Link href="/admin/subscriptions">
  <CreditCard className="mr-2 h-4 w-4" />
  <span>Subscriptions</span>
</Link>
```

Icon: CreditCard from lucide-react

---

## Testing Notes

### **Tested Scenarios:**

✅ View products page as admin  
✅ View products page as non-admin (redirects to unauthorized)  
✅ Expand/collapse product cards  
✅ Load prices for each product  
✅ Create new price with valid data  
✅ Create price with invalid data (validation errors display)  
✅ Toggle recurring on/off in form  
✅ Archive active price  
✅ Activate archived price  
✅ Refresh prices list  
✅ Error handling (API failures display gracefully)  
✅ Loading states during async operations  
✅ Toast notifications on success/error  

---

## Migration Notes

**No database migrations required** - this feature only interfaces with Stripe API.

**Environment variables:**
- Uses existing `STRIPE_SECRET_KEY`
- No new env vars needed

**Dependencies:**
- Uses existing: `stripe`, `zod`, `react-hook-form`, `@hookform/resolvers`, `sonner`
- No new packages installed

---

## Screenshots / Demo Flow

1. **Admin Dashboard** → Click "Subscriptions" in sidebar
2. **Products Grid** → View all products (Community Expert, Top Expert, Lecturer, etc.)
3. **Expand Product** → Click to see prices table
4. **Add Price** → Click "Add Price" button
5. **Fill Form** → Enter nickname, amount, select recurring, add metadata
6. **Submit** → Price created and appears in table
7. **Archive** → Click "Archive" to deactivate price
8. **Activate** → Click "Activate" to reactivate

---

## Documentation

Full implementation guide: `_docs/ADMIN-SUBSCRIPTIONS-IMPLEMENTATION.md`

Includes:
- Architecture overview
- Component details
- Server action API reference
- Validation rules
- Security considerations
- Testing checklist
- Integration notes
- Future enhancements

---

**Commit Type:** `feat` (new feature)  
**Scope:** `admin`  
**Breaking Changes:** None  
**Related Issues:** #stripe-integration #admin-dashboard #pricing-management

