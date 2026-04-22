// Mock for next-intl - Vitest compatible
import { vi } from 'vitest';

interface TranslationValue {
  [key: string]: string | TranslationValue;
}

interface Translations {
  [namespace: string]: TranslationValue;
}

// Define translations for common keys used in tests
const translations: Translations = {
  profilePublish: {
    status: {
      published: 'Profile Published',
      notPublished: 'Profile Not Published',
    },
    publishDialog: {
      title: 'Publish Your Expert Profile',
      description: 'By publishing your profile, you agree to the Practitioner Agreement.',
      termsLabel: 'I agree to the Practitioner Agreement',
      viewAgreement: 'View Agreement',
    },
    unpublishDialog: {
      title: 'Unpublish Your Expert Profile',
      description: 'Your profile will be hidden from clients.',
    },
    incompleteDialog: {
      title: 'Complete All Steps First',
      description: 'Please complete all setup steps before publishing.',
    },
    buttons: {
      publish: 'Publish Profile',
      unpublish: 'Unpublish',
      cancel: 'Cancel',
    },
  },
};

// Create a mock translation function that can handle nested keys
const createMockTranslation =
  (namespace?: string) =>
  (key: string): string => {
    if (!namespace) return key;

    const keys = key.split('.');
    let value: unknown = translations[namespace];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return key;
      }
    }

    return typeof value === 'string' ? value : key;
  };

export const useTranslations = vi.fn((namespace?: string) => createMockTranslation(namespace));
export const useLocale = vi.fn(() => 'en');
export const useMessages = vi.fn(() => ({}));
export const useNow = vi.fn(() => new Date());
export const useTimeZone = vi.fn(() => 'UTC');

// Default export for compatibility
const mockNextIntl = {
  useTranslations,
  useLocale,
  useMessages,
  useNow,
  useTimeZone,
};

export default mockNextIntl;
