import { isValidLocale } from '@/app/i18n';
import { IntlProvider } from '@/app/providers';
import Footer from '@/components/layout/footer/Footer';
import Header from '@/components/layout/header/Header';
import { SmoothScrollProvider } from '@/components/providers/SmoothScrollProvider';
import { locales } from '@/lib/i18n/routing';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type React from 'react';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

interface MetadataTranslations {
  title?: string;
  description?: string;
  og?: {
    title?: string;
    description?: string;
    siteName?: string;
  };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    console.error(`Invalid locale in generateMetadata: ${locale}`);
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const meta = messages.metadata as MetadataTranslations | undefined;

  const title = meta?.title || 'Expert care for Pregnancy, Postpartum & Sexual Health | Eleva Care';
  const description =
    meta?.description ||
    'Eleva Care: Empowering growth, embracing care. Expert care for pregnancy, postpartum, menopause, and sexual health.';

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    openGraph: {
      type: 'website',
      url: baseUrl,
      siteName: meta?.og?.siteName || 'Eleva Care',
      title: meta?.og?.title || title,
      description: meta?.og?.description || description,
      images: [
        {
          url: `${baseUrl}/img/eleva-care-share.png`,
          width: 1200,
          height: 680,
          alt: 'Eleva Care',
        },
      ],
    },
    alternates: {
      canonical: `/${locale}`,
      languages: locales.reduce(
        (acc, loc) => {
          acc[loc] = `${baseUrl}/${loc}`;
          return acc;
        },
        {} as Record<string, string>,
      ),
    },
  };
}

export default async function MarketingLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    console.error(`Invalid locale in layout: ${locale}`);
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  // Combined: i18n provider + marketing layout (header/footer)
  // ID="eleva-care-marketing" is used by globals.css for scroll-margin-top offset
  return (
    <IntlProvider locale={locale} messages={messages}>
      <SmoothScrollProvider>
        <div id="eleva-care-marketing" className="relative">
          <Header />
          {children}
          <Footer />
        </div>
      </SmoothScrollProvider>
    </IntlProvider>
  );
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * CRITICAL: Disable dynamic params to prevent route conflicts
 *
 * With `dynamicParams = false`:
 * - Only values from generateStaticParams are valid for [locale]
 * - `/en/about` ✓ matches (en is in locales)
 * - `/foo/about` ✗ doesn't match (foo is not in locales)
 *
 * This ensures all marketing and docs routes require a valid locale prefix.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamicparams
 */
export const dynamicParams = false;
