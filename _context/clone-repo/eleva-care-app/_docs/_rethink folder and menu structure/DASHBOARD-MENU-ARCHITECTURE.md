# Dashboard Menu Architecture

**Version:** 2.0  
**Date:** November 12, 2025  
**Status:** 🎨 Design Proposal

---

## Executive Summary

This document defines a scalable, role-aware dashboard navigation structure that supports:

- ✅ Solo practitioners (Phase 1 - Current)
- 🔮 Multi-expert partners (Phase 2 - Future)
- 🔮 eLearning/LMS platform (Phase 3 - Future)
- 🔮 B2B partner management (Phase 3 - Future)

**Design Principles:**

1. **Progressive Disclosure**: Show relevant features based on role and plan
2. **Consistent Patterns**: Similar features grouped logically
3. **Scalable Structure**: Easy to add new features without reorganization
4. **Role-Aware**: Different menus for Experts, Admins, Patients, Partner Managers
5. **Industry Standards**: Inspired by Cal.com, Dub, Vercel, WorkOS dashboards

---

## Navigation Hierarchy

### 🏠 Core Navigation (All Roles)

```
app/
├── (private)/
│   ├── home/                    # Dynamic home based on role
│   ├── calendar/                # Unified calendar view
│   └── notifications/           # Bell icon - notification center
```

---

## 👨‍💼 Patient Portal (Patients Only) 🆕

### Primary Navigation

```
1. 📊 Overview
   └── /patient/dashboard
       ├── Upcoming Appointments
       ├── Recent Session Summaries
       ├── Pending Reviews
       └── Quick Actions

2. 📅 My Appointments
   └── /patient/appointments
       ├── /patient/appointments/upcoming       # Default view
       ├── /patient/appointments/past
       ├── /patient/appointments/calendar       # Calendar view
       └── /patient/appointments/[id]           # Appointment details
           ├── Session summary/notes
           ├── Reschedule/Cancel
           ├── Join video call
           └── Leave review (after session) 🆕

3. 📝 Session Notes
   └── /patient/sessions
       ├── /patient/sessions                    # All sessions
       └── /patient/sessions/[id]               # Session details
           ├── Expert notes (shared)
           ├─ Recommendations
           └── Related resources

4. ⭐ My Reviews
   └── /patient/reviews
       ├── /patient/reviews                     # All my reviews
       ├── /patient/reviews/pending             # Pending reviews
       └── /patient/reviews/[id]                # Edit review

5. 👥 My Experts
   └── /patient/experts
       ├── /patient/experts                     # Experts I've worked with
       └── /patient/experts/[username]          # Expert profile + review

6. 💳 Billing
   └── /patient/billing
       ├── /patient/billing/payments            # Payment history
       ├── /patient/billing/invoices            # Invoices
       └── /patient/billing/methods             # Payment methods

7. 👤 Profile
   └── /patient/profile
       ├── Personal information
       ├── Health information (optional)
       ├── Emergency contact
       └── Privacy settings
```

### Secondary Navigation

```
8. ⚙️ Settings
   └── /patient/settings
       ├── /patient/settings/account            # Personal info
       ├── /patient/settings/notifications      # Notification preferences
       ├── /patient/settings/privacy            # Privacy settings
       └── /patient/settings/security           # Security settings
```

---

## 👨‍⚕️ Expert Dashboard (Experts Only)

### Primary Navigation

