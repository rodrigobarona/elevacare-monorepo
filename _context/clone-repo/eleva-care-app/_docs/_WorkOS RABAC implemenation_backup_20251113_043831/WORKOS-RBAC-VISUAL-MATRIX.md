# WorkOS RBAC: Visual Permissions Matrix

**Version:** 1.0  
**Date:** November 13, 2025  
**Purpose:** Visual reference for roles and permissions

---

## 🎯 Role Overview

| Role                | Slug               | Priority | Users                | Permissions | Dashboard Access         |
| ------------------- | ------------------ | -------- | -------------------- | ----------- | ------------------------ |
| 🔵 Patient          | `patient`          | 10       | All users initially  | 15          | Patient Portal           |
| 🟢 Expert Community | `expert_community` | 70       | Standard experts     | 42          | Expert Dashboard         |
| 🟡 Expert Top       | `expert_top`       | 80       | Premium experts      | 49          | Expert + Analytics       |
| 🔵 Clinic Member    | `clinic_member`    | 60       | Clinic practitioners | 45          | Expert + Clinic (view)   |
| 🟣 Clinic Admin     | `clinic_admin`     | 90       | Clinic managers      | 68          | Expert + Clinic (manage) |
| 🔴 Platform Admin   | `superadmin`       | 100      | Platform team        | 89 (ALL)    | All dashboards           |

---

## 📊 Complete Permissions Matrix

Legend: ✅ = Has Permission | ❌ = No Permission | 🔮 = Phase 2

### Appointments (9 permissions)

| Permission                    | Patient | Expert Community | Expert Top | Clinic Member | Clinic Admin | Admin |
| ----------------------------- | ------- | ---------------- | ---------- | ------------- | ------------ | ----- |
| `appointments:view_own`       | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `appointments:create`         | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `appointments:cancel_own`     | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `appointments:reschedule_own` | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `appointments:view_incoming`  | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `appointments:manage_own`     | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `appointments:view_calendar`  | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `appointments:confirm`        | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `appointments:complete`       | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |

### Sessions (2 permissions)

| Permission              | Patient | Expert Community | Expert Top | Clinic Member | Clinic Admin | Admin |
| ----------------------- | ------- | ---------------- | ---------- | ------------- | ------------ | ----- |
| `sessions:view_own`     | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `sessions:view_history` | ❌      | ❌               | ❌         | ❌            | ❌           | ✅    |

### Patients (7 permissions)

| Permission                | Patient | Expert Community | Expert Top | Clinic Member | Clinic Admin | Admin |
| ------------------------- | ------- | ---------------- | ---------- | ------------- | ------------ | ----- |
| `patients:view_own`       | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `patients:view_history`   | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `patients:send_notes`     | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `patients:view_all`       | ❌      | ❌               | ❌         | 🔮            | 🔮 ✅        | ✅    |
| `patients:manage_records` | ❌      | ❌               | ❌         | 🔮            | 🔮 ✅        | ✅    |
| `patients:view_insights`  | ❌      | ❌               | ❌         | 🔮            | 🔮 ✅        | ✅    |

### Events (5 permissions)

| Permission             | Patient | Expert Community | Expert Top | Clinic Member | Clinic Admin | Admin |
| ---------------------- | ------- | ---------------- | ---------- | ------------- | ------------ | ----- |
| `events:create`        | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `events:view_own`      | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `events:edit_own`      | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `events:delete_own`    | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `events:toggle_active` | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |

### Availability (5 permissions)

| Permission                | Patient | Expert Community | Expert Top | Clinic Member | Clinic Admin | Admin |
| ------------------------- | ------- | ---------------- | ---------- | ------------- | ------------ | ----- |
| `availability:view_own`   | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `availability:create`     | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `availability:edit_own`   | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `availability:delete_own` | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `availability:set_limits` | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |

### Calendars (4 permissions)

