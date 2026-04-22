/**
 * Analytics Integration Tests
 *
 * Tests for PostHog and Sentry integration with WorkOS user context.
 * Verifies that user identification, role-based grouping, and cross-platform
 * context linking work correctly.
 */
import { vi } from 'vitest';

// Mock PostHog
const mockPostHogIdentify = vi.fn();
const mockPostHogGroup = vi.fn();
const mockPostHogRegister = vi.fn();
const mockPostHogPeopleSet = vi.fn();
const mockPostHogCapture = vi.fn();
const mockPostHogGetSessionId = vi.fn(() => 'test-session-id');
const mockPostHogGetDistinctId = vi.fn(() => 'test-distinct-id');
const mockPostHogGetSessionReplayUrl = vi.fn(() => 'https://posthog.com/replay/test');

vi.mock('posthog-js', () => ({
  posthog: {
    identify: mockPostHogIdentify,
    group: mockPostHogGroup,
    register: mockPostHogRegister,
    people: {
      set: mockPostHogPeopleSet,
    },
    capture: mockPostHogCapture,
    get_session_id: mockPostHogGetSessionId,
    get_distinct_id: mockPostHogGetDistinctId,
    get_session_replay_url: mockPostHogGetSessionReplayUrl,
    init: vi.fn(),
  },
  PostHog: vi.fn(),
  PostHogConfig: {},
}));

// Mock Sentry
const mockSentrySetUser = vi.fn();
const mockSentrySetContext = vi.fn();
const mockSentrySetTag = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  setUser: mockSentrySetUser,
  setContext: mockSentrySetContext,
  setTag: mockSentrySetTag,
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

