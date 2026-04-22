import { Skeleton } from '@/components/ui/skeleton';

/**
 * Reusable loading skeleton for booking/calendar interfaces
 * Used across:
 * - Route-level loading.tsx files
 * - Suspense boundaries in booking flows
 * - Calendar availability loading states
 */
export function BookingLoadingSkeleton() {
  return (
    <div className="w-full max-w-5xl rounded-2xl bg-white p-8 shadow-lg">
      {/* Header Skeleton */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-8 w-full" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Calendar Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="space-y-2">
            {/* Calendar header */}
            <div className="flex justify-between">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-6" />
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={`day-${i}`} className="h-10" />
              ))}
            </div>
          </div>
        </div>

        {/* Time Slots Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={`slot-${i}`} className="h-12 rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      {/* Footer Skeleton */}
      <div className="mt-8 space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
    </div>
  );
}

/**
 * Wrapper for booking loading skeleton that centers it on the page
 * Used in route-level loading.tsx files
 */
export function CenteredBookingLoadingSkeleton() {
  return (
    <div className="mx-auto mt-10 flex max-w-5xl flex-col items-center justify-center p-4 md:mt-0 md:h-dvh md:p-6">
      <BookingLoadingSkeleton />
    </div>
  );
}
