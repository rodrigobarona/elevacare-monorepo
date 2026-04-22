export type SupportedLocale = 'en' | 'pt' | 'es' | 'pt-BR' | 'br';

export interface EmailTheme {
  mode: 'light' | 'dark';
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: {
      primary: string;
      secondary: string;
      muted: string;
    };
    border: string;
    success: string;
    warning: string;
    error: string;
  };
}

export const emailThemes: Record<'light' | 'dark', EmailTheme> = {
  light: {
    mode: 'light',
    colors: {
      primary: '#006D77',
      secondary: '#F0FDFF',
      background: '#FFFFFF',
      surface: '#F8F9FA',
      text: {
        primary: '#2D3748',
        secondary: '#4A5568',
        muted: '#718096',
      },
      border: '#E2E8F0',
      success: '#22C55E',
      warning: '#F59E0B',
      error: '#EF4444',
    },
  },
  dark: {
    mode: 'dark',
    colors: {
      primary: '#00A8B8',
      secondary: '#1A2F33',
      background: '#0F1419',
      surface: '#1E2832',
      text: {
        primary: '#F7FAFC',
        secondary: '#E2E8F0',
        muted: '#A0AEC0',
      },
      border: '#2D3748',
      success: '#10B981',
      warning: '#F97316',
      error: '#F87171',
    },
  },
};

// Type for email message paths
export type EmailMessagePath =
  | 'notifications.welcome.email'
  | 'notifications.appointmentReminder.email'
  | 'notifications.appointmentCancelled.email'
  | 'notifications.platformPaymentReceived.email'
  | 'notifications.platformPayoutProcessed.email'
  | 'notifications.expertPayoutSetup.email'
  | 'notifications.newBookingExpert.email'
  | 'notifications.expertOnboardingComplete.email'
  | 'notifications.multibancoBookingPending.email'
  | 'notifications.multibancoPaymentReminder.email';

export interface EmailTranslations {
  [key: string]: unknown;
}

// Load messages function - in a real app this would be dynamic
export async function loadEmailMessages(locale: SupportedLocale): Promise<EmailTranslations> {
  try {
    // Import the appropriate message file
    let messages: EmailTranslations;

    switch (locale) {
      case 'en':
        messages = (await import('../../messages/en.json')).default;
        break;
      case 'pt':
        messages = (await import('../../messages/pt.json')).default;
        break;
      case 'es':
        messages = (await import('../../messages/es.json')).default;
        break;
      case 'pt-BR':
      case 'br':
        messages = (await import('../../messages/pt-BR.json')).default;
        break;
      default:
        messages = (await import('../../messages/en.json')).default;
    }

    return messages;
  } catch {
    console.warn(`Failed to load messages for locale ${locale}, falling back to English`);
    return (await import('../../messages/en.json')).default;
  }
}

// Helper function to get nested message value
export function getEmailMessage(
  messages: EmailTranslations,
  path: string,
  variables?: Record<string, string | number>,
): string {
  const keys = path.split('.');
  let value: unknown = messages;

  for (const key of keys) {
    if (value && typeof value === 'object' && value !== null && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      console.warn(`Email message not found for path: ${path}`);
      return path; // Return path as fallback
    }
  }

  if (typeof value !== 'string') {
    console.warn(`Email message at path ${path} is not a string`);
    return path;
  }

  // Replace variables in the message
  if (variables) {
    return Object.entries(variables).reduce((msg, [key, val]) => {
      return msg.replace(new RegExp(`{${key}}`, 'g'), String(val));
    }, value);
  }

  return value;
}

// Email context interface
export interface EmailContext {
  locale: SupportedLocale;
  theme: EmailTheme;
  messages: EmailTranslations;
}

// Create email context
export async function createEmailContext(
  locale: SupportedLocale = 'en',
  themeMode: 'light' | 'dark' = 'light',
): Promise<EmailContext> {
  const messages = await loadEmailMessages(locale);
  const theme = emailThemes[themeMode];

  return {
    locale,
    theme,
    messages,
  };
}

// Hook-like function for getting translated messages
export function useEmailTranslation(context: EmailContext) {
  return {
    t: (path: string, variables?: Record<string, string | number>) =>
      getEmailMessage(context.messages, path, variables),
    locale: context.locale,
    theme: context.theme,
  };
}

// Common email messages that exist across all templates
export const commonEmailPaths = {
  company: {
    name: 'company.name',
    tagline: 'company.tagline',
    website: 'company.website',
  },
  common: {
    greeting: 'common.greeting',
    thankYou: 'common.thankYou',
    support: 'common.support',
    team: 'common.team',
  },
  cta: {
    viewDetails: 'common.cta.viewDetails',
    learnMore: 'common.cta.learnMore',
    contactSupport: 'common.cta.contactSupport',
  },
} as const;
