# Eleva Role Progression & Subscription System

**Version:** 1.0  
**Last Updated:** November 6, 2025  
**Status:** 🚀 Design Document - Ready for Implementation

---

## 📋 Executive Summary

Eleva's role-based progression system is inspired by Airbnb's successful multi-sided marketplace model, adapted for healthcare services. This document outlines a comprehensive framework combining **WorkOS RBAC**, **Stripe Subscriptions**, and a **progressive tier system** that encourages user growth and quality service delivery.

### Key Parallels with Airbnb

| **Airbnb**      | **Eleva**                  | **Purpose**                           |
| --------------- | -------------------------- | ------------------------------------- |
| Guest           | Patient/Client             | Entry point - consume services        |
| Host            | Community Expert           | Provide services after approval       |
| Superhost       | Top Expert                 | Premium tier with proven track record |
| Experiences     | eLearning (Future)         | Additional service offerings          |
| Airbnb for Work | Eleva for Clinics (Future) | B2B enterprise solution               |

---

## 🎯 Role Hierarchy

### 1. **Patient/Client** (Base Role)

_Like Airbnb Guest_

**Entry Point:** Every user who registers

**Capabilities:**

- Browse expert profiles
- Book appointments
- Leave reviews and ratings
- Access their appointment history
- Manage payment methods
- View receipts and invoices

**Navigation Access:**

```typescript
const PATIENT_NAVIGATION = [
  '/dashboard', // Overview of appointments
  '/booking', // Browse & book experts
  '/appointments', // Appointment history
  '/account', // Profile & settings
  '/account/billing', // Payment methods
  '/help', // Support center
];
```

**Stripe Subscription:** None (Free)

**WorkOS Role:** `patient`

---

### 2. **Community Expert** (Earned Role)

_Like Airbnb Host_

**Entry Point:** Application + Approval Process

**Requirements to Apply:**

- ✅ Valid professional credentials (uploaded & verified)
- ✅ Complete comprehensive profile
- ✅ Pass identity verification (Stripe Identity)
- ✅ Agree to Expert Terms & Conditions
- ✅ Complete onboarding checklist

**Application Flow:**

```
Patient Account → Apply to Become Expert → Submit Credentials →
Admin Review → Approval/Rejection → Setup Profile → Go Live
```

**New Capabilities (In Addition to Patient):**

- Create and manage services/events
- Set availability and schedule
- Receive bookings from patients
- Manage calendar integration (Google Calendar)
- Access expert dashboard with analytics
- Receive payouts via Stripe Connect
- Respond to patient reviews

**Navigation Access:**

```typescript
const COMMUNITY_EXPERT_NAVIGATION = [
  ...PATIENT_NAVIGATION, // Keeps patient features
  '/expert', // Expert overview dashboard
  '/expert/services', // Manage services offered
  '/expert/calendar', // Availability management
  '/expert/appointments', // Incoming bookings
  '/expert/earnings', // Revenue & payouts
  '/expert/reviews', // Rating management
  '/expert/profile', // Public profile customization
];
```

**Stripe Subscription:**

- **Tier:** Community Expert
- **Pricing Options:**
  - **Commission-Based:** $0/month + 20% commission per booking
  - **Annual Subscription:** $490/year + 12% commission per booking
- **Benefits:**
  - List up to 5 services
  - Basic analytics
  - Standard payout schedule (weekly)
  - Basic profile customization
  - Email support
  - 30-day free trial (commission-based)

**WorkOS Role:** `expert_community`

**Metadata Tracked:**

```typescript
{
  expertStatus: 'community',
  approvalDate: Date,
  totalBookings: number,
  averageRating: number,
  totalEarnings: number,
  complianceScore: number,
}
```

---

### 3. **Top Expert** (Achievement-Based)

_Like Airbnb Superhost_

**Entry Point:** Earned through performance metrics

**Requirements (Evaluated Every 3 Months):**

- ⭐ Minimum 4.8/5.0 average rating
- 📅 Minimum 25 completed appointments in last 90 days
- 💯 < 5% cancellation rate
- 📊 90%+ response rate within 24 hours
- ✨ Promoted profile link (custom vanity URL)
- 🎖️ At least 3 months as Community Expert
- 📈 Consistent availability (active 80%+ of days)

**Evaluation Schedule:**

- **Quarterly Review:** Automated system check
- **Grace Period:** 1-month warning before demotion
- **Re-qualification:** Must meet criteria again to regain status

**Additional Capabilities:**

