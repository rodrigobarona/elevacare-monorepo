# Dashboard Menu Implementation Guide

**Version:** 1.0  
**Date:** November 12, 2025  
**Related:** `DASHBOARD-MENU-ARCHITECTURE.md`

---

## 📊 Before vs After Comparison

### Current Structure (Before)

```
app/(private)/
├── dashboard/
│   ├── page.tsx
│   ├── subscription/
│   └── widgets-kitchen-sink/
├── booking/
│   ├── events/
│   ├── expert/
│   └── schedule/
├── appointments/
│   ├── page.tsx
│   ├── patients/
│   └── records/
├── admin/
│   ├── categories/
│   ├── payments/
│   └── users/
├── account/
└── setup/
```

**Current Sidebar:**

- Events
- Calendar
- Expert Profile
- Notifications
- Public Expert Profile
- Need help?

**Issues:**

- "Booking" is developer terminology, not user-facing
- Scattered settings across multiple locations
- No clear analytics section
- Billing spread across admin and account
- No scalable structure for partners or LMS
- Mixing internal terminology with user features

---

### Proposed Structure (After)

```
app/(private)/
├── dashboard/                    # ✅ Keep - Rename to "Overview"
│   └── page.tsx
│
├── appointments/                 # ✅ Keep & Enhance
│   ├── page.tsx                 # Upcoming/Past tabs
│   ├── calendar/                # NEW: Calendar view
│   └── patients/                # ✅ Keep
│       ├── page.tsx
│       ├── [id]/
│       └── layout.tsx
│
├── availability/                 # NEW: Clearer name than "schedule"
│   ├── page.tsx                 # Weekly hours
│   ├── dates/                   # Date overrides
│   ├── limits/                  # Booking rules
│   └── timezone/                # Timezone settings
│
├── events/                       # MOVED: From booking/events
│   ├── page.tsx
│   ├── new/
│   └── [slug]/
│       ├── edit/
│       └── bookings/
│
├── analytics/                    # NEW: Consolidated analytics
│   ├── page.tsx                 # Overview
│   ├── revenue/                 # Financial insights
│   ├── patients/                # Patient insights
│   └── performance/             # Booking trends
│
├── profile/                      # NEW: Public profile management
│   ├── expert/                  # Expert profile settings
│   ├── preview/                 # Preview page
│   └── link/                    # Booking link management
│
├── billing/                      # NEW: Consolidated billing
│   ├── subscription/            # Plan management
│   ├── payments/                # Payment history
│   ├── payouts/                 # Earnings & payouts
│   └── invoices/                # Generated invoices
│
├── partner/                       # 🔮 FUTURE: Partner features
│   ├── layout.tsx              # Partner member check
│   ├── page.tsx                # Partner overview
│   ├── team/
│   ├── schedule/
│   ├── patients/
│   ├── analytics/
│   └── settings/
│
├── learn/                        # 🔮 FUTURE: LMS (Expert view)
│   ├── courses/
│   ├── content/
│   └── students/
│
├── learning/                     # 🔮 FUTURE: LMS (Student view)
│   ├── dashboard/
│   ├── courses/
│   └── browse/
│
├── admin/                        # ✅ Keep - Platform admin only
│   ├── page.tsx
│   ├── users/
│   ├── organizations/
│   ├── analytics/
│   ├── payments/
│   ├── categories/
│   └── settings/
│
├── settings/                     # NEW: Personal settings
│   ├── account/
│   ├── notifications/
│   ├── integrations/
│   └── security/
│
└── notifications/                # NEW: Notification center
    └── page.tsx
```

**New Sidebar:**

**Primary (Expert)**

- 📊 Overview
- 📅 Appointments
- 🗓️ Availability
- 🔗 Event Types
- 📈 Analytics (tier-based)
- 👤 Profile
- 💳 Billing

**Secondary**

- ⚙️ Settings
- 📚 Resources (top tier)
- ❓ Help & Support

---

## 🎨 Sidebar Component Implementation

### 1. Define Navigation Types

```typescript
// types/navigation.ts
import type { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
  badge?: string | number;
  items?: NavigationSubItem[];
  permission?: string; // WorkOS permission
  minTier?: 'community' | 'top'; // Minimum subscription tier
  comingSoon?: boolean;
}

export interface NavigationSubItem {
  title: string;
  url: string;
  badge?: string | number;
  permission?: string;
}

export interface NavigationSection {
  label?: string;
  items: NavigationItem[];
  permission?: string; // Permission for entire section
  condition?: boolean; // Dynamic condition (e.g., isClinicMember)
}
```

