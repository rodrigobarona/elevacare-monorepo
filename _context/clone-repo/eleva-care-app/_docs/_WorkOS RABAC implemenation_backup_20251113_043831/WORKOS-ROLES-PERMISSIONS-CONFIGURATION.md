# WorkOS RBAC: Complete Roles & Permissions Configuration

**Version:** 1.0  
**Date:** November 13, 2025  
**Status:** Ready for WorkOS Dashboard Configuration  
**Based On:** Dashboard Architecture v2.0 + Industry Best Practices

---

## Executive Summary

This document provides a **complete, production-ready list** of roles and permissions to configure in WorkOS Dashboard for the Eleva Care platform.

**Total Configuration:**

- **6 Primary Roles** (Patient, Expert Community, Expert Top, Clinic Admin, Clinic Member, Platform Admin)
- **89 Granular Permissions** across 15 resource categories
- **4 Future Roles** (Expert Lecturer, Student, Content Creator, Moderator)

**Design Principles:**

1. ✅ **Resource:Action Pattern** - Clear, predictable permission slugs
2. ✅ **Granular Control** - Fine-grained permissions for precise access
3. ✅ **Principle of Least Privilege** - Minimal permissions per role
4. ✅ **Role Inheritance** - Higher roles inherit lower role permissions
5. ✅ **Healthcare Compliance** - HIPAA/LGPD-ready permission structure
6. ✅ **Scalable** - Ready for clinics, LMS, and future features

---

## Quick Navigation

