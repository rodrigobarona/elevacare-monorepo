/**
 * WorkOS RBAC Configuration Script
 *
 * This script prints the configuration guide for setting up RBAC in WorkOS Dashboard.
 * WorkOS RBAC must be configured manually via the Dashboard UI.
 *
 * Usage:
 *   bun scripts/configure-workos-rbac.ts --guide
 *
 * @see _docs/_WorkOS RABAC implemenation/WORKOS-DASHBOARD-QUICK-SETUP.md
 */

// ============================================================================
// PERMISSIONS DEFINITION (89 total)
// ============================================================================

interface Permission {
  slug: string;
  name: string;
  description: string;
}

const PERMISSIONS: Permission[] = [
  // ============================================================================
  // Appointments (9)
  // ============================================================================
  {
    slug: 'appointments:view_own',
    name: 'View own appointments',
    description: 'Allows users to view their own booked appointments',
  },
  {
    slug: 'appointments:view_incoming',
    name: 'View incoming appointments',
    description: 'Allows experts to view appointments booked with them',
  },
  {
    slug: 'appointments:create',
    name: 'Create appointments',
    description: 'Allows users to book new appointments',
  },
  {
    slug: 'appointments:manage_own',
    name: 'Manage own appointments',
    description: 'Allows users to manage their own bookings',
  },
  {
    slug: 'appointments:cancel_own',
    name: 'Cancel own appointments',
    description: 'Allows users to cancel their own appointments within policy',
  },
  {
    slug: 'appointments:reschedule_own',
    name: 'Reschedule own appointments',
    description: 'Allows users to reschedule their own appointments',
  },
  {
    slug: 'appointments:view_calendar',
    name: 'View calendar',
    description: 'Access calendar view of appointments',
  },
  {
    slug: 'appointments:confirm',
    name: 'Confirm appointments',
    description: 'Allows experts to confirm incoming appointments',
  },
  {
    slug: 'appointments:complete',
    name: 'Complete appointments',
    description: 'Allows experts to mark appointments as completed',
  },

  // ============================================================================
  // Sessions (2)
  // ============================================================================
  {
    slug: 'sessions:view_own',
    name: 'View own sessions',
    description: 'View session notes and summaries',
  },
  {
    slug: 'sessions:view_history',
    name: 'View session history',
    description: 'View complete session history',
  },

  // ============================================================================
  // Patients (7)
  // ============================================================================
  {
    slug: 'patients:view_own',
    name: 'View own patients',
    description: "View list of patients you've worked with",
  },
  {
    slug: 'patients:view_all',
    name: 'View all partner patients',
    description: 'View all patients in the partner (partner admin)',
  },
  {
    slug: 'patients:view_history',
    name: 'View patient history',
    description: "View patient's appointment history",
  },
  {
    slug: 'patients:send_notes',
    name: 'Send session notes',
    description: 'Share session notes with patients',
  },
  {
    slug: 'patients:manage_records',
    name: 'Manage patient records',
    description: 'Create and update patient records',
  },
  {
    slug: 'patients:view_insights',
    name: 'View patient insights',
    description: 'View patient analytics and demographics',
  },
  {
    slug: 'patients:export',
    name: 'Export patient data',
    description: 'Export patient data for reporting',
  },

  // ============================================================================
  // Events (5)
  // ============================================================================
  {
    slug: 'events:create',
    name: 'Create event types',
    description: 'Create new bookable event types',
  },
  {
    slug: 'events:view_own',
    name: 'View own events',
    description: 'View your own event types',
  },
  {
    slug: 'events:edit_own',
    name: 'Edit own events',
    description: 'Edit your own event types',
  },
  {
    slug: 'events:delete_own',
    name: 'Delete own events',
    description: 'Delete your own event types',
  },
  {
    slug: 'events:toggle_active',
    name: 'Toggle event status',
    description: 'Activate or deactivate event types',
  },

  // ============================================================================
  // Availability (5)
  // ============================================================================
  {
    slug: 'availability:view_own',
    name: 'View own availability',
    description: 'View your availability schedules',
  },
  {
    slug: 'availability:create',
    name: 'Create schedules',
    description: 'Create new availability schedules',
  },
  {
    slug: 'availability:edit_own',
    name: 'Edit schedules',
    description: 'Edit your availability schedules',
  },
  {
    slug: 'availability:delete_own',
    name: 'Delete schedules',
    description: 'Delete your availability schedules',
  },
  {
    slug: 'availability:set_limits',
    name: 'Set booking limits',
    description: 'Set buffer times and maximum bookings',
  },

  // ============================================================================
  // Calendars (4)
  // ============================================================================
  {
    slug: 'calendars:connect',
    name: 'Connect calendars',
    description: 'Connect external calendar providers (Google, Outlook)',
  },
  {
    slug: 'calendars:view_own',
    name: 'View connected calendars',
    description: 'View your connected calendars',
  },
  {
    slug: 'calendars:edit_own',
    name: 'Edit calendar settings',
    description: 'Edit calendar integration settings',
  },
  {
    slug: 'calendars:disconnect',
    name: 'Disconnect calendars',
    description: 'Disconnect external calendars',
  },

  // ============================================================================
  // Reviews (6)
  // ============================================================================
  {
    slug: 'reviews:create',
    name: 'Create reviews',
    description: 'Leave reviews after completed sessions',
  },
  {
    slug: 'reviews:view_own',
    name: 'View own reviews',
    description: "View reviews you've written",
  },
  {
    slug: 'reviews:view_about_me',
    name: 'View reviews about me',
    description: 'View reviews written about you',
  },
  {
    slug: 'reviews:edit_own',
    name: 'Edit own reviews',
    description: 'Edit your reviews (within 30 days)',
  },
  {
    slug: 'reviews:delete_own',
    name: 'Delete own reviews',
    description: 'Delete your reviews (within 7 days)',
  },
  {
    slug: 'reviews:respond',
    name: 'Respond to reviews',
    description: 'Respond to reviews about you',
  },

  // ============================================================================
  // Profile (6)
  // ============================================================================
  {
    slug: 'profile:view_own',
    name: 'View own profile',
    description: 'View your patient profile',
  },
  {
    slug: 'profile:edit_own',
    name: 'Edit own profile',
    description: 'Edit your patient profile',
  },
  {
    slug: 'profile:view_expert',
    name: 'View expert profile',
    description: 'View your expert public profile',
  },
  {
    slug: 'profile:edit_expert',
    name: 'Edit expert profile',
    description: 'Edit your expert public profile',
  },
  {
    slug: 'profile:preview',
    name: 'Preview profile',
    description: 'Preview how patients see your profile',
  },
  {
    slug: 'profile:manage_link',
    name: 'Manage booking link',
    description: 'Manage your booking link settings',
  },

  // ============================================================================
  // Experts (7)
  // ============================================================================
  {
    slug: 'experts:browse',
    name: 'Browse experts',
    description: 'Browse expert directory',
  },
  {
    slug: 'experts:view_profiles',
    name: 'View expert profiles',
    description: 'View expert public profiles',
  },
  {
    slug: 'experts:view_applications',
    name: 'View expert applications',
    description: 'View expert applications (admin only)',
  },
  {
    slug: 'experts:approve',
    name: 'Approve applications',
    description: 'Approve expert applications (admin only)',
  },
  {
    slug: 'experts:reject',
    name: 'Reject applications',
    description: 'Reject expert applications (admin only)',
  },
  {
    slug: 'experts:suspend',
    name: 'Suspend experts',
    description: 'Suspend expert accounts (admin only)',
  },
  {
    slug: 'experts:verify',
    name: 'Verify credentials',
    description: 'Verify expert credentials (admin only)',
  },

  // ============================================================================
  // Analytics (10)
  // ============================================================================
  {
    slug: 'analytics:view',
    name: 'View analytics',
    description: 'Access analytics dashboard (Top tier)',
  },
  {
    slug: 'analytics:revenue',
    name: 'View revenue analytics',
    description: 'View detailed revenue analytics',
  },
  {
    slug: 'analytics:patients',
    name: 'View patient analytics',
    description: 'View patient demographics and insights',
  },
  {
    slug: 'analytics:performance',
    name: 'View performance metrics',
    description: 'View booking trends and conversion',
  },
  {
    slug: 'analytics:export',
    name: 'Export analytics',
    description: 'Export analytics data',
  },
  {
    slug: 'analytics:platform_growth',
    name: 'View platform growth',
    description: 'View platform-wide user growth (admin)',
  },
  {
    slug: 'analytics:platform_revenue',
    name: 'View platform revenue',
    description: 'View platform revenue metrics (admin)',
  },
  {
    slug: 'analytics:platform_engagement',
    name: 'View platform engagement',
    description: 'View engagement metrics (admin)',
  },
  {
    slug: 'analytics:platform_churn',
    name: 'View platform churn',
    description: 'View retention and churn data (admin)',
  },
  {
    slug: 'analytics:platform_export',
    name: 'Export platform data',
    description: 'Export platform-wide analytics (admin)',
  },

  // ============================================================================
  // Branding (3)
  // ============================================================================
  {
    slug: 'branding:customize',
    name: 'Customize branding',
    description: 'Customize profile branding (Top tier)',
  },
  {
    slug: 'branding:upload_logo',
    name: 'Upload logo',
    description: 'Upload custom logo (Top tier)',
  },
  {
    slug: 'branding:custom_colors',
    name: 'Custom colors',
    description: 'Set custom brand colors (Top tier)',
  },

  // ============================================================================
  // Billing (8)
  // ============================================================================
  {
    slug: 'billing:view_own',
    name: 'View own billing',
    description: 'View personal payment history and invoices',
  },
  {
    slug: 'billing:view_earnings',
    name: 'View earnings',
    description: 'View earnings and commission details',
  },
  {
    slug: 'billing:view_payouts',
    name: 'View payouts',
    description: 'View payout history',
  },
  {
    slug: 'billing:view_subscription',
    name: 'View subscription',
    description: 'View current subscription plan',
  },
  {
    slug: 'billing:manage_subscription',
    name: 'Manage subscription',
    description: 'Upgrade or downgrade subscription',
  },
  {
    slug: 'billing:methods_manage',
    name: 'Manage payment methods',
    description: 'Add or remove payment methods',
  },
  {
    slug: 'billing:manage_clinic_sub',
    name: 'Manage partner subscription',
    description: 'Manage partner subscription (partner admin)',
  },
  {
    slug: 'billing:view_clinic_billing',
    name: 'View partner billing',
    description: 'View partner billing history (partner admin)',
  },

  // ============================================================================
  // Settings (7)
  // ============================================================================
  {
    slug: 'settings:view_own',
    name: 'View own settings',
    description: 'View personal settings',
  },
  {
    slug: 'settings:edit_own',
    name: 'Edit own settings',
    description: 'Edit account, notifications, integrations',
  },
  {
    slug: 'settings:security',
    name: 'Security settings',
    description: 'Manage 2FA, sessions, security',
  },
  {
    slug: 'settings:view_platform',
    name: 'View platform settings',
    description: 'View platform configuration (admin)',
  },
  {
    slug: 'settings:edit_platform',
    name: 'Edit platform settings',
    description: 'Edit platform configuration (admin)',
  },
  {
    slug: 'settings:manage_features',
    name: 'Manage feature flags',
    description: 'Enable/disable features (admin)',
  },
  {
    slug: 'settings:manage_integrations',
    name: 'Manage integrations',
    description: 'Manage API keys, webhooks (admin)',
  },

  // ============================================================================
  // Dashboard (2)
  // ============================================================================
  {
    slug: 'dashboard:view_expert',
    name: 'View expert dashboard',
    description: 'Access expert dashboard',
  },
  {
    slug: 'dashboard:view_patient',
    name: 'View patient dashboard',
    description: 'Access patient dashboard',
  },

  // ============================================================================
  // Partner (18) - Phase 2
  // ============================================================================
  {
    slug: 'partner:view_dashboard',
    name: 'View partner dashboard',
    description: 'View partner overview (read-only for members)',
  },
  {
    slug: 'partner:manage_settings',
    name: 'Manage partner settings',
    description: 'Manage partner configuration (admin)',
  },
  {
    slug: 'partner:manage_branding',
    name: 'Manage partner branding',
    description: 'Manage partner logo, colors (admin)',
  },
  {
    slug: 'partner:view_analytics',
    name: 'View partner analytics',
    description: 'View partner-wide analytics (admin)',
  },
  {
    slug: 'partner:view_patients',
    name: 'View partner patients',
    description: 'View shared partner patients',
  },
  {
    slug: 'partner:export_data',
    name: 'Export partner data',
    description: 'Export partner data (admin)',
  },
  {
    slug: 'team:view_members',
    name: 'View team members',
    description: 'View partner team members',
  },
  {
    slug: 'team:invite_members',
    name: 'Invite team members',
    description: 'Invite new team members (admin)',
  },
  {
    slug: 'team:remove_members',
    name: 'Remove team members',
    description: 'Remove team members (admin)',
  },
  {
    slug: 'team:manage_roles',
    name: 'Manage team roles',
    description: 'Assign and change member roles (admin)',
  },
  {
    slug: 'team:view_performance',
    name: 'View team performance',
    description: 'View team member performance (admin)',
  },
  {
    slug: 'schedule:manage_clinic',
    name: 'Manage partner schedule',
    description: 'Manage multi-practitioner schedule (admin)',
  },
  {
    slug: 'schedule:manage_rooms',
    name: 'Manage rooms',
    description: 'Manage partner rooms/locations (admin)',
  },
  {
    slug: 'schedule:view_capacity',
    name: 'View capacity planning',
    description: 'View capacity planning (admin)',
  },
  {
    slug: 'revenue:view_overview',
    name: 'View revenue overview',
    description: 'View partner revenue overview (admin)',
  },
  {
    slug: 'revenue:view_splits',
    name: 'View commission splits',
    description: 'View commission splits (admin)',
  },
  {
    slug: 'revenue:manage_payouts',
    name: 'Manage payouts',
    description: 'Manage payout schedules (admin)',
  },
  {
    slug: 'revenue:export_financial',
    name: 'Export financial data',
    description: 'Export financial reports (admin)',
  },

  // ============================================================================
  // Platform Admin (22)
  // ============================================================================
  {
    slug: 'users:view_all',
    name: 'View all users',
    description: 'View all platform users',
  },
  {
    slug: 'users:create',
    name: 'Create users',
    description: 'Create new users',
  },
  {
    slug: 'users:edit',
    name: 'Edit users',
    description: 'Edit any user account',
  },
  {
    slug: 'users:delete',
    name: 'Delete users',
    description: 'Soft delete user accounts',
  },
  {
    slug: 'users:manage_roles',
    name: 'Manage user roles',
    description: 'Assign and change user roles',
  },
  {
    slug: 'users:impersonate',
    name: 'Impersonate users',
    description: 'Sign in as user for support',
  },
  {
    slug: 'organizations:view_all',
    name: 'View all organizations',
    description: 'View all organizations',
  },
  {
    slug: 'organizations:create',
    name: 'Create organizations',
    description: 'Create new organizations',
  },
  {
    slug: 'organizations:edit',
    name: 'Edit organizations',
    description: 'Edit organization details',
  },
  {
    slug: 'organizations:delete',
    name: 'Delete organizations',
    description: 'Delete organizations',
  },
  {
    slug: 'organizations:manage_settings',
    name: 'Manage org settings',
    description: 'Manage organization settings',
  },
  {
    slug: 'payments:view_all',
    name: 'View all payments',
    description: 'View all platform transactions',
  },
  {
    slug: 'payments:view_transfers',
    name: 'View transfers',
    description: 'View payout transfers',
  },
  {
    slug: 'payments:manage_disputes',
    name: 'Manage disputes',
    description: 'Manage payment disputes',
  },
  {
    slug: 'payments:process_refunds',
    name: 'Process refunds',
    description: 'Issue refunds',
  },
  {
    slug: 'payments:retry_failed',
    name: 'Retry failed payments',
    description: 'Retry failed payment attempts',
  },
  {
    slug: 'moderation:view_flags',
    name: 'View flagged content',
    description: 'View content flagged by users',
  },
  {
    slug: 'moderation:review_content',
    name: 'Review content',
    description: 'Review flagged content',
  },
  {
    slug: 'moderation:remove_content',
    name: 'Remove content',
    description: 'Remove inappropriate content',
  },
  {
    slug: 'moderation:ban_users',
    name: 'Ban users',
    description: 'Ban users from platform',
  },
  {
    slug: 'audit:view_logs',
    name: 'View audit logs',
    description: 'View platform audit logs',
  },
  {
    slug: 'audit:export_logs',
    name: 'Export audit logs',
    description: 'Export audit logs for compliance',
  },
];

