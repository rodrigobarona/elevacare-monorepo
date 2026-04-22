import type { ReactNode } from 'react';

/**
 * Trust Section Layout
 *
 * Provides a centered container with consistent padding for trust & security documents.
 * Used by security policy, DPA, and other trust-related pages.
 *
 * @param children - Trust page content to render
 * @returns Layout wrapper with responsive padding
 *
 * @example
 * ```tsx
 * // Used by Next.js App Router to wrap trust pages
 * <TrustLayout>
 *   <SecurityPage />
 * </TrustLayout>
 * ```
 */
export default function TrustLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
      {children}
    </div>
  );
}
