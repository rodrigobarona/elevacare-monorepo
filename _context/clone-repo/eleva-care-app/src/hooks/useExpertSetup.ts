import { checkExpertSetupStatus, markStepComplete } from '@/server/actions/expert-setup';
import type { SetupStepType as ExpertSetupStep } from '@/types/expert-setup';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

/**
 * Custom hook for managing expert setup state
 * Provides methods for completing steps, checking status from ExpertSetupTable (database)
 */
export function useExpertSetup() {
  const { user, loading } = useAuth();
  const isLoaded = !loading;
  const [isLoading, setIsLoading] = useState(false);
  const [setupStatus, setSetupStatus] = useState<Record<ExpertSetupStep, boolean>>({
    profile: false,
    availability: false,
    events: false,
    identity: false,
    payment: false,
    google_account: false,
  });
  const [setupCompletedAt, setSetupCompletedAt] = useState<Date | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  // Function to load the current status from the server (ExpertSetupTable)
  const loadStatus = useCallback(async () => {
    if (!isLoaded || !user) return;

    setIsLoading(true);
    try {
      const result = await checkExpertSetupStatus();
      if (result.setupStatus) {
        setSetupStatus(result.setupStatus as Record<ExpertSetupStep, boolean>);
      }
      setIsSetupComplete(result.isSetupComplete);
      setSetupCompletedAt(result.setupCompletedAt);
    } catch (error) {
      console.error('Error loading expert setup status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, user]);

  // Load status on initial mount
  useEffect(() => {
    if (isLoaded && user) {
      loadStatus();
    }
  }, [isLoaded, user, loadStatus]);

  // Function to mark a step as complete in database (ExpertSetupTable)
  const completeStep = useCallback(
    async (step: ExpertSetupStep) => {
      if (!isLoaded || !user) return false;

      try {
        // Call the server action to mark step as complete
        await markStepComplete(step);

        // Update local state
        setSetupStatus((prev) => ({
          ...prev,
          [step]: true,
        }));

        // Dispatch event to notify any listeners
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('expert-setup-updated'));

          // Additional step-specific events
          if (step === 'google_account') {
            const customEvent = new CustomEvent('google-account-connected', {
              detail: { timestamp: new Date().toISOString() },
            });
            window.dispatchEvent(customEvent);
          }
        }

        // Show success message
        toast.success(
          `${step.charAt(0).toUpperCase() + step.slice(1).replace('_', ' ')} step completed!`,
        );

        // Reload status to get updated completion info
        await loadStatus();

        return true;
      } catch (error) {
        console.error(`Error completing ${step} step:`, error);
        toast.error(`Failed to complete ${step} step`);
        return false;
      }
    },
    [isLoaded, user, loadStatus],
  );

  // Calculate progress percentage
  const progressPercentage = Math.round(
    (Object.values(setupStatus).filter(Boolean).length / Object.keys(setupStatus).length) * 100,
  );

  // Format completion date from ExpertSetupTable
  const getFormattedCompletionDate = useCallback((): string | null => {
    if (!setupCompletedAt) {
      return null;
    }

    try {
      // Format the date in a user-friendly way
      const formattedDate = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(setupCompletedAt);

      return formattedDate;
    } catch (error) {
      console.error('Error parsing completion date:', error);
      return null;
    }
  }, [setupCompletedAt]);

  return {
    setupStatus,
    isLoading,
    progressPercentage,
    isComplete: isSetupComplete,
    completeStep,
    refreshStatus: loadStatus,
    completionDate: setupCompletedAt,
    formattedCompletionDate: getFormattedCompletionDate(),
  };
}