```
1. 📊 Overview
   └── /dashboard
       ├── Quick Stats (Today's appointments, Revenue, Patients)
       ├── Upcoming Appointments
       ├── Recent Activity
       └── Action Items

2. 📅 Appointments
   └── /appointments
       ├── /appointments/upcoming       # Default view (list)
       ├── /appointments/past
       ├── /appointments/calendar       # Week/Month view (built-in calendar)
       │   ├── Day view
       │   ├── Week view
       │   ├── Month view
       │   └── Filter by schedule/location
       └── /appointments/patients
           ├── /appointments/patients       # Patient list
           └── /appointments/patients/[id] # Patient details + history

3. 🗓️ Availability
   └── /availability
       ├── /availability/schedules      # Multiple calendars (like Cal.com)
       │   ├── /availability/schedules                    # All schedules list
       │   ├── /availability/schedules/new                # Create new schedule
       │   └── /availability/schedules/[id]              # Edit schedule
       │       ├── Weekly hours
       │       ├── Date overrides & time off
       │       ├── Timezone
       │       └── Default status
       ├── /availability/limits         # Buffer, max bookings
       └── /availability/calendars      # Calendar integrations
           ├── /availability/calendars                    # Connected calendars
           ├── /availability/calendars/connect           # Connect new provider
           └── /availability/calendars/[id]/settings     # Calendar settings

4. 🔗 Event Types
   └── /events
       ├── /events                      # All event types
       ├── /events/new                  # Create new
       └── /events/[slug]
           ├── /events/[slug]/edit      # Edit event
           │   ├── Basic info
           │   ├── Location (Remote, In-person, Phone, etc.)
           │   ├── Schedule assignment (which calendar to use)
           │   ├── Calendar destination (where to save bookings)
           │   └── Availability rules
           └── /events/[slug]/bookings  # Bookings for this event

5. 📈 Analytics
   └── /analytics
       ├── /analytics/overview          # KPIs, Charts
       ├── /analytics/revenue           # Financial analytics
       ├── /analytics/patients          # Patient insights
       └── /analytics/performance       # Booking trends, conversion

6. 👤 Public Profile
   └── /profile
       ├── /profile/expert              # Public expert profile settings
       ├── /profile/preview             # Preview how patients see you
       └── /profile/link                # Your booking link

7. 💳 Billing
   └── /billing
       ├── /billing/subscription        # Current plan
       ├── /billing/payments            # Payment history
       ├── /billing/payouts             # Your earnings & payouts
       └── /billing/invoices            # Generated invoices
```

### Secondary Navigation

```
8. ⚙️ Settings
   └── /settings
       ├── /settings/account            # Personal info, password
       ├── /settings/notifications      # Email, SMS preferences
       ├── /settings/integrations       # Calendar sync, Zoom, etc.
       └── /settings/security           # 2FA, sessions

9. 📚 Resources (Conditional: Top Tier)
   └── /resources
       ├── /resources/library           # Future: LMS content
       ├── /resources/templates         # Future: Session templates
       └── /resources/guides            # Help articles
```

---

## 🏥 Partner Dashboard (Partner Admins Only)

**Note:** This appears when user is part of a partner organization (Phase 2)

### Primary Navigation

```
1. 📊 Partner Overview
   └── /partner
       ├── Key Metrics (All practitioners)
       ├── Today's Schedule
       ├── Revenue Summary
       └── Quick Actions

2. 👥 Team
   └── /partner/team
       ├── /partner/team/members         # All practitioners
       ├── /partner/team/invite          # Invite new members
       ├── /partner/team/roles           # Role management
       └── /partner/team/[memberId]      # Member details & analytics

3. 📅 Partner Schedule
   └── /partner/schedule
       ├── /partner/schedule/calendar    # Multi-practitioner calendar
       ├── /partner/schedule/rooms       # Room management (future)
       └── /partner/schedule/capacity    # Capacity planning

4. 👨‍👩‍👧‍👦 Patients
   └── /partner/patients
       ├── /partner/patients             # All partner patients
       ├── /partner/patients/[id]        # Patient records
       └── /partner/patients/insights    # Patient analytics

5. 📊 Partner Analytics
   └── /partner/analytics
       ├── /partner/analytics/revenue    # Partner-wide revenue
       ├── /partner/analytics/performance # Practitioner performance
       ├── /partner/analytics/patients   # Patient insights
       └── /partner/analytics/reports    # Custom reports

6. 💼 Partner Settings
   └── /partner/settings
       ├── /partner/settings/organization # Partner info
       ├── /partner/settings/branding     # Logo, colors
       ├── /partner/settings/billing      # Partner subscription
       └── /partner/settings/integrations # Partner-wide integrations

7. 💳 Revenue & Payouts
   └── /partner/revenue
       ├── /partner/revenue/overview     # Total revenue
       ├── /partner/revenue/splits       # Commission splits
       ├── /partner/revenue/payouts      # Payout management
       └── /partner/revenue/invoices     # Client invoices
```

