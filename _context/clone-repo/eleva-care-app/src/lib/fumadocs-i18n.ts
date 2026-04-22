/**
 * Fumadocs i18n Re-exports
 *
 * This file re-exports the Fumadocs i18n configuration for convenience.
 * The actual configuration is in fumadocs-i18n.config.ts.
 *
 * With URL-based locale routing (help inside [locale] route), locale detection
 * is no longer needed - locale comes directly from route params.
 *
 * @see https://fumadocs.vercel.app/docs/headless/internationalization
 */

export {
  i18n,
  translations,
  getTranslations,
  isValidFumadocsLocale,
  type FumadocsLanguage,
  type FumadocsLocale,
} from './fumadocs-i18n.config';
