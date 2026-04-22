/**
 * Admin Layout
 *
 * Protected layout for admin dashboard pages.
 * Requires superadmin role (verified via WorkOS RBAC).
 *
 * Features:
 * - Sidebar navigation with admin sections
 * - Role-based access control (redirects to /unauthorized if not admin)
 * - Consistent layout across all admin pages
 */
import { isAdmin } from '@/lib/auth/roles.server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { BanknoteIcon, CreditCard, Tag, Users } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

/**
 * Admin layout component that wraps all /admin/* pages
 *
 * @param children - Child page components
 * @returns Admin layout with sidebar navigation
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Require authentication with WorkOS
  await withAuth({ ensureSignedIn: true });

  // Check if user is admin using the centralized isAdmin function
  const userIsAdmin = await isAdmin();

  if (!userIsAdmin) {
    redirect('/unauthorized');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="container flex-1 items-start md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        <aside className="fixed top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 border-r pt-4 pr-4 md:sticky md:block">
          <nav className="relative space-y-2 py-2">
            <h2 className="mb-4 px-2 text-xl font-semibold tracking-tight">Admin Dashboard</h2>
            <div className="space-y-1">
              <Link
                href="/admin/users"
                className="group hover:bg-muted hover:text-foreground flex w-full items-center rounded-md border border-transparent px-2 py-1"
              >
                <Users className="mr-2 h-4 w-4" />
                <span>Users</span>
              </Link>
              <Link
                href="/admin/categories"
                className="group hover:bg-muted hover:text-foreground flex w-full items-center rounded-md border border-transparent px-2 py-1"
              >
                <Tag className="mr-2 h-4 w-4" />
                <span>Categories</span>
              </Link>
              <Link
                href="/admin/payments"
                className="group hover:bg-muted hover:text-foreground flex w-full items-center rounded-md border border-transparent px-2 py-1"
              >
                <BanknoteIcon className="mr-2 h-4 w-4" />
                <span>Manage Payments</span>
              </Link>
              <Link
                href="/admin/subscriptions"
                className="group hover:bg-muted hover:text-foreground flex w-full items-center rounded-md border border-transparent px-2 py-1"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Subscriptions</span>
              </Link>
            </div>
          </nav>
        </aside>
        <main className="flex w-full flex-col overflow-hidden pt-4">{children}</main>
      </div>
    </div>
  );
}