---

## 🎓 Learning Platform (Future Phase 3)

**Note:** Appears based on feature flags or subscription tier

### Expert View (Content Creators)

```
1. 📚 My Courses
   └── /learn/courses
       ├── /learn/courses               # My courses
       ├── /learn/courses/new           # Create course
       └── /learn/courses/[id]
           ├── /learn/courses/[id]/edit      # Edit course
           ├── /learn/courses/[id]/students  # Enrolled students
           └── /learn/courses/[id]/analytics # Course analytics

2. 📝 Content Library
   └── /learn/content
       ├── /learn/content/videos        # Video library
       ├── /learn/content/documents     # Documents/PDFs
       ├── /learn/content/quizzes       # Assessments
       └── /learn/content/templates     # Course templates

3. 👨‍🎓 Students
   └── /learn/students
       ├── /learn/students              # All students
       ├── /learn/students/[id]         # Student progress
       └── /learn/students/certificates # Issue certificates
```

### Patient/Student View (Learners)

```
1. 🎓 My Learning
   └── /learning
       ├── /learning/dashboard          # Learning dashboard
       ├── /learning/courses            # Enrolled courses
       ├── /learning/progress           # Progress tracking
       └── /learning/certificates       # My certificates

2. 📚 Course Library
   └── /learning/browse
       ├── /learning/browse             # Browse all courses
       ├── /learning/browse/[id]        # Course details
       └── /learning/browse/search      # Search courses
```

---

## 🛠️ Admin Dashboard (Platform Admins Only)

**Note:** Super admin features for platform management

### Primary Navigation

```
1. 🏢 Platform Overview
   └── /admin
       ├── Platform Stats
       ├── Recent Activity
       ├── System Health
       └── Quick Actions

2. 👥 Users
   └── /admin/users
       ├── /admin/users                 # All users
       ├── /admin/users/experts         # Expert users
       ├── /admin/users/patients        # Patient users
       └── /admin/users/[id]            # User management

3. 🏥 Organizations
   └── /admin/organizations
       ├── /admin/organizations         # All organizations
       ├── /admin/organizations/partners # Partner organizations
       └── /admin/organizations/[id]    # Org details

4. 📊 Platform Analytics
   └── /admin/analytics
       ├── /admin/analytics/users       # User growth
       ├── /admin/analytics/revenue     # Platform revenue
       ├── /admin/analytics/engagement  # Usage metrics
       └── /admin/analytics/churn       # Retention analytics

5. 💳 Payments
   └── /admin/payments
       ├── /admin/payments/transactions # All transactions
       ├── /admin/payments/transfers    # Payout transfers
       ├── /admin/payments/disputes     # Payment disputes
       └── /admin/payments/refunds      # Refund management

6. 🏷️ Categories
   └── /admin/categories
       ├── /admin/categories            # Manage categories
       └── /admin/categories/tags       # Tag management

7. ⚙️ Platform Settings
   └── /admin/settings
       ├── /admin/settings/general      # Platform config
       ├── /admin/settings/features     # Feature flags
       ├── /admin/settings/integrations # API keys, webhooks
       └── /admin/settings/security     # Security settings
```

---

## 🎨 Sidebar Component Structure

### Recommended Layout Pattern

