# Dashboard Menu Quick Reference

**Last Updated:** November 12, 2025  
**Status:** Design Approved - Ready for Implementation

---

## 📋 TL;DR

### What Changed?

❌ **Old:** `booking/events`, `booking/schedule`, `booking/expert`  
✅ **New:** `events`, `availability`, `profile/expert`

### Why?

- User-facing names (not developer terminology)
- Scalable for partners and LMS
- Industry best practices (Cal.com, Dub, Vercel)
- Role-aware navigation
- Clearer feature grouping

### When?

- **Phase 1:** Restructure (2 weeks) - Current features
- **Phase 2:** Partner features (Future)
- **Phase 3:** LMS features (Future)

---

## 🗂️ Menu Structure at a Glance

### Solo Expert (Community Tier)

```
📊 Overview
📅 Appointments → Upcoming | Past | Calendar (Built-in) | Patients
🗓️ Availability → Schedules (Multiple) | Limits | Calendar Connections
🔗 Event Types → All Events | Create
👤 Profile → Expert Profile | Preview | Link
💳 Billing → Subscription | Payments | Payouts | Invoices
⚙️ Settings → Account | Notifications | Integrations
```

### Solo Expert (Top Tier)

```
+ All Community features
+ 📈 Analytics → Overview, Revenue, Patients, Performance
+ 📚 Resources (future)
```

### Partner Admin

```
PERSONAL
  📊 My Overview
  📅 My Appointments
  🗓️ My Availability
  🔗 My Event Types

CLINIC
  🏥 Partner Overview
  👥 Team → Members, Invite, Roles
  📅 Schedule → Multi-calendar, Rooms
  👨‍👩‍👧‍👦 Patients → All, Records, Insights
  📊 Analytics → Revenue, Performance, Reports
  💼 Settings → Org Info, Branding, Billing
  💳 Revenue → Overview, Splits, Payouts
```

### Platform Admin

```
🏢 Platform Overview
👥 Users → All, Experts, Patients
🏥 Organizations → All, Partners, Details
📊 Analytics → Growth, Revenue, Engagement
💳 Payments → Transactions, Transfers, Disputes
🏷️ Categories → Specialties, Services, Tags
⚙️ Settings → General, Features, Integrations
```

---

## 📁 Folder Structure

### Current State → New State

| Old Path                 | New Path               | Status  |
| ------------------------ | ---------------------- | ------- |
| `booking/events`         | `events`               | Move    |
| `booking/schedule`       | `availability`         | Move    |
| `booking/expert`         | `profile/expert`       | Move    |
| `dashboard`              | `dashboard`            | Keep    |
| `appointments`           | `appointments`         | Enhance |
| `admin`                  | `admin`                | Keep    |
| `dashboard/subscription` | `billing/subscription` | Move    |
| `admin/payments`         | `billing/payments`     | Move    |
| -                        | `analytics`            | New     |
| -                        | `settings`             | New     |
| -                        | `notifications`        | New     |
| -                        | `partner`              | Future  |
| -                        | `learn`                | Future  |

---

## 🎯 Routes Cheat Sheet

### Appointments

```
/appointments                    # Upcoming (default)
/appointments?tab=past          # Past appointments
/appointments/calendar          # 🆕 Built-in calendar (Day/Week/Month)
/appointments/patients          # Patient list
/appointments/patients/[id]     # Patient detail
```

**Built-in Calendar Features:**

- ✅ Day, Week, Month views
- ✅ Works without external calendar
- ✅ Filter by schedule/location
- ✅ Color-coded by event type
- ✅ Click to view/reschedule

### Availability (Enhanced - Like Cal.com)

```
/availability/schedules                    # All schedules list
/availability/schedules/new                # Create new schedule
/availability/schedules/[id]               # Edit schedule
/availability/schedules/[id]/hours         # Weekly hours for this schedule
/availability/schedules/[id]/dates         # Date overrides for this schedule
/availability/schedules/[id]/location      # Location settings
/availability/limits                       # Buffer, max bookings
/availability/calendars                    # Connected calendars (optional)
/availability/calendars/connect            # Connect Google/Outlook/etc
/availability/calendars/[id]/settings      # Calendar settings
```

**New Features:**

- ✅ Multiple schedules (Remote, In-person, Partner, etc.)
- ✅ Each schedule has own hours, location, timezone
- ✅ Assign schedule to event types
- ✅ Calendar integration is OPTIONAL (not mandatory)
- ✅ Built-in calendar view in `/appointments/calendar`

### Event Types

```
/events                        # All event types
/events/new                    # Create new event
/events/[slug]/edit           # Edit event
/events/[slug]/bookings       # Event bookings
```

### Analytics (Top Tier Only)

