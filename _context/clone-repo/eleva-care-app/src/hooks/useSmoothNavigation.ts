'use client';

import { useSmoothScroll } from '@/components/providers/SmoothScrollProvider';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Hook for smooth navigation with hash support
 *
 * Uses native browser scrolling:
 * - Same-page: scrollIntoView with CSS scroll-margin-top for offset
 * - Cross-page: Navigate then scroll after content loads
 */
export function useSmoothNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { scrollTo } = useSmoothScroll();

  const navigateWithHash = (href: string) => {
    const [path, hash] = href.split('#');

    if (!hash) {
      // No hash, just navigate normally
      router.push(href);
      return;
    }

    // Normalize paths for comparison (remove locale prefixes)
    const normalizeRoute = (route: string) => {
      // Remove locale prefix (e.g., /en, /pt, /es, /br)
      return route.replace(/^\/[a-z]{2}(-[a-z]{2})?/, '') || '/';
    };

    const currentNormalizedPath = normalizeRoute(pathname);
    const targetNormalizedPath = normalizeRoute(path);

    // Check if we're staying on the same page
    if (currentNormalizedPath === targetNormalizedPath) {
      // Same page navigation - scroll using native scrollIntoView
      // CSS scroll-margin-top handles the offset
      scrollTo(`#${hash}`);
      return;
    }

    // Cross-page navigation with hash
    // Navigate to the new page first
    router.push(path);

    // Wait for navigation and content to load, then scroll
    const attemptScroll = (attempt: number = 1) => {
      if (attempt > 4) return; // Max 4 attempts

      setTimeout(() => {
        const element = document.querySelector(`#${hash}`);
        if (element) {
          scrollTo(`#${hash}`);
        } else {
          // Element not found yet, try again
          attemptScroll(attempt + 1);
        }
      }, attempt * 300); // 300ms, 600ms, 900ms, 1200ms
    };

    attemptScroll();
  };

  return { navigateWithHash };
}