- **Top Expert Badge** on profile
- Priority placement in search results
- Featured on homepage
- Access to premium analytics
- Early access to new features
- Custom branding options
- Direct patient messaging
- Group sessions capability
- Priority support

**Navigation Access:**

```typescript
const TOP_EXPERT_NAVIGATION = [
  ...COMMUNITY_EXPERT_NAVIGATION,
  '/expert/top', // Top Expert dashboard
  '/expert/analytics', // Advanced analytics
  '/expert/branding', // Custom branding
  '/expert/messaging', // Direct messaging
  '/expert/promotions', // Marketing tools
  '/expert/group-sessions', // Group offering management
];
```

**Stripe Subscription:**

- **Tier:** Top Expert
- **Pricing Options:**
  - **Commission-Based:** $0/month + 15% commission per booking
  - **Annual Subscription:** $1,490/year + 8% commission per booking
- **Benefits:**
  - Unlimited services
  - Advanced analytics & insights
  - Priority payouts (daily available)
  - Premium profile customization
  - Featured placement
  - Priority phone support
  - Marketing tools & promotional credits
  - Industry-leading low commission rates
  - VIP annual subscriber benefits

**WorkOS Role:** `expert_top`

**Metadata Tracked:**

```typescript
{
  expertStatus: 'top',
  topExpertSince: Date,
  lastEvaluationDate: Date,
  nextEvaluationDate: Date,
  qualificationHistory: Array<{
    quarter: string,
    qualified: boolean,
    metrics: {
      rating: number,
      completedBookings: number,
      cancellationRate: number,
      responseRate: number,
    }
  }>,
  badgeAwarded: boolean,
}
```

---

### 4. **Lecturer** (Future - Phase 2)

_Like Airbnb Experiences_

**Entry Point:** Any Expert can apply

**Requirements:**

- ✅ Active Community or Top Expert
- ✅ Course curriculum approval
- ✅ Video content quality review
- ✅ Minimum 4.5/5.0 teaching rating

**New Capabilities:**

- Create and publish courses
- Host live webinars
- Manage student enrollments
- Access LMS (Learning Management System)
- Earn from course sales
- Track student progress

**Navigation Access:**

```typescript
const LECTURER_NAVIGATION = [
  ...(COMMUNITY_EXPERT_NAVIGATION || TOP_EXPERT_NAVIGATION),
  '/lecturer/courses', // Course management
  '/lecturer/students', // Student roster
  '/lecturer/live-sessions', // Webinar scheduling
  '/lecturer/content', // Upload learning materials
  '/lecturer/earnings', // Course revenue
];
```

**Stripe Subscription:**

- **Add-on:** eLearning Module
  - **Commission-Based:** +5% on course sales
  - **Annual Subscription:** +$490/year + 3% on course sales

**WorkOS Role:** `expert_lecturer`

---

### 5. **Enterprise/Clinic** (Future - Phase 3)

_Like Airbnb for Work_

**Entry Point:** B2B Onboarding

**Requirements:**

- ✅ Business verification
- ✅ Minimum 5 selected experts
- ✅ Custom branding requirements
- ✅ Enterprise contract

**Capabilities:**

- Custom subdomain (e.g., `clinic-name.eleva.care`)
- White-label branding
- Curated expert roster
- Team management
- Bulk appointment scheduling
- Advanced reporting
- API access
- SSO integration (WorkOS)

**Navigation Access:**

```typescript
const ENTERPRISE_NAVIGATION = [
  '/enterprise', // Enterprise dashboard
  '/enterprise/experts', // Manage expert roster
  '/enterprise/team', // Team member management
  '/enterprise/branding', // Custom branding
  '/enterprise/bookings', // Appointment overview
  '/enterprise/analytics', // Business intelligence
  '/enterprise/api', // API management
  '/enterprise/billing', // Enterprise billing
];
```

**Stripe Subscription:**

- **Tier:** Enterprise (Custom pricing)
- **Benefits:** Everything + API access, dedicated support, SLA

**WorkOS Organization:** Yes (Multi-tenant with roles)

---

## 🔐 WorkOS RBAC Implementation

### Role Definitions