```typescript
// components/layout/sidebar/AppSidebar.tsx
<Sidebar>
  <SidebarHeader>
    {/* Logo + Org Switcher (if applicable) */}
  </SidebarHeader>

  <SidebarContent>
    {/* Primary Navigation */}
    <SidebarGroup>
      <NavMain items={primaryNavItems} />
    </SidebarGroup>

    {/* Conditional: Partner Section (if partner member) */}
    {isClinicMember && (
      <SidebarGroup>
        <SidebarGroupLabel>Partner</SidebarGroupLabel>
        <NavMain items={clinicNavItems} />
      </SidebarGroup>
    )}

    {/* Conditional: Learning Section (if enabled) */}
    {learningEnabled && (
      <SidebarGroup>
        <SidebarGroupLabel>Learning</SidebarGroupLabel>
        <NavMain items={learningNavItems} />
      </SidebarGroup>
    )}

    {/* Secondary Navigation */}
    <SidebarGroup className="mt-auto">
      <NavSecondary items={secondaryNavItems} />
    </SidebarGroup>
  </SidebarContent>

  <SidebarFooter>
    <NavUser />
  </SidebarFooter>
</Sidebar>
```

---

## 📁 Recommended Folder Structure

```
app/
├── (private)/
│   ├── layout.tsx                      # Auth + Sidebar wrapper (role-based redirect)
│   │
│   ├── dashboard/                      # Expert Home/Overview
│   │   └── page.tsx
│   │
│   ├── patient/                        # 🆕 Patient Portal
│   │   ├── layout.tsx                 # Patient auth check
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Patient overview
│   │   ├── appointments/
│   │   │   ├── page.tsx              # Upcoming/Past appointments
│   │   │   ├── calendar/
│   │   │   │   └── page.tsx          # Calendar view
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Appointment details
│   │   │       └── review/
│   │   │           └── page.tsx      # Leave review
│   │   ├── sessions/
│   │   │   ├── page.tsx              # All sessions
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Session details & notes
│   │   ├── reviews/
│   │   │   ├── page.tsx              # All reviews
│   │   │   ├── pending/
│   │   │   │   └── page.tsx          # Pending reviews
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Edit review
│   │   ├── experts/
│   │   │   ├── page.tsx              # My experts
│   │   │   └── [username]/
│   │   │       └── page.tsx          # Expert profile
│   │   ├── billing/
│   │   │   ├── payments/
│   │   │   ├── invoices/
│   │   │   └── methods/
│   │   ├── profile/
│   │   │   └── page.tsx              # Patient profile
│   │   └── settings/
│   │       ├── account/
│   │       ├── notifications/
│   │       ├── privacy/
│   │       └── security/
│   │
│   ├── appointments/                   # Appointment management
│   │   ├── page.tsx                   # List view (upcoming/past tabs)
│   │   ├── calendar/                  # 🆕 Built-in calendar view
│   │   │   └── page.tsx              # Day/Week/Month views
│   │   │       ├── Day view
│   │   │       ├── Week view
│   │   │       ├── Month view
│   │   │       └── Filter by schedule/location
│   │   └── patients/
│   │       ├── page.tsx
│   │       ├── [id]/
│   │       │   └── page.tsx
│   │       └── layout.tsx
│   │
│   ├── availability/                   # Advanced schedule management
│   │   ├── schedules/                 # 🆕 Multiple schedules (like Cal.com)
│   │   │   ├── page.tsx              # List all schedules
│   │   │   ├── new/
│   │   │   │   └── page.tsx          # Create new schedule
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Edit schedule
│   │   │       ├── hours/            # Weekly hours
│   │   │       ├── dates/            # Date overrides
│   │   │       └── location/         # Location settings
│   │   ├── limits/
│   │   │   └── page.tsx              # Buffer, max bookings
│   │   └── calendars/                # 🆕 Calendar integrations
│   │       ├── page.tsx              # Connected calendars
│   │       ├── connect/
│   │       │   └── page.tsx          # Connect new provider
│   │       └── [id]/
│   │           └── settings/
│   │               └── page.tsx      # Calendar settings
│   │
│   ├── events/                         # Event types
│   │   ├── page.tsx
│   │   ├── new/
│   │   │   └── page.tsx
│   │   └── [slug]/
│   │       ├── edit/
│   │       │   └── page.tsx
│   │       └── bookings/
│   │           └── page.tsx
│   │
│   ├── analytics/                      # Analytics & Reports
│   │   ├── page.tsx
│   │   ├── revenue/
│   │   ├── patients/
│   │   └── performance/
│   │
│   ├── profile/                        # Public profile settings
│   │   ├── expert/
│   │   ├── preview/
│   │   └── link/
│   │
│   ├── billing/                        # Billing & Subscriptions
│   │   ├── subscription/
│   │   ├── payments/
│   │   ├── payouts/
│   │   └── invoices/
│   │
│   ├── partner/                         # 🏥 Partner Management (Phase 2)
│   │   ├── layout.tsx                 # Partner auth check
│   │   ├── page.tsx                   # Partner overview
│   │   ├── team/
│   │   │   ├── page.tsx
│   │   │   ├── invite/
│   │   │   ├── roles/
│   │   │   └── [memberId]/
│   │   ├── schedule/
│   │   ├── patients/
│   │   ├── analytics/
│   │   ├── settings/
│   │   └── revenue/
│   │
│   ├── learn/                          # 🎓 Learning Platform (Phase 3)
│   │   ├── layout.tsx                 # Feature flag check
│   │   ├── courses/
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   ├── content/
│   │   └── students/
│   │
│   ├── learning/                       # 🎓 Student View (Phase 3)
│   │   ├── dashboard/
│   │   ├── courses/
│   │   ├── progress/
│   │   └── browse/
│   │
│   ├── admin/                          # 🛠️ Platform Admin
│   │   ├── layout.tsx                 # Admin auth check
│   │   ├── page.tsx
│   │   ├── users/
│   │   ├── organizations/
│   │   ├── analytics/
│   │   ├── payments/
│   │   ├── categories/
│   │   └── settings/
│   │
│   ├── settings/                       # ⚙️ Personal Settings
│   │   ├── account/
│   │   ├── notifications/
│   │   ├── integrations/
│   │   └── security/
│   │
│   └── notifications/                  # 🔔 Notification Center
│       └── page.tsx
│
└── (public)/
    └── [username]/                     # Public expert profiles
        └── page.tsx
```

