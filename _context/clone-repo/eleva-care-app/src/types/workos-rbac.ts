/**
 * WorkOS RBAC Type Definitions
 *
 * These types match the roles and permissions defined in WorkOS Dashboard.
 * Used throughout the application for type-safe permission checking.
 *
 * @see _docs/_WorkOS RABAC implemenation/WORKOS-ROLES-PERMISSIONS-CONFIGURATION.md
 * @see scripts/configure-workos-rbac.ts for full permission list
 */

// ============================================================================
// ROLES
// ============================================================================

/**
 * WorkOS RBAC Role Slugs
 *
 * These match the roles defined in WorkOS Dashboard.
 * Priority order: patient < partner_member < expert_community < expert_top < partner_admin < superadmin
 */
export const WORKOS_ROLES = {
  /** Basic patient role (priority: 10) */
  PATIENT: 'patient',
  /** Standard expert tier (priority: 70) */
  EXPERT_COMMUNITY: 'expert_community',
  /** Premium expert tier (priority: 80) */
  EXPERT_TOP: 'expert_top',
  /** Partner team member (priority: 60) */
  PARTNER_MEMBER: 'partner_member',
  /** Partner administrator (priority: 90) */
  PARTNER_ADMIN: 'partner_admin',
  /** Platform administrator (priority: 100) */
  SUPERADMIN: 'superadmin',
} as const;

export type WorkOSRole = (typeof WORKOS_ROLES)[keyof typeof WORKOS_ROLES];

/**
 * Role hierarchy for permission escalation checks
 * Higher values have more permissions
 */
export const WORKOS_ROLE_HIERARCHY: Record<WorkOSRole, number> = {
  [WORKOS_ROLES.PATIENT]: 10,
  [WORKOS_ROLES.PARTNER_MEMBER]: 60,
  [WORKOS_ROLES.EXPERT_COMMUNITY]: 70,
  [WORKOS_ROLES.EXPERT_TOP]: 80,
  [WORKOS_ROLES.PARTNER_ADMIN]: 90,
  [WORKOS_ROLES.SUPERADMIN]: 100,
};

/**
 * Expert roles for quick checking
 */
export const EXPERT_ROLES = [WORKOS_ROLES.EXPERT_COMMUNITY, WORKOS_ROLES.EXPERT_TOP] as const;

/**
 * Admin roles for quick checking
 */
export const ADMIN_ROLES = [WORKOS_ROLES.SUPERADMIN] as const;

/**
 * Partner roles for quick checking
 */
export const PARTNER_ROLES = [WORKOS_ROLES.PARTNER_MEMBER, WORKOS_ROLES.PARTNER_ADMIN] as const;

// ============================================================================
// PERMISSIONS (121 total)
// ============================================================================

/**
 * WorkOS RBAC Permission Slugs
 *
 * These match the permissions defined in WorkOS Dashboard.
 * Format: resource:action (e.g., events:create)
 */
