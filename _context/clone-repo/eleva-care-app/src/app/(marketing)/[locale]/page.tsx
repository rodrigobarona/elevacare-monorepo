import { isValidLocale } from '@/app/i18n';
import ExpertsSection from '@/components/sections/home/ExpertsSection';
import Hero from '@/components/sections/home/Hero';
import {
  ApproachSkeleton,
  ExpertsSkeleton,
  ServicesSkeleton,
} from '@/components/shared/loading/HomePageSkeletons';
import { generatePageMetadata } from '@/lib/seo/metadata-utils';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Define the page props
interface PageProps {
  params: Promise<{ locale: string }>;
}

// Fallback metadata for invalid locales or errors
const FALLBACK_METADATA = {
  path: '/',
  title: "Connect with Expert Women's Health Specialists | Eleva Care",
  description:
    "Eleva Care: Find and book trusted women's health experts for pregnancy, postpartum, menopause, and sexual health. A trusted platform connecting you with independent care experts.",
  keywords: [
    'pregnancy care',
    'postpartum support',
    'sexual health',
    'women health',
    'healthcare experts',
    'menopause care',
    'digital health platform',
    'find experts',
  ],
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    // Fallback metadata for invalid locales
    return generatePageMetadata({
      locale: 'en',
      ...FALLBACK_METADATA,
    });
  }

  try {
    const t = await getTranslations({ locale, namespace: 'metadata' });

    // TypeScript doesn't infer types correctly for nested namespaces in metadata functions
    // Cast the translate function to bypass type checking
    const translate = t as any;

    return generatePageMetadata({
      locale,
      path: '/',
      title: translate('title'),
      description: translate('description'),
      ogTitle: translate('og.title') || undefined,
      ogDescription: translate('og.description') || undefined,
      siteName: translate('og.siteName') || undefined,
      keywords: [
        'pregnancy care',
        'postpartum support',
        'sexual health',
        'women health',
        'healthcare experts',
        'menopause care',
      ],
      image: {
        url: '/img/eleva-care-share.png',
        width: 1200,
        height: 680,
        alt: 'Eleva Care - Expert Healthcare for Women',
      },
    });
  } catch (error) {
    console.error('Error generating home page metadata:', error);

    // Fallback metadata using utility
    return generatePageMetadata({
      locale,
      ...FALLBACK_METADATA,
    });
  }
}

// Dynamic imports with proper loading states
// Services and Approach are client components that don't fetch data, use dynamic() to code-split
const ServicesSection = dynamic(() => import('@/components/sections/home/Services'), {
  loading: () => <ServicesSkeleton />,
  ssr: true, // Enable SSR for SEO
});

const ApproachSection = dynamic(() => import('@/components/sections/home/ApproachSection'), {
  loading: () => <ApproachSkeleton />,
  ssr: true, // Enable SSR for SEO
});

export default function HomePage() {
  return (
    <main>
      {/* Hero: Static content, no data fetching, renders immediately */}
      <Hero />

      {/* Services: Client component, code-split with dynamic import */}
      <ServicesSection />

      {/* Approach: Client component, code-split with dynamic import */}
      <ApproachSection />

      {/* Experts: Server component with database queries, wrapped in Suspense */}
      {/* This enables streaming - page shows immediately while experts data loads */}
      <Suspense fallback={<ExpertsSkeleton />}>
        <ExpertsSection />
      </Suspense>
    </main>
  );
}
