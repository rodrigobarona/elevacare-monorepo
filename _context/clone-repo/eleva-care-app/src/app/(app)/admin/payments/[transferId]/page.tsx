import { withAuth } from '@workos-inc/authkit-nextjs';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { TransferDetailsClient } from './transfer-details-client';

// Note: Route is dynamic by default with cacheComponents enabled in Next.js 16

export default async function TransferDetailsPage({
  params,
}: {
  params: Promise<{ transferId: string }>;
}) {
  const resolvedParams = await params;
  await withAuth({ ensureSignedIn: true });

  return (
    <div className="container py-8">
      <div className="mb-8">
        <Link
          href="/admin/payments"
          className="mb-4 inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Transfers
        </Link>

        <h1 className="mb-2 text-3xl font-bold">Payment Transfer Details</h1>
        <p className="text-muted-foreground">Transfer #{resolvedParams.transferId}</p>
      </div>

      <Suspense fallback={<TransferDetailsLoading />}>
        <TransferDetails transferId={resolvedParams.transferId} />
      </Suspense>
    </div>
  );
}

// Server component to fetch and display transfer details
async function TransferDetails({ transferId }: { transferId: string }) {
  // Admin auth is handled by layout, just fetch the data
  // Fetch transfer details
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/payment-transfers/${transferId}`,
    {
      cache: 'no-store',
    },
  );

  if (response.status === 404) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold">Transfer Not Found</h2>
        <p className="text-muted-foreground">
          The requested transfer does not exist or has been deleted.
        </p>
      </div>
    );
  }

  if (!response.ok) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold">Error loading transfer details</h2>
        <p className="text-muted-foreground">
          Status: {response.status} {response.statusText}
        </p>
      </div>
    );
  }

  const data = await response.json();

  return <TransferDetailsClient transfer={data} />;
}

// Loading state component
function TransferDetailsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex space-x-4">
        <div className="h-8 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg border bg-gray-50" />
        <div className="h-64 animate-pulse rounded-lg border bg-gray-50" />
      </div>
    </div>
  );
}