// ============================================================================
// ROLES DEFINITION (6 total)
// ============================================================================

interface RoleDefinition {
  slug: string;
  name: string;
  description: string;
  permissions: string[];
}

// Patient permissions (15)
const PATIENT_PERMISSIONS = [
  'appointments:view_own',
  'appointments:create',
  'appointments:cancel_own',
  'appointments:reschedule_own',
  'sessions:view_own',
  'reviews:create',
  'reviews:view_own',
  'reviews:edit_own',
  'reviews:delete_own',
  'experts:browse',
  'experts:view_profiles',
  'profile:view_own',
  'profile:edit_own',
  'billing:view_own',
  'billing:methods_manage',
  'dashboard:view_patient',
];

// Expert Community permissions (42) = Patient (16) + Expert (26)
const EXPERT_COMMUNITY_PERMISSIONS = [
  ...PATIENT_PERMISSIONS,
  'dashboard:view_expert',
  'appointments:view_incoming',
  'appointments:manage_own',
  'appointments:view_calendar',
  'appointments:confirm',
  'appointments:complete',
  'patients:view_own',
  'patients:view_history',
  'patients:send_notes',
  'events:create',
  'events:view_own',
  'events:edit_own',
  'events:delete_own',
  'events:toggle_active',
  'availability:view_own',
  'availability:create',
  'availability:edit_own',
  'availability:delete_own',
  'availability:set_limits',
  'calendars:connect',
  'calendars:view_own',
  'calendars:edit_own',
  'calendars:disconnect',
  'profile:view_expert',
  'profile:edit_expert',
  'profile:preview',
  'profile:manage_link',
  'billing:view_earnings',
  'billing:view_payouts',
  'billing:view_subscription',
  'billing:manage_subscription',
  'reviews:view_about_me',
  'reviews:respond',
  'settings:view_own',
  'settings:edit_own',
  'settings:security',
];