### 2. Navigation Configuration

```typescript
// config/navigation.ts
import type { NavigationSection } from '@/types/navigation';
import { WORKOS_PERMISSIONS } from '@/types/workos-rbac';
import {
  BarChart3,
  Bell,
  Building2,
  Calendar,
  Clock,
  CreditCard,
  FileText,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  Link2,
  Settings,
  Shield,
  User,
  Users,
} from 'lucide-react';

/**
 * Expert Primary Navigation
 * Core features for individual practitioners
 */
export function getExpertNavigation(): NavigationSection[] {
  return [
    {
      items: [
        {
          title: 'Overview',
          url: '/dashboard',
          icon: LayoutDashboard,
        },
        {
          title: 'Appointments',
          url: '/appointments',
          icon: Calendar,
          items: [
            { title: 'Upcoming', url: '/appointments' },
            { title: 'Past', url: '/appointments?tab=past' },
            { title: 'Calendar View', url: '/appointments/calendar' },
            { title: 'Patients', url: '/appointments/patients' },
          ],
        },
        {
          title: 'Availability',
          url: '/availability',
          icon: Clock,
          items: [
            { title: 'Weekly Hours', url: '/availability' },
            { title: 'Date Overrides', url: '/availability/dates' },
            { title: 'Booking Limits', url: '/availability/limits' },
            { title: 'Timezone', url: '/availability/timezone' },
          ],
        },
        {
          title: 'Event Types',
          url: '/events',
          icon: Link2,
          items: [
            { title: 'All Events', url: '/events' },
            { title: 'Create Event', url: '/events/new' },
          ],
        },
        {
          title: 'Analytics',
          url: '/analytics',
          icon: BarChart3,
          minTier: 'top', // Only show for Top tier
          items: [
            { title: 'Overview', url: '/analytics' },
            { title: 'Revenue', url: '/analytics/revenue' },
            { title: 'Patients', url: '/analytics/patients' },
            { title: 'Performance', url: '/analytics/performance' },
          ],
        },
        {
          title: 'Profile',
          url: '/profile/expert',
          icon: User,
          items: [
            { title: 'Expert Profile', url: '/profile/expert' },
            { title: 'Preview', url: '/profile/preview' },
            { title: 'Booking Link', url: '/profile/link' },
          ],
        },
        {
          title: 'Billing',
          url: '/billing/subscription',
          icon: CreditCard,
          items: [
            { title: 'Subscription', url: '/billing/subscription' },
            { title: 'Payment History', url: '/billing/payments' },
            { title: 'Payouts', url: '/billing/payouts' },
            { title: 'Invoices', url: '/billing/invoices' },
          ],
        },
      ],
    },
  ];
}

/**
 * Partner Navigation
 * Additional section for partner members/admins
 */
export function getClinicNavigation(isClinicAdmin: boolean): NavigationSection {
  return {
    label: 'Partner',
    condition: true, // Only show if user is partner member
    items: [
      {
        title: 'Partner Overview',
        url: '/partner',
        icon: Building2,
        permission: WORKOS_PERMISSIONS.CLINIC_VIEW,
      },
      {
        title: 'Team',
        url: '/partner/team',
        icon: Users,
        permission: WORKOS_PERMISSIONS.CLINIC_MANAGE,
        items: isClinicAdmin
          ? [
              { title: 'Members', url: '/partner/team' },
              { title: 'Invite', url: '/partner/team/invite' },
              { title: 'Roles', url: '/partner/team/roles' },
            ]
          : undefined,
      },
      {
        title: 'Schedule',
        url: '/partner/schedule',
        icon: Calendar,
        permission: WORKOS_PERMISSIONS.CLINIC_VIEW,
      },
      {
        title: 'Patients',
        url: '/partner/patients',
        icon: Users,
        permission: WORKOS_PERMISSIONS.CLINIC_VIEW,
      },
      {
        title: 'Analytics',
        url: '/partner/analytics',
        icon: BarChart3,
        permission: WORKOS_PERMISSIONS.CLINIC_ANALYTICS,
      },
      {
        title: 'Settings',
        url: '/partner/settings',
        icon: Settings,
        permission: WORKOS_PERMISSIONS.CLINIC_MANAGE,
      },
    ],
  };
}

/**
 * Learning Platform Navigation (Future)
 * LMS features for content creators
 */
export function getLearningNavigation(): NavigationSection {
  return {
    label: 'Learning',
    condition: false, // Feature flag: learning_platform_enabled
    items: [
      {
        title: 'My Courses',
        url: '/learn/courses',
        icon: GraduationCap,
        comingSoon: true,
        items: [
          { title: 'All Courses', url: '/learn/courses' },
          { title: 'Create Course', url: '/learn/courses/new' },
        ],
      },
      {
        title: 'Content Library',
        url: '/learn/content',
        icon: FileText,
        comingSoon: true,
      },
      {
        title: 'Students',
        url: '/learn/students',
        icon: Users,
        comingSoon: true,
      },
    ],
  };
}

/**
 * Admin Navigation
 * Platform administration features
 */
export function getAdminNavigation(): NavigationSection {
  return {
    label: 'Admin',
    permission: WORKOS_PERMISSIONS.ADMIN_ACCESS,
    items: [
      {
        title: 'Platform',
        url: '/admin',
        icon: Shield,
        items: [
          { title: 'Overview', url: '/admin' },
          { title: 'Users', url: '/admin/users' },
          { title: 'Organizations', url: '/admin/organizations' },
          { title: 'Analytics', url: '/admin/analytics' },
          { title: 'Payments', url: '/admin/payments' },
        ],
      },
      {
        title: 'Categories',
        url: '/admin/categories',
        icon: FileText,
      },
      {
        title: 'Settings',
        url: '/admin/settings',
        icon: Settings,
      },
    ],
  };
}

/**
 * Secondary Navigation
 * Settings and support features
 */
export function getSecondaryNavigation(): NavigationSection {
  return {
    items: [
      {
        title: 'Settings',
        url: '/settings/account',
        icon: Settings,
      },
      {
        title: 'Notifications',
        url: '/notifications',
        icon: Bell,
        badge: 'badgeCount', // Dynamic badge
      },
      {
        title: 'Help & Support',
        url: 'https://help.eleva.care',
        icon: HelpCircle,
      },
    ],
  };
}
```

