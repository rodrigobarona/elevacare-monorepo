# Subscription Organization-Level Migration Plan

**Date:** 2025-02-06  
**Goal:** Migrate subscriptions from user-owned to organization-owned (industry standard)

---

## 🔴 Current Issues

### 1. Schema Problems (`drizzle/schema-workos.ts`)

```typescript
// ❌ CURRENT (WRONG):
export const SubscriptionPlansTable = pgTable('subscription_plans', {
  workosUserId: text('workos_user_id')
    .notNull()
    .unique()  // ❌ One subscription per user (backwards!)
    .references(() => UsersTable.workosUserId, { onDelete: 'cascade' }), // ❌ Deletes subscription if user leaves!
  
  orgId: uuid('org_id')
    .notNull()
    .references(() => OrganizationsTable.id, { onDelete: 'cascade' }),
    // ❌ NOT unique - multiple orgs could share subscription (wrong!)
});
```

**Problems:**
- ❌ `workosUserId` is unique → subscriptions belong to users, not orgs
- ❌ `orgId` is not unique → orgs don't "own" subscriptions
- ❌ `onDelete: 'cascade'` on user → subscription deleted if billing admin leaves
- ❌ Naming is ambiguous → unclear who owns what

### 2. Server Actions Problems (`server/actions/subscriptions.ts`)

All queries lookup by `workosUserId` instead of `orgId`:

```typescript
// ❌ Lines 130, 253, 354, 404:
const subscription = await db.query.SubscriptionPlansTable.findFirst({
  where: eq(SubscriptionPlansTable.workosUserId, userId), // ❌ User-centric!
});
```

**Problems:**
- ❌ Queries by user ID, not org ID
- ❌ No consideration for organization ownership
- ❌ Multiple org members can't share subscription

### 3. Webhook Handler Problems (`app/api/webhooks/stripe-subscriptions/route.ts`)

```typescript
// ❌ Line 225:
const existingPlan = await db.query.SubscriptionPlansTable.findFirst({
  where: eq(SubscriptionPlansTable.workosUserId, workosUserId), // ❌ User-centric!
});
```

**Problems:**
- ❌ Looks up subscription by user, not org
- ❌ Creates subscription for user, not org
- ❌ Stripe Customer ID tied to user

---

## ✅ Correct Implementation (Industry Standard)

### 1. Fixed Schema

```typescript
// ✅ FIXED (CORRECT):
export const SubscriptionPlansTable = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // ✅ PRIMARY OWNER: Organization
  orgId: uuid('org_id')
    .notNull()
    .unique() // ✅ One subscription per organization
    .references(() => OrganizationsTable.id, { onDelete: 'cascade' }),
  
  // ✅ SECONDARY: Billing admin (can change)
  billingAdminUserId: text('billing_admin_user_id')
    .notNull()
    .references(() => UsersTable.workosUserId, { onDelete: 'restrict' }), // ✅ Don't delete subscription!
  
  // ... rest of fields
});
```

**Benefits:**
- ✅ Organizations own subscriptions
- ✅ Multiple users can belong to same org and share subscription
- ✅ Billing admin can be transferred without losing subscription
- ✅ Aligns with Cal.com, Vercel, Dub patterns

### 2. Fixed Queries

```typescript
// ✅ Query by orgId first:
const subscription = await db.query.SubscriptionPlansTable.findFirst({
  where: eq(SubscriptionPlansTable.orgId, orgId), // ✅ Org-centric!
});
```

---

## 📋 Migration Steps

### Phase 1: Schema Changes

1. **Remove unique constraint** from `workosUserId`
2. **Add unique constraint** to `orgId`
3. **Rename** `workosUserId` → `billingAdminUserId` (for clarity)
4. **Change cascade behavior** on user FK to `restrict`

### Phase 2: Server Actions Updates

1. Change all queries to lookup by `orgId`
2. Get user's `orgId` from `UserOrgMembershipsTable`
3. Update Stripe metadata to include `orgId`

### Phase 3: Webhook Handler Updates

1. Update subscription lookup to use `orgId`
2. Store `orgId` in Stripe metadata
3. Create Stripe Customer with org details

### Phase 4: Stripe Integration

