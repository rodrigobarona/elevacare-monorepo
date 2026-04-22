import { vi, describe, it, expect, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

/**
 * ProfilePublishToggle Component Tests
 *
 * Tests the toggle component for publishing/unpublishing expert profiles.
 * The component uses a confirmation dialog before performing actions.
 */

// Use vi.hoisted for mocks that need to be available in vi.mock factories
const mocks = vi.hoisted(() => ({
  toggleProfilePublication: vi.fn(),
  checkExpertSetupStatus: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
}));

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string) => key),
  useLocale: vi.fn(() => 'en'),
}));

// Mock next-intl navigation
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) =>
    React.createElement('a', { href, ...props }, children),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  redirect: vi.fn(),
}));

// Mock the server actions
vi.mock('@/server/actions/expert-profile', () => ({
  toggleProfilePublication: mocks.toggleProfilePublication,
}));

vi.mock('@/server/actions/expert-setup', () => ({
  checkExpertSetupStatus: mocks.checkExpertSetupStatus,
}));

// Mock toast notification
vi.mock('sonner', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

// Import after mocks are set up
import { ProfilePublishToggle } from '@/components/features/profile/ProfilePublishToggle';

describe('ProfilePublishToggle', () => {
  const mockProps = {
    initialPublishedStatus: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Suppress console warnings about nested elements
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Set up default mock implementations
    mocks.toggleProfilePublication.mockResolvedValue({
      success: true,
      isPublished: true,
      message: 'Profile published successfully',
    });

    // All steps complete by default
    mocks.checkExpertSetupStatus.mockResolvedValue({
      setupStatus: {
        profile: true,
        events: true,
        availability: true,
        identity: true,
        payment: true,
      },
    });
  });

  it('renders with initial unpublished state', () => {
    render(<ProfilePublishToggle {...mockProps} />);

    expect(screen.getByRole('switch')).toBeInTheDocument();
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('renders with initial published state', () => {
    render(<ProfilePublishToggle initialPublishedStatus={true} />);

    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('opens confirmation dialog when switch is clicked', async () => {
    render(<ProfilePublishToggle {...mockProps} />);

    const switchElement = screen.getByRole('switch');

    await act(async () => {
      fireEvent.click(switchElement);
    });

    // Wait for the dialog to appear (checkExpertSetupStatus is called first)
    await waitFor(() => {
      // Should have called checkExpertSetupStatus when trying to publish
      expect(mocks.checkExpertSetupStatus).toHaveBeenCalled();
    });
  });

  it('calls checkExpertSetupStatus when trying to publish', async () => {
    render(<ProfilePublishToggle {...mockProps} />);

    const switchElement = screen.getByRole('switch');

    await act(async () => {
      fireEvent.click(switchElement);
    });

    await waitFor(() => {
      expect(mocks.checkExpertSetupStatus).toHaveBeenCalled();
    });
  });

  it('shows incomplete dialog when setup is not complete', async () => {
    // Mock incomplete setup
    mocks.checkExpertSetupStatus.mockResolvedValue({
      setupStatus: {
        profile: true,
        events: false, // Missing events
        availability: true,
        identity: true,
        payment: false, // Missing payment
      },
    });

    render(<ProfilePublishToggle {...mockProps} />);

    const switchElement = screen.getByRole('switch');

    await act(async () => {
      fireEvent.click(switchElement);
    });

    await waitFor(() => {
      expect(mocks.checkExpertSetupStatus).toHaveBeenCalled();
    });

    // toggleProfilePublication should NOT be called when steps are incomplete
    // (unless user confirms in the incomplete dialog)
    expect(mocks.toggleProfilePublication).not.toHaveBeenCalled();
  });

  it('shows unpublish dialog when profile is currently published', async () => {
    render(<ProfilePublishToggle initialPublishedStatus={true} />);

    const switchElement = screen.getByRole('switch');

    await act(async () => {
      fireEvent.click(switchElement);
    });

    // For unpublishing, checkExpertSetupStatus should NOT be called
    expect(mocks.checkExpertSetupStatus).not.toHaveBeenCalled();
  });

  it('handles toggle error gracefully', async () => {
    // Set up a failure response
    mocks.toggleProfilePublication.mockResolvedValue({
      success: false,
      message: 'Failed to publish profile',
      isPublished: false,
    });

    render(<ProfilePublishToggle {...mockProps} />);

    const switchElement = screen.getByRole('switch');

    await act(async () => {
      fireEvent.click(switchElement);
    });

    // Verify checkExpertSetupStatus was called
    await waitFor(() => {
      expect(mocks.checkExpertSetupStatus).toHaveBeenCalled();
    });
  });

  it('handles network error gracefully', async () => {
    mocks.checkExpertSetupStatus.mockRejectedValue(new Error('Network error'));

    render(<ProfilePublishToggle {...mockProps} />);

    const switchElement = screen.getByRole('switch');

    await act(async () => {
      fireEvent.click(switchElement);
    });

    // Should show error toast
    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalled();
    });
  });
});