```typescript
// drizzle/schema-workos.ts

export type UserRole =
  | 'patient' // Base user
  | 'expert_community' // Approved community expert
  | 'expert_top' // Achievement-based top expert
  | 'expert_lecturer' // Expert with teaching capability
  | 'enterprise_admin' // B2B clinic administrator
  | 'enterprise_member' // B2B clinic staff
  | 'admin' // Platform administrator
  | 'moderator'; // Content moderation

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  patient: 0,
  expert_community: 1,
  expert_top: 2,
  expert_lecturer: 2,
  enterprise_member: 3,
  enterprise_admin: 4,
  moderator: 5,
  admin: 10,
};

export const EXPERT_ROLES = ['expert_community', 'expert_top', 'expert_lecturer'] as const;

export const ENTERPRISE_ROLES = ['enterprise_admin', 'enterprise_member'] as const;
```

### Permission System

```typescript
// lib/auth/permissions.ts

export const PERMISSIONS = {
  // Patient permissions
  'bookings.create': ['patient', 'expert_community', 'expert_top'],
  'bookings.view_own': ['patient', 'expert_community', 'expert_top'],
  'reviews.create': ['patient'],

  // Expert permissions
  'services.create': ['expert_community', 'expert_top'],
  'services.manage': ['expert_community', 'expert_top'],
  'calendar.manage': ['expert_community', 'expert_top'],
  'bookings.view_incoming': ['expert_community', 'expert_top'],
  'earnings.view': ['expert_community', 'expert_top'],

  // Top Expert exclusive
  'analytics.advanced': ['expert_top'],
  'branding.customize': ['expert_top'],
  'group_sessions.create': ['expert_top'],
  'messaging.direct': ['expert_top'],

  // Lecturer permissions
  'courses.create': ['expert_lecturer'],
  'courses.manage': ['expert_lecturer'],
  'students.manage': ['expert_lecturer'],
  'webinars.host': ['expert_lecturer'],

  // Enterprise permissions
  'organization.manage': ['enterprise_admin'],
  'team.manage': ['enterprise_admin'],
  'api.access': ['enterprise_admin'],

  // Admin permissions
  'users.manage': ['admin'],
  'experts.approve': ['admin', 'moderator'],
  'platform.configure': ['admin'],
} as const;

export async function checkPermission(
  permission: keyof typeof PERMISSIONS,
  userRole: UserRole,
): Promise<boolean> {
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles.includes(userRole);
}
```

### Middleware Integration

```typescript
// lib/auth/rbac-middleware.ts
import { checkPermission } from '@/lib/auth/permissions';
import { getUserApplicationRole } from '@/lib/integrations/workos/roles';
import { withAuth } from '@workos-inc/authkit-nextjs';

export async function requireRole(allowedRoles: UserRole[]) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const userRole = await getUserApplicationRole(user.id);

  if (!allowedRoles.includes(userRole as UserRole)) {
    throw new Error('Insufficient permissions');
  }

  return { user, role: userRole };
}

export async function requirePermission(permission: keyof typeof PERMISSIONS) {
  const { user } = await withAuth({ ensureSignedIn: true });
  const userRole = await getUserApplicationRole(user.id);

  const hasPermission = await checkPermission(permission, userRole as UserRole);

  if (!hasPermission) {
    throw new Error(`Missing permission: ${permission}`);
  }

  return { user, role: userRole };
}
```

---

## 💳 Stripe Subscription Integration

### Subscription Products

```typescript
// config/stripe-subscriptions.ts

export const STRIPE_PLANS = {
  patient: {
    priceId: null, // Free
    amount: 0,
    features: ['Browse experts', 'Book appointments', 'Leave reviews', 'Basic support'],
  },

  community_expert_commission: {
    priceId: null, // Commission-based (no Stripe subscription)
    amount: 0,
    commissionRate: 0.2, // 20%
    features: [
      'List up to 5 services',
      'Basic analytics',
      'Weekly payouts',
      'Email support',
      'Pay only 20% commission',
      'No monthly fees',
    ],
    trialDays: 30,
  },

  community_expert_annual: {
    priceId: 'price_community_annual',
    amount: 49000, // $490/year
    commissionRate: 0.12, // 12%
    features: [
      'List up to 5 services',
      'Basic analytics',
      'Weekly payouts',
      'Email support',
      'Reduced 12% commission (was 20%)',
      'Save up to 40% on costs',
      'Predictable annual fee',
    ],
    commitmentMonths: 12,
  },

  top_expert_commission: {
    priceId: null, // Commission-based (no Stripe subscription)
    amount: 0,
    commissionRate: 0.15, // 15%
    features: [
      'All Community Expert features',
      'Unlimited services',
      'Advanced analytics',
      'Daily payouts',
      'Priority support',
      'Top Expert badge',
      'Featured placement',
      'Pay only 15% commission',
      'No monthly fees',
    ],
  },

  top_expert_annual: {
    priceId: 'price_top_annual',
    amount: 149000, // $1,490/year
    commissionRate: 0.08, // 8%
    features: [
      'All Top Expert features',
      'Unlimited services',
      'Advanced analytics',
      'Daily payouts',
      'Priority support',
      'Top Expert badge',
      'Featured placement',
      'Industry-leading 8% commission (was 15%)',
      'Save up to 40% on costs',
      'VIP annual benefits',
    ],
    commitmentMonths: 12,
  },

  lecturer_addon_commission: {
    priceId: null,
    amount: 0,
    commissionRate: 0.05, // 5% on course sales
    features: ['Create & sell courses', 'Host webinars', 'LMS access', 'Pay 5% on course sales'],
  },

  lecturer_addon_annual: {
    priceId: 'price_lecturer_addon_annual',
    amount: 49000, // $490/year
    commissionRate: 0.03, // 3% on course sales
    features: [
      'Create & sell courses',
      'Host webinars',
      'LMS access',
      'Reduced 3% on course sales (was 5%)',
    ],
  },

  enterprise: {
    priceId: 'price_enterprise_custom',
    amount: null, // Custom
    features: [
      'Custom subdomain',
      'White-label branding',
      'Team management',
      'API access',
      'SSO',
      'Dedicated support',
      'SLA',
    ],
  },
} as const;
```

