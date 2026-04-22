/**
 * WorkOS Widgets Kitchen Sink
 *
 * This page showcases all available WorkOS widgets for testing and evaluation.
 * Each widget is displayed with:
 * - Description of its purpose
 * - Required permissions/scopes
 * - Use case recommendations
 * - Live implementation
 *
 * @see https://workos.com/docs/widgets/quick-start
 */
import { workos } from '@/lib/integrations/workos/client';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';

import { WidgetShowcase } from './WidgetShowcase';

// Widget interface matching WidgetShowcase props
interface Widget {
  id: string;
  name: string;
  description: string;
  category: string;
  token: string;
  scopes: string[];
  useCases: string[];
  permissions: string;
  component: string;
  sessionId?: string;
}

// Generate widget tokens with error handling
async function generateWidgetTokens(userId: string, organizationId: string) {
  try {
    // Try to generate tokens one by one to see which ones fail
    console.log('🔑 Generating widget tokens...');

    let userManagementToken: string | null = null;
    let userProfileToken: string | null = null;
    let domainVerificationToken: string | null = null;
    let ssoConnectionToken: string | null = null;

    // 1. Try User Management Widget (needs: widgets:users-table:manage)
    try {
      userManagementToken = await workos.widgets.getToken({
        userId,
        organizationId,
        scopes: ['widgets:users-table:manage'],
      });
      console.log('✅ User Management token generated');
    } catch (error: any) {
      console.error('❌ User Management token failed:', error.message);
    }

    // 2. Try User Profile Widget (needs: widgets:users-table:manage)
    try {
      userProfileToken = await workos.widgets.getToken({
        userId,
        organizationId,
        scopes: ['widgets:users-table:manage'],
      });
      console.log('✅ User Profile token generated');
    } catch (error: any) {
      console.error('❌ User Profile token failed:', error.message);
    }

    // 3. Try Domain Verification Widget (needs: widgets:domain-verification:manage)
    try {
      domainVerificationToken = await workos.widgets.getToken({
        userId,
        organizationId,
        scopes: ['widgets:domain-verification:manage'],
      });
      console.log('✅ Domain Verification token generated');
    } catch (error: any) {
      console.error('❌ Domain Verification token failed:', error.message);
    }

    // 4. Try SSO Connection Widget (needs: widgets:sso:manage)
    try {
      ssoConnectionToken = await workos.widgets.getToken({
        userId,
        organizationId,
        scopes: ['widgets:sso:manage'],
      });
      console.log('✅ SSO Connection token generated');
    } catch (error: any) {
      console.error('❌ SSO Connection token failed:', error.message);
    }

    return {
      userManagementToken,
      userProfileToken,
      userSecurityToken: userProfileToken, // Reuse profile token
      userSessionsToken: userProfileToken, // Reuse profile token
      userApiKeysToken: userProfileToken, // Reuse profile token
      domainVerificationToken,
      ssoConnectionToken,
    };
  } catch (error) {
    console.error('Error generating widget tokens:', error);
    return null;
  }
}

