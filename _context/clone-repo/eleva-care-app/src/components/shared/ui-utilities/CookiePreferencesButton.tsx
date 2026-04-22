'use client';

import { useCookieConsent } from 'react-cookie-manager';

/**
 * Cookie Preferences Button
 *
 * A client-side button that triggers the cookie consent banner.
 * Extracted as a separate component to allow Footer to remain a Server Component.
 *
 * @example
 * ```tsx
 * <CookiePreferencesButton label="Cookie Preferences" />
 * ```
 */
interface CookiePreferencesButtonProps {
  label: string;
}

export function CookiePreferencesButton({ label }: CookiePreferencesButtonProps) {
  const { showConsentBanner } = useCookieConsent() || { showConsentBanner: () => {} };

  return (
    <button
      type="button"
      onClick={() => showConsentBanner?.()}
      className="font-medium text-eleva-neutral-900 hover:text-eleva-primary"
    >
      {label}
    </button>
  );
}