---

## 🎯 Role-Based Menu Configuration

### Expert (Solo Practitioner)

**Primary Menu:**

- Overview
- Appointments
- Availability
- Event Types
- Analytics (based on tier)
- Public Profile
- Billing

**Secondary Menu:**

- Settings
- Resources (if top tier)
- Help & Support

---

### Expert (Partner Member)

**Primary Menu:**

- Overview (personal)
- My Appointments
- My Availability
- My Event Types
- My Analytics

**Partner Section:**

- Partner Overview (if admin)
- Team (if admin)
- Partner Schedule
- Partner Patients (shared access)

**Secondary Menu:**

- Settings
- Help & Support

---

### Partner Admin

**Primary Menu:**

- Partner Overview
- Team
- Partner Schedule
- Patients
- Partner Analytics
- Partner Settings
- Revenue & Payouts

**Personal Section:**

- My Schedule
- My Profile
- My Billing

**Secondary Menu:**

- Settings
- Help & Support

---

### Platform Admin

**Primary Menu:**

- Platform Overview
- Users
- Organizations
- Platform Analytics
- Payments
- Categories
- Platform Settings

**Secondary Menu:**

- Audit Logs
- Support Tickets
- System Status

---

## 🎨 UI/UX Best Practices

### Navigation Patterns

1. **Collapsible Sidebar** (Current ✅)
   - Icon mode when collapsed
   - Tooltips in collapsed state
   - Keyboard shortcut: `Cmd/Ctrl + B`

2. **Breadcrumbs** (Current ✅)
   - Show current location
   - Clickable navigation
   - Auto-generated from route

3. **Context Switcher**
   - Organization switcher (for multi-org users)
   - Role indicator badge
   - Quick access to settings

4. **Search Command Palette** (Future)
   - Global search: `Cmd/Ctrl + K`
   - Quick navigation
   - Action shortcuts

### Visual Hierarchy

