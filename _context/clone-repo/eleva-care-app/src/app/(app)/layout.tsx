import { IntlProvider } from '@/app/providers';
import { AppBreadcrumb } from '@/components/layout/sidebar/AppBreadcrumb';
import { AppSidebar } from '@/components/layout/sidebar/AppSidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/layout/sidebar/sidebar';
import { Separator } from '@/components/ui/separator';
import { defaultLocale, locales } from '@/lib/i18n/routing';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { getMessages } from 'next-intl/server';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

interface PrivateLayoutProps {
  children: ReactNode;
}

/**
 * @file Private Layout for authenticated routes
 * @module app/(app)/layout
 *
 * @component PrivateLayout
 * @description Root layout for all authenticated routes in the (app) route group.
 * Protects routes via WorkOS AuthKit and provides internationalization via IntlProvider.
 *
 * @param {PrivateLayoutProps} props - Component props
 * @param {React.ReactNode} props.children - Child components to render within the layout
 *
 * @returns {Promise<JSX.Element>} The authenticated layout with sidebar and i18n support
 *
 * @example
 * ```tsx
 * // This layout is automatically applied to all routes in (app)/
 * // Usage in a page:
 * export default function DashboardPage() {
 *   return <div>Dashboard content</div>;
 * }
 *
 * // The page will be wrapped with:
 * // <PrivateLayout>
 * //   <DashboardPage />
 * // </PrivateLayout>
 * ```
 *
 * @see {@link withAuth} - WorkOS AuthKit authentication wrapper
 * @see {@link IntlProvider} - Internationalization context provider
 */
export default async function PrivateLayout({ children }: PrivateLayoutProps) {
  // Require authentication - auto-redirects if not logged in
  await withAuth({ ensureSignedIn: true });

  // Get locale from cookie and validate against supported locales
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('ELEVA_LOCALE')?.value;

  // Validate locale against supported locales, fallback to default if invalid
  const locale =
    cookieLocale && locales.includes(cookieLocale as (typeof locales)[number])
      ? cookieLocale
      : defaultLocale;

  // Load messages for the validated locale
  const messages = await getMessages({ locale });

  return (
    <IntlProvider locale={locale} messages={messages}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 rounded-t-xl bg-white">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <AppBreadcrumb />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto rounded-b-xl bg-white p-4 pt-0">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </IntlProvider>
  );
}
