/**
 * Protected Route Helper (AuthKit)
 *
 * Simplifies authentication and role checking in Server Components.
 * Wraps WorkOS AuthKit with role-based access control.
 *
 * Usage:
 * - withProtectedAuth(): Require authentication only
 * - withProtectedAuth({ requiredRole: 'expert_top' }): Require specific role
 * - withProtectedAuth({ requiredPermission: 'expert_community' }): Require permission level
 */
import type { ApplicationRole, Role } from '@/types/roles';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';

import { hasPermission, hasRole } from '../integrations/workos/roles';

/**
 * Options for protected route helper
 */
interface WithAuthOptions {
  /**
   * Require exact role match
   */
  requiredRole?: Role;

  /**
   * Require permission level (includes higher roles)
   */
  requiredPermission?: ApplicationRole;

  /**
   * Where to redirect if unauthorized
   */
  redirectTo?: string;

  /**
   * Custom error message for unauthorized access
   */
  errorMessage?: string;
}

/**
 * Protect a page or route with authentication and optional role check
 *
 * This wraps WorkOS AuthKit's withAuth() with additional role-based access control.
 *
 * @param options - Protection options
 * @returns WorkOS session with user if authorized
 * @throws Redirects to sign-in or specified page if unauthorized
 *
 * @example
 * ```tsx
 * // Require authentication only
 * export default async function DashboardPage() {
 *   const { user } = await withProtectedAuth();
 *   return <div>Welcome {user.firstName}</div>;
 * }
 *
 * // Require specific role
 * export default async function ExpertPage() {
 *   await withProtectedAuth({ requiredRole: 'expert_top' });
 *   return <ExpertDashboard />;
 * }
 *
 * // Require permission level (expert or higher)
 * export default async function ExpertFeaturesPage() {
 *   await withProtectedAuth({ requiredPermission: 'expert_community' });
 *   return <ExpertFeatures />;
 * }
 *
 * // Custom redirect
 * export default async function AdminPage() {
 *   await withProtectedAuth({
 *     requiredRole: 'admin',
 *     redirectTo: '/dashboard',
 *     errorMessage: 'Admin access required'
 *   });
 *   return <AdminPanel />;
 * }
 * ```
 */
export async function withProtectedAuth(options?: WithAuthOptions) {
  // Step 1: Require authentication (redirects to /sign-in if not authenticated)
  const authResult = await withAuth({ ensureSignedIn: true });

  // Step 2: Check role if specified
  if (options?.requiredRole) {
    const hasRequiredRole = await hasRole(authResult.user.id, options.requiredRole);

    if (!hasRequiredRole) {
      console.warn(`User ${authResult.user.id} lacks required role: ${options.requiredRole}`);

      // Redirect to specified page or dashboard
      redirect(options.redirectTo || '/dashboard');
    }
  }

  // Step 3: Check permission level if specified
  if (options?.requiredPermission) {
    const hasRequiredPermission = await hasPermission(
      authResult.user.id,
      options.requiredPermission,
    );

    if (!hasRequiredPermission) {
      console.warn(
        `User ${authResult.user.id} lacks required permission: ${options.requiredPermission}`,
      );

      // Redirect to specified page or dashboard
      redirect(options.redirectTo || '/dashboard');
    }
  }

  return authResult;
}

/**
 * Higher-order function to protect API routes or Server Actions
 *
 * @param handler - The async function to protect
 * @param options - Protection options
 * @returns Protected handler
 *
 * @example
 * ```ts
 * // In API route or Server Action
 * export const adminAction = protectedAction(
 *   async ({ user }) => {
 *     // Admin-only logic
 *     return { success: true };
 *   },
 *   { requiredRole: 'admin' }
 * );
 * ```
 */
export function protectedAction<T>(
  handler: (authResult: Awaited<ReturnType<typeof withAuth>>) => Promise<T>,
  options?: WithAuthOptions,
): () => Promise<T> {
  return async () => {
    const authResult = await withProtectedAuth(options);
    return handler(authResult);
  };
}

/**
 * Check if current user has required role
 *
 * Does NOT redirect, just returns boolean.
 * Useful for conditional rendering in Server Components.
 *
 * @param role - Role to check
 * @returns True if user has role
 *
 * @example
 * ```tsx
 * export default async function Page() {
 *   const { user } = await withAuth({ ensureSignedIn: true });
 *   const isAdmin = await currentUserHasRole('admin');
 *
 *   return (
 *     <div>
 *       {isAdmin && <AdminPanel />}
 *       <UserContent />
 *     </div>
 *   );
 * }
 * ```
 */
export async function currentUserHasRole(role: Role): Promise<boolean> {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    return await hasRole(user.id, role);
  } catch {
    return false;
  }
}

/**
 * Check if current user has required permission level
 *
 * Does NOT redirect, just returns boolean.
 *
 * @param permission - Permission level to check
 * @returns True if user has permission
 */
export async function currentUserHasPermission(permission: ApplicationRole): Promise<boolean> {
  try {
    const { user } = await withAuth({ ensureSignedIn: true });
    return await hasPermission(user.id, permission);
  } catch {
    return false;
  }
}