// Expert Top permissions (49) = Expert Community (42) + Top Exclusive (7)
const EXPERT_TOP_PERMISSIONS = [
  ...EXPERT_COMMUNITY_PERMISSIONS,
  'analytics:view',
  'analytics:revenue',
  'analytics:patients',
  'analytics:performance',
  'analytics:export',
  'branding:customize',
  'branding:upload_logo',
  'branding:custom_colors',
];

// Partner Member permissions (45) = Expert Community (42) + Partner View (3)
const PARTNER_MEMBER_PERMISSIONS = [
  ...EXPERT_COMMUNITY_PERMISSIONS,
  'partner:view_dashboard',
  'partner:view_patients',
  'team:view_members',
];

// Partner Admin permissions (68) = Partner Member (45) + Partner Management (23)
const PARTNER_ADMIN_PERMISSIONS = [
  ...PARTNER_MEMBER_PERMISSIONS,
  'partner:manage_settings',
  'partner:manage_branding',
  'partner:view_analytics',
  'partner:export_data',
  'team:invite_members',
  'team:remove_members',
  'team:manage_roles',
  'team:view_performance',
  'schedule:manage_clinic',
  'schedule:manage_rooms',
  'schedule:view_capacity',
  'patients:view_all',
  'patients:manage_records',
  'patients:view_insights',
  'patients:export',
  'revenue:view_overview',
  'revenue:view_splits',
  'revenue:manage_payouts',
  'revenue:export_financial',
  'billing:manage_clinic_sub',
  'billing:view_clinic_billing',
];

