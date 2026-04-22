'use client';

/**
 * RequireRole Component
 *
 * Conditionally renders content based on user roles.
 * Useful for role-based UI rendering in client components.
 *
 * @example
 * ```tsx
 * // Only show for experts
 * <RequireRole role={WORKOS_ROLES.EXPERT_TOP}>
 *   <ExpertOnlyFeature />
 * </RequireRole>
 *
 * // Show for any expert type
 * <RequireRole anyRoles={[WORKOS_ROLES.EXPERT_COMMUNITY, WORKOS_ROLES.EXPERT_TOP]}>
 *   <ExpertFeature />
 * </RequireRole>
 *
 * // Show upgrade CTA for non-experts
 * <RequireRole role={WORKOS_ROLES.EXPERT_TOP} fallback={<UpgradeToTop />}>
 *   <TopExpertFeature />
 * </RequireRole>
 * ```
 */

import { useRBAC } from '@/components/providers/RBACProvider';
import type { WorkOSRole } from '@/types/workos-rbac';
import { WORKOS_ROLES } from '@/types/workos-rbac';
import type { ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface RequireRoleProps {
  /** Single role to check */
  role?: WorkOSRole;
  /** Multiple roles - user needs ANY of these */
  anyRoles?: WorkOSRole[];
  /** Content to render when user has role */
  children: ReactNode;
  /** Content to render when user lacks role (optional) */
  fallback?: ReactNode;
  /** Content to render while loading (optional) */
  loading?: ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RequireRole({
  role,
  anyRoles,
  children,
  fallback = null,
  loading = null,
}: RequireRoleProps) {
  const { hasRole, hasAnyRole, isLoading } = useRBAC();

  // Show loading state
  if (isLoading) {
    return <>{loading}</>;
  }

  // Check roles
  let hasAccess = false;

  if (role) {
    hasAccess = hasRole(role);
  } else if (anyRoles && anyRoles.length > 0) {
    hasAccess = hasAnyRole(anyRoles);
  } else {
    // No role specified - allow access
    hasAccess = true;
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

// ============================================================================
// CONVENIENCE COMPONENTS
// ============================================================================

interface RoleChildrenProps {
  children: ReactNode;
  fallback?: ReactNode;
  loading?: ReactNode;
}

/**
 * Require admin role (superadmin)
 */
export function RequireAdmin({
  children,
  fallback = null,
  loading = null,
}: RoleChildrenProps) {
  return (
    <RequireRole
      role={WORKOS_ROLES.SUPERADMIN}
      fallback={fallback}
      loading={loading}
    >
      {children}
    </RequireRole>
  );
}

/**
 * Require any expert role (community or top)
 */
export function RequireExpert({
  children,
  fallback = null,
  loading = null,
}: RoleChildrenProps) {
  return (
    <RequireRole
      anyRoles={[WORKOS_ROLES.EXPERT_COMMUNITY, WORKOS_ROLES.EXPERT_TOP]}
      fallback={fallback}
      loading={loading}
    >
      {children}
    </RequireRole>
  );
}

/**
 * Require top expert role
 */
export function RequireTopExpert({
  children,
  fallback = null,
  loading = null,
}: RoleChildrenProps) {
  return (
    <RequireRole
      role={WORKOS_ROLES.EXPERT_TOP}
      fallback={fallback}
      loading={loading}
    >
      {children}
    </RequireRole>
  );
}

/**
 * Require community expert role
 */
export function RequireCommunityExpert({
  children,
  fallback = null,
  loading = null,
}: RoleChildrenProps) {
  return (
    <RequireRole
      role={WORKOS_ROLES.EXPERT_COMMUNITY}
      fallback={fallback}
      loading={loading}
    >
      {children}
    </RequireRole>
  );
}

/**
 * Require any partner role (member or admin)
 */
export function RequirePartner({
  children,
  fallback = null,
  loading = null,
}: RoleChildrenProps) {
  return (
    <RequireRole
      anyRoles={[WORKOS_ROLES.PARTNER_MEMBER, WORKOS_ROLES.PARTNER_ADMIN]}
      fallback={fallback}
      loading={loading}
    >
      {children}
    </RequireRole>
  );
}

/**
 * Require partner admin role
 */
export function RequirePartnerAdminRole({
  children,
  fallback = null,
  loading = null,
}: RoleChildrenProps) {
  return (
    <RequireRole
      role={WORKOS_ROLES.PARTNER_ADMIN}
      fallback={fallback}
      loading={loading}
    >
      {children}
    </RequireRole>
  );
}

/**
 * Require patient role (basic users)
 */
export function RequirePatient({
  children,
  fallback = null,
  loading = null,
}: RoleChildrenProps) {
  return (
    <RequireRole
      role={WORKOS_ROLES.PATIENT}
      fallback={fallback}
      loading={loading}
    >
      {children}
    </RequireRole>
  );
}

// ============================================================================
// NOT ROLE COMPONENTS (for showing content when user DOESN'T have a role)
// ============================================================================

interface NotRoleProps {
  role: WorkOSRole;
  children: ReactNode;
  loading?: ReactNode;
}

/**
 * Show content only when user does NOT have specified role
 *
 * Useful for upgrade CTAs and conditional content for non-experts
 */
export function NotRole({
  role,
  children,
  loading = null,
}: NotRoleProps) {
  const { hasRole, isLoading } = useRBAC();

  if (isLoading) {
    return <>{loading}</>;
  }

  if (!hasRole(role)) {
    return <>{children}</>;
  }

  return null;
}

/**
 * Show content only for non-experts (patients)
 */
export function NonExpert({
  children,
  loading = null,
}: { children: ReactNode; loading?: ReactNode }) {
  const { isExpert, isLoading } = useRBAC();

  if (isLoading) {
    return <>{loading}</>;
  }

  if (!isExpert) {
    return <>{children}</>;
  }

  return null;
}

/**
 * Show content only for non-top-experts
 *
 * Useful for upgrade CTAs to Top Expert tier
 */
export function NonTopExpert({
  children,
  loading = null,
}: { children: ReactNode; loading?: ReactNode }) {
  const { isTopExpert, isLoading } = useRBAC();

  if (isLoading) {
    return <>{loading}</>;
  }

  if (!isTopExpert) {
    return <>{children}</>;
  }

  return null;
}

