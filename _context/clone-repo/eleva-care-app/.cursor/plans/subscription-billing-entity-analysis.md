# Subscription Billing Entity Analysis

**Date:** 2025-02-06  
**Question:** Should subscriptions be tied to Users or Organizations?  
**Research Sources:** Cal.com, Vercel, Dub.co (via Context7)

---

## Executive Summary

✅ **RECOMMENDATION: Organizations/Teams/Workspaces should own subscriptions, NOT individual users.**

This is the industry standard across all major SaaS platforms and is the correct approach for Eleva.

---

## Industry Research

### 1. Cal.com

**Model:** Organization-based billing

**Key Findings:**

- Organizations own subscriptions with Stripe price IDs
- Users become **members** of organizations with roles (OWNER, ADMIN, MEMBER)
- Environment variables explicitly reference organization billing:
  ```env
  STRIPE_ORG_MONTHLY_PRICE_ID=<your_stripe_price_id>
  ```
- Permissions are organization-level (e.g., "org_admins_can_create_new_teams")
- Teams exist **under** organizations
- Features can be enabled at the organization or team level

**Billing Flow:**

```
Organization → Stripe Subscription → Members access features
```

---

### 2. Vercel

**Model:** Team-based billing

**Key Findings:**

- Everything is scoped to **Teams**, not individual users
- API endpoints explicitly use `teamId`:
  - `PUT /teams/{teamId}/members/{memberId}`
  - `POST /api/team/members/invite`
  - `POST /v1/webhooks?teamId=xxx`
- Roles are hierarchical:
  - Team-level: `OWNER`, `MEMBER`, `DEVELOPER`, `BILLING`, `VIEWER`
  - Project-level: `ADMIN`, `PROJECT_VIEWER`, `PROJECT_DEVELOPER`
- Billing webhooks are tied to teams, not users
- Workspaces = Teams (they use the terms interchangeably)

**Billing Flow:**

```
Team → Stripe/Vercel Billing → Members with roles → Project access
```

---

### 3. Dub.co

**Model:** Workspace-based billing

**Key Findings:**

- Links, analytics, and features are scoped to **Workspaces**
- Settings and conversion tracking are workspace-level:
  - "Workspace-level Conversion Tracking"
  - `/settings/analytics` is per workspace
- API uses `workspaceId` for data organization
- Multiple users can collaborate within a workspace
- Stripe checkout includes team reference:
  ```javascript
  client_reference_id: user.teamId,
  metadata: {
    dubCustomerId: user.id, // user for conversion tracking
  }
  ```

**Billing Flow:**

```
Workspace → Stripe Subscription → Team Members → Shared Resources
```

---

## Why Organizations Own Subscriptions

### 1. **Business Model Alignment**

Organizations (or teams/workspaces) represent the **actual customer**:

- A clinic/practice pays for a subscription
- Multiple practitioners use the same subscription
- The organization gets upgraded features, not individual users

### 2. **Collaboration & Sharing**

- Multiple users need access to the same resources
- Shared calendars, appointments, settings, analytics
- Team members shouldn't each pay separately for the same workspace

### 3. **Administrative Control**

- Organization owners manage billing
- Admins control member access and roles
- Centralized subscription management (upgrade/downgrade)
- Clear separation: who pays vs. who uses

### 4. **Scalability**

- Organizations can add/remove members without affecting billing structure
- One subscription = unlimited users (or tiered by seats)
- Easier to upsell enterprise features

### 5. **Legal & Accounting**

- Organizations have billing information, not individual users
- Tax compliance (VAT, sales tax) is organization-level
- Invoices go to the organization, not individuals

---

## Eleva's Current Implementation

### Current State ✅

Looking at `drizzle/schema-workos.ts`, Eleva **already has the correct structure**:

```typescript
export const SubscriptionPlansTable = pgTable('subscription_plans', {
  workosUserId: text('workos_user_id')
    .notNull()
    .references(() => UsersTable.workosUserId, { onDelete: 'cascade' }),

  orgId: uuid('org_id')
    .notNull()
    .references(() => OrganizationsTable.id, { onDelete: 'cascade' }),

  // ... subscription details
});
```

**Analysis:**

- ✅ `orgId` is present and references `OrganizationsTable`
- ✅ `workosUserId` likely represents the "subscription owner/admin"
- ⚠️ **BUT**: The relationship should emphasize the organization as primary

### Potential Issues

1. **Both `workosUserId` AND `orgId` are NOT NULL**
   - This creates ambiguity: who owns the subscription?
   - Industry standard: Organization owns, user is just the admin

2. **Subscription lookup by user instead of org**
   - Some queries might be fetching by `workosUserId` instead of `orgId`
   - Should always query by `orgId` first

3. **Stripe Customer ID**
   - Should be tied to the organization, not the user
   - If a user leaves, the organization keeps the subscription

---

## Recommended Data Model

### Primary Relationship

```
Organization (pays) → Subscription Plan
  ↓
Organization Memberships → Users (members with roles)
```

### Updated Schema Recommendation