// Platform Admin permissions (89) = ALL
const SUPERADMIN_PERMISSIONS = PERMISSIONS.map((p) => p.slug);

const ROLES: RoleDefinition[] = [
  {
    slug: 'patient',
    name: 'Patient',
    description: 'Basic patient role for booking appointments and accessing healthcare journey',
    permissions: PATIENT_PERMISSIONS,
  },
  {
    slug: 'expert_community',
    name: 'Expert Community',
    description:
      'Standard expert tier with core expert features (20% monthly or 12% annual commission)',
    permissions: EXPERT_COMMUNITY_PERMISSIONS,
  },
  {
    slug: 'expert_top',
    name: 'Expert Top',
    description:
      'Premium expert tier with advanced analytics and branding (18% monthly or 8% annual commission)',
    permissions: EXPERT_TOP_PERMISSIONS,
  },
  {
    slug: 'partner_member',
    name: 'Partner Member',
    description: 'Expert who is a member of a partner (read-only partner access)',
    permissions: PARTNER_MEMBER_PERMISSIONS,
  },
  {
    slug: 'partner_admin',
    name: 'Partner Admin',
    description: 'Administrator of a partner organization with full management access',
    permissions: PARTNER_ADMIN_PERMISSIONS,
  },
  {
    slug: 'superadmin',
    name: 'Platform Admin',
    description: 'Platform administrator with full system access (Eleva Care team only)',
    permissions: SUPERADMIN_PERMISSIONS,
  },
];

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function createPermissions(): Promise<Map<string, string>> {
  console.log('\n📋 Creating permissions...');
  const permissionMap = new Map<string, string>();

  for (const perm of PERMISSIONS) {
    try {
      // Note: WorkOS doesn't have a direct "create permission" API
      // Permissions are typically created via the Dashboard
      // This is a placeholder for when/if WorkOS adds this API
      console.log(`  ✅ ${perm.slug} - ${perm.name}`);
      permissionMap.set(perm.slug, perm.slug);
    } catch (error) {
      console.error(`  ❌ Failed to create permission: ${perm.slug}`, error);
    }
  }

  console.log(`\n✅ Total permissions: ${PERMISSIONS.length}`);
  return permissionMap;
}

