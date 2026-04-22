import { vi, type Mock } from 'vitest';

// Mock user
export const mockUser = {
  id: 'user_123',
  publicMetadata: { role: ['community_expert'] },
  unsafeMetadata: { expertSetup: { profile: false, events: false } },
  emailAddresses: [{ emailAddress: 'test@example.com', verification: { status: 'verified' } }],
  externalAccounts: [],
};

// Default setup status to use in mocks
const defaultSetupStatus = {
  profile: true,
  events: true,
  availability: false,
  identity: false,
  payment: false,
  google_account: false,
};

// Define the mock function type
type MarkStepCompleteFunction = (step: string) => Promise<{
  success: boolean;
  setupStatus: Record<string, boolean>;
}>;

// Mock the expert setup functions
export const mockMarkStepComplete = vi.fn() as Mock<MarkStepCompleteFunction>;
mockMarkStepComplete.mockImplementation((step: string) => {
  return Promise.resolve({
    success: true,
    setupStatus: {
      profile: step === 'profile',
      events: step === 'events',
      availability: step === 'availability',
      identity: step === 'identity',
      payment: step === 'payment',
      google_account: step === 'google_account',
    },
  });
});

export const mockCheckExpertSetupStatus = vi.fn().mockImplementation(() => {
  return Promise.resolve({
    success: true,
    setupStatus: defaultSetupStatus,
    isPublished: false,
  });
});

export const mockUpdateProfile = vi.fn().mockImplementation(() => {
  return Promise.resolve({
    success: true,
    profile: {
      id: 'profile_123',
      clerkUserId: mockUser.id,
      firstName: 'John',
      lastName: 'Doe',
      shortBio: 'Expert in testing',
      longBio: 'Extensive experience in software testing and quality assurance.',
      published: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
});

export const mockToggleProfilePublication = vi.fn().mockImplementation(() => {
  // Use our default setup status instead of calling the function which might return undefined
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
