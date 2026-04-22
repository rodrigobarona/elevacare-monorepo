'use client';

import HelpSearchDialog from '@/components/help/search-dialog';
import { type FumadocsLocale, i18n, translations } from '@/lib/fumadocs-i18n.config';
import { defineI18nUI } from 'fumadocs-ui/i18n';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { type ReactNode, useEffect } from 'react';

interface DocsProviderProps {
  children: ReactNode;
  locale: FumadocsLocale;
}

/**
 * Documentation Provider
 *
 * Client component wrapper for RootProvider that configures:
 * - Fumadocs i18n provider for UI translations
 * - Custom search dialog with portal tag filtering
 * - Theme support (light/dark mode)
 * - Hides floating sidebar panel (since we use static sidebar)
 *
 * This is needed because RootProvider's search.SearchDialog prop
 * requires a client component to pass function references.
 *
 * @see https://fumadocs.vercel.app/docs/ui/layouts/root-provider
 * @see https://fumadocs.vercel.app/docs/ui/internationalization
 */
export function DocsProvider({ children, locale }: DocsProviderProps) {
  // Create Fumadocs i18n provider for the current locale
  const { provider } = defineI18nUI(i18n, { translations });
  const fumadocsI18n = provider(locale);

  // Hide the floating sidebar panel (collapse/search buttons)
  // We use a static sidebar with collapsible: false, so this panel is not needed
  useEffect(() => {
    const hideFloatingPanel = () => {
      const panel = document.querySelector('[data-sidebar-panel]');
      if (panel instanceof HTMLElement) {
        panel.style.display = 'none';
        panel.setAttribute('aria-hidden', 'true');
        panel.setAttribute('hidden', '');
      }
    };

    // Run immediately and observe for changes (Fumadocs renders async)
    hideFloatingPanel();

    // Use requestAnimationFrame for smoother hiding
    requestAnimationFrame(hideFloatingPanel);

    const observer = new MutationObserver(() => {
      hideFloatingPanel();
      requestAnimationFrame(hideFloatingPanel);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return (
    <RootProvider
      i18n={fumadocsI18n}
      search={{
        SearchDialog: HelpSearchDialog,
      }}
    >
      {children}
    </RootProvider>
  );
}
