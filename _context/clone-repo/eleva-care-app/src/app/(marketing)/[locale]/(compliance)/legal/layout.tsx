import type { ReactNode } from 'react';

/**
 * Legal Section Layout
 *
 * Provides a centered container with consistent padding for all legal documents.
 * Used by terms, privacy, cookie policy, and other legal pages.
 *
 * @param children - Legal page content to render
 * @returns Layout wrapper with responsive padding
 *
 * @example
 * ```tsx
 * // Used by Next.js App Router to wrap legal pages
 * <LegalLayout>
 *   <PrivacyPolicyPage />
 * </LegalLayout>
 * ```
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
      {children}
    </div>
  );
}
