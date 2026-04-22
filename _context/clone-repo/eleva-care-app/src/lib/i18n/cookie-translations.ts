/**
 * Cookie translations adapter for next-intl to react-cookie-manager
 *
 * This utility function converts next-intl message format to the format
 * expected by the CookieManager component from react-cookie-manager.
 *
 * @param messages - The messages object from next-intl
 * @returns Formatted translations for react-cookie-manager
 */

/**
 * Creates cookie translations from next-intl messages
 * Handles any type of messages object structure
 */
export function createCookieTranslations(messages: Record<string, unknown>) {
  // Safely access the cookie object, handling any structure
  const cookie =
    messages?.cookie && typeof messages.cookie === 'object'
      ? (messages.cookie as Record<string, string>)
      : {};

  return {
    title: cookie.title || 'Cookie Preferences',
    message:
      cookie.message ||
      'We use cookies to enhance your experience, analyze site traffic, and for marketing purposes.',
    buttonText: cookie.buttonText || 'Accept All',
    declineButtonText: cookie.declineButtonText || 'Decline All',
    manageButtonText: cookie.manageButtonText || 'Manage Preferences',
    privacyPolicyText: cookie.privacyPolicyText || 'Cookie Policy',

    // Manage cookie dialog
    manageTitle: cookie.manageTitle || 'Cookie Preferences',
    manageMessage: cookie.manageMessage || 'Manage your cookie preferences below.',

    // Essential cookies
    manageEssentialTitle: cookie.manageEssentialTitle || 'Essential',
    manageEssentialSubtitle:
      cookie.manageEssentialSubtitle || 'Required for the website to function properly',
    manageEssentialStatus: cookie.manageEssentialStatus || 'Status: Always enabled',
    manageEssentialStatusButtonText: cookie.manageEssentialStatusButtonText || 'Always On',

    // Analytics cookies
    manageAnalyticsTitle: cookie.manageAnalyticsTitle || 'Analytics',
    manageAnalyticsSubtitle:
      cookie.manageAnalyticsSubtitle || 'Help us understand how visitors interact with our website',

    // Social cookies
    manageSocialTitle: cookie.manageSocialTitle || 'Social',
    manageSocialSubtitle: cookie.manageSocialSubtitle || 'Enable social media features and sharing',

    // Advertising cookies
    manageAdvertTitle: cookie.manageAdvertTitle || 'Advertising',
    manageAdvertSubtitle:
      cookie.manageAdvertSubtitle || 'Personalize advertisements and measure their performance',

    // Status messages
    manageCookiesStatus: cookie.manageCookiesStatus || 'Status: {{status}} on {{date}}',
    manageCookiesStatusConsented: cookie.manageCookiesStatusConsented || 'Consented',
    manageCookiesStatusDeclined: cookie.manageCookiesStatusDeclined || 'Declined',

    // Buttons in manage modal
    manageCancelButtonText: cookie.manageCancelButtonText || 'Cancel',
    manageSaveButtonText: cookie.manageSaveButtonText || 'Save Preferences',
  };
}

// Export default for backwards compatibility
export default createCookieTranslations;