1. Update checkout sessions to pass `orgId`
2. Update customer creation to use org metadata
3. Ensure webhooks use `orgId` for lookups

---

## 🛠️ Implementation

### Step 1: Update Schema

**File:** `drizzle/schema-workos.ts`

```typescript
export const SubscriptionPlansTable = pgTable(
  'subscription_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    
    // ✅ PRIMARY: Organization owns subscription
    orgId: uuid('org_id')
      .notNull()
      .unique() // ✅ One subscription per org
      .references(() => OrganizationsTable.id, { onDelete: 'cascade' }),
    
    // ✅ SECONDARY: Billing admin (can be transferred)
    billingAdminUserId: text('billing_admin_user_id')
      .notNull()
      .references(() => UsersTable.workosUserId, { onDelete: 'restrict' }), // ✅ Don't cascade
    
    // Plan configuration
    planType: text('plan_type').notNull().$type<'commission' | 'monthly' | 'annual'>(),
    tierLevel: text('tier_level').notNull().$type<'community' | 'top'>(),
    
    // ... rest of fields stay the same
  },
  (table) => ({
    orgIdIndex: index('subscription_plans_org_id_idx').on(table.orgId), // Primary lookup
    billingAdminIndex: index('subscription_plans_billing_admin_idx').on(table.billingAdminUserId), // Secondary
    stripeSubscriptionIdIndex: index('subscription_plans_stripe_sub_idx').on(table.stripeSubscriptionId),
    planTypeIndex: index('subscription_plans_plan_type_idx').on(table.planType),
  }),
);
```

### Step 2: Migration SQL

```sql
-- 1. Drop old unique constraint on workos_user_id
ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_workos_user_id_unique;

-- 2. Rename column for clarity
ALTER TABLE subscription_plans RENAME COLUMN workos_user_id TO billing_admin_user_id;

-- 3. Add unique constraint on org_id (ensures one subscription per org)
ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_org_id_unique UNIQUE (org_id);

-- 4. Update foreign key to use RESTRICT instead of CASCADE
ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_workos_user_id_users_workos_user_id_fk;
ALTER TABLE subscription_plans 
  ADD CONSTRAINT subscription_plans_billing_admin_user_id_users_workos_user_id_fk 
  FOREIGN KEY (billing_admin_user_id) REFERENCES users(workos_user_id) ON DELETE RESTRICT;

-- 5. Update index names
DROP INDEX IF EXISTS subscription_plans_user_id_idx;
CREATE INDEX subscription_plans_billing_admin_idx ON subscription_plans(billing_admin_user_id);

-- 6. Ensure all subscriptions have valid org_id
UPDATE subscription_plans sp
SET org_id = (
  SELECT org_id 
  FROM user_org_memberships 
  WHERE workos_user_id = sp.billing_admin_user_id 
  LIMIT 1
)
WHERE org_id IS NULL;
```

### Step 3: Update Server Actions

**File:** `server/actions/subscriptions.ts`

**Pattern to follow everywhere:**

```typescript
// ❌ OLD (user-centric):
const subscription = await db.query.SubscriptionPlansTable.findFirst({
  where: eq(SubscriptionPlansTable.workosUserId, userId),
});

// ✅ NEW (org-centric):
// 1. Get user's organization
const membership = await db.query.UserOrgMembershipsTable.findFirst({
  where: eq(UserOrgMembershipsTable.workosUserId, userId),
  columns: { orgId: true },
});

if (!membership) {
  return { success: false, error: 'Organization not found' };
}

// 2. Query subscription by orgId
const subscription = await db.query.SubscriptionPlansTable.findFirst({
  where: eq(SubscriptionPlansTable.orgId, membership.orgId),
});
```

### Step 4: Update Webhook Handler

**File:** `app/api/webhooks/stripe-subscriptions/route.ts`

**Line ~225:** Change from user lookup to org lookup:

```typescript
// ❌ OLD:
const existingPlan = await db.query.SubscriptionPlansTable.findFirst({
  where: eq(SubscriptionPlansTable.workosUserId, workosUserId),
});

// ✅ NEW:
// Get user's org
const membership = await db.query.UserOrgMembershipsTable.findFirst({
  where: eq(UserOrgMembershipsTable.workosUserId, workosUserId),
  columns: { orgId: true },
});

// Query by orgId
const existingPlan = await db.query.SubscriptionPlansTable.findFirst({
  where: eq(SubscriptionPlansTable.orgId, membership.orgId),
});
```

