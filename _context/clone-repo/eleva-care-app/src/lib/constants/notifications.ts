/**
 * Notification Constants
 *
 * This file centralizes all notification-related constants used throughout the application
 * to ensure consistency between the notification system, UI components, and Novu integration.
 */

// Notification Type Constants
export const NOTIFICATION_TYPE_VERIFICATION_HELP = 'VERIFICATION_HELP' as const;
export const NOTIFICATION_TYPE_ACCOUNT_UPDATE = 'ACCOUNT_UPDATE' as const;
export const NOTIFICATION_TYPE_SECURITY_ALERT = 'SECURITY_ALERT' as const;
export const NOTIFICATION_TYPE_SYSTEM_MESSAGE = 'SYSTEM_MESSAGE' as const;

// Complete list of valid notification types
export const VALID_NOTIFICATION_TYPES = [
  NOTIFICATION_TYPE_VERIFICATION_HELP,
  NOTIFICATION_TYPE_ACCOUNT_UPDATE,
  NOTIFICATION_TYPE_SECURITY_ALERT,
  NOTIFICATION_TYPE_SYSTEM_MESSAGE,
] as const;

// Type for notification types (derived from the constant array)
export type NotificationType = (typeof VALID_NOTIFICATION_TYPES)[number];

// Novu Event Mapping Constants
export const NOVU_EVENT_VERIFICATION_HELP = 'verification-help' as const;
export const NOVU_EVENT_ACCOUNT_UPDATE = 'account-update' as const;
export const NOVU_EVENT_SECURITY_ALERT = 'security-alert' as const;
export const NOVU_EVENT_SYSTEM_MESSAGE = 'system-message' as const;

// Notification Type to Novu Event Mapping
export const NOTIFICATION_TYPE_TO_NOVU_EVENT_MAP = {
  [NOTIFICATION_TYPE_VERIFICATION_HELP]: NOVU_EVENT_VERIFICATION_HELP,
  [NOTIFICATION_TYPE_ACCOUNT_UPDATE]: NOVU_EVENT_ACCOUNT_UPDATE,
  [NOTIFICATION_TYPE_SECURITY_ALERT]: NOVU_EVENT_SECURITY_ALERT,
  [NOTIFICATION_TYPE_SYSTEM_MESSAGE]: NOVU_EVENT_SYSTEM_MESSAGE,
} as const;

// UI Constants for Notification Display
export const NOTIFICATION_ICONS = {
  [NOTIFICATION_TYPE_VERIFICATION_HELP]: '🔍',
  [NOTIFICATION_TYPE_ACCOUNT_UPDATE]: '👤',
  [NOTIFICATION_TYPE_SECURITY_ALERT]: '🔒',
  [NOTIFICATION_TYPE_SYSTEM_MESSAGE]: '📢',
} as const;

export const NOTIFICATION_COLORS = {
  [NOTIFICATION_TYPE_VERIFICATION_HELP]: 'border-l-blue-500',
  [NOTIFICATION_TYPE_ACCOUNT_UPDATE]: 'border-l-green-500',
  [NOTIFICATION_TYPE_SECURITY_ALERT]: 'border-l-red-500',
  [NOTIFICATION_TYPE_SYSTEM_MESSAGE]: 'border-l-purple-500',
} as const;

export const NOTIFICATION_DESCRIPTIONS = {
  [NOTIFICATION_TYPE_VERIFICATION_HELP]: 'Identity verification issues',
  [NOTIFICATION_TYPE_ACCOUNT_UPDATE]: 'Account status changes',
  [NOTIFICATION_TYPE_SECURITY_ALERT]: 'Security related notifications',
  [NOTIFICATION_TYPE_SYSTEM_MESSAGE]: 'General system messages',
} as const;

// Helper Functions
export function isValidNotificationType(type: string): type is NotificationType {
  return VALID_NOTIFICATION_TYPES.includes(type as NotificationType);
}

export function getNotificationIcon(type: NotificationType): string {
  return NOTIFICATION_ICONS[type] || '📋';
}

export function getNotificationColor(type: NotificationType): string {
  return NOTIFICATION_COLORS[type] || 'border-l-gray-500';
}

export function getNovuEventForType(type: NotificationType): string {
  return NOTIFICATION_TYPE_TO_NOVU_EVENT_MAP[type];
}
