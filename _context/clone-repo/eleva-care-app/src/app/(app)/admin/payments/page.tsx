/**
 * Admin Payments Page
 *
 * Admin-only page for managing and monitoring expert payment transfers.
 * Supports filtering, sorting, and paginated display of payment records.
 *
 * Authorization: Requires superadmin role (enforced by admin layout + proxy)
 */
import { withAuth } from '@workos-inc/authkit-nextjs';
import { headers } from 'next/headers';
import { Suspense } from 'react';

import { PaymentTransfersClient } from './payment-transfers-client';

// Note: Route is dynamic by default with cacheComponents enabled in Next.js 16

/**
 * Payment transfers management page for administrators
 *
 * @param searchParams - URL search parameters for filtering and pagination
 * @returns Payment transfers table with filters and pagination
 */
export default async function PaymentTransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  await withAuth({ ensureSignedIn: true });

  // Convert search params to query string for API call
  const queryParams = new URLSearchParams();

  // Add all search params to query string
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (value) {
      if (Array.isArray(value)) {
        for (const v of value) {
          queryParams.append(key, v);
        }
      } else {
        queryParams.append(key, value);
      }
    }
  }

  // Add default values if not provided
  if (!resolvedSearchParams.page) queryParams.set('page', '1');
  if (!resolvedSearchParams.limit) queryParams.set('limit', '10');
  if (!resolvedSearchParams.sortBy) queryParams.set('sortBy', 'scheduledTransferTime');
  if (!resolvedSearchParams.sortDirection) queryParams.set('sortDirection', 'desc');

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Manage Payments</h1>
        <p className="text-muted-foreground">Manage and monitor payments to experts</p>
      </div>

      <Suspense fallback={<PaymentTransfersLoading />}>
        <PaymentTransfersList queryParams={queryParams.toString()} />
      </Suspense>
    </div>
  );
}

/**
 * Server component to fetch and display payment transfers
 *
 * @param queryParams - Query string for filtering and pagination
 * @returns Payment transfers list or error message
 */
async function PaymentTransfersList({ queryParams }: { queryParams: string }) {
  // Admin auth is handled by layout, just fetch the data
  // Fetch payment transfers data with forwarded cookies for authentication
  const headersList = await headers();
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/payment-transfers?${queryParams}`,
    {
      cache: 'no-store',
      headers: {
        cookie: headersList.get('cookie') || '',
      },
    },
  );

  if (!response.ok) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold">Error loading payment transfers</h2>
        <p className="text-muted-foreground">
          Status: {response.status} {response.statusText}
        </p>
      </div>
    );
  }

  const data = await response.json();

  return <PaymentTransfersClient data={data} />;
}

/**
 * Loading skeleton for payment transfers list
 *
 * Displayed via Suspense while data is being fetched.
 */
function PaymentTransfersLoading() {
  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center space-x-4">
        <div className="h-8 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-8 w-40 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="rounded-lg border">
        <div className="h-12 border-b bg-gray-50" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse border-b bg-gray-50 opacity-70 last:border-0"
          />
        ))}
      </div>
    </div>
  );
}