### Step 5: Update Stripe Checkout

**File:** `server/actions/subscriptions.ts` - `createSubscription` function

```typescript
// Add orgId to Stripe metadata
const session = await stripe.checkout.sessions.create({
  customer: existingCustomerId || undefined,
  customer_email: !existingCustomerId ? user.email : undefined,
  client_reference_id: membership.orgId, // ✅ Organization ID, not user ID
  metadata: {
    workosUserId: user.id,
    orgId: membership.orgId, // ✅ Add org ID
    tierLevel,
    billingInterval,
  },
  // ...
});
```

---

## 🧪 Testing Checklist

### Unit Tests

- [ ] Subscription creation associates with orgId
- [ ] Multiple users in same org see same subscription
- [ ] Billing admin can be transferred
- [ ] Subscription persists if billing admin leaves
- [ ] Only one subscription per org

### Integration Tests

- [ ] Stripe checkout passes orgId in metadata
- [ ] Webhooks update subscription by orgId
- [ ] Multiple org members share subscription benefits
- [ ] Billing admin transfer works correctly

### Manual Testing

- [ ] Create subscription as Dr. Smith
- [ ] Invite Dr. Johnson to same org
- [ ] Verify Dr. Johnson sees subscription benefits
- [ ] Transfer billing admin to Dr. Johnson
- [ ] Remove Dr. Smith from org
- [ ] Verify subscription still active

---

## 🚨 Breaking Changes

### Database

- Column renamed: `workos_user_id` → `billing_admin_user_id`
- Unique constraint moved from user to org
- Foreign key cascade behavior changed

### API

- Queries now use `orgId` instead of `workosUserId`
- Stripe metadata includes `orgId`
- Billing admin is separate from organization owner

### Backward Compatibility

**Existing data:**
- All existing subscriptions will be migrated
- `workosUserId` becomes `billingAdminUserId`
- `orgId` populated from user's membership

**Queries:**
- Old code querying by `workosUserId` will fail
- Must update to query by `orgId`

---

## 📝 Code Changes Summary

### Files to Update

1. `drizzle/schema-workos.ts` - Schema definition
2. `server/actions/subscriptions.ts` - All subscription queries
3. `app/api/webhooks/stripe-subscriptions/route.ts` - Webhook handler
4. `server/actions/eligibility.ts` - Eligibility checks (if exists)
5. UI components showing subscription status

### Search & Replace Patterns

```bash
# Find all subscription queries
rg "SubscriptionPlansTable.workosUserId" --type ts

# Find all subscription lookups
rg "eq\(SubscriptionPlansTable\.workosUserId" --type ts

# Find Stripe metadata references
rg "metadata.*workosUserId" --type ts
```

---

## ✅ Success Criteria

- [ ] Schema updated with `orgId` as unique
- [ ] All queries lookup by `orgId` first
- [ ] Stripe metadata includes `orgId`
- [ ] Multiple org members share subscription
- [ ] Billing admin can be transferred
- [ ] Subscription persists if admin leaves
- [ ] Tests pass
- [ ] Migration successful
- [ ] Documentation updated

---

## 🎯 Rollout Plan

### Stage 1: Schema Migration (Low Risk)
- Run migration SQL
- Verify data integrity
- **Rollback plan:** Restore from backup

### Stage 2: Code Updates (Medium Risk)
- Update server actions
- Update webhook handler
- **Rollback plan:** Revert code changes

### Stage 3: Stripe Integration (Low Risk)
- Update metadata in new checkouts
- Old subscriptions continue working
- **Rollback plan:** None needed (metadata is additive)

### Stage 4: Validation (No Risk)
- Monitor logs for errors
- Test with real subscriptions
- Verify org-level access

---

## 📚 References

- Industry analysis: `.cursor/plans/subscription-billing-entity-analysis.md`
- Current schema: `drizzle/schema-workos.ts`
- Server actions: `server/actions/subscriptions.ts`
- Webhook handler: `app/api/webhooks/stripe-subscriptions/route.ts`

