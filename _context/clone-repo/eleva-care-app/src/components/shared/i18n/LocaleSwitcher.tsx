import type { Locale } from '@/lib/i18n/routing';
import { routing } from '@/lib/i18n/routing';
import { useLocale, useTranslations } from 'next-intl';

import LocaleSwitcherSelect from './LocaleSwitcherSelect';

/**
 * Locale display names mapped to ISO locale codes.
 * Uses native language names for each locale.
 */
const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
  'pt-BR': 'Português (Brasil)',
};

/**
 * Language Switcher Component
 *
 * Renders an accessible language selector dropdown.
 * Uses next-intl's useLocale hook to get current locale
 * and routing config for available locales.
 *
 * @example
 * ```tsx
 * // In Footer or Header
 * <LanguageSwitcher />
 * ```
 */
export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations('common');

  const options = routing.locales.map((localeCode) => ({
    value: localeCode,
    label: localeNames[localeCode],
  }));

  return <LocaleSwitcherSelect value={locale} options={options} label={t('selectLanguage')} />;
}
