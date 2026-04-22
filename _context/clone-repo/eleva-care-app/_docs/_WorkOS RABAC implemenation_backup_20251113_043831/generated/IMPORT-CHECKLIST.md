# WorkOS RBAC Import Checklist

**Use this checklist while importing to WorkOS Dashboard to track your progress.**

---

## 📋 Pre-Import Preparation

- [ ] Reviewed the configuration in `workos-rbac-config.md`
- [ ] Opened WorkOS Dashboard at [dashboard.workos.com](https://dashboard.workos.com)
- [ ] Navigated to **RBAC** → **Roles & Permissions**
- [ ] Opened `workos-permissions.csv` in spreadsheet software
- [ ] Decided on Phase 1 only (4 roles) or Full (6 roles)

---

## 🔐 Step 1: Create Permissions (137 total)

**Progress:** \_\_\_ / 137 permissions created

### Appointments (9 permissions)

- [ ] `appointments:view_own` - View own appointments
- [ ] `appointments:view_incoming` - View appointments booked with you
- [ ] `appointments:create` - Book new appointments
- [ ] `appointments:manage_own` - Manage own bookings
- [ ] `appointments:cancel_own` - Cancel own appointments
- [ ] `appointments:reschedule_own` - Reschedule own appointments
- [ ] `appointments:view_calendar` - View calendar view
- [ ] `appointments:confirm` - Confirm appointments
- [ ] `appointments:complete` - Mark appointments as completed

### Sessions (2 permissions)

- [ ] `sessions:view_own` - View own session notes
- [ ] `sessions:view_history` - View session history

### Patients (6 permissions)

- [ ] `patients:view_own` - View own patients
- [ ] `patients:view_all` - View all clinic patients
- [ ] `patients:view_history` - View patient appointment history
- [ ] `patients:send_notes` - Share session notes with patients
- [ ] `patients:manage_records` - Manage patient records
- [ ] `patients:view_insights` - View patient analytics

### Events (5 permissions)

- [ ] `events:create` - Create event types
- [ ] `events:view_own` - View own events
- [ ] `events:edit_own` - Edit own events
- [ ] `events:delete_own` - Delete own events
- [ ] `events:toggle_active` - Activate/deactivate events

### Availability (5 permissions)

- [ ] `availability:view_own` - View own availability
- [ ] `availability:create` - Create schedules
- [ ] `availability:edit_own` - Edit schedules
- [ ] `availability:delete_own` - Delete schedules
- [ ] `availability:set_limits` - Set buffer times and max bookings

### Calendars (4 permissions)

- [ ] `calendars:connect` - Connect external calendars
- [ ] `calendars:view_own` - View connected calendars
- [ ] `calendars:edit_own` - Edit calendar settings
- [ ] `calendars:disconnect` - Disconnect calendars

### Reviews (6 permissions)

- [ ] `reviews:create` - Leave reviews after sessions
- [ ] `reviews:view_own` - View own reviews
- [ ] `reviews:view_about_me` - View reviews about me
- [ ] `reviews:edit_own` - Edit own reviews (within 30 days)
- [ ] `reviews:delete_own` - Delete own reviews (within 7 days)
- [ ] `reviews:respond` - Respond to reviews

### Profile (6 permissions)

- [ ] `profile:view_own` - View own profile
- [ ] `profile:edit_own` - Edit own profile
- [ ] `profile:view_expert` - View expert profile
- [ ] `profile:edit_expert` - Edit expert profile
- [ ] `profile:preview` - Preview public profile
- [ ] `profile:manage_link` - Manage booking link

### Experts (7 permissions)

- [ ] `experts:browse` - Browse expert directory
- [ ] `experts:view_profiles` - View expert profiles
- [ ] `experts:view_applications` - View expert applications
- [ ] `experts:approve` - Approve expert applications
- [ ] `experts:reject` - Reject expert applications
- [ ] `experts:suspend` - Suspend expert accounts
- [ ] `experts:verify` - Verify expert credentials

### Analytics (10 permissions)

- [ ] `analytics:view` - Access analytics dashboard
- [ ] `analytics:revenue` - View revenue analytics
- [ ] `analytics:patients` - View patient insights
- [ ] `analytics:performance` - View performance metrics
- [ ] `analytics:export` - Export analytics data
- [ ] `analytics:platform_growth` - View platform growth
- [ ] `analytics:platform_revenue` - View platform revenue
- [ ] `analytics:platform_engagement` - View platform engagement
- [ ] `analytics:platform_churn` - View platform churn
- [ ] `analytics:platform_export` - Export platform data

### Branding (3 permissions)

- [ ] `branding:customize` - Customize branding
- [ ] `branding:upload_logo` - Upload custom logo
- [ ] `branding:custom_colors` - Set custom colors

### Billing (8 permissions)

- [ ] `billing:view_own` - View own billing
- [ ] `billing:view_earnings` - View earnings
- [ ] `billing:view_payouts` - View payouts
- [ ] `billing:view_subscription` - View subscription
- [ ] `billing:manage_subscription` - Manage subscription
- [ ] `billing:methods_manage` - Manage payment methods
- [ ] `billing:manage_clinic_sub` - Manage clinic subscription
- [ ] `billing:view_clinic_billing` - View clinic billing

### Settings (7 permissions)

- [ ] `settings:view_own` - View own settings
- [ ] `settings:edit_own` - Edit own settings
- [ ] `settings:security` - Manage security (2FA, sessions)
- [ ] `settings:view_platform` - View platform settings
- [ ] `settings:edit_platform` - Edit platform settings
- [ ] `settings:manage_features` - Manage feature flags
- [ ] `settings:manage_integrations` - Manage integrations (API, webhooks)

### Dashboard (2 permissions)

- [ ] `dashboard:view_expert` - Access expert dashboard
- [ ] `dashboard:view_patient` - Access patient dashboard

### Users (6 permissions) - Platform Admin

- [ ] `users:view_all` - View all users
- [ ] `users:create` - Create users
- [ ] `users:edit` - Edit users
- [ ] `users:delete` - Delete users (soft delete)
- [ ] `users:manage_roles` - Manage user roles
- [ ] `users:impersonate` - Impersonate users (support)

### Organizations (5 permissions) - Platform Admin

- [ ] `organizations:view_all` - View all organizations
- [ ] `organizations:create` - Create organizations
- [ ] `organizations:edit` - Edit organizations
- [ ] `organizations:delete` - Delete organizations
- [ ] `organizations:manage_settings` - Manage organization settings

### Payments (5 permissions) - Platform Admin

- [ ] `payments:view_all` - View all transactions
- [ ] `payments:view_transfers` - View transfers
- [ ] `payments:manage_disputes` - Manage disputes
- [ ] `payments:process_refunds` - Process refunds
- [ ] `payments:retry_failed` - Retry failed payments

### Categories (4 permissions) - Platform Admin

- [ ] `categories:create` - Create categories
- [ ] `categories:edit` - Edit categories
- [ ] `categories:delete` - Delete categories
- [ ] `categories:manage_tags` - Manage tags

### Moderation (4 permissions) - Platform Admin

- [ ] `moderation:view_flags` - View flagged content
- [ ] `moderation:review_content` - Review content
- [ ] `moderation:remove_content` - Remove content
- [ ] `moderation:ban_users` - Ban users

### Audit (4 permissions) - Platform Admin

- [ ] `audit:view_logs` - View audit logs
- [ ] `audit:export_logs` - Export audit logs
- [ ] `audit:view_reports` - View reports
- [ ] `audit:generate_reports` - Generate reports

### Support (4 permissions) - Platform Admin

- [ ] `support:view_tickets` - View tickets
- [ ] `support:respond_tickets` - Respond to tickets
- [ ] `support:escalate` - Escalate tickets
- [ ] `support:close_tickets` - Close tickets

### Clinic (7 permissions) - Phase 2 🔮

- [ ] `clinic:view_dashboard` - View clinic overview
- [ ] `clinic:view_patients` - View shared clinic patients
- [ ] `clinic:view_schedule` - View clinic schedule
- [ ] `clinic:manage_settings` - Manage clinic settings
- [ ] `clinic:manage_branding` - Manage clinic branding
- [ ] `clinic:view_analytics` - View clinic analytics
- [ ] `clinic:export_data` - Export clinic data

### Team (5 permissions) - Phase 2 🔮

- [ ] `team:view_members` - View team members
- [ ] `team:invite_members` - Invite members
- [ ] `team:remove_members` - Remove members
- [ ] `team:manage_roles` - Manage roles
- [ ] `team:view_performance` - View performance

### Schedule (3 permissions) - Phase 2 🔮

- [ ] `schedule:manage_clinic` - Manage clinic schedule
- [ ] `schedule:manage_rooms` - Manage rooms
- [ ] `schedule:view_capacity` - View capacity planning

### Revenue (5 permissions) - Phase 2 🔮

- [ ] `revenue:view_overview` - View revenue overview
- [ ] `revenue:view_splits` - View commission splits
- [ ] `revenue:manage_payouts` - Manage payouts
- [ ] `revenue:view_invoices` - View invoices
- [ ] `revenue:export_financial` - Export financial data

---

## 👥 Step 2: Create Roles

**Create in this order (lowest to highest priority):**

### Phase 1 Roles (Implement Now)

#### Role 1: Patient (Priority 10)

- [ ] Created role with slug: `patient`
- [ ] Set priority: `10`
- [ ] Added description: "Basic user/patient role for booking appointments and accessing their healthcare journey"
- [ ] Assigned 16 permissions (check `workos-rbac-config.md` for full list)
- [ ] Verified permission count: **16**

**Quick Permission Reference:**

- All `appointments:*_own`, `appointments:create`
- `sessions:view_own`
- All `reviews:*_own`, `reviews:create`
- `experts:browse`, `experts:view_profiles`
- `profile:view_own`, `profile:edit_own`
- `billing:view_own`, `billing:methods_manage`
- `dashboard:view_patient`

#### Role 2: Expert Community (Priority 70)

- [ ] Created role with slug: `expert_community`
- [ ] Set priority: `70`
- [ ] Added description: "Standard expert tier with core expert features. Pays 20% commission (monthly) or 12% (annual)"
- [ ] Assigned 52 permissions (includes all patient permissions + expert permissions)
- [ ] Verified permission count: **52**

**Additional Permissions (beyond Patient):**

- `dashboard:view_expert`
- All `appointments:*` (expert-specific)
- All `patients:*_own`, `patients:view_history`, `patients:send_notes`
- All `events:*`
- All `availability:*`
- All `calendars:*`
- `profile:*_expert`, `profile:preview`, `profile:manage_link`
- `billing:view_earnings`, `billing:view_payouts`, `billing:*_subscription`
- `reviews:view_about_me`, `reviews:respond`
- All `settings:*_own`, `settings:security`

#### Role 3: Expert Top (Priority 80)

- [ ] Created role with slug: `expert_top`
- [ ] Set priority: `80`
- [ ] Added description: "Premium expert tier with advanced features. Pays 18% commission (monthly) or 8% (annual)"
- [ ] Assigned 60 permissions (includes all expert_community + top exclusive)
- [ ] Verified permission count: **60**

**Additional Permissions (beyond Expert Community):**

- All `analytics:*` (except platform analytics)
- All `branding:*`

#### Role 4: Platform Admin (Priority 100)

- [ ] Created role with slug: `superadmin`
- [ ] Set priority: `100`
- [ ] Added description: "Platform-level administrator with full system access. For Eleva Care team only"
- [ ] Assigned ALL 137 permissions
- [ ] Verified permission count: **137**

**Tip:** Select all permissions for this role

---

### Phase 2 Roles (Optional - For Clinic Features) 🔮

#### Role 5: Clinic Member (Priority 60)

- [ ] Created role with slug: `clinic_member`
- [ ] Set priority: `60`
- [ ] Added description: "Expert who is a member of a clinic organization"
- [ ] Assigned 56 permissions (expert_community + clinic read-only)
- [ ] Verified permission count: **56**

**Additional Permissions (beyond Expert Community):**

- `clinic:view_dashboard`
- `clinic:view_patients`
- `clinic:view_schedule`
- `team:view_members`

#### Role 6: Clinic Admin (Priority 90)

- [ ] Created role with slug: `clinic_admin`
- [ ] Set priority: `90`
- [ ] Added description: "Administrator of a clinic organization"
- [ ] Assigned 77 permissions (clinic_member + clinic management)
- [ ] Verified permission count: **77**

**Additional Permissions (beyond Clinic Member):**

- All `clinic:*` (management)
- All `team:*` (full management)
- All `schedule:*`
- `patients:view_all`, `patients:manage_records`, `patients:view_insights`
- All `revenue:*`
- `billing:manage_clinic_sub`, `billing:view_clinic_billing`

---

## ✅ Step 3: Verification

### Permission Verification

- [ ] Total permissions created: 137
- [ ] All permission slugs use `resource:action` format
- [ ] No duplicate permission slugs
- [ ] All permissions have descriptions

### Role Verification

- [ ] Total roles created: \_\_\_\_ (4 for Phase 1, 6 for Full)
- [ ] All roles have unique slugs
- [ ] Priorities set correctly (10, 70, 80, 100 for Phase 1)
- [ ] Permission counts match expected:
  - [ ] Patient: 16
  - [ ] Expert Community: 52
  - [ ] Expert Top: 60
  - [ ] Clinic Member: 56 (Phase 2)
  - [ ] Clinic Admin: 77 (Phase 2)
  - [ ] Platform Admin: 137

### Test Configuration

- [ ] Created test user
- [ ] Assigned test user to Patient role
- [ ] Verified JWT contains correct permissions
- [ ] Tested permission check in application
- [ ] Tested role hierarchy

---

## 🎯 Next Steps

After completing the import:

1. **Update Application:**
   - [ ] Copy `workos-rbac-constants.ts` to your codebase
   - [ ] Update import paths
   - [ ] Replace hardcoded permission strings with constants
   - [ ] Test permission checks

2. **Update Documentation:**
   - [ ] Mark configuration as "Applied to WorkOS"
   - [ ] Document any deviations from the plan
   - [ ] Update team wiki/docs

3. **Deploy to Production:**
   - [ ] Test in development environment
   - [ ] Test in staging environment
   - [ ] Create deployment checklist
   - [ ] Deploy to production
   - [ ] Monitor for issues

4. **User Migration:**
   - [ ] Plan user role assignments
   - [ ] Migrate existing users to new roles
   - [ ] Test user access
   - [ ] Communicate changes to users

---

## 📝 Notes

**Completed by:** **\*\*\*\***\_**\*\*\*\***  
**Date:** **\*\*\*\***\_**\*\*\*\***  
**Time Taken:** **\*\*\*\***\_**\*\*\*\***  
**Issues Encountered:**

-
-
- **Deviations from Plan:**

-
-
- **Production Deployment Date:** **\*\*\*\***\_**\*\*\*\***

  ***

## 💡 Tips

**Speed up the process:**

- Create permissions in batches by category
- Use multiple browser tabs for faster navigation
- Copy-paste permission details from CSV
- Use keyboard shortcuts in WorkOS Dashboard

**Avoid mistakes:**

- Double-check slug spelling (they're immutable)
- Keep this checklist open while importing
- Mark off each item as you complete it
- Take breaks every 30 minutes

**If something goes wrong:**

- WorkOS doesn't support bulk delete
- You'll need to delete items manually
- Contact WorkOS support for bulk operations
- Consider using a test environment first

---

**Last Updated:** November 13, 2025  
**Configuration Version:** 1.0  
**Source:** `scripts/utilities/workos-rbac-config.ts`
