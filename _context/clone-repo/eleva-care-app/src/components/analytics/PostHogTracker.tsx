'use client';

import { usePostHogEvents, usePostHogFeatureFlag } from '@/hooks/usePostHog';
import React, { useEffect, useRef } from 'react';

// PostHog Type Definitions
interface PostHogEventProperties {
  [key: string]: string | number | boolean | null | undefined;
}

interface PostHogTrackerProps {
  children: React.ReactNode;
  eventName?: string;
  eventProperties?: PostHogEventProperties;
  featureFlag?: string;
  trackOnMount?: boolean;
}

/**
 * PostHog Tracker Component
 *
 * Wraps children and provides automatic event tracking capabilities.
 * Can be used to track page views, feature flag exposure, or custom events.
 *
 * @example
 * ```tsx
 * <PostHogTracker
 *   eventName="page_viewed"
 *   eventProperties={{ page: 'dashboard' }}
 *   featureFlag="new_dashboard_layout"
 *   trackOnMount
 * >
 *   <DashboardContent />
 * </PostHogTracker>
 * ```
 */
export function PostHogTracker({
  children,
  eventName,
  eventProperties,
  featureFlag,
  trackOnMount = false,
}: PostHogTrackerProps) {
  const { trackEvent } = usePostHogEvents();

  // Only call usePostHogFeatureFlag if featureFlag is provided and non-empty
  const { flagValue } = usePostHogFeatureFlag(
    featureFlag && featureFlag.length > 0 ? featureFlag : '',
    false,
  );

  useEffect(() => {
    if (trackOnMount && eventName) {
      trackEvent(eventName, eventProperties);
    }
  }, [trackOnMount, eventName, eventProperties, trackEvent]);

  useEffect(() => {
    if (featureFlag && featureFlag.length > 0 && flagValue) {
      trackEvent('feature_flag_exposure', {
        flag_key: featureFlag,
        flag_value: flagValue,
        ...eventProperties,
      });
    }
  }, [featureFlag, flagValue, trackEvent, eventProperties]);

  return <>{children}</>;
}

/**
 * Click Tracking Wrapper
 *
 * Automatically tracks click events on wrapped elements.
 * Provides proper keyboard accessibility.
 */
interface ClickTrackerProps {
  children: React.ReactNode;
  eventProperties?: PostHogEventProperties;
  element?: string;
}

export function ClickTracker({
  children,
  eventProperties,
  element = 'unknown',
}: ClickTrackerProps) {
  const { trackEngagement } = usePostHogEvents();

  const handleClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    trackEngagement('click', element, {
      ...eventProperties,
      click_target: target?.tagName?.toLowerCase(),
      click_text: target?.textContent?.slice(0, 100),
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Handle Enter and Space keys for keyboard accessibility
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const target = event.target as HTMLElement;
      trackEngagement('click', element, {
        ...eventProperties,
        click_target: target?.tagName?.toLowerCase(),
        click_text: target?.textContent?.slice(0, 100),
        interaction_type: 'keyboard',
      });
    }
  };

  return (
    <div onClick={handleClick} onKeyDown={handleKeyDown} role="button" tabIndex={0} data-ph-capture>
      {children}
    </div>
  );
}

/**
 * Form Tracking Wrapper
 *
 * Tracks form interactions and submissions.
 */
interface FormTrackerProps {
  children: React.ReactNode;
  formName: string;
  onSubmit?: (data: FormData) => void;
  validateForm?: (formData: FormData) => boolean;
}

export function FormTracker({ children, formName, onSubmit, validateForm }: FormTrackerProps) {
  const { trackEvent, trackConversion } = usePostHogEvents();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent default form submission

    const formData = new FormData(event.currentTarget);
    const formObject = Object.fromEntries(formData.entries());

    // Determine if form has errors using validation function or form validity
    const hasErrors = validateForm ? !validateForm(formData) : !event.currentTarget.checkValidity();

    // Track form submission
    trackEvent('form_submitted', {
      form_name: formName,
      field_count: Object.keys(formObject).length,
      has_errors: hasErrors,
    });

    // Only track conversion if form is valid
    if (!hasErrors) {
      trackConversion('form_completion', formName, {
        field_count: Object.keys(formObject).length,
      });
    }

    onSubmit?.(formData);
  };

  const handleFieldInteraction = (event: React.FocusEvent) => {
    const target = event.target as HTMLInputElement;
    trackEvent('form_field_interaction', {
      form_name: formName,
      field_name: target?.name,
      field_type: target?.type,
      interaction_type: 'focus',
    });
  };

  return (
    <form onSubmit={handleSubmit} onFocus={handleFieldInteraction} data-ph-capture>
      {children}
    </form>
  );
}

