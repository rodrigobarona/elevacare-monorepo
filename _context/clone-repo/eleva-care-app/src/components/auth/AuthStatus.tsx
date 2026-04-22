/**
 * AuthStatus Component
 *
 * Displays current authentication state with user info, organization, and role.
 * Follows brijr pattern for displaying auth state in headers/dashboards.
 *
 * Usage:
 * ```tsx
 * <AuthStatus />
 * ```
 */
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { getUserApplicationRole } from '@/lib/integrations/workos/roles';
import { withAuth } from '@workos-inc/authkit-nextjs';

import { LogoutButton } from './LogoutButton';

interface AuthStatusProps {
  /**
   * Show logout button
   * @default true
   */
  showLogout?: boolean;
  /**
   * Show role badge
   * @default true
   */
  showRole?: boolean;
  /**
   * Show organization info
   * @default false
   */
  showOrganization?: boolean;
}

/**
 * AuthStatus - Display Current Auth State
 *
 * Shows user avatar, name, and optionally role/org info.
 * Best used in headers, navigation, or dashboard layouts.
 *
 * @example
 * ```tsx
 * // In a Server Component (header)
 * export default async function Header() {
 *   return (
 *     <header className="flex items-center justify-between">
 *       <Logo />
 *       <AuthStatus />
 *     </header>
 *   );
 * }
 * ```
 */
export async function AuthStatus({
  showLogout = true,
  showRole = true,
  showOrganization = false,
}: AuthStatusProps) {
  const { user, organizationId } = await withAuth();

  // If not authenticated, return null
  if (!user) {
    return null;
  }

  // Get user role
  const role = showRole ? await getUserApplicationRole(user.id) : null;

  // Get initials for avatar fallback
  const initials =
    user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : user.email[0].toUpperCase();

  // Format role for display
  const roleDisplay = role
    ? role
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : null;

  return (
    <div className="flex items-center gap-3">
      {/* User Avatar and Info */}
      <div className="flex items-center gap-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.profilePictureUrl || undefined} alt={user.email} />
          <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
        </Avatar>

        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
          </span>

          {/* Role Badge */}
          {showRole && roleDisplay && (
            <Badge variant="secondary" className="w-fit text-xs">
              {roleDisplay}
            </Badge>
          )}

          {/* Organization Info */}
          {showOrganization && organizationId && (
            <span className="text-xs text-muted-foreground">Org: {organizationId}</span>
          )}
        </div>
      </div>

      {/* Logout Button */}
      {showLogout && <LogoutButton size="sm" />}
    </div>
  );
}

/**
 * AuthStatusCompact - Compact version for mobile/small spaces
 *
 * Shows only avatar with logout button.
 *
 * @example
 * ```tsx
 * <AuthStatusCompact />
 * ```
 */
export async function AuthStatusCompact() {
  const { user } = await withAuth();

  if (!user) {
    return null;
  }

  const initials =
    user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : user.email[0].toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarImage src={user.profilePictureUrl || undefined} alt={user.email} />
        <AvatarFallback className="bg-primary text-xs text-primary-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      <LogoutButton size="icon" variant="ghost" />
    </div>
  );
}
