'use client';

import { WORKOS_ROLES, type WorkOSRole } from '@/types/workos-rbac';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

interface AuthorizationContextType {
  roles: WorkOSRole[];
  hasRole: (roleToCheck: WorkOSRole | WorkOSRole[]) => boolean;
  isLoading: boolean;
}

const AuthorizationContext = createContext<AuthorizationContextType>({
  roles: [],
  hasRole: () => false,
  isLoading: true,
});

/**
 * Authorization Provider - WorkOS Version
 *
 * Provides role-based access control for client components.
 * Fetches user roles from the database via API and exposes them via context.
 * Uses WorkOS's built-in useAuth hook for authentication state.
 *
 * @example
 * // Wrap your app or layout with the provider
 * <AuthorizationProvider>
 *   <App />
 * </AuthorizationProvider>
 *
 * // Then use the hooks in child components
 * function AdminPanel() {
 *   const isAdmin = useIsAdmin();
 *   if (!isAdmin) return null;
 *   return <AdminDashboard />;
 * }
 */
export function AuthorizationProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<WorkOSRole[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);

  // Fetch user roles from API when user is loaded
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setRoles([]);
      setIsLoadingRoles(false);
      return;
    }

    const abortController = new AbortController();

    // Fetch roles from API
    const fetchRoles = async () => {
      try {
        const response = await fetch('/api/user/roles', {
          signal: abortController.signal,
        });

        if (!response.ok) {
          console.error('Failed to fetch user roles');
          setRoles([WORKOS_ROLES.PATIENT]); // Default to patient role
          return;
        }

        const data = await response.json();
        // Validate response shape
        const roles = Array.isArray(data.roles) ? data.roles : [WORKOS_ROLES.PATIENT];
        setRoles(roles);
      } catch (error) {
        // Ignore abort errors (component unmounted)
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error('Error fetching user roles:', error);
        setRoles([WORKOS_ROLES.PATIENT]); // Default to patient role on error
      } finally {
        setIsLoadingRoles(false);
      }
    };

    fetchRoles();

    return () => {
      abortController.abort();
    };
  }, [authLoading, user]);

  // Derive loading state
  const isLoading = authLoading || isLoadingRoles;

  const hasRole = (roleToCheck: WorkOSRole | WorkOSRole[]): boolean => {
    if (roles.length === 0) return false;
    const rolesToCheck = Array.isArray(roleToCheck) ? roleToCheck : [roleToCheck];
    return roles.some((role) => rolesToCheck.includes(role));
  };

  return (
    <AuthorizationContext.Provider
      value={{
        roles,
        hasRole,
        isLoading,
      }}
    >
      {children}
    </AuthorizationContext.Provider>
  );
}

/**
 * Hook to access the authorization context
 *
 * @returns Authorization context with roles, hasRole function, and loading state
 * @example
 * const { roles, hasRole, isLoading } = useAuthorization();
 * if (hasRole(WORKOS_ROLES.SUPERADMIN)) {
 *   // Show admin content
 * }
 */
export function useAuthorization() {
  return useContext(AuthorizationContext);
}

/**
 * Hook to check if the current user is a superadmin
 *
 * @returns boolean indicating if user has superadmin role
 * @example
 * const isAdmin = useIsAdmin();
 * if (isAdmin) {
 *   return <AdminDashboard />;
 * }
 */
export function useIsAdmin(): boolean {
  const { hasRole } = useAuthorization();
  return hasRole(WORKOS_ROLES.SUPERADMIN);
}

/**
 * Hook to check if the current user is any type of expert
 *
 * @returns boolean indicating if user has expert_community or expert_top role
 * @example
 * const isExpert = useIsExpert();
 * if (isExpert) {
 *   return <ExpertDashboard />;
 * }
 */
export function useIsExpert(): boolean {
  const { hasRole } = useAuthorization();
  return hasRole([WORKOS_ROLES.EXPERT_COMMUNITY, WORKOS_ROLES.EXPERT_TOP]);
}

/**
 * Hook to check if the current user is a top expert
 *
 * @returns boolean indicating if user has expert_top role
 * @example
 * const isTopExpert = useIsTopExpert();
 * if (isTopExpert) {
 *   return <PremiumAnalytics />;
 * }
 */
export function useIsTopExpert(): boolean {
  const { hasRole } = useAuthorization();
  return hasRole(WORKOS_ROLES.EXPERT_TOP);
}

/**
 * Hook to check if the current user is a community expert
 *
 * @returns boolean indicating if user has expert_community role
 * @example
 * const isCommunityExpert = useIsCommunityExpert();
 */
export function useIsCommunityExpert(): boolean {
  const { hasRole } = useAuthorization();
  return hasRole(WORKOS_ROLES.EXPERT_COMMUNITY);
}

/**
 * Component for role-based UI rendering
 *
 * Renders children only if user has the required role(s).
 * Shows fallback or redirects if access is denied.
 *
 * @example
 * // Render admin-only content with fallback
 * <RequireRole roles={WORKOS_ROLES.SUPERADMIN} fallback={<AccessDenied />}>
 *   <AdminPanel />
 * </RequireRole>
 *
 * @example
 * // Redirect if user doesn't have expert role
 * <RequireRole roles={[WORKOS_ROLES.EXPERT_TOP, WORKOS_ROLES.EXPERT_COMMUNITY]} redirectTo="/dashboard">
 *   <ExpertContent />
 * </RequireRole>
 */
interface RequireRoleProps {
  children: ReactNode;
  roles: WorkOSRole | WorkOSRole[];
  fallback?: ReactNode;
  redirectTo?: string;
}

export function RequireRole({ children, roles, fallback, redirectTo }: RequireRoleProps) {
  const { hasRole, isLoading } = useAuthorization();

  if (isLoading) {
    return null;
  }

  const hasAccess = hasRole(roles);

  if (!hasAccess) {
    if (redirectTo) {
      redirect(redirectTo);
    }
    return fallback || null;
  }

  return <>{children}</>;
}