```typescript
export const SubscriptionPlansTable = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),

  // PRIMARY OWNER: Organization
  orgId: uuid('org_id')
    .notNull()
    .unique() // One subscription per organization
    .references(() => OrganizationsTable.id, { onDelete: 'cascade' }),

  // SECONDARY: Admin who manages the subscription (can change)
  billingAdminUserId: text('billing_admin_user_id')
    .notNull()
    .references(() => UsersTable.workosUserId, { onDelete: 'restrict' }), // Don't cascade!

  // Subscription details
  planType: text('plan_type').$type<'commission' | 'monthly' | 'annual'>(),
  tierLevel: text('tier_level').$type<'community' | 'top'>(),

  // Stripe billing (tied to organization)
  stripeCustomerId: text('stripe_customer_id').unique(), // Organization's Stripe ID
  stripeSubscriptionId: text('stripe_subscription_id').unique(),

  // ... rest of fields
});
```

### Key Changes

1. **`orgId` is unique**: One subscription per organization (not per user)
2. **`billingAdminUserId`**: Tracks who manages billing (can be transferred)
3. **`onDelete: 'restrict'`**: If billing admin leaves, don't delete subscription
4. **Stripe Customer**: Clearly belongs to the organization

---

## Implementation Checklist

### Phase 1: Clarify Ownership (Immediate)

- [ ] **Document** that subscriptions are organization-owned
- [ ] Update server actions to query by `orgId` first
- [ ] Ensure Stripe customers are created with org metadata

### Phase 2: Schema Refinement (Optional but Recommended)

- [ ] Rename `workosUserId` → `billingAdminUserId` for clarity
- [ ] Add `UNIQUE` constraint on `orgId` (if one sub per org)
- [ ] Change foreign key cascade behavior (`restrict` instead of `cascade`)
- [ ] Add `billingEmail` to Organizations table

### Phase 3: UI/UX Updates

- [ ] Subscription dashboard shows "Organization Subscription"
- [ ] Only org owners/admins can manage billing
- [ ] Member invites inherit organization's subscription benefits
- [ ] Clear messaging: "Your organization is on the X plan"

### Phase 4: Stripe Integration

- [ ] Create Stripe Customer with `metadata.orgId`
- [ ] Checkout session references `orgId`, not `userId`
- [ ] Webhook handlers update organization subscription status
- [ ] Support transferring billing admin role

---

## Real-World Example Flow

### Scenario: Healthcare Clinic

```
1. Dr. Smith creates organization: "Downtown Clinic"
   → Organization ID: org_abc123

2. Dr. Smith subscribes to "Top Expert Annual"
   → Stripe Customer created for "Downtown Clinic"
   → Subscription linked to org_abc123
   → Dr. Smith becomes "billing_admin_user_id"

3. Dr. Johnson joins "Downtown Clinic"
   → Added as member with role "expert_top"
   → Inherits subscription benefits automatically
   → Can book appointments, use features
   → Cannot manage billing (not admin)

4. Dr. Smith leaves the clinic
   → Dr. Johnson is promoted to billing admin
   → Subscription remains active
   → Stripe customer stays with organization
   → No disruption to service
```

---

## Common Patterns by Company Size

### Solopreneur (1 person)

- **Organization:** "John Doe Practice"
- **Members:** 1 (John)
- **Subscription:** Owned by organization
- **UX:** Feels like personal account, but technically org-owned

### Small Practice (2-5 people)

- **Organization:** "Family Health Clinic"
- **Members:** 3 doctors + 1 admin
- **Subscription:** Shared access
- **Billing:** One payment, multiple users

### Large Clinic (10+ people)

- **Organization:** "Metro Healthcare Group"
- **Members:** 15 practitioners + 5 staff
- **Subscription:** Enterprise tier
- **Billing:** Seat-based pricing (optional)

---

## Migration Path (If Needed)

If current subscriptions are user-centric, here's how to migrate:

### Step 1: Data Audit

```sql
-- Find subscriptions without orgId
SELECT * FROM subscription_plans WHERE org_id IS NULL;

-- Find multiple subscriptions in same org
SELECT org_id, COUNT(*)
FROM subscription_plans
GROUP BY org_id
HAVING COUNT(*) > 1;
```

### Step 2: Migrate Data

```sql
-- Set orgId from user's organization membership
UPDATE subscription_plans sp
SET org_id = (
  SELECT orgId FROM user_org_memberships
  WHERE workosUserId = sp.workosUserId
  LIMIT 1
)
WHERE org_id IS NULL;
```

### Step 3: Update Logic

- Change all queries to look up by `orgId`
- Update Stripe metadata to include `orgId`
- Modify checkout flow to pass `orgId`

---

## References

- **Cal.com:** `/calcom/cal.com` - PERMISSIONS.md, organization-setup.mdx
- **Vercel:** `/websites/vercel` - Teams API, member management
- **Dub.co:** `/websites/dub_co` - Workspace-level features
- **Industry Standard:** Multi-tenant SaaS best practices

---

## Conclusion

✅ **Eleva is on the right track** with `orgId` in `SubscriptionPlansTable`.

**Next Steps:**

1. Ensure all subscription queries use `orgId` as primary lookup
2. Update Stripe integration to emphasize organization ownership
3. Clarify in UI that subscriptions are "Workspace/Organization" level
4. Allow multiple users to benefit from one organization subscription

**Key Principle:**

> "Organizations pay. Users collaborate. Everyone wins."

---

**Questions?** Review this analysis with the team and validate against current implementation in:

- `server/actions/subscriptions.ts`
- `app/api/webhooks/stripe-subscriptions/route.ts`
- `drizzle/schema-workos.ts`