| Permission             | Patient | Expert Community | Expert Top | Clinic Member | Clinic Admin | Admin |
| ---------------------- | ------- | ---------------- | ---------- | ------------- | ------------ | ----- |
| `calendars:connect`    | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `calendars:view_own`   | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `calendars:edit_own`   | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `calendars:disconnect` | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |

### Reviews (6 permissions)

| Permission              | Patient | Expert Community | Expert Top | Clinic Member | Clinic Admin | Admin |
| ----------------------- | ------- | ---------------- | ---------- | ------------- | ------------ | ----- |
| `reviews:create`        | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `reviews:view_own`      | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `reviews:edit_own`      | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `reviews:delete_own`    | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `reviews:view_about_me` | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `reviews:respond`       | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |

### Profile (6 permissions)

| Permission            | Patient | Expert Community | Expert Top | Clinic Member | Clinic Admin | Admin |
| --------------------- | ------- | ---------------- | ---------- | ------------- | ------------ | ----- |
| `profile:view_own`    | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `profile:edit_own`    | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `profile:view_expert` | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `profile:edit_expert` | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `profile:preview`     | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `profile:manage_link` | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |

### Experts (7 permissions)

| Permission                  | Patient | Expert Community | Expert Top | Clinic Member | Clinic Admin | Admin |
| --------------------------- | ------- | ---------------- | ---------- | ------------- | ------------ | ----- |
| `experts:browse`            | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `experts:view_profiles`     | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `experts:view_applications` | ❌      | ❌               | ❌         | ❌            | ❌           | ✅    |
| `experts:approve`           | ❌      | ❌               | ❌         | ❌            | ❌           | ✅    |
| `experts:reject`            | ❌      | ❌               | ❌         | ❌            | ❌           | ✅    |
| `experts:suspend`           | ❌      | ❌               | ❌         | ❌            | ❌           | ✅    |
| `experts:verify`            | ❌      | ❌               | ❌         | ❌            | ❌           | ✅    |

### Analytics (10 permissions)

| Permission                      | Patient | Expert Community | Expert Top | Clinic Member | Clinic Admin | Admin |
| ------------------------------- | ------- | ---------------- | ---------- | ------------- | ------------ | ----- |
| `analytics:view`                | ❌      | ❌               | ✅         | ❌            | 🔮 ✅        | ✅    |
| `analytics:revenue`             | ❌      | ❌               | ✅         | ❌            | 🔮 ✅        | ✅    |
| `analytics:patients`            | ❌      | ❌               | ✅         | ❌            | 🔮 ✅        | ✅    |
| `analytics:performance`         | ❌      | ❌               | ✅         | ❌            | 🔮 ✅        | ✅    |
| `analytics:export`              | ❌      | ❌               | ✅         | ❌            | 🔮 ✅        | ✅    |
| `analytics:platform_growth`     | ❌      | ❌               | ❌         | ❌            | ❌           | ✅    |
| `analytics:platform_revenue`    | ❌      | ❌               | ❌         | ❌            | ❌           | ✅    |
| `analytics:platform_engagement` | ❌      | ❌               | ❌         | ❌            | ❌           | ✅    |
| `analytics:platform_churn`      | ❌      | ❌               | ❌         | ❌            | ❌           | ✅    |
| `analytics:platform_export`     | ❌      | ❌               | ❌         | ❌            | ❌           | ✅    |

### Branding (3 permissions)

| Permission               | Patient | Expert Community | Expert Top | Clinic Member | Clinic Admin | Admin |
| ------------------------ | ------- | ---------------- | ---------- | ------------- | ------------ | ----- |
| `branding:customize`     | ❌      | ❌               | ✅         | ❌            | 🔮 ✅        | ✅    |
| `branding:upload_logo`   | ❌      | ❌               | ✅         | ❌            | 🔮 ✅        | ✅    |
| `branding:custom_colors` | ❌      | ❌               | ✅         | ❌            | 🔮 ✅        | ✅    |

### Billing (8 permissions)

