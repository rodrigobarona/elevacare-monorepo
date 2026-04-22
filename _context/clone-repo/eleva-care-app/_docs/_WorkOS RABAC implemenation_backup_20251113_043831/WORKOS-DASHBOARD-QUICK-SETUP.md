# WorkOS Dashboard: Quick Setup Guide

**Version:** 1.0  
**Date:** November 13, 2025  
**Time to Complete:** 30-45 minutes

---

## 🚀 Quick Start

This is your **copy-paste ready** guide to configure WorkOS RBAC in 3 steps.

---

## Step 1: Create All Permissions (89 total)

Go to [WorkOS Dashboard](https://dashboard.workos.com) → **RBAC** → **Permissions** → **Create Permission**

### Format

```
Name: [Human-readable name]
Slug: [code-friendly-slug]
Description: [What this allows]
```

---

## 📋 Copy-Paste: All 89 Permissions

### Appointments (9)

```
appointments:view_own | View own appointments | Allows users to view their own booked appointments
appointments:view_incoming | View incoming appointments | Allows experts to view appointments booked with them
appointments:create | Create appointments | Allows users to book new appointments
appointments:manage_own | Manage own appointments | Allows users to manage their own bookings
appointments:cancel_own | Cancel own appointments | Allows users to cancel their own appointments within policy
appointments:reschedule_own | Reschedule own appointments | Allows users to reschedule their own appointments
appointments:view_calendar | View calendar | Access calendar view of appointments
appointments:confirm | Confirm appointments | Allows experts to confirm incoming appointments
appointments:complete | Complete appointments | Allows experts to mark appointments as completed
```

### Sessions (2)

```
sessions:view_own | View own sessions | View session notes and summaries
sessions:view_history | View session history | View complete session history
```

### Patients (7)

```
patients:view_own | View own patients | View list of patients you've worked with
patients:view_all | View all clinic patients | View all patients in the clinic (clinic admin)
patients:view_history | View patient history | View patient's appointment history
patients:send_notes | Send session notes | Share session notes with patients
patients:manage_records | Manage patient records | Create and update patient records
patients:view_insights | View patient insights | View patient analytics and demographics
```

### Events (5)

```
events:create | Create event types | Create new bookable event types
events:view_own | View own events | View your own event types
events:edit_own | Edit own events | Edit your own event types
events:delete_own | Delete own events | Delete your own event types
events:toggle_active | Toggle event status | Activate or deactivate event types
```

### Availability (5)

```
availability:view_own | View own availability | View your availability schedules
availability:create | Create schedules | Create new availability schedules
availability:edit_own | Edit schedules | Edit your availability schedules
availability:delete_own | Delete schedules | Delete your availability schedules
availability:set_limits | Set booking limits | Set buffer times and maximum bookings
```

### Calendars (4)

```
calendars:connect | Connect calendars | Connect external calendar providers (Google, Outlook)
calendars:view_own | View connected calendars | View your connected calendars
calendars:edit_own | Edit calendar settings | Edit calendar integration settings
calendars:disconnect | Disconnect calendars | Disconnect external calendars
```

### Reviews (6)

```
reviews:create | Create reviews | Leave reviews after completed sessions
reviews:view_own | View own reviews | View reviews you've written
reviews:view_about_me | View reviews about me | View reviews written about you
reviews:edit_own | Edit own reviews | Edit your reviews (within 30 days)
reviews:delete_own | Delete own reviews | Delete your reviews (within 7 days)
reviews:respond | Respond to reviews | Respond to reviews about you
```

### Profile (6)

```
profile:view_own | View own profile | View your patient profile
profile:edit_own | Edit own profile | Edit your patient profile
profile:view_expert | View expert profile | View your expert public profile
profile:edit_expert | Edit expert profile | Edit your expert public profile
profile:preview | Preview profile | Preview how patients see your profile
profile:manage_link | Manage booking link | Manage your booking link settings
```

### Experts (7)

```
experts:browse | Browse experts | Browse expert directory
experts:view_profiles | View expert profiles | View expert public profiles
experts:view_applications | View expert applications | View expert applications (admin only)
experts:approve | Approve applications | Approve expert applications (admin only)
experts:reject | Reject applications | Reject expert applications (admin only)
experts:suspend | Suspend experts | Suspend expert accounts (admin only)
experts:verify | Verify credentials | Verify expert credentials (admin only)
```

### Analytics (10)

```
analytics:view | View analytics | Access analytics dashboard (Top tier)
analytics:revenue | View revenue analytics | View detailed revenue analytics
analytics:patients | View patient analytics | View patient demographics and insights
analytics:performance | View performance metrics | View booking trends and conversion
analytics:export | Export analytics | Export analytics data
analytics:platform_growth | View platform growth | View platform-wide user growth (admin)
analytics:platform_revenue | View platform revenue | View platform revenue metrics (admin)
analytics:platform_engagement | View platform engagement | View engagement metrics (admin)
analytics:platform_churn | View platform churn | View retention and churn data (admin)
analytics:platform_export | Export platform data | Export platform-wide analytics (admin)
```

### Branding (3)

```
branding:customize | Customize branding | Customize profile branding (Top tier)
branding:upload_logo | Upload logo | Upload custom logo (Top tier)
branding:custom_colors | Custom colors | Set custom brand colors (Top tier)
```

### Billing (8)

```
billing:view_own | View own billing | View personal payment history and invoices
billing:view_earnings | View earnings | View earnings and commission details
billing:view_payouts | View payouts | View payout history
billing:view_subscription | View subscription | View current subscription plan
billing:manage_subscription | Manage subscription | Upgrade or downgrade subscription
billing:methods_manage | Manage payment methods | Add or remove payment methods
billing:manage_clinic_sub | Manage clinic subscription | Manage clinic subscription (clinic admin)
billing:view_clinic_billing | View clinic billing | View clinic billing history (clinic admin)
```

### Settings (7)

```
settings:view_own | View own settings | View personal settings
settings:edit_own | Edit own settings | Edit account, notifications, integrations
settings:security | Security settings | Manage 2FA, sessions, security
settings:view_platform | View platform settings | View platform configuration (admin)
settings:edit_platform | Edit platform settings | Edit platform configuration (admin)
settings:manage_features | Manage feature flags | Enable/disable features (admin)
settings:manage_integrations | Manage integrations | Manage API keys, webhooks (admin)
```

### Dashboard (2)

```
dashboard:view_expert | View expert dashboard | Access expert dashboard
dashboard:view_patient | View patient dashboard | Access patient dashboard
```

### Clinic (Phase 2) (18)

```
clinic:view_dashboard | View clinic dashboard | View clinic overview (read-only for members)
clinic:manage_settings | Manage clinic settings | Manage clinic configuration (admin)
clinic:manage_branding | Manage clinic branding | Manage clinic logo, colors (admin)
clinic:view_analytics | View clinic analytics | View clinic-wide analytics (admin)
clinic:view_patients | View clinic patients | View shared clinic patients
clinic:export_data | Export clinic data | Export clinic data (admin)

team:view_members | View team members | View clinic team members
team:invite_members | Invite team members | Invite new team members (admin)
team:remove_members | Remove team members | Remove team members (admin)
team:manage_roles | Manage team roles | Assign and change member roles (admin)
team:view_performance | View team performance | View team member performance (admin)

schedule:manage_clinic | Manage clinic schedule | Manage multi-practitioner schedule (admin)
schedule:manage_rooms | Manage rooms | Manage clinic rooms/locations (admin)
schedule:view_capacity | View capacity planning | View capacity planning (admin)

revenue:view_overview | View revenue overview | View clinic revenue overview (admin)
revenue:view_splits | View commission splits | View commission splits (admin)
revenue:manage_payouts | Manage payouts | Manage payout schedules (admin)
revenue:view_invoices | View invoices | View client invoices (admin)
revenue:export_financial | Export financial data | Export financial reports (admin)
```

### Platform Admin (22)

```
users:view_all | View all users | View all platform users
users:create | Create users | Create new users
users:edit | Edit users | Edit any user account
users:delete | Delete users | Soft delete user accounts
users:manage_roles | Manage user roles | Assign and change user roles
users:impersonate | Impersonate users | Sign in as user for support

organizations:view_all | View all organizations | View all organizations
organizations:create | Create organizations | Create new organizations
organizations:edit | Edit organizations | Edit organization details
organizations:delete | Delete organizations | Delete organizations
organizations:manage_settings | Manage org settings | Manage organization settings

payments:view_all | View all payments | View all platform transactions
payments:view_transfers | View transfers | View payout transfers
payments:manage_disputes | Manage disputes | Manage payment disputes
payments:process_refunds | Process refunds | Issue refunds
payments:retry_failed | Retry failed payments | Retry failed payment attempts

categories:create | Create categories | Create new categories/specialties
categories:edit | Edit categories | Edit categories/specialties
categories:delete | Delete categories | Delete categories
categories:manage_tags | Manage tags | Manage service tags

moderation:view_flags | View flagged content | View content flagged by users
moderation:review_content | Review content | Review flagged content
moderation:remove_content | Remove content | Remove inappropriate content
moderation:ban_users | Ban users | Ban users from platform

audit:view_logs | View audit logs | View platform audit logs
audit:export_logs | Export audit logs | Export audit logs for compliance
audit:view_reports | View reports | View compliance reports
audit:generate_reports | Generate reports | Generate custom compliance reports

support:view_tickets | View support tickets | View support tickets
support:respond_tickets | Respond to tickets | Respond to support tickets
support:escalate | Escalate tickets | Escalate support issues
support:close_tickets | Close tickets | Close resolved tickets
```

---

## Step 2: Create Roles (6 roles)

Go to **RBAC** → **Roles** → **Create Role**

### 🔵 Role 1: Patient

```
Name: Patient
Slug: patient
Description: Basic patient role for booking appointments and accessing healthcare journey
Priority: 10

Permissions (15):
✓ appointments:view_own
✓ appointments:create
✓ appointments:cancel_own
✓ appointments:reschedule_own
✓ sessions:view_own
✓ reviews:create
✓ reviews:view_own
✓ reviews:edit_own
✓ reviews:delete_own
✓ experts:browse
✓ experts:view_profiles
✓ profile:view_own
✓ profile:edit_own
✓ billing:view_own
✓ billing:methods_manage
✓ dashboard:view_patient
```

---

### 🟢 Role 2: Expert Community

```
Name: Expert Community
Slug: expert_community
Description: Standard expert tier with core expert features (20% monthly or 12% annual commission)
Priority: 70

Permissions (42):
✓ All Patient permissions (15)

Plus:
✓ dashboard:view_expert
✓ appointments:view_incoming
✓ appointments:manage_own
✓ appointments:view_calendar
✓ appointments:confirm
✓ appointments:complete
✓ patients:view_own
✓ patients:view_history
✓ patients:send_notes
✓ events:create
✓ events:view_own
✓ events:edit_own
✓ events:delete_own
✓ events:toggle_active
✓ availability:view_own
✓ availability:create
✓ availability:edit_own
✓ availability:delete_own
✓ availability:set_limits
✓ calendars:connect
✓ calendars:view_own
✓ calendars:edit_own
✓ calendars:disconnect
✓ profile:view_expert
✓ profile:edit_expert
✓ profile:preview
✓ profile:manage_link
✓ billing:view_earnings
✓ billing:view_payouts
✓ billing:view_subscription
✓ billing:manage_subscription
✓ reviews:view_about_me
✓ reviews:respond
✓ settings:view_own
✓ settings:edit_own
✓ settings:security
```

---

### 🟡 Role 3: Expert Top

```
Name: Expert Top
Slug: expert_top
Description: Premium expert tier with advanced analytics and branding (18% monthly or 8% annual commission)
Priority: 80

Permissions (49):
✓ All Expert Community permissions (42)

Plus:
✓ analytics:view
✓ analytics:revenue
✓ analytics:patients
✓ analytics:performance
✓ analytics:export
✓ branding:customize
✓ branding:upload_logo
✓ branding:custom_colors
```

---

### 🔵 Role 4: Clinic Member (Phase 2)

```
Name: Clinic Member
Slug: clinic_member
Description: Expert who is a member of a clinic (read-only clinic access)
Priority: 60

Permissions (45):
✓ All Expert Community permissions (42)

Plus:
✓ clinic:view_dashboard
✓ clinic:view_patients
✓ clinic:view_schedule
✓ team:view_members
```

---

### 🟣 Role 5: Clinic Admin (Phase 2)

```
Name: Clinic Admin
Slug: clinic_admin
Description: Administrator of a clinic organization with full management access
Priority: 90

Permissions (68):
✓ All Clinic Member permissions (45)

Plus:
✓ clinic:manage_settings
✓ clinic:manage_branding
✓ clinic:view_analytics
✓ clinic:export_data
✓ team:invite_members
✓ team:remove_members
✓ team:manage_roles
✓ team:view_performance
✓ schedule:manage_clinic
✓ schedule:manage_rooms
✓ schedule:view_capacity
✓ patients:view_all
✓ patients:manage_records
✓ patients:view_insights
✓ revenue:view_overview
✓ revenue:view_splits
✓ revenue:manage_payouts
✓ revenue:view_invoices
✓ revenue:export_financial
✓ billing:manage_clinic_sub
✓ billing:view_clinic_billing
```

---

### 🔴 Role 6: Platform Admin

```
Name: Platform Admin
Slug: superadmin
Description: Platform administrator with full system access (Eleva Care team only)
Priority: 100

Permissions (89):
✓ ALL PERMISSIONS (select all checkboxes)
```

---

## Step 3: Set Default Role

Go to **RBAC** → **Configuration** → **Default Role**

```
Default Role: patient

Reason: All new signups start as patients. They can:
- Book appointments
- Browse experts
- Access patient portal

When approved as expert:
- Role is upgraded to expert_community or expert_top
```

---

## ✅ Verification Checklist

After configuration, verify:

### In WorkOS Dashboard

- [ ] 89 permissions created
- [ ] 6 roles created (4 active + 2 Phase 2)
- [ ] Permission slugs match exactly (no typos)
- [ ] Role priorities are correct (10, 70, 80, 90, 100)
- [ ] Default role is set to `patient`

### Test with JWT

1. Create test users with each role
2. Sign in and decode JWT
3. Verify JWT contains:
   ```json
   {
     "role": "expert_top",
     "permissions": ["analytics:view", "events:create", ...]
   }
   ```

### Test in Application

```typescript
// Test 1: Patient can't access expert dashboard
await hasPermission('dashboard:view_expert', patientUser); // false

// Test 2: Expert Community can create events
await hasPermission('events:create', expertCommunityUser); // true

// Test 3: Expert Community can't view analytics
await hasPermission('analytics:view', expertCommunityUser); // false

// Test 4: Expert Top can view analytics
await hasPermission('analytics:view', expertTopUser); // true

// Test 5: Admin has all permissions
await hasPermission('users:delete', adminUser); // true
```

---

## 🚨 Common Mistakes to Avoid

### ❌ Wrong Slug Format

```
Bad:  appointments-view-own
Bad:  appointments_view_own
Bad:  APPOINTMENTS:VIEW_OWN
Good: appointments:view_own
```

### ❌ Missing Inherited Permissions

```
Bad:  Expert Top only has analytics:* (7 permissions)
Good: Expert Top has Expert Community + analytics:* (49 permissions)
```

### ❌ Wrong Priority Order

```
Bad:  Patient = 100, Admin = 10
Good: Patient = 10, Admin = 100
```

### ❌ Typos in Slugs

```
Bad:  analyitcs:view
Bad:  appointments:veiw_own
Bad:  expert_comunity
Good: analytics:view
Good: appointments:view_own
Good: expert_community
```

---

## 📞 Need Help?

### Common Issues

**Issue:** JWT doesn't contain permissions  
**Fix:** Make sure permissions are assigned to the role in WorkOS Dashboard

**Issue:** Permission check fails  
**Fix:** Verify permission slug matches exactly (case-sensitive)

**Issue:** User has wrong role  
**Fix:** Check organization membership in WorkOS Dashboard → Organizations → Members

**Issue:** Permissions not updating  
**Fix:** User needs to re-authenticate to get new JWT with updated permissions

---

## 🎯 Next Steps

After completing WorkOS Dashboard setup:

1. ✅ Update application constants to match permission slugs
2. ✅ Implement middleware permission checks
3. ✅ Update UI to show/hide features based on permissions
4. ✅ Test thoroughly with each role
5. ✅ Deploy to staging
6. ✅ Test with real users in staging
7. ✅ Deploy to production

---

## 📚 Related Documents

- **Complete Guide:** `WORKOS-ROLES-PERMISSIONS-CONFIGURATION.md`
- **Implementation:** `WORKOS-RBAC-IMPLEMENTATION-GUIDE.md`
- **Quick Reference:** `WORKOS-RBAC-QUICK-REFERENCE.md`
- **Dashboard Architecture:** `DASHBOARD-MENU-ARCHITECTURE.md`

---

**Estimated Setup Time:** 30-45 minutes  
**Next Review:** After Phase 1 deployment  
**Version:** 1.0 (November 13, 2025)