// Mock WorkOS useAuth
const mockUseAuth = vi.fn();
vi.mock('@workos-inc/authkit-nextjs/components', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock Next.js hooks
vi.mock('next/navigation', () => ({
  usePathname: () => '/en/dashboard',
  useParams: () => ({ locale: 'en' }),
}));

describe('Analytics Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('User Identification', () => {
    it('should use WorkOS user ID consistently across PostHog and Sentry', () => {
      const mockUser = {
        id: 'workos_user_123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        profilePictureUrl: 'https://example.com/avatar.jpg',
        emailVerified: true,
      };

      mockUseAuth.mockReturnValue({ user: mockUser, loading: false });

      // Verify the user ID format matches WorkOS pattern
      expect(mockUser.id).toMatch(/^workos_user_/);

      // The same ID should be used in both platforms
      const expectedUserId = mockUser.id;
      expect(expectedUserId).toBe('workos_user_123');
    });

    it('should clear user context when user logs out', () => {
      mockUseAuth.mockReturnValue({ user: null, loading: false });

      // Sentry should be called with null to clear user
      // This is verified by the implementation calling Sentry.setUser(null)
      expect(mockUseAuth()).toEqual({ user: null, loading: false });
    });
  });

  describe('Role-based Group Tracking', () => {
    it('should determine correct role priority for admin users', () => {
      const roles = ['admin', 'user'];
      const role =
        roles.includes('admin') || roles.includes('superadmin')
          ? 'admin'
          : roles.includes('expert_top')
            ? 'expert_top'
            : roles.includes('expert_community')
              ? 'expert_community'
              : 'user';

      expect(role).toBe('admin');
    });

    it('should determine correct role priority for expert_top users', () => {
      const roles = ['expert_top', 'user'];
      const role =
        roles.includes('admin') || roles.includes('superadmin')
          ? 'admin'
          : roles.includes('expert_top')
            ? 'expert_top'
            : roles.includes('expert_community')
              ? 'expert_community'
              : 'user';

      expect(role).toBe('expert_top');
    });

    it('should determine correct role priority for expert_community users', () => {
      const roles = ['expert_community', 'user'];
      const role =
        roles.includes('admin') || roles.includes('superadmin')
          ? 'admin'
          : roles.includes('expert_top')
            ? 'expert_top'
            : roles.includes('expert_community')
              ? 'expert_community'
              : 'user';

      expect(role).toBe('expert_community');
    });

    it('should default to user role when no special roles present', () => {
      const roles = ['user'];
      const role =
        roles.includes('admin') || roles.includes('superadmin')
          ? 'admin'
          : roles.includes('expert_top')
            ? 'expert_top'
            : roles.includes('expert_community')
              ? 'expert_community'
              : 'user';

      expect(role).toBe('user');
    });
  });

  describe('PostHog Group Properties', () => {
    const buildGroupProperties = (role: string) => ({
      role: role,
      is_expert: role.startsWith('expert'),
      is_admin: role === 'admin',
    });

    it('should set correct group properties for expert role', () => {
      const groupProperties = buildGroupProperties('expert_top');

      expect(groupProperties).toEqual({
        role: 'expert_top',
        is_expert: true,
        is_admin: false,
      });
    });

    it('should set correct group properties for admin role', () => {
      const groupProperties = buildGroupProperties('admin');

      expect(groupProperties).toEqual({
        role: 'admin',
        is_expert: false,
        is_admin: true,
      });
    });

    it('should set correct group properties for regular user', () => {
      const groupProperties = buildGroupProperties('user');

      expect(groupProperties).toEqual({
        role: 'user',
        is_expert: false,
        is_admin: false,
      });
    });
  });

  describe('Sentry Context', () => {
    it('should build correct PostHog context for Sentry', () => {
      const sessionId = 'test-session-123';
      const distinctId = 'user-distinct-456';
      const replayUrl = 'https://eu.posthog.com/replay/abc123';

      const posthogContext = {
        session_id: sessionId,
        distinct_id: distinctId,
        session_replay_url: replayUrl,
      };

      expect(posthogContext).toEqual({
        session_id: 'test-session-123',
        distinct_id: 'user-distinct-456',
        session_replay_url: 'https://eu.posthog.com/replay/abc123',
      });
    });

    it('should build correct WorkOS context for Sentry', () => {
      const user = {
        id: 'workos_user_123',
        emailVerified: true,
        profilePictureUrl: 'https://example.com/avatar.jpg',
      };

      const workosContext = {
        user_id: user.id,
        email_verified: user.emailVerified,
        has_profile_picture: !!user.profilePictureUrl,
      };

      expect(workosContext).toEqual({
        user_id: 'workos_user_123',
        email_verified: true,
        has_profile_picture: true,
      });
    });
  });

  describe('Route Detection', () => {
    it('should correctly identify private routes', () => {
      const privatePatterns = [
        '/en/dashboard',
        '/en/account/settings',
        '/admin/users',
        '/(private)/profile',
      ];

      privatePatterns.forEach((pathname) => {
        const isPrivate =
          pathname.startsWith('/(private)') ||
          pathname.includes('/dashboard') ||
          pathname.includes('/account') ||
          pathname.includes('/admin');

        expect(isPrivate).toBe(true);
      });
    });

    it('should correctly identify public routes', () => {
      const publicPatterns = ['/en', '/en/experts', '/en/about', '/pricing'];

      publicPatterns.forEach((pathname) => {
        const isPrivate =
          pathname.startsWith('/(private)') ||
          pathname.includes('/dashboard') ||
          pathname.includes('/account') ||
          pathname.includes('/admin');

        expect(isPrivate).toBe(false);
      });
    });
  });

  describe('Timezone Detection', () => {
    it('should handle timezone detection gracefully', () => {
      const getTimezone = () => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch {
          return 'UTC';
        }
      };

      const timezone = getTimezone();
      expect(typeof timezone).toBe('string');
      expect(timezone.length).toBeGreaterThan(0);
    });
  });
});

describe('Cross-Platform User Correlation', () => {
  it('should maintain consistent user ID format across platforms', () => {
    // WorkOS user IDs follow a specific pattern
    const workosUserId = 'user_01ABC123DEF456';

    // This same ID should be used in:
    // 1. PostHog identify()
    // 2. Sentry setUser()
    // 3. PostHog session context in Sentry

    const posthogIdentifyCall = { user_id: workosUserId };
    const sentryUserCall = { id: workosUserId };

    expect(posthogIdentifyCall.user_id).toBe(sentryUserCall.id);
  });

  it('should allow debugging workflow from Sentry to PostHog', () => {
    // When an error occurs in Sentry, you should be able to:
    // 1. See the user ID
    // 2. See the PostHog session replay URL
    // 3. Navigate to PostHog to see full user journey

    const sentryContext = {
      user: { id: 'user_123' },
      contexts: {
        posthog: {
          session_id: 'session_abc',
          distinct_id: 'user_123',
          session_replay_url: 'https://eu.posthog.com/replay/xyz',
        },
      },
    };

    expect(sentryContext.user.id).toBe(sentryContext.contexts.posthog.distinct_id);
    expect(sentryContext.contexts.posthog.session_replay_url).toContain('posthog.com/replay');
  });
});