/**
 * Business Event Tracker
 *
 * Tracks specific business events with proper categorization.
 */
interface BusinessEventTrackerProps {
  children: React.ReactNode;
  event: 'appointment_booked' | 'payment_completed' | 'expert_contacted' | 'profile_completed';
  properties?: PostHogEventProperties;
  triggerOn?: 'mount' | 'click' | 'manual';
}

export function BusinessEventTracker({
  children,
  event,
  properties,
  triggerOn = 'click',
}: BusinessEventTrackerProps) {
  const { trackBusinessEvent } = usePostHogEvents();

  useEffect(() => {
    if (triggerOn === 'mount') {
      trackBusinessEvent(event, properties);
    }
  }, [triggerOn, event, properties, trackBusinessEvent]);

  const handleClick = () => {
    if (triggerOn === 'click') {
      trackBusinessEvent(event, properties);
    }
  };

  const handleKeyDown = (keyEvent: React.KeyboardEvent) => {
    if (triggerOn === 'click' && (keyEvent.key === 'Enter' || keyEvent.key === ' ')) {
      keyEvent.preventDefault();
      trackBusinessEvent(event, properties);
    }
  };

  if (triggerOn === 'click') {
    return (
      <div
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        data-ph-capture
      >
        {children}
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Performance Tracker
 *
 * Tracks component render performance and user interactions.
 */
interface PerformanceTrackerProps {
  children: React.ReactNode;
  componentName: string;
  trackRenderTime?: boolean;
}

export function PerformanceTracker({
  children,
  componentName,
  trackRenderTime = false,
}: PerformanceTrackerProps) {
  const { trackEvent } = usePostHogEvents();
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (trackRenderTime) {
      // Record start time only once when component mounts
      startTimeRef.current = performance.now();

      // Cleanup function runs only on unmount
      return () => {
        if (startTimeRef.current !== null) {
          const endTime = performance.now();
          trackEvent('component_render_time', {
            component_name: componentName,
            render_time: endTime - startTimeRef.current,
          });
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this only runs on mount/unmount

  return <>{children}</>;
}

/**
 * Error Tracker - React Error Boundary with PostHog integration
 */
interface ErrorTrackerProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorTrackerState {
  hasError: boolean;
  error?: Error;
}

export class ErrorTracker extends React.Component<ErrorTrackerProps, ErrorTrackerState> {
  constructor(props: ErrorTrackerProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorTrackerState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Track error with PostHog
    if (typeof window !== 'undefined' && (window as unknown as WindowWithPostHog).posthog) {
      (window as unknown as WindowWithPostHog).posthog.capture('react_error_boundary', {
        error_message: error.message,
        error_stack: error.stack,
        component_stack: errorInfo.componentStack,
        error_boundary: 'PostHogErrorTracker',
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div>
            <h2>Something went wrong.</h2>
            <details style={{ whiteSpace: 'pre-wrap' }}>
              {this.state.error && this.state.error.toString()}
            </details>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

/**
 * Global Error Tracking Setup
 *
 * NOTE: This function has been deprecated. Error tracking is now handled
 * exclusively by Sentry, which provides:
 * - Automatic capture via GlobalHandlers integration
 * - Source maps for readable stack traces
 * - Session replay linked to errors
 * - Better error grouping and analysis
 *
 * @deprecated Use Sentry for error tracking instead
 */
export function setupGlobalErrorTracking() {
  // No-op: Error tracking is handled by Sentry
  // See: instrumentation-client.ts for Sentry configuration
  console.info('[PostHog] Error tracking disabled - Sentry handles all errors');
}

// Type definitions for global PostHog access
declare global {
  interface WindowWithPostHog extends Window {
    posthog: import('posthog-js').PostHog;
  }
}