| Permission                    | Patient | Expert Community | Expert Top | Clinic Member | Clinic Admin | Admin |
| ----------------------------- | ------- | ---------------- | ---------- | ------------- | ------------ | ----- |
| `billing:view_own`            | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `billing:methods_manage`      | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `billing:view_earnings`       | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `billing:view_payouts`        | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `billing:view_subscription`   | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `billing:manage_subscription` | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `billing:manage_clinic_sub`   | ❌      | ❌               | ❌         | 🔮            | 🔮 ✅        | ✅    |
| `billing:view_clinic_billing` | ❌      | ❌               | ❌         | 🔮            | 🔮 ✅        | ✅    |

### Settings (7 permissions)

| Permission                     | Patient | Expert Community | Expert Top | Clinic Member | Clinic Admin | Admin |
| ------------------------------ | ------- | ---------------- | ---------- | ------------- | ------------ | ----- |
| `settings:view_own`            | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `settings:edit_own`            | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `settings:security`            | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `settings:view_platform`       | ❌      | ❌               | ❌         | ❌            | ❌           | ✅    |
| `settings:edit_platform`       | ❌      | ❌               | ❌         | ❌            | ❌           | ✅    |
| `settings:manage_features`     | ❌      | ❌               | ❌         | ❌            | ❌           | ✅    |
| `settings:manage_integrations` | ❌      | ❌               | ❌         | ❌            | ❌           | ✅    |

### Dashboard (2 permissions)

| Permission               | Patient | Expert Community | Expert Top | Clinic Member | Clinic Admin | Admin |
| ------------------------ | ------- | ---------------- | ---------- | ------------- | ------------ | ----- |
| `dashboard:view_patient` | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| `dashboard:view_expert`  | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |

### Clinic (18 permissions) 🔮 Phase 2

| Permission                 | Patient | Expert Community | Expert Top | Clinic Member | Clinic Admin | Admin |
| -------------------------- | ------- | ---------------- | ---------- | ------------- | ------------ | ----- |
| `clinic:view_dashboard`    | ❌      | ❌               | ❌         | 🔮 ✅         | 🔮 ✅        | ✅    |
| `clinic:view_patients`     | ❌      | ❌               | ❌         | 🔮 ✅         | 🔮 ✅        | ✅    |
| `clinic:view_schedule`     | ❌      | ❌               | ❌         | 🔮 ✅         | 🔮 ✅        | ✅    |
| `clinic:manage_settings`   | ❌      | ❌               | ❌         | 🔮 ❌         | 🔮 ✅        | ✅    |
| `clinic:manage_branding`   | ❌      | ❌               | ❌         | 🔮 ❌         | 🔮 ✅        | ✅    |
| `clinic:view_analytics`    | ❌      | ❌               | ❌         | 🔮 ❌         | 🔮 ✅        | ✅    |
| `clinic:export_data`       | ❌      | ❌               | ❌         | 🔮 ❌         | 🔮 ✅        | ✅    |
| `team:view_members`        | ❌      | ❌               | ❌         | 🔮 ✅         | 🔮 ✅        | ✅    |
| `team:invite_members`      | ❌      | ❌               | ❌         | 🔮 ❌         | 🔮 ✅        | ✅    |
| `team:remove_members`      | ❌      | ❌               | ❌         | 🔮 ❌         | 🔮 ✅        | ✅    |
| `team:manage_roles`        | ❌      | ❌               | ❌         | 🔮 ❌         | 🔮 ✅        | ✅    |
| `team:view_performance`    | ❌      | ❌               | ❌         | 🔮 ❌         | 🔮 ✅        | ✅    |
| `schedule:manage_clinic`   | ❌      | ❌               | ❌         | 🔮 ❌         | 🔮 ✅        | ✅    |
| `schedule:manage_rooms`    | ❌      | ❌               | ❌         | 🔮 ❌         | 🔮 ✅        | ✅    |
| `schedule:view_capacity`   | ❌      | ❌               | ❌         | 🔮 ❌         | 🔮 ✅        | ✅    |
| `revenue:view_overview`    | ❌      | ❌               | ❌         | 🔮 ❌         | 🔮 ✅        | ✅    |
| `revenue:view_splits`      | ❌      | ❌               | ❌         | 🔮 ❌         | 🔮 ✅        | ✅    |
| `revenue:manage_payouts`   | ❌      | ❌               | ❌         | 🔮 ❌         | 🔮 ✅        | ✅    |
| `revenue:view_invoices`    | ❌      | ❌               | ❌         | 🔮 ❌         | 🔮 ✅        | ✅    |
| `revenue:export_financial` | ❌      | ❌               | ❌         | 🔮 ❌         | 🔮 ✅        | ✅    |

