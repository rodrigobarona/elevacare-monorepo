/**
 * WorkOS RBAC Configuration Manager
 *
 * Purpose:
 * - Single source of truth for roles and permissions
 * - Generate copy-paste friendly formats for WorkOS Dashboard
 * - Validate configuration structure
 * - Export to multiple formats (JSON, CSV, Markdown)
 *
 * Usage:
 * ```bash
 * # Generate all formats
 * bun scripts/utilities/workos-rbac-config.ts generate-all
 *
 * # Generate specific format
 * bun scripts/utilities/workos-rbac-config.ts generate-json
 * bun scripts/utilities/workos-rbac-config.ts generate-csv
 * bun scripts/utilities/workos-rbac-config.ts generate-markdown
 *
 * # Validate configuration
 * bun scripts/utilities/workos-rbac-config.ts validate
 *
 * # Show summary
 * bun scripts/utilities/workos-rbac-config.ts summary
 * ```
 *
 * Note: WorkOS doesn't provide a public API for creating roles/permissions.
 * This script generates formats for manual import via Dashboard.
 */
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Permission {
  slug: string;
  name: string;
  description: string;
  category: string;
}

interface Role {
  slug: string;
  name: string;
  description: string;
  priority: number;
  permissions: string[]; // Permission slugs
  inheritsFrom?: string; // Role slug to inherit from
}

interface RBACConfig {
  permissions: Permission[];
  roles: Role[];
  metadata: {
    version: string;
    lastUpdated: string;
    totalPermissions: number;
    totalRoles: number;
  };
}

// ============================================================================
// CONFIGURATION - SINGLE SOURCE OF TRUTH
// ============================================================================

/**
 * All Permissions (89 total)
 * Organized by category for clarity
 */
