import { PlatformDisclaimer } from '@/components/shared/ui-utilities/PlatformDisclaimer';
import { Button } from '@/components/ui/button';
import { ClipboardList } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';

import { HeroVideo } from './HeroVideo';

/**
 * Mux video asset configuration
 * Uploaded via next-video sync to Mux CDN
 */
const MUX_PLAYBACK_ID = 'Ol6kzy3beOk2U4RHBssK2n7wtDlqHLWvmOPWH01VOVwA';
const MUX_POSTER_URL = `https://image.mux.com/${MUX_PLAYBACK_ID}/thumbnail.webp?time=0`;

/**
 * Parse simple markdown italic syntax (*text*) to JSX
 * Lightweight alternative to ReactMarkdown for single-use case
 *
 * @param text - Text with optional *italic* markers
 * @returns JSX with <em> tags for italic text
 */
function parseItalics(text: string): React.ReactNode[] {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

/**
 * Hero - Server Component for the homepage hero section
 *
 * Performance optimizations:
 * - Server Component: No client-side hydration overhead for static content
 * - Removed ReactMarkdown: ~50KB bundle reduction, using lightweight parseItalics
 * - HeroVideo client component: Only video logic ships to client
 * - Optimized image: Uses Next.js Image with Mux CDN
 *
 * The video player is conditionally rendered based on cookie consent
 * and lazy-loaded when it enters the viewport.
 */
const Hero = async () => {
  const t = await getTranslations('hero');

  return (
    <section
      className="lg:rounded-5xl relative m-2 min-h-[600px] overflow-hidden rounded-2xl bg-eleva-neutral-900 lg:min-h-[720px]"
      data-component-name="hero"
    >
      {/* Priority load poster image for instant FCP - always visible as fallback */}
      <Image
        src={MUX_POSTER_URL}
        alt="Eleva Care Hero"
        fill
        priority
        fetchPriority="high"
        quality={75}
        className="lg:rounded-5xl rounded-2xl object-cover"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1920px"
        placeholder="blur"
        blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMxYTI2MmQiLz48L3N2Zz4="
      />

      {/* Mux Video Player - Client component, only loads after cookie consent */}
      <HeroVideo />

      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 z-10 bg-eleva-neutral-900/40" />

      {/* Hero content */}
      <div className="relative z-20 px-4 lg:px-6">
        <div className="mx-auto flex max-w-2xl flex-col justify-end pt-44 lg:max-w-7xl lg:justify-between lg:pt-72">
          <div>
            <h1 className="max-w-5xl text-balance font-serif text-5xl/[0.9] font-light tracking-tight text-eleva-neutral-100 lg:text-8xl/[.9]">
              {parseItalics(t('title'))}
            </h1>
          </div>
          <div>
            <p className="mb-4 mt-8 max-w-lg text-balance font-sans text-xl/6 font-light text-eleva-neutral-100 lg:mb-8 lg:mt-16 lg:text-2xl/7">
              {t('subtitle')}
            </p>
          </div>
          <div className="flex flex-col justify-between lg:mb-20 lg:flex-row">
            <div className="items-center gap-x-4 sm:flex">
              <div>
                <Button
                  asChild
                  className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-full border border-transparent bg-eleva-neutral-100 px-8 py-[1.3rem] text-base font-semibold text-eleva-neutral-900 shadow-md hover:bg-eleva-neutral-100/70 lg:w-min lg:py-6 lg:text-lg lg:font-bold"
                >
                  <Link href="#experts">{t('cta2')}</Link>
                </Button>
              </div>
              <div className="mt-2 max-w-xs text-balance text-center text-xs font-light text-eleva-neutral-100/90 lg:mt-0 lg:text-left lg:text-sm/[1.3]">
                {t('disclaimer')}{' '}
                <PlatformDisclaimer>
                  <button className="inline-flex items-center underline decoration-eleva-neutral-100/50 underline-offset-2 transition-colors hover:text-eleva-neutral-100 hover:decoration-eleva-neutral-100">
                    {t('disclaimerLink')}
                  </button>
                </PlatformDisclaimer>
              </div>
            </div>
            <div>
              <Link href="https://patimota.typeform.com/to/XNQHJbgT" target="_blank">
                <Button className="mb-7 mt-5 inline-flex w-full items-center justify-center whitespace-nowrap rounded-full border border-eleva-neutral-100/30 bg-eleva-neutral-100/40 p-5 text-sm font-medium text-eleva-neutral-900 shadow-xs hover:bg-eleva-neutral-100/50 md:w-auto lg:my-0 lg:bg-eleva-neutral-100/10 lg:p-6 lg:text-eleva-neutral-100 lg:shadow-none lg:hover:text-eleva-neutral-900">
                  <ClipboardList className="mr-2 h-5 w-5" />
                  {t('cta1')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