```typescript
// Menu Item Styling
interface MenuItemStyle {
  primary: {
    fontSize: 'text-sm';
    fontWeight: 'font-medium';
    icon: 'size-4';
  };
  secondary: {
    fontSize: 'text-xs';
    fontWeight: 'font-normal';
    icon: 'size-3.5';
  };
  groupLabel: {
    fontSize: 'text-xs';
    fontWeight: 'font-medium';
    color: 'text-muted-foreground';
  };
}
```

### Icons Recommendation

```typescript
import {
  // Event Types
  BarChart3,
  // Settings
  Bell,
  // Team/Patients
  Building2,
  // Overview
  Calendar,
  // Appointments
  Clock,
  // Profile
  CreditCard,
  // Partner
  GraduationCap,
  LayoutDashboard,
  // Availability
  Link2,
  // Learning
  Settings,
  // Notifications
  Shield,
  // Admin
  // Analytics
  User,
  // Billing
  Users,
} from 'lucide-react';
```

---

## 🚀 Migration Strategy

### Phase 1: Restructure Current Routes (Week 1-2)

1. **Rename Routes:**
   - `booking/events` → `events`
   - `booking/schedule` → `availability`
   - `booking/expert` → `profile/expert`
   - `appointments` → `appointments` (keep)
   - `dashboard` → `dashboard` (keep)

2. **Create New Routes:**
   - `analytics/` (consolidate analytics)
   - `billing/` (consolidate subscription + payments)
   - `settings/` (consolidate account settings)

3. **Update Sidebar:**
   - Implement new menu structure
   - Add role-based visibility
   - Add icon updates

### Phase 2: Add Partner Features (Future)

1. **Create Partner Routes:**
   - `partner/` (new section)
   - Implement partner layout with auth checks

2. **Update Sidebar:**
   - Add partner section conditionally
   - Show/hide based on organization membership

### Phase 3: Add Learning Platform (Future)

1. **Create Learning Routes:**
   - `learn/` (expert view)
   - `learning/` (student view)

2. **Feature Flag:**
   - Enable based on subscription tier
   - Progressive rollout

---

## 📊 Analytics & Metrics

### Track Navigation Patterns

```typescript
// Track which menu items are used most
analytics.track('navigation_click', {
  from: currentPath,
  to: targetPath,
  menuItem: itemName,
  userRole: role,
});

// Track feature discovery
analytics.track('feature_discovered', {
  feature: featureName,
  userRole: role,
  daysFromSignup: daysSinceSignup,
});
```

---

## ✅ Implementation Checklist

### Phase 1: Core Restructure

- [ ] Create new folder structure
- [ ] Migrate existing pages
- [ ] Update AppSidebar component
- [ ] Add role-based menu logic
- [ ] Update breadcrumbs
- [ ] Add icons
- [ ] Update navigation links across app
- [ ] Test all routes
- [ ] Update documentation

### Phase 2: Partner Features

- [ ] Design partner data model
- [ ] Implement partner routes
- [ ] Add partner sidebar section
- [ ] Implement organization switcher
- [ ] Add partner-specific permissions
- [ ] Test multi-member scenarios

### Phase 3: Learning Platform

- [ ] Design LMS data model
- [ ] Implement course routes
- [ ] Add learning sidebar section
- [ ] Implement feature flags
- [ ] Add course management UI
- [ ] Test content delivery

---

## 🔗 References

- **Cal.com Dashboard:** Event-centric navigation with clear scheduling focus
- **Dub Dashboard:** Analytics-first with clean feature separation
- **Vercel Dashboard:** Project-centric with team features
- **WorkOS Dashboard:** Organization management and RBAC
- **WorkOS RBAC:** `_docs/02-core-systems/WORKOS-RBAC-QUICK-REFERENCE.md`
- **Solo vs Partner:** `.cursor/plans/SOLO-VS-CLINIC-ARCHITECTURE.md`

---

**Next Steps:**

1. Review and approve this architecture
2. Create implementation plan with timeline
3. Start with Phase 1 migration
4. Gather user feedback
5. Iterate based on usage patterns
