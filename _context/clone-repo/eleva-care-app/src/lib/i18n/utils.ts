import { type Locale, locales } from './routing';

/**
 * Helper function to get the file locale from ISO locale codes
 * Maps locale to message file name
 * @param locale The locale string to transform
 * @returns The file locale to use for imports
 *
 * Mapping:
 * - 'pt-BR' → 'pt-BR' (Brazilian Portuguese - use full locale)
 * - 'pt' → 'pt' (European Portuguese)
 * - 'es' → 'es' (Spanish)
 * - 'en' → 'en' (English)
 */
export function getFileLocale(locale: string): string {
  // Keep pt-BR as is (we use pt-BR.json, not br.json)
  if (locale === 'pt-BR') {
    return 'pt-BR';
  }

  // For all other locales, just return the original
  return locale;
}

// Country to locale mapping table
const COUNTRY_LOCALE_MAP: Record<string, Locale> = {
  // Spanish-speaking countries
  ES: 'es', // Spain
  MX: 'es', // Mexico
  CO: 'es', // Colombia
  AR: 'es', // Argentina
  CL: 'es', // Chile
  PE: 'es', // Peru
  VE: 'es', // Venezuela
  EC: 'es', // Ecuador
  GT: 'es', // Guatemala
  CU: 'es', // Cuba
  BO: 'es', // Bolivia
  DO: 'es', // Dominican Republic
  HN: 'es', // Honduras
  PY: 'es', // Paraguay
  SV: 'es', // El Salvador
  NI: 'es', // Nicaragua
  CR: 'es', // Costa Rica
  PA: 'es', // Panama
  UY: 'es', // Uruguay
  PR: 'es', // Puerto Rico
  GQ: 'es', // Equatorial Guinea

  // Portuguese-speaking countries
  PT: 'pt', // Portugal - Always use pt for Portugal
  BR: 'pt-BR', // Brazil - Always use pt-BR for Brazil
  AO: 'pt', // Angola
  MZ: 'pt', // Mozambique
  GW: 'pt', // Guinea-Bissau
  TL: 'pt', // East Timor
  CV: 'pt', // Cape Verde
  ST: 'pt', // São Tomé and Príncipe
};

/**
 * Parse the Accept-Language header value
 * @param acceptLanguage The Accept-Language header value
 * @returns The best matching locale or null if none matches
 */
function parseAcceptLanguage(acceptLanguage?: string): Locale | null {
  if (!acceptLanguage) return null;

  // Parse the Accept-Language header
  // Format is typically: "en-US,en;q=0.9,es;q=0.8,pt;q=0.7"
  const languages = acceptLanguage
    .split(',')
    .map((lang) => {
      const [value, quality = 'q=1.0'] = lang.trim().split(';');
      const q = Number.parseFloat(quality.split('=')[1]);
      return { value, q };
    })
    .sort((a, b) => b.q - a.q); // Sort by quality descending

  // Find the first supported locale that matches
  for (const lang of languages) {
    const code = lang.value.toLowerCase();

    // Try direct match first (highest priority)
    if (locales.includes(code as Locale)) {
      return code as Locale;
    }

    // Special case for Brazilian Portuguese (explicit pt-BR)
    // Only match exact pt-BR patterns
    if (code === 'pt-br') {
      return 'pt-BR';
    }

    // For all other cases, parse language and region
    const [language, region] = code.split('-');

    // Handle language with region cases
    if (language && region) {
      // Portuguese with Brazil region (pt-BR)
      if (language === 'pt' && region.toLowerCase() === 'br') {
        return 'pt-BR';
      }

      // Portuguese with Portugal region (pt-PT) should be regular 'pt'
      if (language === 'pt' && region.toLowerCase() === 'pt') {
        return 'pt';
      }

      // For all other languages, just return the base language if it's supported
      if (locales.includes(language as Locale)) {
        return language as Locale;
      }
    }
    // Handle base language without region
    else if (language && locales.includes(language as Locale)) {
      // Special case: for Portuguese without region, default to European Portuguese
      // This is because 'pt' alone typically means European Portuguese
      // while Brazilian Portuguese is usually explicitly 'pt-BR'
      if (language === 'pt') {
        return 'pt';
      }
      return language as Locale;
    }
  }

  return null;
}

/**
 * Detect user's preferred locale from request headers
 * Uses both Accept-Language and Vercel geolocation headers
 *
 * @param headers Request headers from middleware
 * @returns The detected locale or null if detection failed
 */
export function detectLocaleFromHeaders(headers: Headers): Locale | null {
  // Try to detect from Accept-Language header first (most accurate)
  const acceptLanguage = headers.get('accept-language');
  const languageLocale = parseAcceptLanguage(acceptLanguage || undefined);

  if (languageLocale) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `🌍 [detectLocaleFromHeaders] Accept-Language detection: ${acceptLanguage} → ${languageLocale}`,
      );
    }
    return languageLocale;
  }

  // If Accept-Language didn't yield a match, try geolocation
  // Vercel automatically adds these headers - https://vercel.com/docs/concepts/edge-network/headers#geolocation
  const country = headers.get('x-vercel-ip-country');

  if (country && COUNTRY_LOCALE_MAP[country]) {
    const geoLocale = COUNTRY_LOCALE_MAP[country];
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🌍 [detectLocaleFromHeaders] Geo-location detection: ${country} → ${geoLocale}`);
    }
    return geoLocale;
  }

  // Fallback to default if nothing matched
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `🌍 [detectLocaleFromHeaders] No locale detected from headers. Accept-Language: ${acceptLanguage || 'none'}, Country: ${country || 'none'}`,
    );
  }
  return null;
}