export const WORKOS_PERMISSIONS = {
  // =========================================================================
  // Appointments (9)
  // =========================================================================
  APPOINTMENTS_VIEW_OWN: 'appointments:view_own',
  APPOINTMENTS_VIEW_INCOMING: 'appointments:view_incoming',
  APPOINTMENTS_CREATE: 'appointments:create',
  APPOINTMENTS_MANAGE_OWN: 'appointments:manage_own',
  APPOINTMENTS_CANCEL_OWN: 'appointments:cancel_own',
  APPOINTMENTS_RESCHEDULE_OWN: 'appointments:reschedule_own',
  APPOINTMENTS_VIEW_CALENDAR: 'appointments:view_calendar',
  APPOINTMENTS_CONFIRM: 'appointments:confirm',
  APPOINTMENTS_COMPLETE: 'appointments:complete',

  // =========================================================================
  // Sessions (2)
  // =========================================================================
  SESSIONS_VIEW_OWN: 'sessions:view_own',
  SESSIONS_VIEW_HISTORY: 'sessions:view_history',

  // =========================================================================
  // Patients (7)
  // =========================================================================
  PATIENTS_VIEW_OWN: 'patients:view_own',
  PATIENTS_VIEW_ALL: 'patients:view_all',
  PATIENTS_VIEW_HISTORY: 'patients:view_history',
  PATIENTS_SEND_NOTES: 'patients:send_notes',
  PATIENTS_MANAGE_RECORDS: 'patients:manage_records',
  PATIENTS_VIEW_INSIGHTS: 'patients:view_insights',
  PATIENTS_EXPORT: 'patients:export',

  // =========================================================================
  // Events (5)
  // =========================================================================
  EVENTS_CREATE: 'events:create',
  EVENTS_VIEW_OWN: 'events:view_own',
  EVENTS_EDIT_OWN: 'events:edit_own',
  EVENTS_DELETE_OWN: 'events:delete_own',
  EVENTS_TOGGLE_ACTIVE: 'events:toggle_active',

  // =========================================================================
  // Availability (5)
  // =========================================================================
  AVAILABILITY_VIEW_OWN: 'availability:view_own',
  AVAILABILITY_CREATE: 'availability:create',
  AVAILABILITY_EDIT_OWN: 'availability:edit_own',
  AVAILABILITY_DELETE_OWN: 'availability:delete_own',
  AVAILABILITY_SET_LIMITS: 'availability:set_limits',

  // =========================================================================
  // Calendars (4)
  // =========================================================================
  CALENDARS_CONNECT: 'calendars:connect',
  CALENDARS_VIEW_OWN: 'calendars:view_own',
  CALENDARS_EDIT_OWN: 'calendars:edit_own',
  CALENDARS_DISCONNECT: 'calendars:disconnect',

  // =========================================================================
  // Reviews (6)
  // =========================================================================
  REVIEWS_CREATE: 'reviews:create',
  REVIEWS_VIEW_OWN: 'reviews:view_own',
  REVIEWS_VIEW_ABOUT_ME: 'reviews:view_about_me',
  REVIEWS_EDIT_OWN: 'reviews:edit_own',
  REVIEWS_DELETE_OWN: 'reviews:delete_own',
  REVIEWS_RESPOND: 'reviews:respond',

  // =========================================================================
  // Profile (6)
  // =========================================================================
  PROFILE_VIEW_OWN: 'profile:view_own',
  PROFILE_EDIT_OWN: 'profile:edit_own',
  PROFILE_VIEW_EXPERT: 'profile:view_expert',
  PROFILE_EDIT_EXPERT: 'profile:edit_expert',
  PROFILE_PREVIEW: 'profile:preview',
  PROFILE_MANAGE_LINK: 'profile:manage_link',

  // =========================================================================
  // Experts (7)
  // =========================================================================
  EXPERTS_BROWSE: 'experts:browse',
  EXPERTS_VIEW_PROFILES: 'experts:view_profiles',
  EXPERTS_VIEW_APPLICATIONS: 'experts:view_applications',
  EXPERTS_APPROVE: 'experts:approve',
  EXPERTS_REJECT: 'experts:reject',
  EXPERTS_SUSPEND: 'experts:suspend',
  EXPERTS_VERIFY: 'experts:verify',

  // =========================================================================
  // Analytics (10)
  // =========================================================================
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_REVENUE: 'analytics:revenue',
  ANALYTICS_PATIENTS: 'analytics:patients',
  ANALYTICS_PERFORMANCE: 'analytics:performance',
  ANALYTICS_EXPORT: 'analytics:export',
  ANALYTICS_PLATFORM_GROWTH: 'analytics:platform_growth',
  ANALYTICS_PLATFORM_REVENUE: 'analytics:platform_revenue',
  ANALYTICS_PLATFORM_ENGAGEMENT: 'analytics:platform_engagement',
  ANALYTICS_PLATFORM_CHURN: 'analytics:platform_churn',
  ANALYTICS_PLATFORM_EXPORT: 'analytics:platform_export',

  // =========================================================================
  // Branding (3)
  // =========================================================================
  BRANDING_CUSTOMIZE: 'branding:customize',
  BRANDING_UPLOAD_LOGO: 'branding:upload_logo',
  BRANDING_CUSTOM_COLORS: 'branding:custom_colors',

  // =========================================================================
  // Billing (8)
  // =========================================================================
  BILLING_VIEW_OWN: 'billing:view_own',
  BILLING_VIEW_EARNINGS: 'billing:view_earnings',
  BILLING_VIEW_PAYOUTS: 'billing:view_payouts',
  BILLING_VIEW_SUBSCRIPTION: 'billing:view_subscription',
  BILLING_MANAGE_SUBSCRIPTION: 'billing:manage_subscription',
  BILLING_METHODS_MANAGE: 'billing:methods_manage',
  BILLING_MANAGE_CLINIC_SUB: 'billing:manage_clinic_sub',
  BILLING_VIEW_CLINIC_BILLING: 'billing:view_clinic_billing',

  // =========================================================================
  // Settings (7)
  // =========================================================================
  SETTINGS_VIEW_OWN: 'settings:view_own',
  SETTINGS_EDIT_OWN: 'settings:edit_own',
  SETTINGS_SECURITY: 'settings:security',
  SETTINGS_VIEW_PLATFORM: 'settings:view_platform',
  SETTINGS_EDIT_PLATFORM: 'settings:edit_platform',
  SETTINGS_MANAGE_FEATURES: 'settings:manage_features',
  SETTINGS_MANAGE_INTEGRATIONS: 'settings:manage_integrations',

  // =========================================================================
  // Dashboard (2)
  // =========================================================================
  DASHBOARD_VIEW_EXPERT: 'dashboard:view_expert',
  DASHBOARD_VIEW_PATIENT: 'dashboard:view_patient',

  // =========================================================================
  // Partner (18) - Phase 2
  // =========================================================================
  PARTNER_VIEW_DASHBOARD: 'partner:view_dashboard',
  PARTNER_MANAGE_SETTINGS: 'partner:manage_settings',
  PARTNER_MANAGE_BRANDING: 'partner:manage_branding',
  PARTNER_VIEW_ANALYTICS: 'partner:view_analytics',
  PARTNER_VIEW_PATIENTS: 'partner:view_patients',
  PARTNER_EXPORT_DATA: 'partner:export_data',
  TEAM_VIEW_MEMBERS: 'team:view_members',
  TEAM_INVITE_MEMBERS: 'team:invite_members',
  TEAM_REMOVE_MEMBERS: 'team:remove_members',
  TEAM_MANAGE_ROLES: 'team:manage_roles',
  TEAM_VIEW_PERFORMANCE: 'team:view_performance',
  SCHEDULE_MANAGE_CLINIC: 'schedule:manage_clinic',
  SCHEDULE_MANAGE_ROOMS: 'schedule:manage_rooms',
  SCHEDULE_VIEW_CAPACITY: 'schedule:view_capacity',
  REVENUE_VIEW_OVERVIEW: 'revenue:view_overview',
  REVENUE_VIEW_SPLITS: 'revenue:view_splits',
  REVENUE_MANAGE_PAYOUTS: 'revenue:manage_payouts',
  REVENUE_EXPORT_FINANCIAL: 'revenue:export_financial',

  // =========================================================================
  // Platform Admin (22)
  // =========================================================================
  USERS_VIEW_ALL: 'users:view_all',
  USERS_CREATE: 'users:create',
  USERS_EDIT: 'users:edit',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE_ROLES: 'users:manage_roles',
  USERS_IMPERSONATE: 'users:impersonate',
  ORGANIZATIONS_VIEW_ALL: 'organizations:view_all',
  ORGANIZATIONS_CREATE: 'organizations:create',
  ORGANIZATIONS_EDIT: 'organizations:edit',
  ORGANIZATIONS_DELETE: 'organizations:delete',
  ORGANIZATIONS_MANAGE_SETTINGS: 'organizations:manage_settings',
  PAYMENTS_VIEW_ALL: 'payments:view_all',
  PAYMENTS_VIEW_TRANSFERS: 'payments:view_transfers',
  PAYMENTS_MANAGE_DISPUTES: 'payments:manage_disputes',
  PAYMENTS_PROCESS_REFUNDS: 'payments:process_refunds',
  PAYMENTS_RETRY_FAILED: 'payments:retry_failed',
  MODERATION_VIEW_FLAGS: 'moderation:view_flags',
  MODERATION_REVIEW_CONTENT: 'moderation:review_content',
  MODERATION_REMOVE_CONTENT: 'moderation:remove_content',
  MODERATION_BAN_USERS: 'moderation:ban_users',
  AUDIT_VIEW_LOGS: 'audit:view_logs',
  AUDIT_EXPORT_LOGS: 'audit:export_logs',
} as const;

