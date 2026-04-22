'use client';

import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';

interface SmoothScrollContextType {
  scrollTo: (target: string | number, options?: { offset?: number }) => void;
}

const SmoothScrollContext = createContext<SmoothScrollContextType>({
  scrollTo: () => {},
});

export const useSmoothScroll = () => useContext(SmoothScrollContext);

interface SmoothScrollProviderProps {
  children: React.ReactNode;
}

/**
 * SmoothScrollProvider - Native CSS smooth scrolling
 *
 * Uses native browser APIs for smooth scrolling:
 * - CSS scroll-behavior: smooth (via Tailwind's scroll-smooth class on HTML)
 * - CSS scroll-margin-top: 120px (for header offset, defined in globals.css)
 * - scrollIntoView() for programmatic scrolling
 * - window.scrollTo() for pixel-based scrolling
 *
 * Benefits:
 * - Zero bundle size impact (no external library)
 * - No main thread blocking
 * - Respects user's prefers-reduced-motion preference
 * - Browser-native, accessible by default
 */
export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  const pathname = usePathname();

  // Handle hash navigation after route changes
  useEffect(() => {
    const handleHashScroll = () => {
      const hash = window.location.hash;
      if (!hash) return;

      // Wait for DOM to be ready
      requestAnimationFrame(() => {
        const element = document.querySelector(hash);
        if (element) {
          // scrollIntoView uses CSS scroll-margin-top for offset
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    };

    // Handle initial hash on page load (with small delay for hydration)
    const timeoutId = setTimeout(handleHashScroll, 100);

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashScroll);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('hashchange', handleHashScroll);
    };
  }, [pathname]);

  const scrollTo = useCallback((target: string | number) => {
    if (typeof target === 'number') {
      // Scroll to pixel position
      window.scrollTo({ top: target, behavior: 'smooth' });
      return;
    }

    // Scroll to element (selector string)
    const element = document.querySelector(target);
    if (element) {
      // Update URL hash without triggering scroll (we handle scroll ourselves)
      if (target.startsWith('#')) {
        history.pushState(null, '', target);
      }
      // scrollIntoView uses CSS scroll-margin-top (120px) for header offset
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const contextValue: SmoothScrollContextType = useMemo(
    () => ({ scrollTo }),
    [scrollTo],
  );

  return (
    <SmoothScrollContext.Provider value={contextValue}>{children}</SmoothScrollContext.Provider>
  );
}
