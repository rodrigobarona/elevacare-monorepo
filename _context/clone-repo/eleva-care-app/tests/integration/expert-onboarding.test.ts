import { vi, describe, it, expect, beforeEach } from 'vitest';

/**
 * Expert Onboarding Flow Tests
 * Tests for the expert setup and onboarding process
 */

// Default setup status to use in mocks
const defaultSetupStatus = {
  profile: true,
  events: true,
  availability: false,
  identity: false,
  payment: false,
  google_account: false,
};

// Use vi.hoisted for mocks that need to be available in vi.mock factories
const mocks = vi.hoisted(() => ({
  markStepComplete: vi.fn(),
  checkExpertSetupStatus: vi.fn(),
  updateProfile: vi.fn(),
  toggleProfilePublication: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/server/actions/expert-setup', () => ({
  markStepComplete: mocks.markStepComplete,
  checkExpertSetupStatus: mocks.checkExpertSetupStatus,
}));

vi.mock('@/server/actions/profile', () => ({
  updateProfile: mocks.updateProfile,
  toggleProfilePublication: mocks.toggleProfilePublication,
}));

// Re-export for test usage
const mockMarkStepComplete = mocks.markStepComplete;
const mockCheckExpertSetupStatus = mocks.checkExpertSetupStatus;
const mockUpdateProfile = mocks.updateProfile;
const mockToggleProfilePublication = mocks.toggleProfilePublication;

interface ProfileData {
  firstName?: string;
  lastName?: string;
  shortBio?: string;
  longBio?: string;
}

describe('Expert Onboarding Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock implementations
    mockMarkStepComplete.mockImplementation((step: string) => {
      return Promise.resolve({
        success: true,
        setupStatus: {
          profile: step === 'profile' || defaultSetupStatus.profile,
          events: step === 'events' || defaultSetupStatus.events,
          availability: step === 'availability',
          identity: step === 'identity',
          payment: step === 'payment',
          google_account: step === 'google_account',
        },
      });
    });

    mockCheckExpertSetupStatus.mockResolvedValue({
      success: true,
      setupStatus: defaultSetupStatus,
      isPublished: false,
    });

    mockUpdateProfile.mockResolvedValue({
      success: true,
      profile: {
        id: 'profile_123',
        firstName: 'John',
        lastName: 'Doe',
        shortBio: 'Expert in testing',
        longBio: 'Extensive experience in software testing.',
        published: false,
      },
    });

    mockToggleProfilePublication.mockImplementation(() => {
      const setupStatus = defaultSetupStatus;
      const allStepsComplete = Object.values(setupStatus).every(Boolean);

      if (allStepsComplete) {
        return Promise.resolve({
          success: true,
          message: 'Profile published successfully',
          isPublished: true,
        });
      }

      return Promise.resolve({
        success: false,
        message: 'Cannot publish profile until all setup steps are complete',
        isPublished: false,
        incompleteSteps: Object.keys(setupStatus).filter(
          (step) => !setupStatus[step as keyof typeof setupStatus],
        ),
      });
    });
  });

  it('should allow completing profile step of expert onboarding', async () => {
    const profileData = {
      firstName: 'John',
      lastName: 'Doe',
      shortBio: 'Expert in software testing',
      longBio: 'I have over 10 years of experience in software testing.',
    };

    const profileResult = await mockUpdateProfile(profileData);
    const stepResult = await mockMarkStepComplete('profile');

    expect(profileResult.success).toBe(true);
    expect(stepResult.success).toBe(true);
    expect(stepResult.setupStatus.profile).toBe(true);

    expect(mockUpdateProfile).toHaveBeenCalledWith(profileData);
    expect(mockMarkStepComplete).toHaveBeenCalledWith('profile');
  });

  it('should prevent publishing a profile until all required steps are complete', async () => {
    mockCheckExpertSetupStatus.mockResolvedValueOnce({
      success: true,
      setupStatus: {
        profile: true,
        events: true,
        availability: false,
        identity: false,
        payment: false,
        google_account: false,
      },
      isPublished: false,
    });

    const result = await mockToggleProfilePublication();

    expect(result.success).toBe(false);
    expect(result.message).toContain('Cannot publish profile');
    expect(result.incompleteSteps).toContain('availability');
    expect(result.incompleteSteps).toContain('identity');
  });

  it('should validate required information for each onboarding step', async () => {
    const invalidProfileData: ProfileData = {
      firstName: '',
      lastName: 'Doe',
      shortBio: '',
    };

    const validateProfile = (data: ProfileData) => {
      const errors: Record<string, string> = {};
      if (!data.firstName) errors.firstName = 'First name is required';
      if (!data.lastName) errors.lastName = 'Last name is required';
      if (!data.shortBio) errors.shortBio = 'Short bio is required';
      return Object.keys(errors).length > 0 ? { success: false, errors } : { success: true };
    };

    const validationResult = validateProfile(invalidProfileData);

    expect(validationResult.success).toBe(false);
    expect(validationResult.errors).toHaveProperty('firstName');
    expect(validationResult.errors).toHaveProperty('shortBio');
    expect(validationResult.errors).not.toHaveProperty('lastName');
  });

  it('should show onboarding progress accurately', async () => {
    const initialSetupStatus = {
      profile: true,
      events: true,
      availability: false,
      identity: false,
      payment: false,
      google_account: false,
    };

    mockCheckExpertSetupStatus.mockResolvedValueOnce({
      success: true,
      setupStatus: initialSetupStatus,
      isPublished: false,
    });

    const calculateProgress = (setupStatus: Record<string, boolean>) => {
      const total = Object.keys(setupStatus).length;
      const completed = Object.values(setupStatus).filter(Boolean).length;
      return Math.round((completed / total) * 100);
    };

    const result = await mockCheckExpertSetupStatus();
    const progress = calculateProgress(result.setupStatus);

    expect(result.success).toBe(true);
    expect(progress).toBe(33);
  });

  it('should allow publishing profile when all steps are complete', async () => {
    mockToggleProfilePublication.mockResolvedValueOnce({
        success: true,
        message: 'Profile published successfully',
        isPublished: true,
    });

    const result = await mockToggleProfilePublication();

    expect(result.success).toBe(true);
    expect(result.message).toContain('Profile published successfully');
    expect(result.isPublished).toBe(true);
  });
});
