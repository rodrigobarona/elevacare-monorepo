'use client';

/**
 * RBAC Provider for Client Components
 *
 * Provides role and permission context to client components.
 * Fetches user RBAC data from /api/user/rbac endpoint.
 *
 * @example
 * ```tsx
 * // In layout or page
 * <RBACProvider>
 *   <MyComponent />
 * </RBACProvider>
 *
 * // In client component
 * const { hasPermission } = useRBAC();
 * if (hasPermission(WORKOS_PERMISSIONS.ANALYTICS_VIEW)) {
 *   // Show analytics
 * }
 * ```
 */
import type { WorkOSPermission, WorkOSRole, WorkOSUserWithRBAC } from '@/types/workos-rbac';
import { WORKOS_ROLES } from '@/types/workos-rbac';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// ============================================================================
// CONTEXT TYPES
// ============================================================================

interface RBACContextValue {
  /** Current user with RBAC info */
  user: WorkOSUserWithRBAC | null;
  /** User's current role */
  role: WorkOSRole;
  /** User's permissions array */
  permissions: WorkOSPermission[];
  /** Whether RBAC data is loading */
  isLoading: boolean;
  /** Error if RBAC fetch failed */
  error: Error | null;

  // Role checking functions
  hasRole: (role: WorkOSRole) => boolean;
  hasAnyRole: (roles: WorkOSRole[]) => boolean;

  // Permission checking functions
  hasPermission: (permission: WorkOSPermission) => boolean;
  hasAnyPermission: (permissions: WorkOSPermission[]) => boolean;
  hasAllPermissions: (permissions: WorkOSPermission[]) => boolean;

  // Convenience checks
  isAdmin: boolean;
  isExpert: boolean;
  isTopExpert: boolean;
  isPartner: boolean;
  isPartnerAdmin: boolean;
  isPatient: boolean;

  // Refresh function
  refresh: () => Promise<void>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const RBACContext = createContext<RBACContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

interface RBACProviderProps {
  children: React.ReactNode;
  /** Initial user data (optional, for SSR) */
  initialUser?: WorkOSUserWithRBAC | null;
}

export function RBACProvider({ children, initialUser = null }: RBACProviderProps) {
  const [user, setUser] = useState<WorkOSUserWithRBAC | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser);
  const [error, setError] = useState<Error | null>(null);