### 3. Updated AppSidebar Component

```typescript
// components/layout/sidebar/AppSidebar.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavMain } from '@/components/layout/sidebar/NavMain';
import { NavSecondary } from '@/components/layout/sidebar/NavSecondary';
import { NavUser } from '@/components/layout/sidebar/NavUser';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/layout/sidebar/sidebar';
import { useRBAC } from '@/components/providers/RBACProvider';
import { useSubscription } from '@/hooks/use-subscription';
import { Leaf } from 'lucide-react';
import { Suspense } from 'react';
import {
  getExpertNavigation,
  getClinicNavigation,
  getAdminNavigation,
  getSecondaryNavigation,
} from '@/config/navigation';

export function AppSidebar() {
  const pathname = usePathname();
  const { hasPermission, role } = useRBAC();
  const { tier } = useSubscription();

  // Check user context
  const isClinicMember = false; // TODO: Implement partner membership check
  const isClinicAdmin = false; // TODO: Implement partner admin check
  const isAdmin = role === 'admin';

  // Get navigation sections
  const expertNav = React.useMemo(() => {
    const nav = getExpertNavigation();
    return filterNavigationByPermissions(nav, hasPermission, tier);
  }, [hasPermission, tier]);

  const clinicNav = React.useMemo(() => {
    if (!isClinicMember) return null;
    const nav = getClinicNavigation(isClinicAdmin);
    return filterNavigationByPermissions([nav], hasPermission, tier);
  }, [isClinicMember, isClinicAdmin, hasPermission, tier]);

  const adminNav = React.useMemo(() => {
    if (!isAdmin) return null;
    const nav = getAdminNavigation();
    return filterNavigationByPermissions([nav], hasPermission, tier);
  }, [isAdmin, hasPermission, tier]);

  const secondaryNav = React.useMemo(() => {
    return getSecondaryNavigation();
  }, []);

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarInset>
        {/* Header */}
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href="/dashboard">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-eleva-primary text-white">
                    <Leaf className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Eleva Care</span>
                    <span className="truncate text-xs">Professional</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* Main Content */}
        <SidebarContent>
          {/* Expert Navigation */}
          <SidebarGroup>
            <NavMain items={expertNav[0].items} />
          </SidebarGroup>

          {/* Partner Navigation (conditional) */}
          {clinicNav && (
            <SidebarGroup>
              <SidebarGroupLabel>Partner</SidebarGroupLabel>
              <NavMain items={clinicNav[0].items} />
            </SidebarGroup>
          )}

          {/* Admin Navigation (conditional) */}
          {adminNav && (
            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <NavMain items={adminNav[0].items} />
            </SidebarGroup>
          )}

          {/* Secondary Navigation */}
          <SidebarGroup className="mt-auto">
            <NavSecondary items={secondaryNav.items} />
          </SidebarGroup>
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter>
          <Suspense fallback={<NavUser.Skeleton />}>
            <NavUser />
          </Suspense>
        </SidebarFooter>
      </SidebarInset>
    </Sidebar>
  );
}

/**
 * Filter navigation items based on permissions and tier
 */
function filterNavigationByPermissions(
  sections: NavigationSection[],
  hasPermission: (permission: string) => boolean,
  tier: 'community' | 'top' | null,
): NavigationSection[] {
  return sections
    .filter((section) => {
      // Check section-level permission
      if (section.permission && !hasPermission(section.permission)) {
        return false;
      }
      // Check section-level condition
      if (section.condition === false) {
        return false;
      }
      return true;
    })
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        // Check item permission
        if (item.permission && !hasPermission(item.permission)) {
          return false;
        }
        // Check tier requirement
        if (item.minTier && (!tier || (tier === 'community' && item.minTier === 'top'))) {
          return false;
        }
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0); // Remove empty sections
}
```

