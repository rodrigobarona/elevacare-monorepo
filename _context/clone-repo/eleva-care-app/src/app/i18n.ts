import { type Locale, locales } from '@/lib/i18n/routing';
import { getFileLocale } from '@/lib/i18n/utils';
import { notFound } from 'next/navigation';

/**
 * Internationalization utilities for Next.js App Router
 *
 * This file provides utilities for locale handling in App Router components:
 * - Locale validation
 * - Message loading with fallbacks
 * - Dictionary loading for server components
 *
 * Locale Detection Strategy:
 * 1. Cookie - User's explicit selection is prioritized (stored in ELEVA_LOCALE cookie)
 * 2. Accept-Language Header - Browser's language preferences
 * 3. IP Geolocation - Using Vercel's geolocation headers
 * 4. Default Locale - If all else fails, fall back to default locale (en)
 */

// Validate if a given locale is supported by the application
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

// Function to load messages for a locale
async function loadMessages(locale: string) {
  // Transform locale to file locale (e.g., pt-BR -> br, es-MX -> mx)
  const fileLocale = getFileLocale(locale);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[i18n.ts] Loading messages for locale: ${locale}, file locale: ${fileLocale}`);
  }

  try {
    const messages = await import(`@/messages/${fileLocale}.json`);

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[i18n.ts] Successfully loaded ${Object.keys(messages.default).length} messages for ${locale}`,
      );
    }

    return messages.default;
  } catch (error) {
    console.error(
      `[i18n.ts] Error loading messages for locale ${locale} (file: ${fileLocale}.json):`,
      error,
    );
    throw new Error(`Failed to load messages for locale: ${locale}`);
  }
}

// Get messages for a validated locale, throwing notFound for invalid locales
export async function getMessages(locale: string) {
  if (!isValidLocale(locale)) {
    console.error(`[i18n.ts] Invalid locale requested: ${locale}`);
    notFound();
  }

  try {
    return await loadMessages(locale);
  } catch (error) {
    console.error('[i18n.ts] Failed to load messages:', error);
    // Try to load default locale as fallback
    try {
      if (locale !== 'en') {
        console.log('[i18n.ts] Trying fallback to English messages');
        return await loadMessages('en');
      }
      // If we're already trying English and it failed, return empty object
      return {};
    } catch (fallbackError) {
      console.error('[i18n.ts] Even fallback to English failed:', fallbackError);
      // Return empty dictionary as last resort to prevent complete failure
      return {};
    }
  }
}

// Validate locale and return dictionary
export default async function getDictionary(locale: string) {
  // Validate locale is one of the supported locales
  if (!isValidLocale(locale)) {
    console.error(`[i18n.ts] Unsupported locale: ${locale}`);
    notFound();
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[i18n.ts] Loading dictionary for locale: ${locale}`);
  }

  return getMessages(locale);
}