### Platform Admin Only (31 permissions)

All admin-only permissions (users:\*, organizations:\*, payments:\*, categories:\*, moderation:\*, audit:\*, support:\*) are ✅ for Platform Admin and ❌ for all other roles.

---

## 📈 Role Comparison

### Permission Counts

| Role             | Own Permissions | Inherited      | Total  |
| ---------------- | --------------- | -------------- | ------ |
| Patient          | 15              | 0              | **15** |
| Expert Community | 27              | 15 (Patient)   | **42** |
| Expert Top       | 7               | 42 (Community) | **49** |
| Clinic Member 🔮 | 4               | 42 (Community) | **46** |
| Clinic Admin 🔮  | 22              | 46 (Member)    | **68** |
| Platform Admin   | 89              | 0              | **89** |

### Feature Access

| Feature                 | Patient | Expert Community | Expert Top | Clinic Member | Clinic Admin | Admin |
| ----------------------- | ------- | ---------------- | ---------- | ------------- | ------------ | ----- |
| Book Appointments       | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| Browse Experts          | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| Leave Reviews           | ✅      | ✅               | ✅         | ✅            | ✅           | ✅    |
| **Accept Bookings**     | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| **Create Events**       | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| **Manage Availability** | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| **Connect Calendar**    | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| **View Patients**       | ❌      | ✅               | ✅         | ✅            | ✅           | ✅    |
| **View Analytics**      | ❌      | ❌               | ✅         | ❌            | ✅ 🔮        | ✅    |
| **Custom Branding**     | ❌      | ❌               | ✅         | ❌            | ✅ 🔮        | ✅    |
| **Manage Clinic**       | ❌      | ❌               | ❌         | View 🔮       | ✅ 🔮        | ✅    |
| **Manage Team**         | ❌      | ❌               | ❌         | View 🔮       | ✅ 🔮        | ✅    |
| **Platform Admin**      | ❌      | ❌               | ❌         | ❌            | ❌           | ✅    |

---

## 🚀 User Journey: Role Transitions

### New User → Patient

```
Sign Up
  ↓
✅ Default role: patient
  ↓
Can book appointments
Can browse experts
Can leave reviews
```

### Patient → Expert Community

```
Submit Expert Application
  ↓
Admin Reviews Application
  ↓
✅ Approved → Role: expert_community
  ↓
Can accept bookings
Can create events
Can manage availability
```

### Expert Community → Expert Top

```
Subscribe to Top Tier
  ↓
Payment Successful
  ↓
✅ Auto-upgrade → Role: expert_top
  ↓
+ View analytics
+ Custom branding
+ Premium features
```

### Expert → Clinic Member 🔮

```
Receive Clinic Invitation
  ↓
Accept Invitation
  ↓
✅ Added to clinic org with role: clinic_member
  ↓
+ View clinic dashboard
+ View shared patients
+ View clinic schedule
(Maintains personal expert practice)
```

### Clinic Member → Clinic Admin 🔮

```
Clinic Owner promotes member
  ↓
Role updated in clinic org
  ↓
✅ New role: clinic_admin
  ↓
+ Manage clinic settings
+ Invite/remove members
+ Manage revenue & payouts
```

---

## 💡 Key Insights

### Design Philosophy

1. **Start Minimal:** Everyone starts as `patient` (15 permissions)
2. **Progressive Enhancement:** Unlock features as users grow
3. **Clear Value Propositions:**
   - Community → Top: Analytics & Branding
   - Expert → Clinic: Team collaboration
   - Any Role → Admin: Platform management