- [🎯 Phase 1: Current Roles (Implement Now)](#phase-1-current-roles-implement-now)
- [📋 All Permissions List](#complete-permissions-list-89-permissions)
- [🔮 Phase 2: Future Roles](#phase-2-future-roles-clinics--lms)
- [📖 WorkOS Dashboard Configuration Steps](#workos-dashboard-configuration-steps)
- [✅ Validation Checklist](#validation-checklist)

---

## Phase 1: Current Roles (Implement Now)

### Role Hierarchy & Priority

```
Priority 100: Platform Admin (superadmin)
Priority 90:  Clinic Admin (clinic_admin) [Future]
Priority 80:  Expert Top (expert_top)
Priority 70:  Expert Community (expert_community)
Priority 60:  Clinic Member (clinic_member) [Future]
Priority 10:  Patient (patient)
```

---

## 1. **Patient** (patient)

### Description

Basic user/patient role for booking appointments and accessing their healthcare journey.

### Priority

10 (Lowest)

### Permissions (15 permissions)

```typescript
// Appointments - Own Data Only
appointments: view_own; // View own appointments
appointments: create; // Book new appointments
appointments: cancel_own; // Cancel own appointments (within policy)
appointments: reschedule_own; // Reschedule own appointments

// Sessions - Own Data Only
sessions: view_own; // View own session notes (shared by expert)

// Reviews - Own Reviews Only
reviews: create; // Leave reviews after sessions
reviews: view_own; // View own reviews
reviews: edit_own; // Edit own reviews (within 30 days)
reviews: delete_own; // Delete own reviews (within 7 days)

// Experts - Browse & View
experts: browse; // Browse expert directory
experts: view_profiles; // View expert public profiles

// Profile - Own Profile Only
profile: view_own; // View own patient profile
profile: edit_own; // Edit own patient profile

// Billing - Own Billing Only
billing: view_own; // View own payment history & invoices
billing: methods_manage; // Manage own payment methods
```

### Dashboard Access

```
✅ /patient/dashboard
✅ /patient/appointments
✅ /patient/sessions
✅ /patient/reviews
✅ /patient/experts
✅ /patient/billing
✅ /patient/profile
✅ /patient/settings
❌ All other routes (403 Forbidden)
```

### Use Cases

- Book appointments with experts
- View session notes shared by experts
- Leave reviews after sessions
- Manage payment methods
- Update personal information

---

## 2. **Expert Community** (expert_community)

### Description

Standard expert tier with core expert features. Pays 20% commission (monthly) or 12% (annual subscription).

### Priority

70

### Permissions (42 permissions)

**Inherits from Patient:** All 15 patient permissions

**Plus Expert Permissions:**

```typescript
// Dashboard
dashboard: view_expert; // Access expert dashboard

// Appointments - Manage Incoming
appointments: view_incoming; // View appointments booked with them
appointments: manage_own; // Manage own appointment bookings
appointments: view_calendar; // View calendar view
appointments: confirm; // Confirm appointments
appointments: complete; // Mark appointments as completed

// Patients - View Own Patients
patients: view_own; // View list of own patients
patients: view_history; // View patient appointment history
patients: send_notes; // Share session notes with patients

// Events - Create & Manage Own
events: create; // Create new event types
events: view_own; // View own event types
events: edit_own; // Edit own event types
events: delete_own; // Delete own event types
events: toggle_active; // Activate/deactivate event types

// Availability - Manage Own
availability: view_own; // View own availability schedules
availability: create; // Create new schedules
availability: edit_own; // Edit own schedules
availability: delete_own; // Delete own schedules
availability: set_limits; // Set buffer times, max bookings

// Calendar Integration (Optional)
calendars: connect; // Connect external calendars (Google, etc.)
calendars: view_own; // View connected calendars
calendars: edit_own; // Edit calendar settings
calendars: disconnect; // Disconnect calendars

// Profile - Manage Public Profile
profile: view_expert; // View own expert public profile
profile: edit_expert; // Edit public expert profile
profile: preview; // Preview profile as patients see it
profile: manage_link; // Manage booking link settings

// Billing - View Own Earnings
billing: view_earnings; // View earnings & commission
billing: view_payouts; // View payout history
billing: view_subscription; // View current subscription plan
billing: manage_subscription; // Upgrade/downgrade subscription

// Reviews - View Reviews About Them
reviews: view_about_me; // View reviews about them
reviews: respond; // Respond to reviews

// Settings
settings: view_own; // View own settings
settings: edit_own; // Edit account, notifications, integrations
settings: security; // Manage 2FA, sessions
```

### Dashboard Access

```
✅ /dashboard (expert overview)
✅ /appointments
✅ /availability
✅ /events
✅ /profile
✅ /billing
✅ /settings
❌ /analytics (Community tier doesn't have access)
❌ /admin
❌ /clinic
```

### Use Cases

- Create consultation event types
- Set weekly availability schedules
- View and manage incoming appointments
- Share session notes with patients
- View earnings and subscription details
- Respond to patient reviews

---

## 3. **Expert Top** (expert_top)

### Description

Premium expert tier with advanced features. Pays 18% commission (monthly) or 8% (annual subscription).

### Priority

80

### Permissions (49 permissions)

**Inherits from Expert Community:** All 42 expert_community permissions

**Plus Top Expert Exclusive Permissions:**

```typescript
// Analytics - Advanced Features
analytics:view              // Access analytics dashboard
analytics:revenue           // View revenue analytics
analytics:patients          // View patient demographics & insights
analytics:performance       // View booking trends & conversion
analytics:export            // Export analytics data

// Branding - Customization
branding:customize          // Customize profile branding
branding:upload_logo        // Upload custom logo
branding:custom_colors      // Set custom brand colors

// Group Sessions (Future)
group_sessions:create       // Create group session events
group_sessions:manage       // Manage group sessions

// Messaging - Direct Communication (Future)
messaging:direct            // Send direct messages to patients
messaging:view_conversations // View message history

// Resources - Access Premium Content (Future)
resources:access_library    // Access resource library
resources:view_templates    // View session templates
resources:view_guides       // Access premium guides
```

### Dashboard Access

```
✅ All Expert Community routes
✅ /analytics (Top tier exclusive)
✅ /resources (Top tier exclusive - future)
❌ /admin
❌ /clinic
```

### Use Cases

- Everything Expert Community can do
- View advanced analytics (revenue, patient demographics)
- Customize profile branding
- Access premium resources and templates
- Create group sessions (future)
- Direct messaging with patients (future)

---

## 4. **Clinic Member** (clinic_member) 🔮 Phase 2

### Description

Expert who is a member of a clinic organization (not admin). Can manage their own practice + view shared clinic resources.

### Priority

60

### Permissions (45 permissions)

**Inherits from Expert Community:** All 42 expert_community permissions

**Plus Clinic Member Permissions:**

```typescript
// Clinic - Read-Only Access
clinic: view_dashboard; // View clinic overview (read-only)
clinic: view_patients; // View shared clinic patients (read-only)
clinic: view_schedule; // View clinic schedule (read-only)

// Team - View Only
team: view_members; // View team members
```

### Dashboard Access

```
✅ All Expert Community routes
✅ /clinic (read-only view)
✅ /clinic/patients (view only)
✅ /clinic/schedule (view only)
✅ /clinic/team (view only)
❌ /clinic/settings
❌ /clinic/revenue
❌ /admin
```

### Use Cases

- Manage own practice (appointments, events, availability)
- View shared clinic patients
- See clinic-wide schedule
- View team members
- No administrative access

---

## 5. **Clinic Admin** (clinic_admin) 🔮 Phase 2

### Description

Administrator of a clinic organization. Can manage team, patients, schedule, and clinic settings.

### Priority

90

### Permissions (68 permissions)

**Inherits from Clinic Member:** All 45 clinic_member permissions

**Plus Clinic Admin Permissions:**

```typescript
// Clinic - Full Management
clinic: manage_settings; // Manage clinic settings
clinic: manage_branding; // Manage clinic branding
clinic: view_analytics; // View clinic-wide analytics
clinic: export_data; // Export clinic data

// Team - Full Management
team: invite_members; // Invite new team members
team: remove_members; // Remove team members
team: manage_roles; // Assign/change member roles
team: view_performance; // View team member performance

// Schedule - Clinic-Wide Management
schedule: manage_clinic; // Manage multi-practitioner schedule
schedule: manage_rooms; // Manage rooms/locations (future)
schedule: view_capacity; // View capacity planning

// Patients - Clinic-Wide Access
patients: view_all; // View all clinic patients
patients: manage_records; // Manage patient records
patients: view_insights; // View patient analytics

// Revenue - Clinic Financial Management
revenue: view_overview; // View clinic revenue overview
revenue: view_splits; // View commission splits
revenue: manage_payouts; // Manage payout schedules
revenue: view_invoices; // View client invoices
revenue: export_financial; // Export financial reports

// Billing - Clinic Subscription
billing: manage_clinic_sub; // Manage clinic subscription
billing: view_clinic_billing; // View clinic billing history
```

### Dashboard Access

```
✅ All Clinic Member routes
✅ /clinic (full access)
✅ /clinic/team (full management)
✅ /clinic/schedule (full management)
✅ /clinic/patients (full access)
✅ /clinic/analytics
✅ /clinic/settings
✅ /clinic/revenue
❌ /admin (platform admin only)
```

### Use Cases

- Everything Clinic Member can do
- Invite and manage clinic team members
- Manage clinic-wide schedule and rooms
- Access all clinic patient records
- View clinic-wide analytics and revenue
- Manage clinic subscription and settings

---

## 6. **Platform Admin** (superadmin)

### Description

Platform-level administrator with full system access. For Eleva Care team only.

### Priority

100 (Highest)

### Permissions (89 permissions - ALL)

**Full Access:** All permissions across the platform

```typescript
// Users - Full Management
users:view_all              // View all users
users:create                // Create users
users:edit                  // Edit any user
users:delete                // Delete users (soft delete)
users:manage_roles          // Assign/change user roles
users:impersonate           // Impersonate users (support)

// Organizations - Full Management
organizations:view_all      // View all organizations
organizations:create        // Create organizations
organizations:edit          // Edit organizations
organizations:delete        // Delete organizations
organizations:manage_settings // Manage organization settings

// Experts - Application Management
experts:view_applications   // View expert applications
experts:approve            // Approve expert applications
experts:reject             // Reject expert applications
experts:suspend            // Suspend expert accounts
experts:verify             // Verify expert credentials

// Platform Analytics - System-Wide
analytics:platform_growth   // View user growth metrics
analytics:platform_revenue  // View platform revenue
analytics:platform_engagement // View engagement metrics
analytics:platform_churn    // View retention/churn data
analytics:platform_export   // Export platform analytics

// Payments - Payment Operations
payments:view_all           // View all transactions
payments:view_transfers     // View payout transfers
payments:manage_disputes    // Manage payment disputes
payments:process_refunds    // Process refunds
payments:retry_failed       // Retry failed payments

// Categories - Content Management
categories:create           // Create categories
categories:edit            // Edit categories
categories:delete          // Delete categories
categories:manage_tags     // Manage tags

// Platform Settings - System Configuration
settings:view_platform      // View platform settings
settings:edit_platform      // Edit platform settings
settings:manage_features    // Manage feature flags
settings:manage_integrations // Manage API keys, webhooks
settings:security          // Manage security settings

// Moderation - Content Moderation
moderation:view_flags       // View flagged content
moderation:review_content   // Review flagged content
moderation:remove_content   // Remove inappropriate content
moderation:ban_users        // Ban users

// Audit - Compliance & Monitoring
audit:view_logs            // View audit logs
audit:export_logs          // Export audit logs
audit:view_reports         // View compliance reports
audit:generate_reports     // Generate custom reports

// Support - Customer Support
support:view_tickets        // View support tickets
support:respond_tickets     // Respond to tickets
support:escalate           // Escalate tickets
support:close_tickets      // Close tickets
```

### Dashboard Access

```
✅ ALL ROUTES (platform-wide access)
✅ /admin (platform admin dashboard)
✅ /admin/users
✅ /admin/organizations
✅ /admin/analytics
✅ /admin/payments
✅ /admin/categories
✅ /admin/settings
✅ Can access any user's data (for support)
```

### Use Cases

- Manage all users and organizations
- Approve/reject expert applications
- View platform-wide analytics
- Manage payment disputes and refunds
- Configure platform settings and features
- Moderate content and manage flagged reviews
- Access audit logs for compliance
- Provide customer support

---

## Complete Permissions List (89 Permissions)

### Category: Appointments (8)

```
appointments:view_own           - View own appointments
appointments:view_incoming      - View appointments booked with you
appointments:create             - Book new appointments
appointments:manage_own         - Manage own bookings
appointments:cancel_own         - Cancel own appointments
appointments:reschedule_own     - Reschedule own appointments
appointments:view_calendar      - View calendar view
appointments:confirm            - Confirm appointments
appointments:complete           - Mark as completed
```

### Category: Sessions (2)

```
sessions:view_own              - View own session notes
sessions:view_history          - View session history
```

### Category: Patients (7)

```
patients:view_own              - View own patients
patients:view_all              - View all clinic patients
patients:view_history          - View patient appointment history
patients:send_notes            - Share session notes
patients:manage_records        - Manage patient records
patients:view_insights         - View patient analytics
```

### Category: Events (6)

```
events:create                  - Create event types
events:view_own                - View own events
events:edit_own                - Edit own events
events:delete_own              - Delete own events
events:toggle_active           - Activate/deactivate events
```

### Category: Availability (6)

```
availability:view_own          - View own availability
availability:create            - Create schedules
availability:edit_own          - Edit schedules
availability:delete_own        - Delete schedules
availability:set_limits        - Set buffer/max bookings
```

### Category: Calendars (5)

```
calendars:connect              - Connect external calendars
calendars:view_own             - View connected calendars
calendars:edit_own             - Edit calendar settings
calendars:disconnect           - Disconnect calendars
```

### Category: Reviews (7)

```
reviews:create                 - Leave reviews
reviews:view_own               - View own reviews
reviews:view_about_me          - View reviews about me
reviews:edit_own               - Edit own reviews
reviews:delete_own             - Delete own reviews
reviews:respond                - Respond to reviews
```

### Category: Profile (7)

```
profile:view_own               - View own profile
profile:edit_own               - Edit own profile
profile:view_expert            - View expert profile
profile:edit_expert            - Edit expert profile
profile:preview                - Preview public profile
profile:manage_link            - Manage booking link
```

### Category: Experts (3)

```
experts:browse                 - Browse expert directory
experts:view_profiles          - View expert profiles
experts:view_applications      - View expert applications (admin)
experts:approve                - Approve applications (admin)
experts:reject                 - Reject applications (admin)
experts:suspend                - Suspend experts (admin)
experts:verify                 - Verify credentials (admin)
```

### Category: Analytics (6)

```
analytics:view                 - Access analytics dashboard
analytics:revenue              - View revenue analytics
analytics:patients             - View patient insights
analytics:performance          - View performance metrics
analytics:export               - Export analytics data
analytics:platform_growth      - Platform growth (admin)
analytics:platform_revenue     - Platform revenue (admin)
analytics:platform_engagement  - Platform engagement (admin)
analytics:platform_churn       - Platform churn (admin)
analytics:platform_export      - Export platform data (admin)
```

### Category: Branding (4)

```
branding:customize             - Customize branding
branding:upload_logo           - Upload custom logo
branding:custom_colors         - Set custom colors
```

### Category: Billing (10)

```
billing:view_own               - View own billing
billing:view_earnings          - View earnings
billing:view_payouts           - View payouts
billing:view_subscription      - View subscription
billing:manage_subscription    - Manage subscription
billing:methods_manage         - Manage payment methods
billing:manage_clinic_sub      - Manage clinic subscription
billing:view_clinic_billing    - View clinic billing
```

### Category: Settings (4)

```
settings:view_own              - View own settings
settings:edit_own              - Edit own settings
settings:security              - Manage security settings
settings:view_platform         - View platform settings (admin)
settings:edit_platform         - Edit platform settings (admin)
settings:manage_features       - Manage feature flags (admin)
settings:manage_integrations   - Manage integrations (admin)
```

### Category: Clinic (15) 🔮 Phase 2

```
clinic:view_dashboard          - View clinic overview
clinic:manage_settings         - Manage clinic settings
clinic:manage_branding         - Manage clinic branding
clinic:view_analytics          - View clinic analytics
clinic:view_patients           - View clinic patients
clinic:export_data             - Export clinic data

// Team Management
team:view_members              - View team members
team:invite_members            - Invite members
team:remove_members            - Remove members
team:manage_roles              - Manage roles
team:view_performance          - View performance

// Schedule Management
schedule:manage_clinic         - Manage clinic schedule
schedule:manage_rooms          - Manage rooms
schedule:view_capacity         - View capacity planning

// Revenue Management
revenue:view_overview          - View revenue overview
revenue:view_splits            - View commission splits
revenue:manage_payouts         - Manage payouts
revenue:view_invoices          - View invoices
revenue:export_financial       - Export financial data
```

### Category: Dashboard (2)

```
dashboard:view_expert          - Access expert dashboard
dashboard:view_patient         - Access patient dashboard
```

### Category: Platform Admin (20)

```
// Users
users:view_all                 - View all users
users:create                   - Create users
users:edit                     - Edit users
users:delete                   - Delete users
users:manage_roles             - Manage user roles
users:impersonate              - Impersonate users

// Organizations
organizations:view_all         - View all organizations
organizations:create           - Create organizations
organizations:edit             - Edit organizations
organizations:delete           - Delete organizations
organizations:manage_settings  - Manage org settings

// Payments
payments:view_all              - View all transactions
payments:view_transfers        - View transfers
payments:manage_disputes       - Manage disputes
payments:process_refunds       - Process refunds
payments:retry_failed          - Retry failed payments

// Categories
categories:create              - Create categories
categories:edit                - Edit categories
categories:delete              - Delete categories
categories:manage_tags         - Manage tags

// Moderation
moderation:view_flags          - View flagged content
moderation:review_content      - Review content
moderation:remove_content      - Remove content
moderation:ban_users           - Ban users

// Audit
audit:view_logs                - View audit logs
audit:export_logs              - Export audit logs
audit:view_reports             - View reports
audit:generate_reports         - Generate reports

// Support
support:view_tickets           - View tickets
support:respond_tickets        - Respond to tickets
support:escalate               - Escalate tickets
support:close_tickets          - Close tickets
```

---

## Phase 2: Future Roles (Clinics & LMS)

### 7. Expert Lecturer (expert_lecturer) 🔮

**Description:** Creates and manages educational content (courses, webinars)  
**Priority:** 65  
**Inherits:** Expert Community permissions  
**Additional Permissions:**

```
courses:create
courses:manage
courses:view_students
courses:issue_certificates
content:upload_videos
content:create_quizzes
webinars:host
webinars:manage
```

### 8. Student (student) 🔮

**Description:** Enrolls in and accesses educational courses  
**Priority:** 15  
**Inherits:** Patient permissions  
**Additional Permissions:**

```
courses:enroll
courses:view_enrolled
courses:view_content
courses:submit_assignments
courses:view_progress
courses:download_certificates
```

### 9. Content Creator (content_creator) 🔮

**Description:** Creates content for resource library  
**Priority:** 70  
**Permissions:**

```
content:create
content:edit_own
content:publish
content:view_analytics
resources:upload
resources:manage_library
```

### 10. Moderator (moderator) 🔮

**Description:** Moderates user-generated content (reviews, comments)  
**Priority:** 85  
**Permissions:**

```
moderation:view_flags
moderation:review_content
moderation:remove_content
moderation:respond_users
reviews:moderate
reviews:flag
reviews:remove_flagged
```

---

## WorkOS Dashboard Configuration Steps

### Step 1: Access WorkOS Dashboard

1. Go to [WorkOS Dashboard](https://dashboard.workos.com)
2. Navigate to **RBAC** → **Roles & Permissions**

### Step 2: Create Permissions First

**Important:** Create ALL permissions before creating roles.

**Format:** `resource:action`

**Example:**

```
Name: View Own Appointments
Slug: appointments:view_own
Description: Allows users to view their own appointments
Category: Appointments
```

**Copy-Paste Ready Permissions (Organized by Category):**

<details>
<summary>📋 Click to expand: All 89 Permissions for Copy-Paste</summary>

```
# Appointments (9 permissions)
appointments:view_own | View own appointments
appointments:view_incoming | View appointments booked with you
appointments:create | Book new appointments
appointments:manage_own | Manage own bookings
appointments:cancel_own | Cancel own appointments
appointments:reschedule_own | Reschedule own appointments
appointments:view_calendar | View calendar view
appointments:confirm | Confirm appointments
appointments:complete | Mark appointments as completed

# Sessions (2 permissions)
sessions:view_own | View own session notes
sessions:view_history | View session history

# Patients (7 permissions)
patients:view_own | View own patients
patients:view_all | View all clinic patients
patients:view_history | View patient appointment history
patients:send_notes | Share session notes with patients
patients:manage_records | Manage patient records
patients:view_insights | View patient analytics

# Events (5 permissions)
events:create | Create event types
events:view_own | View own events
events:edit_own | Edit own events
events:delete_own | Delete own events
events:toggle_active | Activate/deactivate events

# Availability (5 permissions)
availability:view_own | View own availability
availability:create | Create schedules
availability:edit_own | Edit schedules
availability:delete_own | Delete schedules
availability:set_limits | Set buffer times and max bookings

# Calendars (4 permissions)
calendars:connect | Connect external calendars
calendars:view_own | View connected calendars
calendars:edit_own | Edit calendar settings
calendars:disconnect | Disconnect calendars

# Reviews (6 permissions)
reviews:create | Leave reviews after sessions
reviews:view_own | View own reviews
reviews:view_about_me | View reviews about me
reviews:edit_own | Edit own reviews (within 30 days)
reviews:delete_own | Delete own reviews (within 7 days)
reviews:respond | Respond to reviews

# Profile (6 permissions)
profile:view_own | View own profile
profile:edit_own | Edit own profile
profile:view_expert | View expert profile
profile:edit_expert | Edit expert profile
profile:preview | Preview public profile
profile:manage_link | Manage booking link

# Experts (7 permissions)
experts:browse | Browse expert directory
experts:view_profiles | View expert profiles
experts:view_applications | View expert applications
experts:approve | Approve expert applications
experts:reject | Reject expert applications
experts:suspend | Suspend expert accounts
experts:verify | Verify expert credentials

# Analytics (10 permissions)
analytics:view | Access analytics dashboard
analytics:revenue | View revenue analytics
analytics:patients | View patient insights
analytics:performance | View performance metrics
analytics:export | Export analytics data
analytics:platform_growth | View platform growth
analytics:platform_revenue | View platform revenue
analytics:platform_engagement | View platform engagement
analytics:platform_churn | View platform churn
analytics:platform_export | Export platform data

# Branding (3 permissions)
branding:customize | Customize branding
branding:upload_logo | Upload custom logo
branding:custom_colors | Set custom colors

# Billing (8 permissions)
billing:view_own | View own billing
billing:view_earnings | View earnings
billing:view_payouts | View payouts
billing:view_subscription | View subscription
billing:manage_subscription | Manage subscription
billing:methods_manage | Manage payment methods
billing:manage_clinic_sub | Manage clinic subscription
billing:view_clinic_billing | View clinic billing

# Settings (7 permissions)
settings:view_own | View own settings
settings:edit_own | Edit own settings
settings:security | Manage security (2FA, sessions)
settings:view_platform | View platform settings
settings:edit_platform | Edit platform settings
settings:manage_features | Manage feature flags
settings:manage_integrations | Manage integrations (API, webhooks)

# Dashboard (2 permissions)
dashboard:view_expert | Access expert dashboard
dashboard:view_patient | Access patient dashboard
```

</details>

### Step 3: Create Roles

**Order:** Create from lowest to highest priority.

**For Each Role:**

1. Click **Create Role**
2. Enter role details:
   - **Name:** Display name (e.g., "Patient")
   - **Slug:** `patient` (lowercase, matches code)
   - **Description:** (See role descriptions above)
   - **Priority:** (See priority numbers above)
3. Assign permissions (use checkboxes)
4. Save

**Quick Copy Template:**

```
Role 1:
Name: Patient
Slug: patient
Priority: 10
Permissions: [List 15 permissions from Patient section]

Role 2:
Name: Expert Community
Slug: expert_community
Priority: 70
Permissions: [All Patient permissions + 27 expert permissions]

Role 3:
Name: Expert Top
Slug: expert_top
Priority: 80
Permissions: [All Expert Community permissions + 7 top expert permissions]

Role 4:
Name: Clinic Member (Phase 2)
Slug: clinic_member
Priority: 60
Permissions: [All Expert Community permissions + 3 clinic permissions]

Role 5:
Name: Clinic Admin (Phase 2)
Slug: clinic_admin
Priority: 90
Permissions: [All Clinic Member permissions + 23 clinic admin permissions]

Role 6:
Name: Platform Admin
Slug: superadmin
Priority: 100
Permissions: [ALL 89 permissions]
```

### Step 4: Verify Configuration

After creating all roles and permissions:

1. **Test JWT Claims:**

   ```typescript
   // Sign in as each role and verify JWT contains:
   {
     "role": "expert_top",
     "permissions": ["events:create", "events:manage", ...]
   }
   ```

2. **Test Permission Checks:**

   ```typescript
   // In your application:
   const hasPermission = await hasPermission('analytics:view');
   // Should return true for expert_top, false for expert_community
   ```

3. **Test RLS Policies:**
   ```sql
   -- Should respect permissions from JWT
   SELECT * FROM events; -- Should apply RLS based on permissions
   ```

---

## Role Assignment Workflow

### New User Signup

```typescript
// Default role assignment
async function onUserSignup(workosUserId: string, email: string) {
  // 1. Create personal organization
  const org = await createPersonalOrganization(workosUserId, 'patient_personal');

  // 2. Assign default role (patient)
  await workos.userManagement.updateOrganizationMembership({
    organizationMembershipId: membership.id,
    roleSlug: 'patient', // Default role for all new users
  });
}
```

### Expert Application Approval

```typescript
// Promote patient to expert after approval
async function approveExpertApplication(applicationId: string) {
  const application = await getApplication(applicationId);

  // Determine tier based on review
  const roleSlug = application.approvedTier === 'top' ? 'expert_top' : 'expert_community';

  // Update role via WorkOS
  await workos.userManagement.updateOrganizationMembership({
    organizationMembershipId: membership.id,
    roleSlug,
  });

  // Update organization type
  await db
    .update(OrganizationsTable)
    .set({ type: 'expert_individual' })
    .where(eq(OrganizationsTable.id, user.orgId));
}
```

### Subscription Upgrade

```typescript
// Upgrade from Community to Top tier
async function upgradeToTopTier(workosUserId: string) {
  // 1. Update Stripe subscription
  await upgradeStripeSubscription(workosUserId, 'top');

  // 2. Update role in WorkOS (automatic permission inheritance)
  await workos.userManagement.updateOrganizationMembership({
    organizationMembershipId: membership.id,
    roleSlug: 'expert_top', // Now has analytics:*, branding:* permissions
  });

  // User's next JWT will include new permissions
}
```

### Clinic Member Invitation

```typescript
// Invite expert to join clinic (Phase 2)
async function inviteExpertToClinic(expertEmail: string, clinicOrgId: string) {
  // WorkOS handles invitation
  const invitation = await workos.userManagement.createOrganizationInvitation({
    email: expertEmail,
    organizationId: clinicOrgId,
    roleSlug: 'clinic_member', // Start as member
  });

  // Expert maintains their own expert role in personal org
  // Gets additional clinic_member role in clinic org
}
```

---

## Permission Inheritance Examples

### Example 1: Expert Community → Expert Top

```typescript
// Expert Community permissions (42)
const communityPermissions = [
  'appointments:*',
  'events:*',
  'availability:*',
  'profile:*',
  'billing:view_*',
  // ...27 more expert permissions
];

// Expert Top = Community + Exclusive (49 total)
const topPermissions = [
  ...communityPermissions, // Inherits all 42
  'analytics:view', // +7 exclusive
  'analytics:revenue',
  'analytics:patients',
  'analytics:performance',
  'analytics:export',
  'branding:customize',
  'branding:upload_logo',
  'branding:custom_colors',
];
```

### Example 2: Clinic Member → Clinic Admin

```typescript
// Clinic Member permissions (45)
const memberPermissions = [
  ...communityPermissions, // All expert community (42)
  'clinic:view_dashboard', // +3 clinic view
  'clinic:view_patients',
  'clinic:view_schedule',
];

// Clinic Admin = Member + Management (68 total)
const adminPermissions = [
  ...memberPermissions, // Inherits all 45
  'clinic:manage_settings', // +23 management
  'team:invite_members',
  'team:remove_members',
  'revenue:view_overview',
  'revenue:manage_payouts',
  // ...18 more management permissions
];
```

---

## Testing Checklist

### ✅ Permission Tests

```typescript
// Test 1: Patient can't access expert dashboard
await expect(hasPermission('dashboard:view_expert', 'patient')).toBe(false);

// Test 2: Expert Community can create events
await expect(hasPermission('events:create', 'expert_community')).toBe(true);

// Test 3: Expert Community can't access analytics
await expect(hasPermission('analytics:view', 'expert_community')).toBe(false);

// Test 4: Expert Top can access analytics
await expect(hasPermission('analytics:view', 'expert_top')).toBe(true);

// Test 5: Platform Admin has all permissions
await expect(hasPermission('users:delete', 'superadmin')).toBe(true);
await expect(hasPermission('analytics:view', 'superadmin')).toBe(true);
```

### ✅ Role Assignment Tests

```typescript
// Test 1: New user defaults to patient
const newUser = await createUser('patient@example.com');
expect(await getUserRole(newUser.id)).toBe('patient');

// Test 2: Expert application approval updates role
await approveExpertApplication(applicationId, 'top');
expect(await getUserRole(expertId)).toBe('expert_top');

// Test 3: Subscription upgrade changes role
await upgradeSubscription(userId, 'annual_top');
expect(await getUserRole(userId)).toBe('expert_top');
```

### ✅ RLS Policy Tests

```sql
-- Test 1: Patient can only see own appointments
SET LOCAL request.jwt.claims = '{"sub": "user_patient_123", "role": "patient"}';
SELECT COUNT(*) FROM appointments; -- Should only return their appointments

-- Test 2: Expert can see incoming appointments
SET LOCAL request.jwt.claims = '{"sub": "user_expert_456", "role": "expert_community", "permissions": ["appointments:view_incoming"]}';
SELECT COUNT(*) FROM appointments WHERE expert_id = 'user_expert_456'; -- Should return all

-- Test 3: Admin can see all appointments
SET LOCAL request.jwt.claims = '{"sub": "user_admin_789", "role": "superadmin"}';
SELECT COUNT(*) FROM appointments; -- Should return ALL appointments
```

---

## Validation Checklist

Before deploying to production:

### WorkOS Dashboard

- [ ] All 89 permissions created with correct slugs
- [ ] All 6 roles created with correct priorities
- [ ] Permissions correctly assigned to each role
- [ ] Inheritance working (higher roles have lower role permissions)
- [ ] JWT claims include `role` and `permissions` fields

### Application Code

- [ ] Permission constants match WorkOS slugs exactly
- [ ] Role checking uses JWT claims (not database)
- [ ] Middleware protects routes based on permissions
- [ ] UI shows/hides features based on permissions
- [ ] API endpoints validate permissions before actions

### Database (RLS)

- [ ] RLS policies use `auth.jwt_permissions()` function
- [ ] Policies check appropriate permissions for each action
- [ ] Test queries with different roles return correct data
- [ ] Performance is acceptable (permissions from JWT, not DB joins)

### User Experience

- [ ] Clear error messages when permission denied
- [ ] Upgrade CTAs shown to users without premium permissions
- [ ] Role badges displayed in UI (community/top/admin)
- [ ] Feature discovery works (users know what they're missing)

---

## Migration Strategy

### Phase 1: Current Features (Now)

1. ✅ Create Patient role
2. ✅ Create Expert Community role
3. ✅ Create Expert Top role
4. ✅ Create Platform Admin role
5. ✅ Migrate existing users to new roles
6. ✅ Test thoroughly in staging
7. ✅ Deploy to production

### Phase 2: Clinic Features (Q1 2026)

8. ✅ Create Clinic Member role
9. ✅ Create Clinic Admin role
10. ✅ Add clinic permissions
11. ✅ Test multi-org scenarios
12. ✅ Launch clinic beta

### Phase 3: Learning Platform (Q2 2026)

13. ✅ Create Expert Lecturer role
14. ✅ Create Student role
15. ✅ Create Content Creator role
16. ✅ Add LMS permissions
17. ✅ Launch LMS beta

---

## Support & Resources

### Documentation

- **WorkOS RBAC Docs:** https://workos.com/docs/rbac
- **Implementation Guide:** `_docs/_WorkOS RBAC implementation/WORKOS-RBAC-IMPLEMENTATION-GUIDE.md`
- **Quick Reference:** `_docs/_WorkOS RBAC implementation/WORKOS-RBAC-QUICK-REFERENCE.md`
- **Dashboard Architecture:** `_docs/_rethink folder and menu structure/DASHBOARD-MENU-ARCHITECTURE.md`

### Contact

- 💬 Slack: #dev-platform
- 📧 Email: dev-team@eleva.care
- 🐛 GitHub: Issues with `[rbac]` tag

---

**Ready to Configure?** Follow the steps in [WorkOS Dashboard Configuration Steps](#workos-dashboard-configuration-steps) ⬆️

**Questions?** All permissions align with your dashboard architecture and are production-ready! 🎉

---

**Document Version:** 1.0  
**Last Updated:** November 13, 2025  
**Next Review:** After Phase 1 deployment