### Subscription Management

```typescript
// server/actions/subscriptions.ts

'use server';

import { db } from '@/drizzle/db';
import { UsersTable } from '@/drizzle/schema-workos';
import { stripe } from '@/lib/integrations/stripe';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { eq } from 'drizzle-orm';

// server/actions/subscriptions.ts

// server/actions/subscriptions.ts

// server/actions/subscriptions.ts

// server/actions/subscriptions.ts

// server/actions/subscriptions.ts

// server/actions/subscriptions.ts

export async function upgradeToExpert(plan: 'community' | 'top') {
  const { user } = await withAuth({ ensureSignedIn: true });

  // Check if user has completed expert application
  const expertApplication = await db.query.ExpertApplicationsTable.findFirst({
    where: eq(ExpertApplicationsTable.workosUserId, user.id),
  });

  if (!expertApplication || expertApplication.status !== 'approved') {
    return { error: 'Expert application not approved' };
  }

  // Get Stripe customer
  const dbUser = await db.query.UsersTable.findFirst({
    where: eq(UsersTable.workosUserId, user.id),
  });

  if (!dbUser?.stripeCustomerId) {
    return { error: 'Stripe customer not found' };
  }

  // Create subscription
  const priceId =
    plan === 'community' ? STRIPE_PLANS.community_expert.priceId : STRIPE_PLANS.top_expert.priceId;

  const subscription = await stripe.subscriptions.create({
    customer: dbUser.stripeCustomerId,
    items: [{ price: priceId }],
    trial_period_days: plan === 'community' ? 30 : undefined,
    metadata: {
      workosUserId: user.id,
      plan: plan,
    },
  });

  // Update user role
  await db
    .update(UsersTable)
    .set({
      role: plan === 'community' ? 'expert_community' : 'expert_top',
      stripeSubscriptionId: subscription.id,
    })
    .where(eq(UsersTable.workosUserId, user.id));

  return { success: true, subscriptionId: subscription.id };
}

export async function evaluateTopExpertStatus(workosUserId: string) {
  // Fetch expert metrics
  const metrics = await db.query.ExpertMetricsTable.findFirst({
    where: eq(ExpertMetricsTable.workosUserId, workosUserId),
  });

  if (!metrics) {
    return { qualified: false, reason: 'No metrics found' };
  }

  // Check qualification criteria
  const qualified =
    metrics.averageRating >= 4.8 &&
    metrics.completedBookingsLast90Days >= 25 &&
    metrics.cancellationRate < 0.05 &&
    metrics.responseRate >= 0.9 &&
    metrics.daysAsExpert >= 90;

  return {
    qualified,
    metrics: {
      rating: metrics.averageRating,
      bookings: metrics.completedBookingsLast90Days,
      cancellationRate: metrics.cancellationRate,
      responseRate: metrics.responseRate,
    },
  };
}
```

---

## 🎨 Dynamic Sidebar Navigation

### Sidebar Component Structure