### 4. NavMain Component Updates

```typescript
// components/layout/sidebar/NavMain.tsx
'use client';

import { ChevronRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/layout/sidebar/sidebar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NavMainProps {
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
    badge?: string | number;
    items?: {
      title: string;
      url: string;
      badge?: string | number;
    }[];
    comingSoon?: boolean;
  }[];
}

export function NavMain({ items }: NavMainProps) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          const isActive = pathname === item.url || pathname.startsWith(item.url + '/');
          const hasSubItems = item.items && item.items.length > 0;

          // Item with sub-navigation
          if (hasSubItems) {
            return (
              <Collapsible key={item.title} asChild defaultOpen={isActive}>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                      {item.badge && !isCollapsed && (
                        <Badge variant="secondary" className="ml-auto">
                          {item.badge}
                        </Badge>
                      )}
                      {item.comingSoon && !isCollapsed && (
                        <Badge variant="outline" className="ml-auto text-xs">
                          Soon
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                  {hasSubItems && !isCollapsed && (
                    <>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuAction className="data-[state=open]:rotate-90">
                          <ChevronRight />
                          <span className="sr-only">Toggle</span>
                        </SidebarMenuAction>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items?.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={pathname === subItem.url}
                              >
                                <Link href={subItem.url}>
                                  <span>{subItem.title}</span>
                                  {subItem.badge && (
                                    <Badge variant="secondary" className="ml-auto">
                                      {subItem.badge}
                                    </Badge>
                                  )}
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </>
                  )}
                </SidebarMenuItem>
              </Collapsible>
            );
          }

          // Simple item without sub-navigation
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                <Link href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                  {item.badge && !isCollapsed && (
                    <Badge variant="secondary" className="ml-auto">
                      {item.badge}
                    </Badge>
                  )}
                  {item.comingSoon && !isCollapsed && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      Soon
                    </Badge>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
```

---

## 🔄 Migration Steps

### Step 1: Create New Folder Structure (Week 1)

```bash
# Create new folders
mkdir -p app/\(private\)/availability/{dates,limits,timezone}
mkdir -p app/\(private\)/analytics/{revenue,patients,performance}
mkdir -p app/\(private\)/profile/{expert,preview,link}
mkdir -p app/\(private\)/billing/{subscription,payments,payouts,invoices}
mkdir -p app/\(private\)/settings/{account,notifications,integrations,security}
mkdir -p app/\(private\)/appointments/calendar
mkdir -p app/\(private\)/notifications

# Future folders (create when ready)
mkdir -p app/\(private\)/partner/{team,schedule,patients,analytics,settings,revenue}
mkdir -p app/\(private\)/learn/{courses,content,students}
```

### Step 2: Move Existing Files (Week 1)

```bash
# Move events
mv app/\(private\)/booking/events app/\(private\)/events

# Move schedule to availability
mv app/\(private\)/booking/schedule app/\(private\)/availability
mv app/\(private\)/booking/schedule/limits app/\(private\)/availability/limits

# Move expert profile
mv app/\(private\)/booking/expert app/\(private\)/profile/expert

# Move admin payments
mv app/\(private\)/admin/payments app/\(private\)/billing/payments

# Move subscription
mv app/\(private\)/dashboard/subscription app/\(private\)/billing/subscription
```

### Step 3: Create Redirects (Week 1)