const PERMISSIONS: Permission[] = [
  // ===== Appointments (9) =====
  {
    slug: 'appointments:view_own',
    name: 'View Own Appointments',
    description: 'View own appointments',
    category: 'Appointments',
  },
  {
    slug: 'appointments:view_incoming',
    name: 'View Incoming Appointments',
    description: 'View appointments booked with you',
    category: 'Appointments',
  },
  {
    slug: 'appointments:create',
    name: 'Create Appointments',
    description: 'Book new appointments',
    category: 'Appointments',
  },
  {
    slug: 'appointments:manage_own',
    name: 'Manage Own Appointments',
    description: 'Manage own bookings',
    category: 'Appointments',
  },
  {
    slug: 'appointments:cancel_own',
    name: 'Cancel Own Appointments',
    description: 'Cancel own appointments (within policy)',
    category: 'Appointments',
  },
  {
    slug: 'appointments:reschedule_own',
    name: 'Reschedule Own Appointments',
    description: 'Reschedule own appointments',
    category: 'Appointments',
  },
  {
    slug: 'appointments:view_calendar',
    name: 'View Calendar',
    description: 'View calendar view',
    category: 'Appointments',
  },
  {
    slug: 'appointments:confirm',
    name: 'Confirm Appointments',
    description: 'Confirm appointments',
    category: 'Appointments',
  },
  {
    slug: 'appointments:complete',
    name: 'Complete Appointments',
    description: 'Mark appointments as completed',
    category: 'Appointments',
  },

  // ===== Sessions (2) =====
  {
    slug: 'sessions:view_own',
    name: 'View Own Sessions',
    description: 'View own session notes',
    category: 'Sessions',
  },
  {
    slug: 'sessions:view_history',
    name: 'View Session History',
    description: 'View session history',
    category: 'Sessions',
  },

  // ===== Patients (6) =====
  {
    slug: 'patients:view_own',
    name: 'View Own Patients',
    description: 'View own patients',
    category: 'Patients',
  },
  {
    slug: 'patients:view_all',
    name: 'View All Patients',
    description: 'View all clinic patients',
    category: 'Patients',
  },
  {
    slug: 'patients:view_history',
    name: 'View Patient History',
    description: 'View patient appointment history',
    category: 'Patients',
  },
  {
    slug: 'patients:send_notes',
    name: 'Send Patient Notes',
    description: 'Share session notes with patients',
    category: 'Patients',
  },
  {
    slug: 'patients:manage_records',
    name: 'Manage Patient Records',
    description: 'Manage patient records',
    category: 'Patients',
  },
  {
    slug: 'patients:view_insights',
    name: 'View Patient Insights',
    description: 'View patient analytics',
    category: 'Patients',
  },

  // ===== Events (5) =====
  {
    slug: 'events:create',
    name: 'Create Events',
    description: 'Create event types',
    category: 'Events',
  },
  {
    slug: 'events:view_own',
    name: 'View Own Events',
    description: 'View own events',
    category: 'Events',
  },
  {
    slug: 'events:edit_own',
    name: 'Edit Own Events',
    description: 'Edit own events',
    category: 'Events',
  },
  {
    slug: 'events:delete_own',
    name: 'Delete Own Events',
    description: 'Delete own events',
    category: 'Events',
  },
  {
    slug: 'events:toggle_active',
    name: 'Toggle Event Active Status',
    description: 'Activate/deactivate events',
    category: 'Events',
  },

  // ===== Availability (5) =====
  {
    slug: 'availability:view_own',
    name: 'View Own Availability',
    description: 'View own availability',
    category: 'Availability',
  },
  {
    slug: 'availability:create',
    name: 'Create Availability',
    description: 'Create schedules',
    category: 'Availability',
  },
  {
    slug: 'availability:edit_own',
    name: 'Edit Own Availability',
    description: 'Edit schedules',
    category: 'Availability',
  },
  {
    slug: 'availability:delete_own',
    name: 'Delete Own Availability',
    description: 'Delete schedules',
    category: 'Availability',
  },
  {
    slug: 'availability:set_limits',
    name: 'Set Availability Limits',
    description: 'Set buffer times and max bookings',
    category: 'Availability',
  },

  // ===== Calendars (4) =====
  {
    slug: 'calendars:connect',
    name: 'Connect Calendars',
    description: 'Connect external calendars',
    category: 'Calendars',
  },
  {
    slug: 'calendars:view_own',
    name: 'View Own Calendars',
    description: 'View connected calendars',
    category: 'Calendars',
  },
  {
    slug: 'calendars:edit_own',
    name: 'Edit Own Calendars',
    description: 'Edit calendar settings',
    category: 'Calendars',
  },
  {
    slug: 'calendars:disconnect',
    name: 'Disconnect Calendars',
    description: 'Disconnect calendars',
    category: 'Calendars',
  },

  // ===== Reviews (6) =====
  {
    slug: 'reviews:create',
    name: 'Create Reviews',
    description: 'Leave reviews after sessions',
    category: 'Reviews',
  },
  {
    slug: 'reviews:view_own',
    name: 'View Own Reviews',
    description: 'View own reviews',
    category: 'Reviews',
  },
  {
    slug: 'reviews:view_about_me',
    name: 'View Reviews About Me',
    description: 'View reviews about me',
    category: 'Reviews',
  },
  {
    slug: 'reviews:edit_own',
    name: 'Edit Own Reviews',
    description: 'Edit own reviews (within 30 days)',
    category: 'Reviews',
  },
  {
    slug: 'reviews:delete_own',
    name: 'Delete Own Reviews',
    description: 'Delete own reviews (within 7 days)',
    category: 'Reviews',
  },
  {
    slug: 'reviews:respond',
    name: 'Respond to Reviews',
    description: 'Respond to reviews',
    category: 'Reviews',
  },

  // ===== Profile (6) =====
  {
    slug: 'profile:view_own',
    name: 'View Own Profile',
    description: 'View own profile',
    category: 'Profile',
  },
  {
    slug: 'profile:edit_own',
    name: 'Edit Own Profile',
    description: 'Edit own profile',
    category: 'Profile',
  },
  {
    slug: 'profile:view_expert',
    name: 'View Expert Profile',
    description: 'View expert profile',
    category: 'Profile',
  },
  {
    slug: 'profile:edit_expert',
    name: 'Edit Expert Profile',
    description: 'Edit expert profile',
    category: 'Profile',
  },
  {
    slug: 'profile:preview',
    name: 'Preview Profile',
    description: 'Preview public profile',
    category: 'Profile',
  },
  {
    slug: 'profile:manage_link',
    name: 'Manage Booking Link',
    description: 'Manage booking link',
    category: 'Profile',
  },

  // ===== Experts (7) =====
  {
    slug: 'experts:browse',
    name: 'Browse Experts',
    description: 'Browse expert directory',
    category: 'Experts',
  },
  {
    slug: 'experts:view_profiles',
    name: 'View Expert Profiles',
    description: 'View expert profiles',
    category: 'Experts',
  },
  {
    slug: 'experts:view_applications',
    name: 'View Expert Applications',
    description: 'View expert applications',
    category: 'Experts',
  },
  {
    slug: 'experts:approve',
    name: 'Approve Expert Applications',
    description: 'Approve expert applications',
    category: 'Experts',
  },
  {
    slug: 'experts:reject',
    name: 'Reject Expert Applications',
    description: 'Reject expert applications',
    category: 'Experts',
  },
  {
    slug: 'experts:suspend',
    name: 'Suspend Experts',
    description: 'Suspend expert accounts',
    category: 'Experts',
  },
  {
    slug: 'experts:verify',
    name: 'Verify Expert Credentials',
    description: 'Verify expert credentials',
    category: 'Experts',
  },

  // ===== Analytics (10) =====
  {
    slug: 'analytics:view',
    name: 'View Analytics',
    description: 'Access analytics dashboard',
    category: 'Analytics',
  },
  {
    slug: 'analytics:revenue',
    name: 'View Revenue Analytics',
    description: 'View revenue analytics',
    category: 'Analytics',
  },
  {
    slug: 'analytics:patients',
    name: 'View Patient Analytics',
    description: 'View patient insights',
    category: 'Analytics',
  },
  {
    slug: 'analytics:performance',
    name: 'View Performance Analytics',
    description: 'View performance metrics',
    category: 'Analytics',
  },
  {
    slug: 'analytics:export',
    name: 'Export Analytics',
    description: 'Export analytics data',
    category: 'Analytics',
  },
  {
    slug: 'analytics:platform_growth',
    name: 'View Platform Growth',
    description: 'View platform growth',
    category: 'Analytics',
  },
  {
    slug: 'analytics:platform_revenue',
    name: 'View Platform Revenue',
    description: 'View platform revenue',
    category: 'Analytics',
  },
  {
    slug: 'analytics:platform_engagement',
    name: 'View Platform Engagement',
    description: 'View platform engagement',
    category: 'Analytics',
  },
  {
    slug: 'analytics:platform_churn',
    name: 'View Platform Churn',
    description: 'View platform churn',
    category: 'Analytics',
  },
  {
    slug: 'analytics:platform_export',
    name: 'Export Platform Analytics',
    description: 'Export platform data',
    category: 'Analytics',
  },

  // ===== Branding (3) =====
  {
    slug: 'branding:customize',
    name: 'Customize Branding',
    description: 'Customize branding',
    category: 'Branding',
  },
  {
    slug: 'branding:upload_logo',
    name: 'Upload Logo',
    description: 'Upload custom logo',
    category: 'Branding',
  },
  {
    slug: 'branding:custom_colors',
    name: 'Customize Colors',
    description: 'Set custom colors',
    category: 'Branding',
  },

  // ===== Billing (8) =====
  {
    slug: 'billing:view_own',
    name: 'View Own Billing',
    description: 'View own billing',
    category: 'Billing',
  },
  {
    slug: 'billing:view_earnings',
    name: 'View Earnings',
    description: 'View earnings',
    category: 'Billing',
  },
  {
    slug: 'billing:view_payouts',
    name: 'View Payouts',
    description: 'View payouts',
    category: 'Billing',
  },
  {
    slug: 'billing:view_subscription',
    name: 'View Subscription',
    description: 'View subscription',
    category: 'Billing',
  },
  {
    slug: 'billing:manage_subscription',
    name: 'Manage Subscription',
    description: 'Manage subscription',
    category: 'Billing',
  },
  {
    slug: 'billing:methods_manage',
    name: 'Manage Payment Methods',
    description: 'Manage payment methods',
    category: 'Billing',
  },
  {
    slug: 'billing:manage_clinic_sub',
    name: 'Manage Clinic Subscription',
    description: 'Manage clinic subscription',
    category: 'Billing',
  },
  {
    slug: 'billing:view_clinic_billing',
    name: 'View Clinic Billing',
    description: 'View clinic billing',
    category: 'Billing',
  },

  // ===== Settings (7) =====
  {
    slug: 'settings:view_own',
    name: 'View Own Settings',
    description: 'View own settings',
    category: 'Settings',
  },
  {
    slug: 'settings:edit_own',
    name: 'Edit Own Settings',
    description: 'Edit own settings',
    category: 'Settings',
  },
  {
    slug: 'settings:security',
    name: 'Manage Security Settings',
    description: 'Manage security (2FA, sessions)',
    category: 'Settings',
  },
  {
    slug: 'settings:view_platform',
    name: 'View Platform Settings',
    description: 'View platform settings',
    category: 'Settings',
  },
  {
    slug: 'settings:edit_platform',
    name: 'Edit Platform Settings',
    description: 'Edit platform settings',
    category: 'Settings',
  },
  {
    slug: 'settings:manage_features',
    name: 'Manage Feature Flags',
    description: 'Manage feature flags',
    category: 'Settings',
  },
  {
    slug: 'settings:manage_integrations',
    name: 'Manage Integrations',
    description: 'Manage integrations (API, webhooks)',
    category: 'Settings',
  },

  // ===== Dashboard (2) =====
  {
    slug: 'dashboard:view_expert',
    name: 'View Expert Dashboard',
    description: 'Access expert dashboard',
    category: 'Dashboard',
  },
  {
    slug: 'dashboard:view_patient',
    name: 'View Patient Dashboard',
    description: 'Access patient dashboard',
    category: 'Dashboard',
  },

  // ===== Users (6) - Platform Admin =====
  {
    slug: 'users:view_all',
    name: 'View All Users',
    description: 'View all users',
    category: 'Users',
  },
  {
    slug: 'users:create',
    name: 'Create Users',
    description: 'Create users',
    category: 'Users',
  },
  {
    slug: 'users:edit',
    name: 'Edit Users',
    description: 'Edit users',
    category: 'Users',
  },
  {
    slug: 'users:delete',
    name: 'Delete Users',
    description: 'Delete users (soft delete)',
    category: 'Users',
  },
  {
    slug: 'users:manage_roles',
    name: 'Manage User Roles',
    description: 'Manage user roles',
    category: 'Users',
  },
  {
    slug: 'users:impersonate',
    name: 'Impersonate Users',
    description: 'Impersonate users (support)',
    category: 'Users',
  },

  // ===== Organizations (5) - Platform Admin =====
  {
    slug: 'organizations:view_all',
    name: 'View All Organizations',
    description: 'View all organizations',
    category: 'Organizations',
  },
  {
    slug: 'organizations:create',
    name: 'Create Organizations',
    description: 'Create organizations',
    category: 'Organizations',
  },
  {
    slug: 'organizations:edit',
    name: 'Edit Organizations',
    description: 'Edit organizations',
    category: 'Organizations',
  },
  {
    slug: 'organizations:delete',
    name: 'Delete Organizations',
    description: 'Delete organizations',
    category: 'Organizations',
  },
  {
    slug: 'organizations:manage_settings',
    name: 'Manage Organization Settings',
    description: 'Manage organization settings',
    category: 'Organizations',
  },

  // ===== Payments (5) - Platform Admin =====
  {
    slug: 'payments:view_all',
    name: 'View All Payments',
    description: 'View all transactions',
    category: 'Payments',
  },
  {
    slug: 'payments:view_transfers',
    name: 'View Payment Transfers',
    description: 'View transfers',
    category: 'Payments',
  },
  {
    slug: 'payments:manage_disputes',
    name: 'Manage Payment Disputes',
    description: 'Manage disputes',
    category: 'Payments',
  },
  {
    slug: 'payments:process_refunds',
    name: 'Process Refunds',
    description: 'Process refunds',
    category: 'Payments',
  },
  {
    slug: 'payments:retry_failed',
    name: 'Retry Failed Payments',
    description: 'Retry failed payments',
    category: 'Payments',
  },

  // ===== Categories (4) - Platform Admin =====
  {
    slug: 'categories:create',
    name: 'Create Categories',
    description: 'Create categories',
    category: 'Categories',
  },
  {
    slug: 'categories:edit',
    name: 'Edit Categories',
    description: 'Edit categories',
    category: 'Categories',
  },
  {
    slug: 'categories:delete',
    name: 'Delete Categories',
    description: 'Delete categories',
    category: 'Categories',
  },
  {
    slug: 'categories:manage_tags',
    name: 'Manage Tags',
    description: 'Manage tags',
    category: 'Categories',
  },

  // ===== Moderation (4) - Platform Admin =====
  {
    slug: 'moderation:view_flags',
    name: 'View Flagged Content',
    description: 'View flagged content',
    category: 'Moderation',
  },
  {
    slug: 'moderation:review_content',
    name: 'Review Flagged Content',
    description: 'Review content',
    category: 'Moderation',
  },
  {
    slug: 'moderation:remove_content',
    name: 'Remove Content',
    description: 'Remove content',
    category: 'Moderation',
  },
  {
    slug: 'moderation:ban_users',
    name: 'Ban Users',
    description: 'Ban users',
    category: 'Moderation',
  },

  // ===== Audit (4) - Platform Admin =====
  {
    slug: 'audit:view_logs',
    name: 'View Audit Logs',
    description: 'View audit logs',
    category: 'Audit',
  },
  {
    slug: 'audit:export_logs',
    name: 'Export Audit Logs',
    description: 'Export audit logs',
    category: 'Audit',
  },
  {
    slug: 'audit:view_reports',
    name: 'View Audit Reports',
    description: 'View reports',
    category: 'Audit',
  },
  {
    slug: 'audit:generate_reports',
    name: 'Generate Audit Reports',
    description: 'Generate reports',
    category: 'Audit',
  },

  // ===== Support (4) - Platform Admin =====
  {
    slug: 'support:view_tickets',
    name: 'View Support Tickets',
    description: 'View tickets',
    category: 'Support',
  },
  {
    slug: 'support:respond_tickets',
    name: 'Respond to Tickets',
    description: 'Respond to tickets',
    category: 'Support',
  },
  {
    slug: 'support:escalate',
    name: 'Escalate Tickets',
    description: 'Escalate tickets',
    category: 'Support',
  },
  {
    slug: 'support:close_tickets',
    name: 'Close Tickets',
    description: 'Close tickets',
    category: 'Support',
  },

  // ===== Clinic (6) - Phase 2 =====
  {
    slug: 'clinic:view_dashboard',
    name: 'View Clinic Dashboard',
    description: 'View clinic overview',
    category: 'Clinic',
  },
  {
    slug: 'clinic:view_patients',
    name: 'View Clinic Patients',
    description: 'View shared clinic patients',
    category: 'Clinic',
  },
  {
    slug: 'clinic:view_schedule',
    name: 'View Clinic Schedule',
    description: 'View clinic schedule',
    category: 'Clinic',
  },
  {
    slug: 'clinic:manage_settings',
    name: 'Manage Clinic Settings',
    description: 'Manage clinic settings',
    category: 'Clinic',
  },
  {
    slug: 'clinic:manage_branding',
    name: 'Manage Clinic Branding',
    description: 'Manage clinic branding',
    category: 'Clinic',
  },
  {
    slug: 'clinic:view_analytics',
    name: 'View Clinic Analytics',
    description: 'View clinic analytics',
    category: 'Clinic',
  },
  {
    slug: 'clinic:export_data',
    name: 'Export Clinic Data',
    description: 'Export clinic data',
    category: 'Clinic',
  },

  // ===== Team (5) - Phase 2 =====
  {
    slug: 'team:view_members',
    name: 'View Team Members',
    description: 'View team members',
    category: 'Team',
  },
  {
    slug: 'team:invite_members',
    name: 'Invite Team Members',
    description: 'Invite members',
    category: 'Team',
  },
  {
    slug: 'team:remove_members',
    name: 'Remove Team Members',
    description: 'Remove members',
    category: 'Team',
  },
  {
    slug: 'team:manage_roles',
    name: 'Manage Team Roles',
    description: 'Manage roles',
    category: 'Team',
  },
  {
    slug: 'team:view_performance',
    name: 'View Team Performance',
    description: 'View performance',
    category: 'Team',
  },

  // ===== Schedule (3) - Phase 2 =====
  {
    slug: 'schedule:manage_clinic',
    name: 'Manage Clinic Schedule',
    description: 'Manage clinic schedule',
    category: 'Schedule',
  },
  {
    slug: 'schedule:manage_rooms',
    name: 'Manage Rooms',
    description: 'Manage rooms',
    category: 'Schedule',
  },
  {
    slug: 'schedule:view_capacity',
    name: 'View Capacity Planning',
    description: 'View capacity planning',
    category: 'Schedule',
  },

  // ===== Revenue (5) - Phase 2 =====
  {
    slug: 'revenue:view_overview',
    name: 'View Revenue Overview',
    description: 'View revenue overview',
    category: 'Revenue',
  },
  {
    slug: 'revenue:view_splits',
    name: 'View Commission Splits',
    description: 'View commission splits',
    category: 'Revenue',
  },
  {
    slug: 'revenue:manage_payouts',
    name: 'Manage Payouts',
    description: 'Manage payouts',
    category: 'Revenue',
  },
  {
    slug: 'revenue:view_invoices',
    name: 'View Invoices',
    description: 'View invoices',
    category: 'Revenue',
  },
  {
    slug: 'revenue:export_financial',
    name: 'Export Financial Data',
    description: 'Export financial data',
    category: 'Revenue',
  },
];

