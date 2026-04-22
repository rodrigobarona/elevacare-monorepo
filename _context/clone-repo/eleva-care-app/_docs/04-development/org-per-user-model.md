# Org-Per-User Multi-Tenancy Model

## Overview

Eleva Care implements an **org-per-user multi-tenancy architecture** where each expert and patient has their own dedicated organization. This provides complete data isolation, supports flexible business models (B2C and B2B), and enables future expansion into educational services.

**Last Updated:** November 3, 2025  
**Status:** Active  
**Owner:** Architecture Team

---

## Table of Contents

1. [Why Org-Per-User](#why-org-per-user)
2. [Architecture Design](#architecture-design)
3. [Organization Types](#organization-types)
4. [Database Schema](#database-schema)
5. [RLS Implementation](#rls-implementation)
6. [Membership Management](#membership-management)
7. [Query Patterns](#query-patterns)
8. [Migration from Clerk](#migration-from-clerk)
9. [B2B Expansion Path](#b2b-expansion-path)

---

## Why Org-Per-User

### Traditional Multi-Tenancy Challenges

**Shared Organization Model:**

```
❌ Problem: Multiple patients in one "clinic" organization
├─> Data isolation concerns
├─> Complex permission management
├─> Difficult to separate patient data
└─> HIPAA compliance challenges
```

**Our Solution: Org-Per-User**

```
✅ Benefits:
├─> Complete data isolation per user
├─> Simplified HIPAA compliance
├─> Clear data ownership
├─> Easy to scale to multi-user clinics
└─> Future-proof for B2B expansion
```

### Key Benefits

| Requirement                 | Org-Per-User Solution           |
| --------------------------- | ------------------------------- |
| **Data Isolation**          | ✅ Physical separation via RLS  |
| **GDPR Right to Erasure**   | ✅ Delete org = delete all data |
| **HIPAA Compliance**        | ✅ Clear data boundaries        |
| **Patient Privacy**         | ✅ No shared organization space |
| **Clinic Expansion**        | ✅ Invite experts to your org   |
| **B2B Ready**               | ✅ Organizations can have teams |
| **Subscription Management** | ✅ Per-org billing              |

---

## Architecture Design

### Data Isolation Model

```
┌─────────────────────────────────────────────────────────────────┐
│                   Org-Per-User Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Expert User                    Patient User                     │
│  ├─> Has Organization          ├─> Has Organization             │
│  │   ├─> org_type: "expert"   │   ├─> org_type: "patient"      │
│  │   ├─> Owner role            │   ├─> Owner role               │
│  │   └─> Can invite others     │   └─> Solo membership          │
│  │                              │                                 │
│  ├─> Creates Events            ├─> Books Appointments           │
│  │   └─> Scoped to their org  │   └─> Scoped to their org      │
│  │                              │                                 │
│  ├─> Medical Records           ├─> Medical Records              │
│  │   └─> Access via RLS       │   └─> Own records only          │
│  │                              │                                 │
│  └─> Payments Received         └─> Payments Made                │
│      └─> Stripe Connect           └─> Stripe Customer           │
│                                                                  │
│  Multi-Expert Clinic (Future)                                   │
│  ├─> Organization                                               │
│  │   ├─> org_type: "clinic"                                    │
│  │   ├─> Owner (clinic admin)                                  │
│  │   ├─> Members (experts)                                     │
│  │   └─> Subscription tier                                     │
│  │                                                              │
│  └─> Shared Resources                                          │
│      ├─> Schedule visibility                                   │
│      ├─> Patient database                                      │
│      └─> Team messaging                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Organization Lifecycle

```
1. User Signs Up (Expert or Patient)
   └─> Create User record
       └─> Create Organization
           ├─> type: Based on user selection
           ├─> slug: Generated from email
           └─> subscription_tier: "free"
       └─> Create Membership
           ├─> role: "owner"
           └─> status: "active"

2. Solo Operation (Initial State)
   └─> Expert manages their own calendar
   └─> Patient books their own appointments
   └─> Full data isolation via RLS

3. Clinic Expansion (B2B Feature)
   └─> Expert upgrades subscription
       └─> Invites other experts
           └─> New memberships created
               └─> Shared org resources

4. Organization Deletion
   └─> Cascade delete all org data
       ├─> Events
       ├─> Appointments
       ├─> Medical records (archived)
       └─> Memberships
```

---

## Organization Types

### Type Definitions

```typescript
// types/organization.ts
export type OrganizationType =
  | 'patient_personal' // Individual patient
  | 'expert_individual' // Solo practitioner
  | 'clinic' // Multi-expert clinic
  | 'educational_institution'; // For courses/lectures (future)

export interface OrganizationFeatures {
  // Current features
  scheduling?: boolean;
  booking?: boolean;
  payments?: boolean;
  medicalRecords?: boolean;

  // B2B features (requires subscription)
  multipleExperts?: boolean;
  sharedCalendar?: boolean;
  teamMessaging?: boolean;
  analytics?: boolean;

  // Future features
  courses?: boolean;
  certifications?: boolean;
  studentManagement?: boolean;
}

export type SubscriptionTier =
  | 'free' // Individual users
  | 'professional' // Enhanced features
  | 'clinic_starter' // 2-5 experts
  | 'clinic_growth' // 6-20 experts
  | 'enterprise'; // Custom
```

### Feature Matrix

| Org Type                  | Primary User | Multi-Member | Subscription      | Use Case              |
| ------------------------- | ------------ | ------------ | ----------------- | --------------------- |
| `patient_personal`        | Patient      | ❌ Solo      | Free              | Individual healthcare |
| `expert_individual`       | Expert       | ❌ Solo      | Free/Professional | Solo practice         |
| `clinic`                  | Clinic Admin | ✅ Team      | Clinic tiers      | Group practice        |
| `educational_institution` | Teacher      | ✅ Team      | Enterprise        | Courses/lectures      |

---

## Database Schema

### Core Tables

#### Organizations Table

```typescript
export const OrganizationsTable = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workosOrgId: text('workos_org_id').unique().notNull(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    type: text('type').notNull().$type<OrganizationType>(),

    // Features and subscriptions
    features: jsonb('features').$type<OrganizationFeatures>(),
    subscriptionTier: text('subscription_tier').$type<SubscriptionTier>().default('free'),
    subscriptionStatus: text('subscription_status').default('active'),

    // Billing
    stripeSubscriptionId: text('stripe_subscription_id'),
    billingEmail: text('billing_email'),

    // Metadata
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    // RLS: Users can only see orgs they belong to
    crudPolicy({
      role: authenticatedRole,
      read: sql`EXISTS (
        SELECT 1 FROM user_org_memberships
        WHERE user_org_memberships.org_id = ${table.id}
        AND user_org_memberships.workos_user_id = auth.user_id()
        AND user_org_memberships.status = 'active'
      )`,
      modify: sql`EXISTS (
        SELECT 1 FROM user_org_memberships
        WHERE user_org_memberships.org_id = ${table.id}
        AND user_org_memberships.workos_user_id = auth.user_id()
        AND user_org_memberships.role IN ('owner', 'admin')
      )`,
    }),
  ],
);
```

#### Users Table

```typescript
export const UsersTable = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  workosUserId: text('workos_user_id').notNull().unique(),
  email: text('email').notNull(),

  // Default organization (their personal org)
  primaryOrgId: uuid('primary_org_id').references(() => OrganizationsTable.id),

  // Platform role (separate from org roles)
  platformRole: text('platform_role').default('user'), // 'user' | 'expert' | 'admin'

  // Stripe IDs
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeConnectAccountId: text('stripe_connect_account_id').unique(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

#### Memberships Table

```typescript
export const UserOrgMembershipsTable = pgTable(
  'user_org_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workosUserId: text('workos_user_id').notNull(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => OrganizationsTable.id, {
        onDelete: 'cascade',
      }),

    // WorkOS references
    workosOrgMembershipId: text('workos_org_membership_id').unique(),

    // Role from WorkOS RBAC
    role: text('role').notNull(), // 'owner' | 'admin' | 'member' | 'billing_admin'

    // Status
    status: text('status').default('active'), // 'active' | 'invited' | 'suspended'

    // Timestamps
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
    invitedAt: timestamp('invited_at'),
    invitedBy: text('invited_by'),
  },
  (table) => [
    // RLS: Users can only see their own memberships
    crudPolicy({
      role: authenticatedRole,
      read: sql`${table.workosUserId} = auth.user_id()`,
      modify: sql`false`, // Managed via WorkOS only
    }),
  ],
);
```

### Org-Scoped Tables

All application tables include `orgId` for automatic RLS filtering:

```typescript
// Events table with org scoping
export const EventsTable = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => OrganizationsTable.id),
    workosUserId: text('workos_user_id').notNull(),
    title: text('title').notNull(),
    // ... other fields
  },
  (table) => [
    crudPolicy({
      role: authenticatedRole,
      read: sql`EXISTS (
        SELECT 1 FROM user_org_memberships
        WHERE user_org_memberships.org_id = ${table.orgId}
        AND user_org_memberships.workos_user_id = auth.user_id()
        AND user_org_memberships.status = 'active'
      )`,
      modify: sql`${table.workosUserId} = auth.user_id()`,
    }),
  ],
);
```

---

## RLS Implementation

### Automatic Filtering

With Neon Auth + RLS, all queries are automatically filtered:

```typescript
// Get user's organization-scoped database
const db = await getOrgScopedDb();

// Query events - automatically filtered by user's org memberships
const events = await db.select().from(EventsTable);

// Only returns events from organizations where:
// 1. User has active membership
// 2. User ID matches JWT token
```

### Cross-Organization Queries

For features requiring cross-org access (e.g., appointments between expert and patient):

```typescript
// Appointments table - Special RLS
export const AppointmentsTable = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    expertOrgId: uuid('expert_org_id').notNull(),
    patientOrgId: uuid('patient_org_id').notNull(),
    expertId: text('expert_id').notNull(),
    patientId: text('patient_id').notNull(),
    // ... other fields
  },
  (table) => [
    // RLS: User can access if they're in EITHER org
    crudPolicy({
      role: authenticatedRole,
      read: sql`(
        EXISTS (
          SELECT 1 FROM user_org_memberships
          WHERE user_org_memberships.org_id = ${table.expertOrgId}
          AND user_org_memberships.workos_user_id = auth.user_id()
          AND user_org_memberships.status = 'active'
        ) OR EXISTS (
          SELECT 1 FROM user_org_memberships
          WHERE user_org_memberships.org_id = ${table.patientOrgId}
          AND user_org_memberships.workos_user_id = auth.user_id()
          AND user_org_memberships.status = 'active'
        )
      )`,
      // Only expert can modify
      modify: sql`${table.expertId} = auth.user_id()`,
    }),
  ],
);
```

---

## Membership Management

### Creating Organizations on Sign-Up

```typescript
// server/actions/onboarding.ts
'use server';

import { getOrgScopedDb } from '@/lib/integrations/neon/rls-client';
import { workos } from '@/lib/integrations/workos/client';

// server/actions/onboarding.ts

// server/actions/onboarding.ts

export async function createUserOrganization(params: {
  userId: string;
  email: string;
  userType: 'expert' | 'patient';
}) {
  // 1. Create organization in WorkOS
  const workosOrg = await workos.organizations.createOrganization({
    name: `${params.email}'s ${params.userType === 'expert' ? 'Practice' : 'Account'}`,
  });

  // 2. Create organization membership in WorkOS
  const membership = await workos.userManagement.createOrganizationMembership({
    organizationId: workosOrg.id,
    userId: params.userId,
    roleSlug: 'owner',
  });

  // 3. Create organization in our database
  const db = await getAdminDb(); // Use admin for initial setup

  const [org] = await db
    .insert(OrganizationsTable)
    .values({
      workosOrgId: workosOrg.id,
      slug: workosOrg.slug || generateSlug(params.email),
      name: workosOrg.name,
      type: params.userType === 'expert' ? 'expert_individual' : 'patient_personal',
      features: getDefaultFeatures(params.userType),
      subscriptionTier: 'free',
    })
    .returning();

  // 4. Create membership record
  await db.insert(UserOrgMembershipsTable).values({
    workosUserId: params.userId,
    orgId: org.id,
    workosOrgMembershipId: membership.id,
    role: 'owner',
    status: 'active',
    joinedAt: new Date(),
  });

  // 5. Update user's primary org
  await db
    .update(UsersTable)
    .set({ primaryOrgId: org.id })
    .where(eq(UsersTable.workosUserId, params.userId));

  return org;
}
```

### Inviting Members to Clinic

```typescript
// server/actions/invitations.ts
'use server';

export async function inviteExpertToClinic(params: {
  clinicOrgId: string;
  expertEmail: string;
  role: 'admin' | 'member';
}) {
  const session = await requireAuth();

  // Check permission
  await requirePermission('members:write');

  // Send invitation via WorkOS
  const invitation = await workos.userManagement.createInvitation({
    organizationId: params.clinicOrgId,
    email: params.expertEmail,
    roleSlug: params.role,
    expiresInDays: 7,
  });

  // Log invitation
  await logOrgEvent({
    action: 'membership.invited',
    orgId: params.clinicOrgId,
    actorId: session.userId,
    actorEmail: session.user.email,
    targetOrgName: params.expertEmail,
    changes: { role: params.role },
  });

  return invitation;
}
```

---

## Query Patterns

### Getting User's Organizations

```typescript
export async function getUserOrganizations(userId: string) {
  const db = await getOrgScopedDb();

  // Get all memberships
  const memberships = await db
    .select({
      org: OrganizationsTable,
      membership: UserOrgMembershipsTable,
    })
    .from(UserOrgMembershipsTable)
    .innerJoin(OrganizationsTable, eq(UserOrgMembershipsTable.orgId, OrganizationsTable.id))
    .where(
      and(
        eq(UserOrgMembershipsTable.workosUserId, userId),
        eq(UserOrgMembershipsTable.status, 'active'),
      ),
    );

  return memberships.map((m) => ({
    ...m.org,
    role: m.membership.role,
    joinedAt: m.membership.joinedAt,
  }));
}
```

### Switching Organization Context

```typescript
export async function switchOrganization(orgId: string) {
  const session = await requireAuth();

  // Verify membership
  const membership = await db
    .select()
    .from(UserOrgMembershipsTable)
    .where(
      and(
        eq(UserOrgMembershipsTable.orgId, orgId),
        eq(UserOrgMembershipsTable.workosUserId, session.userId),
        eq(UserOrgMembershipsTable.status, 'active'),
      ),
    )
    .limit(1);

  if (!membership.length) {
    throw new Error('Not a member of this organization');
  }

  // Update session
  await setSession({
    ...session,
    organizationId: orgId,
    role: membership[0].role,
  });
}
```

### Querying Within Organization

```typescript
export async function getOrganizationEvents(orgId: string) {
  const db = await getOrgScopedDb();

  // RLS automatically filters by user's memberships
  // Just query the org you want
  const events = await db
    .select()
    .from(EventsTable)
    .where(eq(EventsTable.orgId, orgId))
    .orderBy(EventsTable.createdAt);

  return events;
}
```

---

## Migration from Clerk

### Data Mapping

```typescript
// scripts/migration/create-organizations.ts
export async function migrateUsersToOrgs() {
  // For each user in legacy database
  for (const legacyUser of legacyUsers) {
    // 1. Determine org type
    const orgType = legacyUser.profileType === 'expert' ? 'expert_individual' : 'patient_personal';

    // 2. Create organization in WorkOS
    const workosOrg = await workos.organizations.createOrganization({
      name: `${legacyUser.email}'s ${orgType === 'expert_individual' ? 'Practice' : 'Account'}`,
    });

    // 3. Create membership
    await workos.userManagement.createOrganizationMembership({
      organizationId: workosOrg.id,
      userId: legacyUser.workosUserId, // From previous user migration
      roleSlug: 'owner',
    });

    // 4. Create org in new database
    const [newOrg] = await db
      .insert(OrganizationsTable)
      .values({
        workosOrgId: workosOrg.id,
        slug: generateSlug(legacyUser.email),
        name: workosOrg.name,
        type: orgType,
        features: getDefaultFeatures(orgType),
        subscriptionTier: 'free',
      })
      .returning();

    // 5. Create membership record
    await db.insert(UserOrgMembershipsTable).values({
      workosUserId: legacyUser.workosUserId,
      orgId: newOrg.id,
      workosOrgMembershipId: membership.id,
      role: 'owner',
      status: 'active',
    });

    // 6. Migrate org-scoped data
    await migrateUserData(legacyUser.id, newOrg.id);
  }
}
```

---

## B2B Expansion Path

### Phase 1: Current (Solo Users)

- Each user has their own org
- All features available to individuals
- No multi-member support

### Phase 2: Clinic Collaboration

- Expert can upgrade to clinic tier
- Invite other experts to organization
- Shared schedule visibility
- Team messaging

### Phase 3: Educational Institutions

- New org type: `educational_institution`
- Course management features
- Student enrollment
- Certification tracking

### Implementation Checklist

**Clinic Features (Phase 2):**

- [ ] Subscription tier upgrades
- [ ] Member invitation system
- [ ] Shared calendar view
- [ ] Team chat/messaging
- [ ] Multi-expert booking
- [ ] Revenue sharing
- [ ] Analytics dashboard

**Educational Features (Phase 3):**

- [ ] Course creation
- [ ] Student management
- [ ] Certification issuance
- [ ] Progress tracking
- [ ] Video content hosting
- [ ] Assessment tools

---

## Best Practices

### 1. Always Query with Org Context

```typescript
// ✅ Good - Explicit org filtering
const events = await db
  .select()
  .from(EventsTable)
  .where(eq(EventsTable.orgId, currentOrgId));

// ✅ Also good - Let RLS handle it
const events = await db.select().from(EventsTable);
// RLS filters automatically
```

### 2. Verify Membership Before Actions

```typescript
export async function hasOrgAccess(userId: string, orgId: string): Promise<boolean> {
  const membership = await db
    .select()
    .from(UserOrgMembershipsTable)
    .where(
      and(
        eq(UserOrgMembershipsTable.workosUserId, userId),
        eq(UserOrgMembershipsTable.orgId, orgId),
        eq(UserOrgMembershipsTable.status, 'active'),
      ),
    )
    .limit(1);

  return membership.length > 0;
}
```

### 3. Handle Organization Deletion Carefully

```typescript
export async function deleteOrganization(orgId: string) {
  const session = await requireAuth();

  // Verify ownership
  await requireOrgRole(orgId, 'owner');

  // Archive audit logs (HIPAA requirement)
  await archiveOrgAuditLogs(orgId);

  // Archive medical records
  await archiveMedicalRecords(orgId);

  // Delete org (cascades to related data)
  await db.delete(OrganizationsTable).where(eq(OrganizationsTable.id, orgId));

  // Delete from WorkOS
  await workos.organizations.deleteOrganization(org.workosOrgId);
}
```

---

## Resources

- [WorkOS Organizations](https://workos.com/docs/organizations)
- [Neon Auth + RLS](../03-infrastructure/neon-auth-rls.md)
- [WorkOS RBAC](https://workos.com/docs/rbac)
- [Multi-Tenancy Best Practices](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

---

**Questions?** Contact: architecture@eleva.care
