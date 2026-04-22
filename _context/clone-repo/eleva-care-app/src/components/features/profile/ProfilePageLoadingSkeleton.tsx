import { Skeleton } from '@/components/ui/skeleton';

/**
 * Profile column skeleton - Reusable for profile loading state
 * Matches the actual profile layout with image, name, headline, bio, and social links
 */
export function ProfileColumnSkeleton() {
  return (
    <div className="space-y-6">
      {/* Profile Image Skeleton */}
      <div className="relative aspect-18/21 w-full overflow-hidden rounded-lg">
        <Skeleton className="h-full w-full" />
      </div>

      <div className="space-y-12">
        <div>
          {/* Name Skeleton */}
          <Skeleton className="mb-2 h-9 w-48" />
          {/* Headline Skeleton */}
          <Skeleton className="h-5 w-32" />
          {/* Categories/Tags Skeleton */}
          <div className="mt-2 flex flex-wrap gap-2">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>
        </div>

        <div className="space-y-4">
          {/* "About me" title with social links */}
          <div className="flex w-full items-center justify-between">
            <Skeleton className="h-7 w-32" />
            <div className="flex gap-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          </div>

          {/* Bio Skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[85%]" />
            <Skeleton className="h-4 w-[80%]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Event cards list skeleton - For the right column
 * Shows a title and multiple event cards
 */
export function EventCardsListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-6">
      {/* Section Title Skeleton */}
      <Skeleton className="h-8 w-48" />

      {/* Event Cards Skeleton */}
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`event-${i}`}
          className="space-y-4 rounded-xl border border-eleva-neutral-200 p-6"
        >
          {/* Event Title */}
          <Skeleton className="h-6 w-3/4" />
          {/* Event Meta (duration, price) */}
          <div className="flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          {/* Event Description */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          {/* Book Button */}
          <Skeleton className="h-10 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Complete profile page loading skeleton
 * Two-column layout: Profile info (left) + Event cards (right)
 * Used in route-level loading.tsx and Suspense boundaries
 */
export function ProfilePageLoadingSkeleton() {
  return (
    <div className="container max-w-7xl pb-10 pt-32">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[400px_1fr]">
        {/* Left Column - Profile */}
        <ProfileColumnSkeleton />

        {/* Right Column - Events */}
        <EventCardsListSkeleton count={3} />
      </div>
    </div>
  );
}
