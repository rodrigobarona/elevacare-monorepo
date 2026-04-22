'use client';

/**
 * RequirePermission Component
 *
 * Conditionally renders content based on user permissions.
 * Useful for showing/hiding UI elements based on RBAC.
 *
 * @example
 * ```tsx
 * // Hide analytics for non-top experts
 * <RequirePermission permission={WORKOS_PERMISSIONS.ANALYTICS_VIEW}>
 *   <AnalyticsDashboard />
 * </RequirePermission>
 *
 * // Show upgrade CTA when permission is missing
 * <RequirePermission
 *   permission={WORKOS_PERMISSIONS.ANALYTICS_VIEW}
 *   fallback={<UpgradeCard title="Unlock Analytics" />}
 * >
 *   <AnalyticsDashboard />
 * </RequirePermission>
 * ```
 */
import { useRBAC } from '@/components/providers/RBACProvider';
import type { WorkOSPermission } from '@/types/workos-rbac';
import type { ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface RequirePermissionProps {
  /** Single permission to check */
  permission?: WorkOSPermission;
  /** Multiple permissions - user needs ANY of these */
  anyPermissions?: WorkOSPermission[];
  /** Multiple permissions - user needs ALL of these */
  allPermissions?: WorkOSPermission[];
  /** Content to render when user has permission */
  children: ReactNode;
  /** Content to render when user lacks permission (optional) */
  fallback?: ReactNode;
  /** Content to render while loading (optional) */
  loading?: ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RequirePermission({
  permission,
  anyPermissions,
  allPermissions,
  children,
  fallback = null,
  loading = null,
}: RequirePermissionProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = useRBAC();

  // Show loading state
  if (isLoading) {
    return <>{loading}</>;
  }

  // Check permissions
  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (anyPermissions && anyPermissions.length > 0) {
    hasAccess = hasAnyPermission(anyPermissions);
  } else if (allPermissions && allPermissions.length > 0) {
    hasAccess = hasAllPermissions(allPermissions);
  } else {
    // No permission specified - allow access
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

interface RequireAnyPermissionProps {
  permissions: WorkOSPermission[];
  children: ReactNode;
  fallback?: ReactNode;
  loading?: ReactNode;
}

/**
 * Require user to have ANY of the specified permissions
 */
export function RequireAnyPermission({
  permissions,
  children,
  fallback = null,
  loading = null,
}: RequireAnyPermissionProps) {
  return (
    <RequirePermission anyPermissions={permissions} fallback={fallback} loading={loading}>
      {children}
    </RequirePermission>
  );
}

interface RequireAllPermissionsProps {
  permissions: WorkOSPermission[];
  children: ReactNode;
  fallback?: ReactNode;
  loading?: ReactNode;
}

/**
 * Require user to have ALL of the specified permissions
 */
export function RequireAllPermissions({
  permissions,
  children,
  fallback = null,
  loading = null,
}: RequireAllPermissionsProps) {
  return (
    <RequirePermission allPermissions={permissions} fallback={fallback} loading={loading}>
      {children}
    </RequirePermission>
  );
}

// ============================================================================
// SPECIFIC PERMISSION COMPONENTS
// ============================================================================

interface PermissionChildrenProps {
  children: ReactNode;
  fallback?: ReactNode;
  loading?: ReactNode;
}

/**
 * Require analytics:view permission (Top Expert feature)
 */
export function RequireAnalytics({
  children,
  fallback = null,
  loading = null,
}: PermissionChildrenProps) {
  return (
    <RequirePermission permission="analytics:view" fallback={fallback} loading={loading}>
      {children}
    </RequirePermission>
  );
}

/**
 * Require branding:customize permission (Top Expert feature)
 */
export function RequireBranding({
  children,
  fallback = null,
  loading = null,
}: PermissionChildrenProps) {
  return (
    <RequirePermission permission="branding:customize" fallback={fallback} loading={loading}>
      {children}
    </RequirePermission>
  );
}

/**
 * Require experts:approve permission (Admin only)
 */
export function RequireExpertApproval({
  children,
  fallback = null,
  loading = null,
}: PermissionChildrenProps) {
  return (
    <RequirePermission permission="experts:approve" fallback={fallback} loading={loading}>
      {children}
    </RequirePermission>
  );
}

/**
 * Require partner:view_dashboard permission
 */
export function RequirePartnerDashboard({
  children,
  fallback = null,
  loading = null,
}: PermissionChildrenProps) {
  return (
    <RequirePermission permission="partner:view_dashboard" fallback={fallback} loading={loading}>
      {children}
    </RequirePermission>
  );
}

/**
 * Require partner:manage_settings permission (Partner Admin)
 */
export function RequirePartnerAdmin({
  children,
  fallback = null,
  loading = null,
}: PermissionChildrenProps) {
  return (
    <RequirePermission permission="partner:manage_settings" fallback={fallback} loading={loading}>
      {children}
    </RequirePermission>
  );
}

/**
 * Require users:view_all permission (Platform Admin)
 */
export function RequireUserManagement({
  children,
  fallback = null,
  loading = null,
}: PermissionChildrenProps) {
  return (
    <RequirePermission permission="users:view_all" fallback={fallback} loading={loading}>
      {children}
    </RequirePermission>
  );
}
