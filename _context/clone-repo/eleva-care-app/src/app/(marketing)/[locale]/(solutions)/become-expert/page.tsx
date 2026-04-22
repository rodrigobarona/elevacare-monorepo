/**
 * Become an Expert Landing Page (Multilingual)
 *
 * CMS-ready architecture with presentation components and MDX content.
 * Follows the same pattern as about/page.tsx for easy Sanity CMS integration.
 *
 * Flow:
 * 1. User lands on /become-expert (or /[locale]/become-expert)
 * 2. Sees benefits, requirements, and CTA in their language from MDX
 * 3. Clicks "Get Started" → redirects to /register?expert=true
 * 4. After registration → auto-creates expert_individual organization
 * 5. Redirects to /setup for guided expert onboarding
 */
import { isValidLocale } from '@/app/i18n';
import BenefitsSection from '@/components/sections/become-expert/BenefitsSection';
import FinalCTASection from '@/components/sections/become-expert/FinalCTASection';
import HeroSection from '@/components/sections/become-expert/HeroSection';
import HowItWorksSection from '@/components/sections/become-expert/HowItWorksSection';
import RequirementsSection from '@/components/sections/become-expert/RequirementsSection';
import type { MDXContentComponent } from '@/types/mdx';
import { locales, type Locale } from '@/lib/i18n/routing';
import { generateGenericPageMetadata } from '@/lib/seo/metadata-utils';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

// Static marketing page - cache for 24 hours
export const revalidate = 86400;

// Define the page props
interface PageProps {
  params: Promise<{ locale: string }>;
}

/** Localized fallback metadata for when MDX import fails */
const fallbackMetadata: Record<Locale, { title: string; description: string }> = {
  en: {
    title: 'Become an Expert - Share Your Knowledge',
    description:
      'Join our community of healthcare professionals, coaches, and consultants. Set your own rates and earn on your schedule.',
  },
  es: {
    title: 'Conviértete en Experto - Comparte tu Conocimiento',
    description:
      'Únete a nuestra comunidad de profesionales de la salud, coaches y consultores. Establece tus tarifas y gana según tu horario.',
  },
  pt: {
    title: 'Torne-se um Especialista - Compartilhe seu Conhecimento',
    description:
      'Junte-se à nossa comunidade de profissionais de saúde, coaches e consultores. Defina suas próprias taxas e ganhe no seu horário.',
  },
  'pt-BR': {
    title: 'Torne-se um Especialista - Compartilhe seu Conhecimento',
    description:
      'Junte-se à nossa comunidade de profissionais de saúde, coaches e consultores. Defina suas próprias taxas e ganhe no seu horário.',
  },
};

/**
 * Generates metadata for the Become an Expert page.
 *
 * Uses a safe locale fallback to 'en' if the provided locale is invalid.
 * Dynamically imports MDX metadata, falling back to localized defaults.
 *
 * @param params - Page parameters containing the locale
 * @returns Promise resolving to Next.js Metadata object
 *
 * @example
 * ```tsx
 * const metadata = await generateMetadata({
 *   params: Promise.resolve({ locale: 'en' })
 * });
 * // Returns: { title: 'Become an Expert...', description: '...', ... }
 * ```
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;

  // Use default locale for metadata if invalid (page component handles redirect)
  const safeLocale = isValidLocale(locale) ? locale : 'en';

  try {
    // Dynamically import metadata from MDX file using Next.js 16 native approach
    const { metadata } = await import(`@/content/become-expert/${safeLocale}.mdx`);

    return generateGenericPageMetadata(
      safeLocale,
      '/become-expert',
      metadata.title,
      metadata.description,
      'primary', // Use primary variant for CTA page
      [
        'become an expert',
        'expert registration',
        'healthcare professional',
        'consultant',
        'coach',
        'earn money',
      ],
    );
  } catch (error) {
    console.error('Error loading metadata from MDX:', error);

    const fallback = fallbackMetadata[safeLocale] || fallbackMetadata.en;

    return generateGenericPageMetadata(
      safeLocale,
      '/become-expert',
      fallback.title,
      fallback.description,
      'primary',
      [
        'become an expert',
        'expert registration',
        'healthcare professional',
        'consultant',
        'coach',
        'earn money',
      ],
    );
  }
}

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * Become an Expert Page Component
 *
 * Renders the expert registration landing page with localized MDX content.
 * Redirects to default locale if the provided locale is invalid.
 *
 * @param params - Page parameters containing the locale
 * @returns JSX element rendering the page content
 */
export default async function BecomeExpertPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    redirect('/become-expert'); // Default locale (en) has no prefix
  }

  // Native Next.js 16 MDX import - Turbopack optimized
  // Dynamic import with proper error handling
  let BecomeExpertContent: MDXContentComponent;
  try {
    const mdxModule = await import(`@/content/become-expert/${locale}.mdx`);
    BecomeExpertContent = mdxModule.default as MDXContentComponent;
  } catch (error) {
    console.error(`Failed to load MDX content for locale ${locale}:`, error);
    return notFound();
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-muted/20 to-background">
      <BecomeExpertContent
        components={{
          HeroSection,
          BenefitsSection,
          HowItWorksSection,
          RequirementsSection,
          FinalCTASection,
        }}
      />
    </div>
  );
}
