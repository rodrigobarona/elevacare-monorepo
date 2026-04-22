import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';
import type { Locale } from './routing';
import { getFileLocale } from './utils';

// Define a more flexible type for translation messages to handle arrays and complex objects
type MessageValue =
  | string
  | number
  | boolean
  | null
  | MessageValue[]
  | { [key: string]: MessageValue };

interface MessageObject {
  [key: string]: MessageValue;
}

export default getRequestConfig(async ({ requestLocale }) => {
  // `requestLocale` is the locale resolved by the middleware OR the [locale] param
  const requested = await requestLocale;
  if (process.env.NODE_ENV !== 'production') {
    console.log('[request.ts] Received requestLocale:', requested);
  }

  // Validate the locale against our supported locales
  const locale: Locale = hasLocale(routing.locales, requested as string)
    ? (requested as Locale)
    : routing.defaultLocale;

  if (process.env.NODE_ENV !== 'production') {
    if (locale !== requested) {
      console.log(`[request.ts] Locale ${requested} not supported, falling back to ${locale}`);
    } else {
      console.log('[request.ts] Resolved locale:', locale);
    }
  }

  // Transform locale to file locale (e.g., pt-BR -> br, es-MX -> mx)
  const fileLocale = getFileLocale(locale);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[request.ts] Using file locale: ${fileLocale}`);
  }

  // Load messages from JSON files with dynamic imports for better code splitting
  let messages: MessageObject;
  try {
    // Use dynamic import() for better code splitting - only load the needed locale
    const messageModule = await import(`@/messages/${fileLocale}.json`);
    messages = messageModule.default;

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[request.ts] Successfully loaded ${Object.keys(messages).length} messages for locale ${locale}`,
      );
    }
  } catch (error) {
    console.error(
      `[request.ts] Failed to load messages for locale ${locale} (file: ${fileLocale}.json):`,
      error,
    );
    // Fallback to English if locale not found
    try {
      const fallbackModule = await import('@/messages/en.json');
      messages = fallbackModule.default;
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[request.ts] Falling back to 'en' messages.`);
      }
    } catch (fallbackError) {
      console.error('[request.ts] Even fallback to en.json failed:', fallbackError);
      // Last resort - empty messages object to prevent complete failure
      messages = {};
    }
  }

  return {
    locale,
    messages,
    // Optional: set time zone if needed based on locale
    // timeZone: 'UTC',
  };
});