  // Fetch user RBAC data
  const fetchRBAC = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/user/rbac');

      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated - not an error
          setUser(null);
          return;
        }
        throw new Error(`Failed to fetch RBAC: ${response.statusText}`);
      }

      const data = await response.json();
      setUser(data.user);
    } catch (err) {
      console.error('[RBACProvider] Error fetching RBAC:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount (if no initial user)
  useEffect(() => {
    if (!initialUser) {
      fetchRBAC();
    }
  }, [fetchRBAC, initialUser]);

  // Derived values with proper memoization
  const role = user?.role || WORKOS_ROLES.PATIENT;
  const permissions = useMemo(() => user?.permissions || [], [user?.permissions]);

  // Role checking functions
  const hasRole = useCallback((checkRole: WorkOSRole) => role === checkRole, [role]);

  const hasAnyRole = useCallback((roles: WorkOSRole[]) => roles.includes(role), [role]);

  // Permission checking functions
  const hasPermission = useCallback(
    (permission: WorkOSPermission) => permissions.includes(permission),
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (perms: WorkOSPermission[]) => perms.some((p) => permissions.includes(p)),
    [permissions],
  );

  const hasAllPermissions = useCallback(
    (perms: WorkOSPermission[]) => perms.every((p) => permissions.includes(p)),
    [permissions],
  );

  // Convenience checks
  const isAdmin = role === WORKOS_ROLES.SUPERADMIN;
  const isExpert = role === WORKOS_ROLES.EXPERT_COMMUNITY || role === WORKOS_ROLES.EXPERT_TOP;
  const isTopExpert = role === WORKOS_ROLES.EXPERT_TOP;
  const isPartner = role === WORKOS_ROLES.PARTNER_MEMBER || role === WORKOS_ROLES.PARTNER_ADMIN;
  const isPartnerAdmin = role === WORKOS_ROLES.PARTNER_ADMIN;
  const isPatient = role === WORKOS_ROLES.PATIENT;

  // Context value
  const value = useMemo<RBACContextValue>(
    () => ({
      user,
      role,
      permissions,
      isLoading,
      error,
      hasRole,
      hasAnyRole,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      isAdmin,
      isExpert,
      isTopExpert,
      isPartner,
      isPartnerAdmin,
      isPatient,
      refresh: fetchRBAC,
    }),
    [
      user,
      role,
      permissions,
      isLoading,
      error,
      hasRole,
      hasAnyRole,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      isAdmin,
      isExpert,
      isTopExpert,
      isPartner,
      isPartnerAdmin,
      isPatient,
      fetchRBAC,
    ],
  );

  return <RBACContext.Provider value={value}>{children}</RBACContext.Provider>;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Use RBAC context
 *
 * @throws Error if used outside RBACProvider
 *
 * @example
 * ```tsx
 * const { hasPermission, isExpert } = useRBAC();
 * ```
 */
export function useRBAC(): RBACContextValue {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error('useRBAC must be used within RBACProvider');
  }
  return context;
}

/**
 * Check if user is admin
 */
export function useIsAdmin(): boolean {
  const { isAdmin, isLoading } = useRBAC();
  return !isLoading && isAdmin;
}

/**
 * Check if user is any type of expert
 */
export function useIsExpert(): boolean {
  const { isExpert, isLoading } = useRBAC();
  return !isLoading && isExpert;
}

/**
 * Check if user is top expert
 */
export function useIsTopExpert(): boolean {
  const { isTopExpert, isLoading } = useRBAC();
  return !isLoading && isTopExpert;
}

/**
 * Check if user is partner (member or admin)
 */
export function useIsPartner(): boolean {
  const { isPartner, isLoading } = useRBAC();
  return !isLoading && isPartner;
}

/**
 * Check if user is partner admin
 */
export function useIsPartnerAdmin(): boolean {
  const { isPartnerAdmin, isLoading } = useRBAC();
  return !isLoading && isPartnerAdmin;
}

/**
 * Check if user has a specific permission
 *
 * @example
 * ```tsx
 * const canViewAnalytics = useHasPermission(WORKOS_PERMISSIONS.ANALYTICS_VIEW);
 * ```
 */
export function useHasPermission(permission: WorkOSPermission): boolean {
  const { hasPermission, isLoading } = useRBAC();
  return !isLoading && hasPermission(permission);
}

/**
 * Check if user has any of the specified permissions
 */
export function useHasAnyPermission(permissions: WorkOSPermission[]): boolean {
  const { hasAnyPermission, isLoading } = useRBAC();
  return !isLoading && hasAnyPermission(permissions);
}

/**
 * Check if user has all of the specified permissions
 */
export function useHasAllPermissions(permissions: WorkOSPermission[]): boolean {
  const { hasAllPermissions, isLoading } = useRBAC();
  return !isLoading && hasAllPermissions(permissions);
}

/**
 * Check if user has a specific role
 */
export function useHasRole(role: WorkOSRole): boolean {
  const { hasRole, isLoading } = useRBAC();
  return !isLoading && hasRole(role);
}

/**
 * Check if user has any of the specified roles
 */
export function useHasAnyRole(roles: WorkOSRole[]): boolean {
  const { hasAnyRole, isLoading } = useRBAC();
  return !isLoading && hasAnyRole(roles);
}

/**
 * Get user's current role
 */
export function useRole(): WorkOSRole {
  const { role } = useRBAC();
  return role;
}

/**
 * Get user's permissions array
 */
export function usePermissions(): WorkOSPermission[] {
  const { permissions } = useRBAC();
  return permissions;
}

/**
 * Get loading state
 */
export function useRBACLoading(): boolean {
  const { isLoading } = useRBAC();
  return isLoading;
}