```
/analytics                     # Overview & KPIs
/analytics/revenue            # Financial insights
/analytics/patients           # Patient demographics
/analytics/performance        # Booking trends
```

### Profile

```
/profile/expert               # Edit public profile
/profile/preview              # Preview as patient sees
/profile/link                 # Booking link settings
```

### Billing

```
/billing/subscription         # Current plan & upgrade
/billing/payments            # Payment history
/billing/payouts             # Your earnings
/billing/invoices            # Generated invoices
```

### Settings

```
/settings/account            # Personal information
/settings/notifications      # Email/SMS preferences
/settings/integrations       # Calendar, Zoom, etc.
/settings/security           # 2FA, sessions
```

### Partner (Future)

```
/partner                      # Partner overview
/partner/team                # Team management
/partner/team/invite         # Invite member
/partner/team/[id]           # Member details
/partner/schedule            # Multi-practitioner calendar
/partner/patients            # All partner patients
/partner/analytics           # Partner-wide analytics
/partner/settings            # Partner configuration
/partner/revenue             # Revenue & payouts
```

### Learning (Future)

```
/learn/courses              # My courses (expert)
/learn/courses/new          # Create course
/learn/courses/[id]/edit    # Edit course
/learn/content             # Content library
/learn/students            # Student management

/learning/dashboard        # Learning dashboard (student)
/learning/courses          # Enrolled courses
/learning/browse           # Course catalog
```

### Admin

```
/admin                     # Platform overview
/admin/users              # User management
/admin/organizations      # Organization management
/admin/analytics          # Platform analytics
/admin/payments           # Payment operations
/admin/categories         # Category management
/admin/settings           # Platform settings
```

---

## 🔑 Role & Permission Matrix

| Feature             | Community | Top | Partner Member | Partner Admin | Platform Admin |
| ------------------- | --------- | --- | -------------- | ------------- | -------------- |
| Overview            | ✅        | ✅  | ✅             | ✅            | ✅             |
| Appointments        | ✅        | ✅  | ✅             | ✅            | ✅             |
| Availability        | ✅        | ✅  | ✅             | ✅            | ✅             |
| Event Types         | ✅        | ✅  | ✅             | ✅            | ✅             |
| **Analytics**       | ❌        | ✅  | ❌             | ✅ (partner)  | ✅             |
| Profile             | ✅        | ✅  | ✅             | ✅            | ✅             |
| Billing             | ✅        | ✅  | ✅             | ✅            | ✅             |
| **Partner Section** | ❌        | ❌  | ✅ (view)      | ✅ (full)     | ✅             |
| **Admin Section**   | ❌        | ❌  | ❌             | ❌            | ✅             |

---

## 🎨 Icons Reference

```typescript
import {
  // 🔗 Event Types
  BarChart3,
  // ⚙️ Settings
  Bell,
  // 👥 Team, Patients
  Building2,
  // 📊 Overview
  Calendar,
  // ▶️ Expand menu
  ChevronDown, // ▼ Dropdown
  // ➕ Create/Add
  ChevronRight,
  // 📅 Appointments, Schedule
  Clock,
  // 👤 Profile, User
  CreditCard,
  // ❓ Help
  ExternalLink,
  // 🔔 Notifications
  FileText,
  // 🏥 Partner
  GraduationCap,
  // 🛡️ Admin, Security
  HelpCircle,
  LayoutDashboard,
  // 🗓️ Availability
  Link2,
  // 🔍 Search
  Plus,
  // 🔗 External links
  Search,
  // 🎓 Learning
  Settings,
  // 📝 Documents, Content
  Shield,
  // 📈 Analytics
  User,
  // 💳 Billing
  Users,
} from 'lucide-react';
```

---

## 🚀 Migration Steps (Simple)

### 1. Create New Folders

```bash
cd app/(private)
mkdir -p availability/{dates,limits,timezone}
mkdir -p analytics/{revenue,patients,performance}
mkdir -p profile/{expert,preview,link}
mkdir -p billing/{subscription,payments,payouts,invoices}
mkdir -p settings/{account,notifications,integrations,security}
```

### 2. Move Existing Files

```bash
# Events
mv booking/events/* events/

# Availability (was schedule)
mv booking/schedule/* availability/

# Profile (was expert)
mv booking/expert/* profile/expert/

# Subscription
mv dashboard/subscription/* billing/subscription/

# Payments
mv admin/payments/* billing/payments/
```

### 3. Update AppSidebar

```typescript
// components/layout/sidebar/AppSidebar.tsx
const mainItems = [
  { title: 'Overview', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Appointments', url: '/appointments', icon: Calendar },
  { title: 'Availability', url: '/availability', icon: Clock },
  { title: 'Event Types', url: '/events', icon: Link2 },
  { title: 'Analytics', url: '/analytics', icon: BarChart3, minTier: 'top' },
  { title: 'Profile', url: '/profile/expert', icon: User },
  { title: 'Billing', url: '/billing/subscription', icon: CreditCard },
];
```

