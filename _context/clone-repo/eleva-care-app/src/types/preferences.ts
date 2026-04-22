/**
 * User Preferences Type Definitions
 *
 * Defines user preferences for security, notifications, and UI settings.
 * Replaces Clerk publicMetadata storage with database-backed preferences.
 */

/**
 * Complete user preferences interface
 */
export interface UserPreferences {
  // Security preferences
  securityAlerts: boolean;
  newDeviceAlerts: boolean;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  unusualTimingAlerts: boolean;
  locationChangeAlerts: boolean;

  // UI preferences
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'es' | 'pt' | 'br';
}

/**
 * Partial preferences for updates
 */
export type UserPreferencesUpdate = Partial<UserPreferences>;

/**
 * Security preferences subset
 */
export interface SecurityPreferences {
  securityAlerts: boolean;
  newDeviceAlerts: boolean;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  unusualTimingAlerts: boolean;
  locationChangeAlerts: boolean;
}

/**
 * UI preferences subset
 */
export interface UIPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'es' | 'pt' | 'br';
}

/**
 * Default preferences
 *
 * Applied when a user is created or preferences are reset.
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  // Security defaults (opt-in for important alerts)
  securityAlerts: true,
  newDeviceAlerts: false, // Too noisy for most users
  emailNotifications: true,
  inAppNotifications: true,
  unusualTimingAlerts: true,
  locationChangeAlerts: true,

  // UI defaults
  theme: 'light',
  language: 'en',
};

/**
 * Preference display names for UI
 */
export const PREFERENCE_LABELS: Record<keyof UserPreferences, string> = {
  // Security
  securityAlerts: 'Security Alerts',
  newDeviceAlerts: 'New Device Notifications',
  emailNotifications: 'Email Notifications',
  inAppNotifications: 'In-App Notifications',
  unusualTimingAlerts: 'Unusual Activity Alerts',
  locationChangeAlerts: 'Location Change Alerts',

  // UI
  theme: 'Theme',
  language: 'Language',
};

/**
 * Preference descriptions for UI
 */
export const PREFERENCE_DESCRIPTIONS: Record<keyof UserPreferences, string> = {
  // Security
  securityAlerts: 'Receive alerts about potential security issues',
  newDeviceAlerts: 'Get notified when a new device logs in',
  emailNotifications: 'Receive notifications via email',
  inAppNotifications: 'Show notifications in the app',
  unusualTimingAlerts: 'Alert when activity happens at unusual times',
  locationChangeAlerts: 'Notify when login from new location',

  // UI
  theme: 'Choose your preferred theme',
  language: 'Select your preferred language',
};

/**
 * Theme options for UI
 */
export const THEME_OPTIONS: Array<{ value: UserPreferences['theme']; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

/**
 * Language options for UI
 */
export const LANGUAGE_OPTIONS: Array<{ value: UserPreferences['language']; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'pt', label: 'Português' },
  { value: 'br', label: 'Português (Brasil)' },
];

/**
 * Get security preferences from full preferences
 */
export function getSecurityPreferences(preferences: UserPreferences): SecurityPreferences {
  return {
    securityAlerts: preferences.securityAlerts,
    newDeviceAlerts: preferences.newDeviceAlerts,
    emailNotifications: preferences.emailNotifications,
    inAppNotifications: preferences.inAppNotifications,
    unusualTimingAlerts: preferences.unusualTimingAlerts,
    locationChangeAlerts: preferences.locationChangeAlerts,
  };
}

/**
 * Get UI preferences from full preferences
 */
export function getUIPreferences(preferences: UserPreferences): UIPreferences {
  return {
    theme: preferences.theme,
    language: preferences.language,
  };
}

/**
 * Merge partial preferences with defaults
 */
export function mergeWithDefaults(partial: Partial<UserPreferences>): UserPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    ...partial,
  };
}

/**
 * Validate preferences object
 */
export function isValidPreferences(obj: unknown): obj is UserPreferences {
  if (typeof obj !== 'object' || obj === null) return false;

  const prefs = obj as Record<string, unknown>;

  return (
    typeof prefs.securityAlerts === 'boolean' &&
    typeof prefs.newDeviceAlerts === 'boolean' &&
    typeof prefs.emailNotifications === 'boolean' &&
    typeof prefs.inAppNotifications === 'boolean' &&
    typeof prefs.unusualTimingAlerts === 'boolean' &&
    typeof prefs.locationChangeAlerts === 'boolean' &&
    ['light', 'dark', 'system'].includes(prefs.theme as string) &&
    ['en', 'es', 'pt', 'br'].includes(prefs.language as string)
  );
}