async function createRoles(): Promise<void> {
  console.log('\n👥 Creating roles...');

  for (const role of ROLES) {
    try {
      console.log(`\n  📌 ${role.name} (${role.slug})`);
      console.log(`     Description: ${role.description}`);
      console.log(`     Permissions: ${role.permissions.length}`);
    } catch (error) {
      console.error(`  ❌ Failed to create role: ${role.slug}`, error);
    }
  }
}

async function printSetupInstructions(): Promise<void> {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    WORKOS DASHBOARD SETUP GUIDE                    ');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('\n📌 IMPORTANT: WorkOS RBAC configuration must be done in the Dashboard');
  console.log('   Go to: https://dashboard.workos.com → RBAC\n');

  console.log('─────────────────────────────────────────────────────────────────────');
  console.log('STEP 1: CREATE PERMISSIONS (89 total)');
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log('\nGo to RBAC → Permissions → Create Permission\n');
  console.log('Copy-paste each permission below:\n');

  for (const perm of PERMISSIONS) {
    console.log(`Slug: ${perm.slug}`);
    console.log(`Name: ${perm.name}`);
    console.log(`Description: ${perm.description}`);
    console.log('---');
  }

  console.log('\n─────────────────────────────────────────────────────────────────────');
  console.log('STEP 2: CREATE ROLES (6 total)');
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log('\nGo to RBAC → Roles → Create Role\n');

  for (const role of ROLES) {
    console.log(`\n=== ${role.name.toUpperCase()} ===`);
    console.log(`Slug: ${role.slug}`);
    console.log(`Name: ${role.name}`);
    console.log(`Description: ${role.description}`);
    console.log(`\nPermissions to assign (${role.permissions.length}):`);
    role.permissions.forEach((p) => console.log(`  ✓ ${p}`));
  }

  console.log('\n─────────────────────────────────────────────────────────────────────');
  console.log('STEP 3: SET DEFAULT ROLE');
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log('\nGo to RBAC → Configuration → Default Role');
  console.log('Select: patient');
  console.log('\n═══════════════════════════════════════════════════════════════════\n');
}

