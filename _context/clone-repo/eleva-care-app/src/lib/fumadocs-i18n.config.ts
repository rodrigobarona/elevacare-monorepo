import type { I18nConfig } from 'fumadocs-core/i18n';

/**
 * Fumadocs i18n Configuration (Client-safe)
 *
 * This file contains only the i18n configuration that can be used in both
 * server and client components. For server-only utilities like getFumadocsLocale(),
 * use fumadocs-i18n.ts instead.
 *
 * Configuration:
 * - parser: 'dir' - Content is organized in locale directories (en/, pt/, etc.)
 * - hideLocale: 'default-locale' - Hide locale prefix for English (default)
 *
 * URL structure:
 * - English (default): /help/expert (no prefix)
 * - Other locales: /pt/help/expert → rewritten to /help/expert with cookie
 *
 * @see https://fumadocs.vercel.app/docs/headless/internationalization
 * @see https://fumadocs.vercel.app/docs/headless/page-conventions#i18n-routing
 */
/**
 * Supported languages for documentation
 * Keep as const for proper type inference
 */
const FUMADOCS_LANGUAGES = ['en', 'pt'] as const;

export const i18n: I18nConfig = {
  defaultLanguage: 'en',
  languages: [...FUMADOCS_LANGUAGES],
  hideLocale: 'default-locale',
  parser: 'dir', // Content uses directory structure: en/index.mdx, pt/index.mdx
};

/**
 * Language type from Fumadocs i18n config
 */
export type FumadocsLanguage = (typeof FUMADOCS_LANGUAGES)[number];

/**
 * UI Translations for Fumadocs Components
 *
 * These translations are used by Fumadocs UI components
 * like search, table of contents, and navigation.
 */
export const translations = {
  en: {
    displayName: 'English',
    search: 'Search documentation...',
    searchNoResults: 'No results found',
    toc: 'On this page',
    editPage: 'Edit this page',
    lastUpdated: 'Last updated',
    nextPage: 'Next',
    previousPage: 'Previous',
    backToTop: 'Back to top',
  },
  pt: {
    displayName: 'Português',
    search: 'Pesquisar documentação...',
    searchNoResults: 'Nenhum resultado encontrado',
    toc: 'Nesta página',
    editPage: 'Editar esta página',
    lastUpdated: 'Última atualização',
    nextPage: 'Próximo',
    previousPage: 'Anterior',
    backToTop: 'Voltar ao topo',
  },
} as const;

/**
 * Type for supported locales (from translations)
 */
export type FumadocsLocale = keyof typeof translations;

/**
 * Get translations for a specific locale
 */
export function getTranslations(locale: string) {
  return translations[locale as FumadocsLocale] ?? translations.en;
}

/**
 * Validate locale is supported by Fumadocs
 */
export function isValidFumadocsLocale(locale: string): locale is FumadocsLanguage {
  return FUMADOCS_LANGUAGES.includes(locale as FumadocsLanguage);
}

/**
 * Maps next-intl locale codes to Fumadocs language codes.
 *
 * Fumadocs only supports 'en' and 'pt', so we map:
 * - 'pt-BR' or 'pt' => 'pt' (Portuguese)
 * - 'es' => 'en' (Spanish falls back to English - no Spanish docs yet)
 * - All others => 'en' (default to English)
 *
 * @param locale - The next-intl locale code (e.g., 'pt-BR', 'es', 'en')
 * @returns FumadocsLanguage code ('en' or 'pt')
 *
 * @example
 * ```tsx
 * mapToFumadocsLocale('pt-BR'); // => 'pt'
 * mapToFumadocsLocale('pt');    // => 'pt'
 * mapToFumadocsLocale('es');    // => 'en' (fallback)
 * mapToFumadocsLocale('en');    // => 'en'
 * mapToFumadocsLocale('fr');    // => 'en' (default)
 * ```
 */
export function mapToFumadocsLocale(locale: string): FumadocsLanguage {
  // Handle all Portuguese variants (pt, pt-BR, pt-PT, etc.)
  // Use strict matching to only accept exact 'pt' or valid BCP47 'pt-' prefixed variants
  if (locale === 'pt' || locale.startsWith('pt-')) return 'pt';
  // All other locales (including 'es', 'en', 'fr', etc.) default to English
  return 'en';
}