```typescript
// components/layout/sidebar/DynamicNavigation.tsx

'use client';

import { useAuth } from '@/hooks/use-auth-role';
import { NAVIGATION_CONFIG } from '@/config/navigation';
import { NavItem } from './NavItem';

export function DynamicNavigation() {
  const { role, loading, permissions } = useAuth();

  if (loading) {
    return <NavigationSkeleton />;
  }

  // Filter navigation items based on role and permissions
  const visibleItems = NAVIGATION_CONFIG.filter(item => {
    // Check role requirement
    if (item.requiredRole && !item.requiredRole.includes(role)) {
      return false;
    }

    // Check permission requirement
    if (item.requiredPermission && !permissions.includes(item.requiredPermission)) {
      return false;
    }

    return true;
  });

  return (
    <nav>
      {visibleItems.map(item => (
        <NavItem key={item.path} {...item} />
      ))}
    </nav>
  );
}
```

### Navigation Configuration

```typescript
// config/navigation.ts
import { UserRole } from '@/drizzle/schema-workos';
import {
  AcademicCapIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  ChartBarIcon,
  CreditCardIcon,
  HomeIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

export interface NavigationItem {
  label: string;
  path: string;
  icon: React.ComponentType;
  requiredRole?: UserRole[];
  requiredPermission?: string;
  badge?: () => Promise<number>; // Dynamic badge count
  children?: NavigationItem[];
}

export const NAVIGATION_CONFIG: NavigationItem[] = [
  // Common for all users
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: HomeIcon,
  },

  // Patient-specific
  {
    label: 'Book Appointment',
    path: '/booking',
    icon: CalendarIcon,
    requiredRole: ['patient'],
  },

  // Expert section
  {
    label: 'Expert Dashboard',
    path: '/expert',
    icon: ChartBarIcon,
    requiredRole: ['expert_community', 'expert_top'],
    children: [
      {
        label: 'Services',
        path: '/expert/services',
        icon: CalendarIcon,
      },
      {
        label: 'Calendar',
        path: '/expert/calendar',
        icon: CalendarIcon,
      },
      {
        label: 'Earnings',
        path: '/expert/earnings',
        icon: CreditCardIcon,
        badge: async () => {
          // Fetch pending payout count
          return 3;
        },
      },
    ],
  },

  // Top Expert exclusive
  {
    label: 'Advanced Analytics',
    path: '/expert/analytics',
    icon: ChartBarIcon,
    requiredRole: ['expert_top'],
  },

  // Lecturer section
  {
    label: 'Teaching',
    path: '/lecturer',
    icon: AcademicCapIcon,
    requiredRole: ['expert_lecturer'],
    children: [
      {
        label: 'Courses',
        path: '/lecturer/courses',
        icon: AcademicCapIcon,
      },
      {
        label: 'Students',
        path: '/lecturer/students',
        icon: UserIcon,
      },
    ],
  },

  // Enterprise section
  {
    label: 'Enterprise',
    path: '/enterprise',
    icon: BuildingOfficeIcon,
    requiredRole: ['enterprise_admin'],
  },

  // Account (all users)
  {
    label: 'Account',
    path: '/account',
    icon: UserIcon,
  },
];
```

---

## 📊 Metrics & Evaluation System

### Expert Metrics Tracking