### Permission Patterns

```typescript
// Pattern 1: Own Data (Scope: Self)
appointments: view_own; // ✅ Patient has this
appointments: view_incoming; // ❌ Patient doesn't need this

// Pattern 2: Resource Management (Scope: Created Resources)
events: create; // ✅ Expert Community+
events: view_own; // ✅ Only own events
events: view_all; // ❌ No one except admin

// Pattern 3: Organization-Wide (Scope: Organization)
clinic: view_patients; // ✅ Clinic Member+ (read-only)
clinic: manage_settings; // ✅ Clinic Admin only (write)

// Pattern 4: Platform-Wide (Scope: All Organizations)
users: view_all; // ✅ Platform Admin only
analytics: platform_growth; // ✅ Platform Admin only
```

### Upgrade Incentives

| Feature              | Available In       | Upgrade CTA                                            |
| -------------------- | ------------------ | ------------------------------------------------------ |
| 📊 Analytics         | Expert Top         | "Want to see your revenue trends? Upgrade to Top tier" |
| 🎨 Custom Branding   | Expert Top         | "Stand out with your own logo and colors"              |
| 👥 Clinic Management | Clinic Admin       | "Ready to grow your team? Create a clinic"             |
| 🎓 Course Creation   | Expert Lecturer 🔮 | "Share your knowledge at scale"                        |

---

## 📋 Quick Reference Cards

### Patient Role

```
Role: patient
Priority: 10
Permissions: 15

Core Actions:
✅ Book appointments
✅ View session notes
✅ Leave reviews
✅ Browse experts
✅ Manage billing

Dashboard: /patient/*
```

### Expert Community Role

```
Role: expert_community
Priority: 70
Permissions: 42

Core Actions:
✅ All Patient actions
✅ Accept bookings
✅ Create event types
✅ Manage availability
✅ View patient history
✅ Connect calendars

Dashboard: /dashboard, /appointments, /events, /availability
```

### Expert Top Role

```
Role: expert_top
Priority: 80
Permissions: 49

Core Actions:
✅ All Expert Community actions
✅ View analytics (revenue, patients, performance)
✅ Custom branding
✅ Export data

Dashboard: All Community routes + /analytics
```

### Platform Admin Role

```
Role: superadmin
Priority: 100
Permissions: 89 (ALL)

Core Actions:
✅ ALL actions
✅ Manage users & organizations
✅ Approve expert applications
✅ View platform analytics
✅ Process refunds & disputes
✅ Moderate content

Dashboard: ALL routes + /admin/*
```

---

## 🎯 Implementation Priority

### Phase 1: Core Roles (Q4 2025) ✅

1. Patient (15 permissions)
2. Expert Community (42 permissions)
3. Expert Top (49 permissions)
4. Platform Admin (89 permissions)

**Status:** Ready for implementation

### Phase 2: Clinic Roles (Q1 2026) 🔮

5. Clinic Member (46 permissions)
6. Clinic Admin (68 permissions)

**Prerequisite:** Multi-org support, clinic dashboard

### Phase 3: Learning Roles (Q2 2026) 🔮

7. Expert Lecturer (Course creators)
8. Student (Course learners)
9. Content Creator (Resource library)

**Prerequisite:** LMS platform, content management

---

## 📚 Related Documents

- **Configuration Guide:** `WORKOS-ROLES-PERMISSIONS-CONFIGURATION.md`
- **Quick Setup:** `WORKOS-DASHBOARD-QUICK-SETUP.md`
- **Implementation:** `WORKOS-RBAC-IMPLEMENTATION-GUIDE.md`
- **Dashboard Architecture:** `DASHBOARD-MENU-ARCHITECTURE.md`

---

**Built for:** Eleva Care Platform  
**Version:** 1.0  
**Last Updated:** November 13, 2025  
**Next Review:** After Phase 1 deployment
