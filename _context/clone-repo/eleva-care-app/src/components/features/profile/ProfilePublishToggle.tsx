'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Link } from '@/lib/i18n/navigation';
import { toggleProfilePublication } from '@/server/actions/expert-profile';
import { checkExpertSetupStatus } from '@/server/actions/expert-setup';
import { AlertTriangle, CheckCircle2, FileText, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ProfilePublishToggleProps {
  initialPublishedStatus: boolean;
}

export function ProfilePublishToggle({ initialPublishedStatus }: ProfilePublishToggleProps) {
  const t = useTranslations('profilePublish');
  const [isPublished, setIsPublished] = useState(initialPublishedStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [incompleteSteps, setIncompleteSteps] = useState<string[]>([]);
  const [dialogMode, setDialogMode] = useState<'publish' | 'unpublish' | 'incomplete'>('publish');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    // Sync state with props if changed externally
    setIsPublished(initialPublishedStatus);
  }, [initialPublishedStatus]);

  useEffect(() => {
    // Reset agreement checkbox when dialog closes or mode changes
    if (!showConfirmDialog || dialogMode !== 'publish') {
      setAgreedToTerms(false);
    }
  }, [showConfirmDialog, dialogMode]);

  async function checkCompletionStatus() {
    try {
      const setupStatus = await checkExpertSetupStatus();

      // Find incomplete steps
      const incomplete = Object.entries(setupStatus.setupStatus || {})
        .filter(([_, isComplete]) => !isComplete)
        .map(([step]) => step);

      setIncompleteSteps(incomplete);

      return incomplete.length === 0;
    } catch (error) {
      console.error('Error checking completion status:', error);
      toast.error('Failed to check profile completion status');
      return false;
    }
  }

  const getStepName = (step: string): string => {
    const stepNames: Record<string, string> = {
      profile: 'Complete your profile',
      availability: 'Set your availability',
      events: 'Create at least one service',
      identity: 'Verify your identity',
      payment: 'Connect a payment account',
    };

    return stepNames[step] || step;
  };

  const handleToggleRequest = async () => {
    if (isPublished) {
      // If currently published, confirm before unpublishing
      setDialogMode('unpublish');
      setShowConfirmDialog(true);
    } else {
      // If not published, check if all steps are complete before allowing publish
      setIsLoading(true);
      const isComplete = await checkCompletionStatus();
      setIsLoading(false);

      if (isComplete) {
        setDialogMode('publish');
        setShowConfirmDialog(true);
      } else {
        setDialogMode('incomplete');
        setShowConfirmDialog(true);
      }
    }
  };

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      // If we're unpublishing, we can proceed directly with less validation
      const result = await toggleProfilePublication();

      if (result.success) {
        setIsPublished(result.isPublished);
        toast.success(result.message);
        // Close the dialog on success
        setShowConfirmDialog(false);
      } else {
        // If the toggle failed due to incomplete steps, show which steps are missing
        if (result.incompleteSteps) {
          setIncompleteSteps(result.incompleteSteps);
          setDialogMode('incomplete');
          setShowConfirmDialog(true);
        } else {
          toast.error(result.message);
          // Close the dialog on error
          setShowConfirmDialog(false);
        }
      }
    } catch (error) {
      console.error('Error toggling profile publication:', error);
      toast.error('Failed to update publication status');
      // Close the dialog on error
      setShowConfirmDialog(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center space-x-2">
        <Switch
          id="profile-published"
          checked={isPublished}
          disabled={isLoading}
          onCheckedChange={handleToggleRequest}
        />
        <Label htmlFor="profile-published" className="text-sm font-medium">
          {isPublished ? (
            <span className="flex items-center text-green-600">
              <CheckCircle2 className="mr-1 h-4 w-4" />
              {t('status.published')}
            </span>
          ) : (
            <span className="flex items-center text-muted-foreground">
              <Info className="mr-1 h-4 w-4" />
              {t('status.notPublished')}
            </span>
          )}
        </Label>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            {dialogMode === 'incomplete' ? (
              <>
                <AlertDialogTitle className="flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5 text-amber-500" />
                  {t('incompleteDialog.title')}
                </AlertDialogTitle>
                <AlertDialogDescription>{t('incompleteDialog.description')}</AlertDialogDescription>
                <div className="mt-3">
                  <ul className="list-disc space-y-1 pl-5">
                    {incompleteSteps.map((step) => (
                      <li key={step}>{getStepName(step)}</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : dialogMode === 'publish' ? (
              <>
                <AlertDialogTitle className="flex items-center">
                  <CheckCircle2 className="mr-2 h-5 w-5 text-green-600" />
                  {t('publishDialog.title')}
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-4">
                  <p>{t('publishDialog.description')}</p>

                  {/* Legal Agreement Section */}
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                    <div className="mb-3 flex items-start">
                      <FileText className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        {t('publishDialog.agreementRequired')}
                      </p>
                    </div>

                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="agree-practitioner-terms"
                        checked={agreedToTerms}
                        onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor="agree-practitioner-terms"
                        className="cursor-pointer text-sm leading-relaxed text-amber-900 dark:text-amber-100"
                      >
                        {t('publishDialog.agreementText')}{' '}
                        <Link
                          href="/legal/expert-agreement"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t('publishDialog.expertAgreement')}
                        </Link>
                        , {t('publishDialog.agreementIncludes')}
                      </Label>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">{t('publishDialog.disclaimer')}</p>
                </AlertDialogDescription>
              </>
            ) : (
              <>
                <AlertDialogTitle className="flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5 text-amber-500" />
                  {t('unpublishDialog.title')}
                </AlertDialogTitle>
                <AlertDialogDescription>{t('unpublishDialog.description')}</AlertDialogDescription>
              </>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('buttons.cancel')}</AlertDialogCancel>
            {dialogMode !== 'incomplete' && (
              <AlertDialogAction
                onClick={handleToggle}
                disabled={isLoading || (dialogMode === 'publish' && !agreedToTerms)}
              >
                {dialogMode === 'publish' ? t('buttons.publish') : t('buttons.unpublish')}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
