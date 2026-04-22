/**
 * WorkOS AuthKit Mock Utilities for Testing
 *
 * Provides centralized mock implementations for WorkOS authentication in tests.
 * This ensures consistency across all test files and makes it easier to update
 * when the WorkOS API changes.
 *
 * Usage in tests:
 * ```typescript
 * import { mockWorkosUser, mockWithAuth, mockUserInfo } from 'tests/__mocks__/@workos-inc/authkit-nextjs';
 *
 * // Override defaults
 * mockWithAuth.mockResolvedValueOnce({
 *   ...mockUserInfo,
 *   user: { ...mockWorkosUser, id: 'custom-id' }
 * });
 * ```
 */
import { vi } from 'vitest';

/**
 * Default mock WorkOS user
 */
export const mockWorkosUser = {
  object: 'user' as const,
  id: 'user_test123',
  email: 'test@example.com',
  emailVerified: true,
  profilePictureUrl: null,
  firstName: 'Test',
  lastName: 'User',
  lastSignInAt: new Date().toISOString(),
  locale: 'en-US',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  externalId: null,
  metadata: {},
};

/**
 * Default mock UserInfo (complete authentication response)
 */
export const mockUserInfo = {
  user: mockWorkosUser,
  sessionId: 'session_test123',
  organizationId: undefined as string | undefined,
  accessToken: 'mock_access_token',
  role: undefined,
  roles: [],
  permissions: [],
  entitlements: [],
  featureFlags: [],
  impersonator: undefined,
};

/**
 * Mock withAuth function
 */
export const mockWithAuth = vi.fn(() => Promise.resolve(mockUserInfo));

/**
 * Mock getSignInUrl function
 */
export const mockGetSignInUrl = vi.fn(() => '/login');

/**
 * Mock getSignUpUrl function
 */
export const mockGetSignUpUrl = vi.fn(() => '/register');

/**
 * Mock getSignOutUrl function
 */
export const mockGetSignOutUrl = vi.fn(() => '/sign-out');

/**
 * Helper to create a custom mock user
 */
export function createMockWorkosUser(overrides: Partial<typeof mockWorkosUser> = {}) {
  return {
    ...mockWorkosUser,
    ...overrides,
  };
}

/**
 * Helper to create a custom mock UserInfo
 */
export function createMockUserInfo(overrides: Partial<typeof mockUserInfo> = {}) {
  return {
    ...mockUserInfo,
    ...overrides,
  };
}

/**
 * Helper to create an expert user with appropriate role
 */
export function createMockExpertUser(overrides: Partial<typeof mockWorkosUser> = {}) {
  return {
    ...mockUserInfo,
    user: createMockWorkosUser(overrides),
    role: 'expert_community',
    roles: ['expert_community'],
  };
}

/**
 * Helper to create an admin user
 */
export function createMockAdminUser(overrides: Partial<typeof mockWorkosUser> = {}) {
  return {
    ...mockUserInfo,
    user: createMockWorkosUser(overrides),
    role: 'admin',
    roles: ['admin'],
  };
}

/**
 * Helper to create an unauthenticated response
 */
export function createUnauthenticatedResponse(): never {
  throw new Error('User not authenticated');
}

// Export all mocks as default module mock
export default {
  withAuth: mockWithAuth,
  getSignInUrl: mockGetSignInUrl,
  getSignUpUrl: mockGetSignUpUrl,
  getSignOutUrl: mockGetSignOutUrl,
};