/**
 * Role Definitions (6 current + 4 future)
 */
const ROLES: Role[] = [
  // ===== PHASE 1: CURRENT ROLES =====
  {
    slug: 'patient',
    name: 'Patient',
    description:
      'Basic user/patient role for booking appointments and accessing their healthcare journey',
    priority: 10,
    permissions: [
      // Appointments
      'appointments:view_own',
      'appointments:create',
      'appointments:cancel_own',
      'appointments:reschedule_own',
      // Sessions
      'sessions:view_own',
      // Reviews
      'reviews:create',
      'reviews:view_own',
      'reviews:edit_own',
      'reviews:delete_own',
      // Experts
      'experts:browse',
      'experts:view_profiles',
      // Profile
      'profile:view_own',
      'profile:edit_own',
      // Billing
      'billing:view_own',
      'billing:methods_manage',
      // Dashboard
      'dashboard:view_patient',
    ],
  },
  {
    slug: 'expert_community',
    name: 'Expert Community',
    description:
      'Standard expert tier with core expert features. Pays 20% commission (monthly) or 12% (annual)',
    priority: 70,
    inheritsFrom: 'patient',
    permissions: [
      // Dashboard
      'dashboard:view_expert',
      // Appointments - Expert specific
      'appointments:view_incoming',
      'appointments:manage_own',
      'appointments:view_calendar',
      'appointments:confirm',
      'appointments:complete',
      // Patients
      'patients:view_own',
      'patients:view_history',
      'patients:send_notes',
      // Events
      'events:create',
      'events:view_own',
      'events:edit_own',
      'events:delete_own',
      'events:toggle_active',
      // Availability
      'availability:view_own',
      'availability:create',
      'availability:edit_own',
      'availability:delete_own',
      'availability:set_limits',
      // Calendar Integration
      'calendars:connect',
      'calendars:view_own',
      'calendars:edit_own',
      'calendars:disconnect',
      // Profile - Expert
      'profile:view_expert',
      'profile:edit_expert',
      'profile:preview',
      'profile:manage_link',
      // Billing - Expert
      'billing:view_earnings',
      'billing:view_payouts',
      'billing:view_subscription',
      'billing:manage_subscription',
      // Reviews
      'reviews:view_about_me',
      'reviews:respond',
      // Settings
      'settings:view_own',
      'settings:edit_own',
      'settings:security',
    ],
  },
  {
    slug: 'expert_top',
    name: 'Expert Top',
    description:
      'Premium expert tier with advanced features. Pays 18% commission (monthly) or 8% (annual)',
    priority: 80,
    inheritsFrom: 'expert_community',
    permissions: [
      // Analytics - Top Expert Exclusive
      'analytics:view',
      'analytics:revenue',
      'analytics:patients',
      'analytics:performance',
      'analytics:export',
      // Branding
      'branding:customize',
      'branding:upload_logo',
      'branding:custom_colors',
    ],
  },
  {
    slug: 'clinic_member',
    name: 'Clinic Member',
    description:
      'Expert who is a member of a clinic organization (not admin). Can manage their own practice + view shared clinic resources',
    priority: 60,
    inheritsFrom: 'expert_community',
    permissions: [
      // Clinic - Read-Only
      'clinic:view_dashboard',
      'clinic:view_patients',
      'clinic:view_schedule',
      // Team
      'team:view_members',
    ],
  },
  {
    slug: 'clinic_admin',
    name: 'Clinic Admin',
    description:
      'Administrator of a clinic organization. Can manage team, patients, schedule, and clinic settings',
    priority: 90,
    inheritsFrom: 'clinic_member',
    permissions: [
      // Clinic - Full Management
      'clinic:manage_settings',
      'clinic:manage_branding',
      'clinic:view_analytics',
      'clinic:export_data',
      // Team
      'team:invite_members',
      'team:remove_members',
      'team:manage_roles',
      'team:view_performance',
      // Schedule
      'schedule:manage_clinic',
      'schedule:manage_rooms',
      'schedule:view_capacity',
      // Patients
      'patients:view_all',
      'patients:manage_records',
      'patients:view_insights',
      // Revenue
      'revenue:view_overview',
      'revenue:view_splits',
      'revenue:manage_payouts',
      'revenue:view_invoices',
      'revenue:export_financial',
      // Billing
      'billing:manage_clinic_sub',
      'billing:view_clinic_billing',
    ],
  },
  {
    slug: 'superadmin',
    name: 'Platform Admin',
    description: 'Platform-level administrator with full system access. For Eleva Care team only',
    priority: 100,
    permissions: [
      // All permissions - admin has everything
      ...PERMISSIONS.map((p) => p.slug),
    ],
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Resolve permissions with inheritance
 */
function resolveRolePermissions(role: Role, allRoles: Role[]): string[] {
  const permissions = new Set<string>(role.permissions);

  if (role.inheritsFrom) {
    const parentRole = allRoles.find((r) => r.slug === role.inheritsFrom);
    if (parentRole) {
      const parentPermissions = resolveRolePermissions(parentRole, allRoles);
      parentPermissions.forEach((p) => permissions.add(p));
    }
  }

  return Array.from(permissions).sort();
}

/**
 * Validate configuration
 */
function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check permission slugs are unique
  const permissionSlugs = new Set<string>();
  PERMISSIONS.forEach((p) => {
    if (permissionSlugs.has(p.slug)) {
      errors.push(`Duplicate permission slug: ${p.slug}`);
    }
    permissionSlugs.add(p.slug);
  });

  // Check role slugs are unique
  const roleSlugs = new Set<string>();
  ROLES.forEach((r) => {
    if (roleSlugs.has(r.slug)) {
      errors.push(`Duplicate role slug: ${r.slug}`);
    }
    roleSlugs.add(r.slug);
  });

  // Check role inheritance
  ROLES.forEach((role) => {
    if (role.inheritsFrom) {
      const parentExists = ROLES.some((r) => r.slug === role.inheritsFrom);
      if (!parentExists) {
        errors.push(`Role ${role.slug} inherits from non-existent role: ${role.inheritsFrom}`);
      }
    }

    // Check all permissions exist
    role.permissions.forEach((permSlug) => {
      if (!permissionSlugs.has(permSlug)) {
        errors.push(`Role ${role.slug} references non-existent permission: ${permSlug}`);
      }
    });
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Get configuration
 */
function getConfig(): RBACConfig {
  return {
    permissions: PERMISSIONS,
    roles: ROLES,
    metadata: {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      totalPermissions: PERMISSIONS.length,
      totalRoles: ROLES.length,
    },
  };
}

// ============================================================================
// GENERATORS
// ============================================================================

/**
 * Generate JSON format
 */
async function generateJSON(outputDir: string) {
  const config = getConfig();
  const outputPath = join(outputDir, 'workos-rbac-config.json');

  await writeFile(outputPath, JSON.stringify(config, null, 2));
  console.log(`✅ Generated JSON: ${outputPath}`);
}

/**
 * Generate CSV format (for easy Excel import)
 */
async function generateCSV(outputDir: string) {
  // Permissions CSV
  const permissionsCsv = [
    'Slug,Name,Description,Category',
    ...PERMISSIONS.map((p) => `"${p.slug}","${p.name}","${p.description}","${p.category}"`),
  ].join('\n');

  const permissionsPath = join(outputDir, 'workos-permissions.csv');
  await writeFile(permissionsPath, permissionsCsv);
  console.log(`✅ Generated Permissions CSV: ${permissionsPath}`);

  // Roles CSV
  const rolesCsv = [
    'Slug,Name,Description,Priority,Inherits From,Total Permissions',
    ...ROLES.map((r) => {
      const totalPerms = resolveRolePermissions(r, ROLES).length;
      return `"${r.slug}","${r.name}","${r.description}",${r.priority},"${r.inheritsFrom || ''}",${totalPerms}`;
    }),
  ].join('\n');

  const rolesPath = join(outputDir, 'workos-roles.csv');
  await writeFile(rolesPath, rolesCsv);
  console.log(`✅ Generated Roles CSV: ${rolesPath}`);

  // Role-Permission Matrix CSV
  const matrixHeaders = ['Role', ...PERMISSIONS.map((p) => p.slug)];
  const matrixRows = ROLES.map((role) => {
    const rolePermissions = new Set(resolveRolePermissions(role, ROLES));
    return [role.name, ...PERMISSIONS.map((p) => (rolePermissions.has(p.slug) ? 'X' : ''))];
  });

  const matrixCsv = [
    matrixHeaders.map((h) => `"${h}"`).join(','),
    ...matrixRows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  const matrixPath = join(outputDir, 'workos-role-permission-matrix.csv');
  await writeFile(matrixPath, matrixCsv);
  console.log(`✅ Generated Role-Permission Matrix CSV: ${matrixPath}`);
}

/**
 * Generate Markdown format (for documentation)
 */
async function generateMarkdown(outputDir: string) {
  const lines: string[] = [];

  lines.push('# WorkOS RBAC Configuration');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Total Permissions:** ${PERMISSIONS.length}`);
  lines.push(`**Total Roles:** ${ROLES.length}`);
  lines.push('');

  // Table of Contents
  lines.push('## Table of Contents');
  lines.push('');
  lines.push('- [Permissions by Category](#permissions-by-category)');
  lines.push('- [Roles Overview](#roles-overview)');
  lines.push('- [Role-Permission Matrix](#role-permission-matrix)');
  lines.push('- [Copy-Paste Format](#copy-paste-format)');
  lines.push('');

  // Permissions by Category
  lines.push('## Permissions by Category');
  lines.push('');

  const categories = [...new Set(PERMISSIONS.map((p) => p.category))];
  categories.forEach((category) => {
    const categoryPerms = PERMISSIONS.filter((p) => p.category === category);
    lines.push(`### ${category} (${categoryPerms.length})`);
    lines.push('');
    lines.push('| Slug | Name | Description |');
    lines.push('|------|------|-------------|');
    categoryPerms.forEach((p) => {
      lines.push(`| \`${p.slug}\` | ${p.name} | ${p.description} |`);
    });
    lines.push('');
  });

  // Roles Overview
  lines.push('## Roles Overview');
  lines.push('');
  lines.push('| Role | Priority | Inherits From | Total Permissions | Description |');
  lines.push('|------|----------|---------------|-------------------|-------------|');
  ROLES.forEach((r) => {
    const totalPerms = resolveRolePermissions(r, ROLES).length;
    lines.push(
      `| **${r.name}** | ${r.priority} | ${r.inheritsFrom || '-'} | ${totalPerms} | ${r.description} |`,
    );
  });
  lines.push('');

  // Role-Permission Matrix
  lines.push('## Role-Permission Matrix');
  lines.push('');
  lines.push('| Permission | ' + ROLES.map((r) => r.name).join(' | ') + ' |');
  lines.push('|------------|' + ROLES.map(() => '---').join('|') + '|');

  PERMISSIONS.forEach((perm) => {
    const row = [perm.slug];
    ROLES.forEach((role) => {
      const rolePerms = new Set(resolveRolePermissions(role, ROLES));
      row.push(rolePerms.has(perm.slug) ? '✓' : '');
    });
    lines.push('| `' + row.join('` | ') + ' |');
  });
  lines.push('');

  // Copy-Paste Format
  lines.push('## Copy-Paste Format');
  lines.push('');
  lines.push('### All Permissions');
  lines.push('');
  lines.push('```');
  PERMISSIONS.forEach((p) => {
    lines.push(`${p.slug} | ${p.name}`);
  });
  lines.push('```');
  lines.push('');

  // Individual Role Permissions
  ROLES.forEach((role) => {
    lines.push(`### ${role.name} (${role.slug})`);
    lines.push('');
    lines.push('```');
    const perms = resolveRolePermissions(role, ROLES);
    perms.forEach((p) => lines.push(p));
    lines.push('```');
    lines.push('');
  });

  const outputPath = join(outputDir, 'workos-rbac-config.md');
  await writeFile(outputPath, lines.join('\n'));
  console.log(`✅ Generated Markdown: ${outputPath}`);
}

/**
 * Generate TypeScript constants (for code integration)
 */
async function generateTypeScript(outputDir: string) {
  const lines: string[] = [];

  lines.push('/**');
  lines.push(' * WorkOS RBAC Configuration');
  lines.push(' * ');
  lines.push(' * ⚠️ AUTO-GENERATED FILE - DO NOT EDIT MANUALLY');
  lines.push(' * Generated by: scripts/utilities/workos-rbac-config.ts');
  lines.push(` * Generated at: ${new Date().toISOString()}`);
  lines.push(' */');
  lines.push('');

  // Permission slugs as constants
  lines.push('/**');
  lines.push(' * All permission slugs');
  lines.push(' */');
  lines.push('export const WORKOS_PERMISSIONS = {');
  const categories = [...new Set(PERMISSIONS.map((p) => p.category))];
  categories.forEach((category) => {
    const categoryPerms = PERMISSIONS.filter((p) => p.category === category);
    lines.push(`  // ${category}`);
    categoryPerms.forEach((p) => {
      const constName = p.slug.toUpperCase().replace(/:/g, '_');
      lines.push(`  ${constName}: '${p.slug}',`);
    });
  });
  lines.push('} as const;');
  lines.push('');

  // Role slugs as constants
  lines.push('/**');
  lines.push(' * All role slugs');
  lines.push(' */');
  lines.push('export const WORKOS_ROLES = {');
  ROLES.forEach((r) => {
    const constName = r.slug.toUpperCase();
    lines.push(`  ${constName}: '${r.slug}',`);
  });
  lines.push('} as const;');
  lines.push('');

  // Role-Permission mapping
  lines.push('/**');
  lines.push(' * Role to permissions mapping (with inheritance resolved)');
  lines.push(' */');
  lines.push('export const ROLE_PERMISSIONS: Record<string, string[]> = {');
  ROLES.forEach((role) => {
    const perms = resolveRolePermissions(role, ROLES);
    lines.push(`  '${role.slug}': [`);
    perms.forEach((p) => {
      lines.push(`    '${p}',`);
    });
    lines.push('  ],');
  });
  lines.push('};');
  lines.push('');

  // Type definitions
  lines.push('/**');
  lines.push(' * Type for all permission slugs');
  lines.push(' */');
  lines.push(
    'export type WorkOSPermission = typeof WORKOS_PERMISSIONS[keyof typeof WORKOS_PERMISSIONS];',
  );
  lines.push('');
  lines.push('/**');
  lines.push(' * Type for all role slugs');
  lines.push(' */');
  lines.push('export type WorkOSRole = typeof WORKOS_ROLES[keyof typeof WORKOS_ROLES];');
  lines.push('');

  const outputPath = join(outputDir, 'workos-rbac-constants.ts');
  await writeFile(outputPath, lines.join('\n'));
  console.log(`✅ Generated TypeScript: ${outputPath}`);
}

// ============================================================================
// CLI COMMANDS
// ============================================================================

async function showSummary() {
  console.log('\n📊 WorkOS RBAC Configuration Summary\n');
  console.log(`Total Permissions: ${PERMISSIONS.length}`);
  console.log(`Total Roles: ${ROLES.length}\n`);

  console.log('Permissions by Category:');
  const categories = [...new Set(PERMISSIONS.map((p) => p.category))];
  categories.forEach((category) => {
    const count = PERMISSIONS.filter((p) => p.category === category).length;
    console.log(`  ${category}: ${count}`);
  });

  console.log('\nRoles:');
  ROLES.forEach((role) => {
    const totalPerms = resolveRolePermissions(role, ROLES).length;
    console.log(
      `  ${role.name} (${role.slug}): ${totalPerms} permissions (priority: ${role.priority})`,
    );
  });

  console.log('\n');
}

async function runValidation() {
  console.log('\n🔍 Validating RBAC Configuration...\n');

  const { valid, errors } = validateConfig();

  if (valid) {
    console.log('✅ Configuration is valid!\n');
    await showSummary();
  } else {
    console.log('❌ Configuration has errors:\n');
    errors.forEach((error) => console.log(`  - ${error}`));
    console.log('\n');
    process.exit(1);
  }
}

async function generateAll() {
  console.log('\n🚀 Generating all formats...\n');

  // Validate first
  const { valid, errors } = validateConfig();
  if (!valid) {
    console.log('❌ Configuration has errors:\n');
    errors.forEach((error) => console.log(`  - ${error}`));
    console.log('\n');
    process.exit(1);
  }

  // Create output directory
  const outputDir = join(process.cwd(), '_docs', '_WorkOS RABAC implemenation', 'generated');
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  // Generate all formats
  await generateJSON(outputDir);
  await generateCSV(outputDir);
  await generateMarkdown(outputDir);
  await generateTypeScript(outputDir);

  console.log('\n✨ All formats generated successfully!\n');
  console.log(`Output directory: ${outputDir}\n`);
}

// ============================================================================
// MAIN
// ============================================================================

const command = process.argv[2];

async function main() {
  switch (command) {
    case 'summary':
      await showSummary();
      break;
    case 'validate':
      await runValidation();
      break;
    case 'generate-json':
      await generateJSON(join(process.cwd(), '_docs', '_WorkOS RABAC implemenation', 'generated'));
      break;
    case 'generate-csv':
      await generateCSV(join(process.cwd(), '_docs', '_WorkOS RABAC implemenation', 'generated'));
      break;
    case 'generate-markdown':
      await generateMarkdown(
        join(process.cwd(), '_docs', '_WorkOS RABAC implemenation', 'generated'),
      );
      break;
    case 'generate-typescript':
      await generateTypeScript(
        join(process.cwd(), '_docs', '_WorkOS RABAC implemenation', 'generated'),
      );
      break;
    case 'generate-all':
      await generateAll();
      break;
    default:
      console.log('\n📚 WorkOS RBAC Configuration Manager\n');
      console.log('Usage:');
      console.log('  bun scripts/utilities/workos-rbac-config.ts <command>\n');
      console.log('Commands:');
      console.log('  summary              Show configuration summary');
      console.log('  validate             Validate configuration');
      console.log('  generate-json        Generate JSON format');
      console.log('  generate-csv         Generate CSV formats');
      console.log('  generate-markdown    Generate Markdown documentation');
      console.log('  generate-typescript  Generate TypeScript constants');
      console.log('  generate-all         Generate all formats\n');
      break;
  }
}

main().catch(console.error);
