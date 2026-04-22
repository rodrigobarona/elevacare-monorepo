/**
 * WorkOS Client Configuration
 *
 * Provides a singleton instance of the WorkOS SDK configured with environment variables.
 * Used for authentication, organization management, and RBAC operations.
 *
 * @see https://workos.com/docs
 */
import { WorkOS } from '@workos-inc/node';

if (!process.env.WORKOS_API_KEY) {
  throw new Error('WORKOS_API_KEY is required');
}

if (!process.env.WORKOS_CLIENT_ID) {
  throw new Error('WORKOS_CLIENT_ID is required');
}

/**
 * WorkOS SDK instance
 *
 * Used for:
 * - User authentication (AuthKit)
 * - Organization management
 * - RBAC (Role-Based Access Control)
 * - Audit logs
 *
 * @example
 * ```typescript
 * import { workos } from '@/lib/integrations/workos/client';
 *
 * // Authenticate user
 * const { user } = await workos.userManagement.authenticateWithCode({ code });
 *
 * // Create organization
 * const org = await workos.organizations.createOrganization({ name: 'Acme' });
 * ```
 */
export const workos = new WorkOS(process.env.WORKOS_API_KEY);

/**
 * WorkOS Client ID
 * Used for generating authorization URLs
 */
export const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID;

/**
 * WorkOS Redirect URI
 * Where users are redirected after authentication
 */
export const WORKOS_REDIRECT_URI =
  process.env.WORKOS_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';
