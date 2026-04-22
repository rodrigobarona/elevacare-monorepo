'use client';

import * as Sentry from '@sentry/nextjs';

/**
 * Sentry Feedback Button
 *
 * A client-side button that triggers Sentry's user feedback form.
 * Extracted as a separate component to allow Footer to remain a Server Component.
 *
 * In Sentry SDK v10+, the feedback integration returns an object with:
 * - createForm(): Opens a feedback dialog programmatically
 * - createWidget(): Creates a floating widget
 * - attachTo(): Attaches to a DOM element
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/user-feedback/
 *
 * @example
 * ```tsx
 * <SentryFeedbackButton label="Report a Bug" />
 * ```
 */
interface SentryFeedbackButtonProps {
  label: string;
}

export function SentryFeedbackButton({ label }: SentryFeedbackButtonProps) {
  const handleClick = async () => {
    const feedback = Sentry.getFeedback();
    if (feedback) {
      // In Sentry SDK v10+, use createForm() to programmatically open the feedback dialog
      const form = await feedback.createForm();
      form.appendToDom();
      form.open();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
    >
      {label}
    </button>
  );
}

