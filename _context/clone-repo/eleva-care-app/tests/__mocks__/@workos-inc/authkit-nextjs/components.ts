/**
 * WorkOS AuthKit Components Mock for Testing
 *
 * Provides mock implementations for WorkOS client-side components used in React tests.
 */
import React from 'react';
import { vi } from 'vitest';

import { mockWorkosUser } from '../authkit-nextjs';

/**
 * Mock useAuth hook
 */
export const mockUseAuth = vi.fn(() => ({
  user: mockWorkosUser,
  loading: false,
  isSignedIn: true,
}));

/**
 * Mock AuthKitProvider component
 * Just renders children without any authentication logic
 */
export const AuthKitProvider = ({ children }: { children: React.ReactNode }) => children;

// Export as module mock
export default {
  useAuth: mockUseAuth,
  AuthKitProvider,
};