### 4. Add Redirects

```typescript
// app/(private)/booking/[...slug]/page.tsx
export default function BookingRedirect({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const map = {
    'events': '/events',
    'schedule': '/availability',
    'expert': '/profile/expert',
  };
  redirect(map[slug[0]] || '/dashboard');
}
```

### 5. Update All Links

Search and replace across project:

- `booking/events` → `events`
- `booking/schedule` → `availability`
- `booking/expert` → `profile/expert`

---

## 🧪 Testing Checklist

```
Navigation
  [ ] All sidebar links work
  [ ] Active states show correctly
  [ ] Breadcrumbs update correctly
  [ ] Sub-menus expand/collapse

Permissions
  [ ] Community tier sees correct menu
  [ ] Top tier sees Analytics
  [ ] Partner members see partner section
  [ ] Admins see admin section

Redirects
  [ ] Old URLs redirect to new URLs
  [ ] No 404 errors
  [ ] Breadcrumbs still work

Responsive
  [ ] Mobile sidebar works
  [ ] Tablet icon mode works
  [ ] Desktop full sidebar works

Accessibility
  [ ] Keyboard navigation works
  [ ] Screen reader announces correctly
  [ ] Focus indicators visible
```

---

## 📞 Implementation Support

### Key Files to Edit

```
1. config/navigation.ts                    # Navigation config
2. components/layout/sidebar/AppSidebar.tsx # Main sidebar
3. components/layout/sidebar/NavMain.tsx    # Menu items
4. app/(private)/*/page.tsx                 # Individual pages
5. All internal Link components             # Update hrefs
```

### Common Issues & Solutions

**Issue:** Old routes still showing  
**Solution:** Clear Next.js cache: `rm -rf .next && pnpm dev`

**Issue:** Permissions not working  
**Solution:** Check WorkOS JWT and RBAC setup

**Issue:** Redirects not working  
**Solution:** Verify redirect page exists and is using `redirect()` from `next/navigation`

**Issue:** Icons not showing  
**Solution:** Ensure `lucide-react` is installed and imported correctly

**Issue:** Active state wrong  
**Solution:** Check `usePathname()` logic in NavMain component

---

## 📊 Success Metrics

Track these after launch:

- Navigation time to features
- 404 error rate
- Feature discovery rate (especially Analytics)
- User satisfaction (NPS)
- Tier upgrade rate (Analytics impact)

---

## 🔗 Related Documents

| Document                             | Purpose                           |
| ------------------------------------ | --------------------------------- |
| `DASHBOARD-MENU-ARCHITECTURE.md`     | Complete design specification     |
| `DASHBOARD-MENU-IMPLEMENTATION.md`   | Step-by-step implementation guide |
| `DASHBOARD-MENU-VISUAL-HIERARCHY.md` | Visual diagrams and layouts       |
| `WORKOS-RBAC-QUICK-REFERENCE.md`     | Permission system                 |
| `SOLO-VS-CLINIC-ARCHITECTURE.md`     | Business logic                    |

---

## ❓ FAQ

**Q: Why not keep "booking" in the URL?**  
A: "Booking" is developer terminology. "Events" and "Availability" are clearer to users.

**Q: Will old URLs break?**  
A: No, we'll add redirects for backward compatibility.

**Q: When will partner features be available?**  
A: Phase 2, timeline TBD after Phase 1 stabilizes.

**Q: Can I hide features I don't use?**  
A: Future enhancement - Phase 4 will add customizable navigation.

**Q: How do I test the new navigation?**  
A: Run locally, check all routes, verify permissions per role.

**Q: What if a user is in multiple partners?**  
A: Organization switcher will be added (Phase 2).

---

## 🎯 Next Actions

1. ✅ Review and approve architecture
2. ⏳ Create GitHub project board
3. ⏳ Assign implementation tasks
4. ⏳ Set milestone dates
5. ⏳ Begin Phase 1 development
6. ⏳ Weekly progress reviews
7. ⏳ Staging deployment
8. ⏳ User testing
9. ⏳ Production rollout
10. ⏳ Monitor metrics

---

**Need Help?**

- 📖 Read full docs: `_docs/DASHBOARD-MENU-*.md`
- 💬 Ask in #dev-platform channel
- 🐛 Report issues in GitHub
- 📧 Email: dev-team@eleva.care

---

**Version History**

- v1.0 (Nov 12, 2025) - Initial design
- v1.1 (TBD) - Post Phase 1 updates
- v2.0 (TBD) - Partner features
- v3.0 (TBD) - LMS features