async function generatePermissionsJSON(): Promise<void> {
  console.log('\n📄 Generating permissions JSON for import...\n');

  const output = {
    permissions: PERMISSIONS,
    roles: ROLES.map((r) => ({
      slug: r.slug,
      name: r.name,
      description: r.description,
      permissionCount: r.permissions.length,
    })),
  };

  console.log(JSON.stringify(output, null, 2));
}

async function main(): Promise<void> {
  console.log('\n🚀 WorkOS RBAC Configuration Script\n');
  console.log(`Total Permissions: ${PERMISSIONS.length}`);
  console.log(`Total Roles: ${ROLES.length}\n`);

  const args = process.argv.slice(2);

  if (args.includes('--json')) {
    await generatePermissionsJSON();
  } else if (args.includes('--guide')) {
    await printSetupInstructions();
  } else {
    // Default: print summary and guide
    await createPermissions();
    await createRoles();
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('\n✅ Configuration summary generated!');
    console.log('\nNext steps:');
    console.log('  1. Run with --guide to see full setup instructions');
    console.log('  2. Run with --json to export JSON format');
    console.log('  3. Go to WorkOS Dashboard to create permissions and roles');
    console.log('\n═══════════════════════════════════════════════════════════════════\n');
  }
}

// Run the script
main().catch(console.error);