export default async function WidgetsKitchenSinkPage() {
  // Ensure user is authenticated
  const { user, organizationId, sessionId } = await withAuth({ ensureSignedIn: true });

  if (!user || !organizationId) {
    redirect('/login');
  }

  // Generate widget tokens for all available widgets
  const tokens = await generateWidgetTokens(user.id, organizationId);

  // Handle token generation errors or missing tokens
  if (!tokens) {
    return (
      <div className="container mx-auto py-8">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <h2 className="mb-2 text-lg font-semibold text-destructive">Error Loading Widgets</h2>
          <p className="text-sm">
            Failed to generate widget tokens. Please check the server logs for specific permission
            errors.
          </p>
        </div>
      </div>
    );
  }

  const {
    userManagementToken,
    userProfileToken,
    userSecurityToken,
    userSessionsToken,
    userApiKeysToken,
    domainVerificationToken,
    ssoConnectionToken,
  } = tokens;

  // Filter out widgets where token generation failed
  const widgets = [
    userManagementToken && {
      id: 'user-management',
      name: 'User Management',
      description:
        'Allows organization admins to manage users, invite new members, remove existing ones, and modify roles. Essential for team management.',
      category: 'User Management',
      token: userManagementToken,
      scopes: ['widgets:users-table:manage'],
      useCases: [
        'Organization admin dashboard',
        'Team management pages',
        'User provisioning workflows',
      ],
      permissions: 'Requires organization admin role',
      component: 'UsersManagement',
    },
    userProfileToken && {
      id: 'user-profile',
      name: 'User Profile',
      description:
        'Displays and allows editing of user profile details including name, email, and other personal information.',
      category: 'User Management',
      token: userProfileToken,
      scopes: ['widgets:users-table:manage'],
      useCases: ['User settings page', 'Profile management', 'Account details'],
      permissions: 'Any authenticated user',
      component: 'UserProfile',
    },
    userSecurityToken && {
      id: 'user-security',
      name: 'User Security',
      description:
        'Allows users to manage passwords and MFA (Multi-Factor Authentication) settings. Essential for security-conscious applications.',
      category: 'Security',
      token: userSecurityToken,
      scopes: ['widgets:users-table:manage'],
      useCases: ['Security settings page', 'Password management', 'MFA setup'],
      permissions: 'Any authenticated user',
      component: 'UserSecurity',
    },
    userSessionsToken && {
      id: 'user-sessions',
      name: 'User Sessions',
      description:
        'Displays active user sessions across devices. Users can view and revoke sessions for security purposes.',
      category: 'Security',
      token: userSessionsToken,
      scopes: ['widgets:users-table:manage'],
      useCases: ['Security dashboard', 'Session management', 'Device tracking'],
      permissions: 'Any authenticated user',
      sessionId, // Pass current session ID
      component: 'UserSessions',
    },
    userApiKeysToken && {
      id: 'user-api-keys',
      name: 'User API Keys',
      description:
        'Allows users to generate and manage API keys for programmatic access to your application.',
      category: 'Developer Tools',
      token: userApiKeysToken,
      scopes: ['widgets:users-table:manage'],
      useCases: ['Developer settings', 'API key management', 'Integration setup'],
      permissions: 'Any authenticated user',
      component: 'ApiKeys',
    },
    domainVerificationToken && {
      id: 'domain-verification',
      name: 'Domain Verification',
      description:
        'Allows users with necessary permissions to verify domains in the Admin Portal. Required for SSO setup.',
      category: 'Admin Portal',
      token: domainVerificationToken,
      scopes: ['widgets:domain-verification:manage'],
      useCases: ['SSO setup workflow', 'Domain verification', 'Organization setup'],
      permissions: 'Requires widgets:domain-verification:manage permission',
      component: 'AdminPortalDomainVerification',
    },
    ssoConnectionToken && {
      id: 'sso-connection',
      name: 'SSO Connection',
      description:
        'Enables configuration and management of Single Sign-On (SSO) connections for an organization.',
      category: 'Admin Portal',
      token: ssoConnectionToken,
      scopes: ['widgets:sso:manage'],
      useCases: ['Enterprise SSO setup', 'SAML configuration', 'Organization authentication'],
      permissions: 'Requires widgets:sso:manage permission',
      component: 'AdminPortalSsoConnection',
    },
  ].filter(Boolean) as Widget[]; // Remove null entries and assert type

  // Show warning if some widgets failed
  const failedWidgets = 7 - widgets.length;
  const hasFailures = failedWidgets > 0;

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">WorkOS Widgets Kitchen Sink</h1>
        <p className="text-muted-foreground">
          Explore all available WorkOS widgets and their use cases. This page is for development and
          testing purposes.
        </p>
      </div>

      {/* User Info */}
      <div className="mb-8 rounded-lg border bg-muted p-4">
        <h2 className="mb-2 text-lg font-semibold">Current User Context</h2>
        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
          <div>
            <span className="font-medium">User ID:</span> <code className="ml-1">{user.id}</code>
          </div>
          <div>
            <span className="font-medium">Email:</span> <code className="ml-1">{user.email}</code>
          </div>
          <div>
            <span className="font-medium">Organization ID:</span>{' '}
            <code className="ml-1">{organizationId}</code>
          </div>
        </div>
      </div>

      {/* Permission Warnings */}
      {hasFailures && (
        <div className="mb-8 rounded-lg border border-yellow-500 bg-yellow-500/10 p-4">
          <h2 className="mb-2 text-lg font-semibold text-yellow-600">
            Some Widgets Unavailable ({failedWidgets} failed)
          </h2>
          <p className="text-sm text-yellow-700">
            Some widget tokens could not be generated due to missing permissions. Check the server
            logs to see which permissions are needed. The available widgets are shown below.
          </p>
        </div>
      )}

      {/* Widget Showcase */}
      <WidgetShowcase widgets={widgets} />
    </div>
  );
}