```typescript
// drizzle/schema-workos.ts

export const ExpertMetricsTable = pgTable('expert_metrics', {
  id: varchar('id', { length: 255 })
    .primaryKey()
    .$defaultFn(() => createId()),
  workosUserId: varchar('workos_user_id', { length: 255 }).notNull(),

  // Rating metrics
  averageRating: numeric('average_rating', { precision: 3, scale: 2 }).default('0'),
  totalReviews: integer('total_reviews').default(0),

  // Booking metrics
  totalBookings: integer('total_bookings').default(0),
  completedBookingsLast90Days: integer('completed_bookings_last_90_days').default(0),
  canceledBookings: integer('canceled_bookings').default(0),
  cancellationRate: numeric('cancellation_rate', { precision: 4, scale: 3 }).default('0'),

  // Response metrics
  averageResponseTime: integer('average_response_time').default(0), // in minutes
  responseRate: numeric('response_rate', { precision: 4, scale: 3 }).default('0'),

  // Activity metrics
  daysAsExpert: integer('days_as_expert').default(0),
  activeDaysLast90Days: integer('active_days_last_90_days').default(0),

  // Earnings
  totalEarnings: integer('total_earnings').default(0), // in cents
  earningsLast90Days: integer('earnings_last_90_days').default(0),

  // Top Expert qualification
  isTopExpertQualified: boolean('is_top_expert_qualified').default(false),
  lastEvaluationDate: timestamp('last_evaluation_date'),
  nextEvaluationDate: timestamp('next_evaluation_date'),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

### Automated Evaluation Cron Job

```typescript
// app/api/cron/evaluate-top-experts/route.ts
import { db } from '@/drizzle/db';
import { ExpertMetricsTable, UsersTable } from '@/drizzle/schema-workos';
import { sendTopExpertNotification } from '@/lib/integrations/novu/notifications';
import { evaluateTopExpertStatus } from '@/server/actions/subscriptions';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Verify cron authentication
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all community experts due for evaluation
    const expertsToEvaluate = await db.query.UsersTable.findMany({
      where: eq(UsersTable.role, 'expert_community'),
    });

    const results = [];

    for (const expert of expertsToEvaluate) {
      const evaluation = await evaluateTopExpertStatus(expert.workosUserId);

      if (evaluation.qualified) {
        // Update to Top Expert
        await db
          .update(UsersTable)
          .set({
            role: 'expert_top',
            updatedAt: new Date(),
          })
          .where(eq(UsersTable.workosUserId, expert.workosUserId));

        // Send notification
        await sendTopExpertNotification({
          userId: expert.workosUserId,
          type: 'qualified',
        });

        results.push({ expertId: expert.id, status: 'upgraded' });
      } else {
        results.push({ expertId: expert.id, status: 'not_qualified' });
      }
    }

    return NextResponse.json({
      success: true,
      evaluatedCount: expertsToEvaluate.length,
      results,
    });
  } catch (error) {
    console.error('Top Expert evaluation failed:', error);
    return NextResponse.json({ error: 'Evaluation failed' }, { status: 500 });
  }
}
```

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Current - Week 1-2)

- ✅ WorkOS RBAC with basic roles (patient, expert_community, expert_top)
- ✅ Dynamic sidebar navigation
- ✅ Permission system implementation
- 🔄 Stripe subscription integration
- 🔄 Expert application flow

### Phase 2: Metrics & Progression (Week 3-4)

- 📅 Expert metrics tracking system
- 📅 Automated Top Expert evaluation
- 📅 Badge system
- 📅 Notification system for status changes

### Phase 3: eLearning Module (Month 2-3)

- 📅 Lecturer role implementation
- 📅 Course management system (LMS)
- 📅 Video hosting integration
- 📅 Student enrollment & progress tracking

### Phase 4: Enterprise (Month 4-6)

- 📅 Multi-tenancy with subdomains
- 📅 White-label branding
- 📅 Team management
- 📅 API development
- 📅 SSO integration

---

## 📚 References

### Airbnb Model Research

- [Airbnb Superhost Program](https://www.airbnb.com/help/article/828)
- [Airbnb Host Progression](https://news.airbnb.com/superhost-benefits/)

### Technical Documentation

- [WorkOS AuthKit RBAC](https://workos.com/docs/authkit/roles-and-permissions)
- [Stripe Subscriptions](https://stripe.com/docs/billing/subscriptions/overview)
- [Next.js 16 App Router](https://nextjs.org/docs)

### Best Practices

- [SaaS Tier Progression](https://www.lennysnewsletter.com/p/how-to-design-a-pricing-page)
- [Multi-sided Marketplace Design](https://a16z.com/marketplace-100/)

---

## 🎯 Success Metrics

### User Progression

- **Patient → Expert Application Rate:** Target 15%
- **Community → Top Expert Conversion:** Target 20%
- **Expert Retention (12 months):** Target 85%

### Quality Metrics

- **Average Expert Rating:** Target > 4.5/5.0
- **Booking Completion Rate:** Target > 92%
- **Response Time:** Target < 2 hours

### Revenue Metrics

- **Subscription MRR Growth:** Target 15% MoM
- **Average Revenue Per Expert:** Target $150/month
- **Churn Rate:** Target < 5%

---

## 👥 Team Responsibilities

- **Backend:** Subscription webhooks, metrics calculation, cron jobs
- **Frontend:** Dynamic navigation, role-based UI, subscription management
- **Design:** Badge system, tier visualization, upgrade flows
- **Product:** Evaluation criteria refinement, pricing optimization
- **Support:** Expert onboarding, tier migration support

---

**Next Steps:**

1. Review and approve this design document
2. Create implementation tickets in project management tool
3. Begin Phase 1 development
4. Set up analytics tracking for progression metrics

---

_Document maintained by the Eleva development team. For questions, contact the tech lead._