```typescript
// app/(private)/booking/[...slug]/page.tsx
import { redirect } from 'next/navigation';

export default function BookingRedirect({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = slug.join('/');

  // Map old routes to new routes
  const redirects: Record<string, string> = {
    'events': '/events',
    'schedule': '/availability',
    'expert': '/profile/expert',
  };

  const newPath = redirects[slug[0]] || '/dashboard';
  redirect(newPath);
}
```

### Step 4: Update Navigation Configuration (Week 1)

- Create `config/navigation.ts` with new structure
- Update `AppSidebar.tsx` to use new configuration
- Test all navigation paths

### Step 5: Update All Internal Links (Week 2)

```bash
# Find all links to old paths
grep -r "booking/events" app/
grep -r "booking/schedule" app/
grep -r "booking/expert" app/

# Update to new paths
# - booking/events → events
# - booking/schedule → availability
# - booking/expert → profile/expert
```

### Step 6: Update Tests (Week 2)

Update all E2E and integration tests with new routes.

### Step 7: Deploy with Monitoring (Week 2)

- Deploy to staging
- Monitor 404 errors
- Track navigation analytics
- Gather user feedback
- Deploy to production with gradual rollout

---

## 📊 Success Metrics

### User Experience

- **Navigation Time**: Time to find features < 5 seconds
- **Click Depth**: Average clicks to reach feature ≤ 2
- **Feature Discovery**: % users who discover Analytics (Top tier)
- **404 Rate**: < 0.1% after migration

### Performance

- **Page Load**: All pages < 1s (p95)
- **Navigation**: Client transitions < 100ms
- **Bundle Size**: Sidebar component < 50KB

### Adoption

- **Feature Usage**: Track which menu items are most used
- **Tier Upgrades**: Monitor Analytics section impact on upgrades
- **User Satisfaction**: NPS score for navigation

---

## 🐛 Testing Checklist

### Functional Tests

- [ ] All primary navigation links work
- [ ] All sub-navigation links work
- [ ] Active states show correctly
- [ ] Breadcrumbs update correctly
- [ ] Redirects from old URLs work
- [ ] External links open in new tab

### Permission Tests

- [ ] Community tier sees correct menu
- [ ] Top tier sees Analytics
- [ ] Admin sees Admin section
- [ ] Partner members see Partner section
- [ ] Non-partner members don't see Partner section

### Responsive Tests

- [ ] Mobile sidebar opens/closes
- [ ] Collapsed sidebar shows icons
- [ ] Tooltips work in collapsed mode
- [ ] Touch targets are adequate (44x44px)
- [ ] Horizontal scroll doesn't occur

### Accessibility Tests

- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Screen reader announces correctly
- [ ] ARIA labels present
- [ ] Color contrast meets WCAG AA

---

## 💡 Future Enhancements

### Phase 2: Command Palette

```typescript
// Global search and navigation
<CommandPalette>
  <CommandInput placeholder="Search or jump to..." />
  <CommandList>
    <CommandGroup heading="Navigation">
      <CommandItem onSelect={() => router.push('/appointments')}>
        <Calendar className="mr-2 h-4 w-4" />
        <span>Appointments</span>
      </CommandItem>
      {/* ... more items */}
    </CommandGroup>
    <CommandGroup heading="Actions">
      <CommandItem onSelect={() => router.push('/events/new')}>
        <Plus className="mr-2 h-4 w-4" />
        <span>Create Event Type</span>
      </CommandItem>
    </CommandGroup>
  </CommandList>
</CommandPalette>
```

### Phase 3: Organization Switcher

```typescript
// For users in multiple organizations
<SidebarHeader>
  <OrganizationSwitcher
    organizations={userOrganizations}
    current={currentOrganization}
    onChange={handleOrgChange}
  />
</SidebarHeader>
```

### Phase 4: Customizable Navigation

- Allow users to pin favorite pages
- Reorder menu items
- Hide unused features
- Create custom shortcuts

---

## 📚 Additional Resources

- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/sidebar)
- [Radix UI Navigation](https://www.radix-ui.com/primitives/docs/components/navigation-menu)
- [WorkOS RBAC Docs](https://workos.com/docs/user-management/rbac)
- [Cal.com Navigation Source](https://github.com/calcom/cal.com)
- [Vercel Dashboard UX](https://vercel.com)

---

**Questions or Issues?**

- Create an issue in the repository
- Contact the dev team
- Review `DASHBOARD-MENU-ARCHITECTURE.md` for overall design