export type WorkOSPermission = (typeof WORKOS_PERMISSIONS)[keyof typeof WORKOS_PERMISSIONS];

// ============================================================================
// USER INTERFACE
// ============================================================================

/**
 * Extended AuthKit User with RBAC claims
 *
 * This interface represents the user object with role and permissions
 * extracted from the JWT token.
 */
export interface WorkOSUserWithRBAC {
  /** WorkOS user ID */
  id: string;
  /** User email */
  email: string;
  /** First name */
  firstName?: string;
  /** Last name */
  lastName?: string;
  /** Profile picture URL */
  profilePictureUrl?: string;

  // RBAC claims from JWT
  /** User's role slug */
  role?: WorkOSRole;
  /** Array of permission slugs */
  permissions?: WorkOSPermission[];

  // Organization context
  /** Current organization ID */
  organizationId?: string;
  /** Current organization slug */
  organizationSlug?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a role is an expert role
 */
export function isExpertRole(role: string): boolean {
  return (EXPERT_ROLES as readonly string[]).includes(role);
}

/**
 * Check if a role is an admin role
 */
export function isAdminRole(role: string): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * Check if a role is a partner role
 */
export function isPartnerRole(role: string): boolean {
  return (PARTNER_ROLES as readonly string[]).includes(role);
}

/**
 * Get role hierarchy level
 */
export function getRoleLevel(role: string): number {
  return WORKOS_ROLE_HIERARCHY[role as WorkOSRole] ?? 0;
}

/**
 * Check if roleA has higher or equal privilege than roleB
 */
export function hasHigherOrEqualRole(roleA: string, roleB: string): boolean {
  return getRoleLevel(roleA) >= getRoleLevel(roleB);
}

// ============================================================================
// ROLE DISPLAY NAMES
// ============================================================================

/**
 * User-facing display names for roles
 *
 * Note: Technical roles use "partner_*" prefix (WorkOS RBAC),
 * but users see "Workspace" terminology (product branding).
 *
 * @see _docs/02-core-systems/NAMING-CONVENTIONS-GLOSSARY.md
 */
export const WORKOS_ROLE_DISPLAY_NAMES: Record<WorkOSRole, string> = {
  [WORKOS_ROLES.PATIENT]: 'Patient',
  [WORKOS_ROLES.EXPERT_COMMUNITY]: 'Community Expert',
  [WORKOS_ROLES.EXPERT_TOP]: 'Top Expert',
  [WORKOS_ROLES.PARTNER_MEMBER]: 'Workspace Member',
  [WORKOS_ROLES.PARTNER_ADMIN]: 'Workspace Admin',
  [WORKOS_ROLES.SUPERADMIN]: 'Platform Admin',
};

export const WORKOS_ROLE_DESCRIPTIONS: Record<WorkOSRole, string> = {
  [WORKOS_ROLES.PATIENT]: 'Book appointments and access patient features',
  [WORKOS_ROLES.EXPERT_COMMUNITY]: 'Standard expert with core features',
  [WORKOS_ROLES.EXPERT_TOP]: 'Premium expert with analytics and branding',
  [WORKOS_ROLES.PARTNER_MEMBER]: 'Team member of a workspace',
  [WORKOS_ROLES.PARTNER_ADMIN]: 'Administrator of a workspace',
  [WORKOS_ROLES.SUPERADMIN]: 'Full platform access',
};

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: string): string {
  return WORKOS_ROLE_DISPLAY_NAMES[role as WorkOSRole] ?? role;
}

/**
 * Get description for a role
 */
export function getRoleDescription(role: string): string {
  return WORKOS_ROLE_DESCRIPTIONS[role as WorkOSRole] ?? '';
}
