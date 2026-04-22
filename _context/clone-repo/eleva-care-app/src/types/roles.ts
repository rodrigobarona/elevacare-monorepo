/**
 * Role Type Definitions
 *
 * Defines application roles and organization roles for the hybrid role system.
 *
 * Architecture:
 * - ApplicationRole: Stored in database (users.role column)
 * - OrganizationRole: Managed by WorkOS (org memberships)
 */

/**
 * Application-specific roles
 *
 * These roles are stored in the database and control application-level permissions.
 * They define what a user can do across the entire application.
 */
export type ApplicationRole =
  | 'user' // Regular user/patient - can book appointments
  | 'expert_top' // Top-tier expert - full expert features + priority listing
  | 'expert_community' // Community expert - standard expert features
  | 'expert_lecturer' // Lecturer - can create and manage courses (future)
  | 'admin' // Application administrator - platform management
  | 'superadmin'; // Super administrator - full system access

/**
 * WorkOS organization membership roles
 *
 * These roles are managed by WorkOS and control organization-level permissions.
 * In our org-per-user model, most users will be 'owner' of their personal org.
 */
export type OrganizationRole =
  | 'owner' // Organization owner - full control
  | 'admin' // Organization admin - can manage members
  | 'member' // Regular member - basic access
  | 'billing_admin'; // Billing admin - can manage billing only

/**
 * Combined role type for functions that accept either
 */
export type Role = ApplicationRole | OrganizationRole;

/**
 * Role hierarchy for permission checking
 *
 * Higher values have more permissions.
 * Used for "at least" permission checks.
 */
export const APPLICATION_ROLE_HIERARCHY: Record<ApplicationRole, number> = {
  user: 0,
  expert_community: 10,
  expert_lecturer: 15,
  expert_top: 20,
  admin: 90,
  superadmin: 100,
};

/**
 * Organization role hierarchy
 */
export const ORGANIZATION_ROLE_HIERARCHY: Record<OrganizationRole, number> = {
  member: 0,
  billing_admin: 10,
  admin: 50,
  owner: 100,
};

/**
 * Role display names for UI
 * Separated by role type to avoid duplicate key issues
 */
export const APPLICATION_ROLE_DISPLAY_NAMES: Record<ApplicationRole, string> = {
  user: 'User',
  expert_top: 'Top Expert',
  expert_community: 'Community Expert',
  expert_lecturer: 'Lecturer',
  admin: 'Application Administrator',
  superadmin: 'Super Administrator',
};

export const ORGANIZATION_ROLE_DISPLAY_NAMES: Record<OrganizationRole, string> = {
  owner: 'Owner',
  admin: 'Organization Admin',
  member: 'Member',
  billing_admin: 'Billing Admin',
};

/**
 * Get display name for any role
 */
export function getRoleDisplayName(role: string): string {
  if (role in APPLICATION_ROLE_DISPLAY_NAMES) {
    return APPLICATION_ROLE_DISPLAY_NAMES[role as ApplicationRole];
  }
  if (role in ORGANIZATION_ROLE_DISPLAY_NAMES) {
    return ORGANIZATION_ROLE_DISPLAY_NAMES[role as OrganizationRole];
  }
  return role;
}

/**
 * Role descriptions for UI
 * Separated by role type to avoid duplicate key issues
 */
export const APPLICATION_ROLE_DESCRIPTIONS: Record<ApplicationRole, string> = {
  user: 'Can book appointments and access patient features',
  expert_top: 'Top-tier expert with full features and priority listing',
  expert_community: 'Community expert with standard expert features',
  expert_lecturer: 'Can create and manage courses and lectures',
  admin: 'Can manage platform settings and users',
  superadmin: 'Full system access with all permissions',
};

export const ORGANIZATION_ROLE_DESCRIPTIONS: Record<OrganizationRole, string> = {
  owner: 'Full control over organization settings and members',
  admin: 'Can manage organization members and settings',
  member: 'Basic organization access',
  billing_admin: 'Can manage billing and subscriptions only',
};

/**
 * Get description for any role
 */
export function getRoleDescription(role: string): string {
  if (role in APPLICATION_ROLE_DESCRIPTIONS) {
    return APPLICATION_ROLE_DESCRIPTIONS[role as ApplicationRole];
  }
  if (role in ORGANIZATION_ROLE_DESCRIPTIONS) {
    return ORGANIZATION_ROLE_DESCRIPTIONS[role as OrganizationRole];
  }
  return '';
}

/**
 * Check if a role is an expert role
 */
export function isExpertRole(role: string): boolean {
  return role.startsWith('expert_');
}

/**
 * Check if a role is an admin role
 */
export function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'superadmin';
}

/**
 * Get all expert roles
 */
export function getExpertRoles(): ApplicationRole[] {
  return ['expert_top', 'expert_community', 'expert_lecturer'];
}

/**
 * Get role hierarchy level
 */
export function getRoleLevel(role: string): number {
  if (role in APPLICATION_ROLE_HIERARCHY) {
    return APPLICATION_ROLE_HIERARCHY[role as ApplicationRole];
  }
  if (role in ORGANIZATION_ROLE_HIERARCHY) {
    return ORGANIZATION_ROLE_HIERARCHY[role as OrganizationRole];
  }
  return 0;
}
