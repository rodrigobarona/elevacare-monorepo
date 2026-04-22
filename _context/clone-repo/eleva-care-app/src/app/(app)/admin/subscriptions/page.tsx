/**
 * Admin Subscriptions Page
 *
 * Admin-only page for managing Stripe subscription products and pricing.
 * Displays products in a grid with expandable price management.
 *
 * Authorization: Requires superadmin role (enforced by admin layout + proxy)
 */
import { listStripeProducts } from '@/server/actions/stripe-pricing';
import { Metadata } from 'next';

import { ProductsGrid } from './products-grid';

export const metadata: Metadata = {
  title: 'Subscription Management | Admin',
  description: 'Manage Stripe products and pricing for expert and partner subscriptions',
};

/**
 * Subscription management page for administrators
 *
 * @returns Products grid with price management interface
 */
export default async function SubscriptionsPage() {
  // Fetch products server-side
  const productsResult = await listStripeProducts();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subscription Management</h1>
        <p className="text-sm text-muted-foreground">
          Manage Stripe products, prices, and subscription plans for experts and partners.
        </p>
      </div>

      {productsResult.success ? (
        <ProductsGrid products={productsResult.data || []} />
      ) : (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            {productsResult.error || 'Failed to load products'}
          </p>
        </div>
      )}
    </div>
  );
}
