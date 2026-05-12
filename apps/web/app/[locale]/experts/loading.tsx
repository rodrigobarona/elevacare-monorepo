import { Skeleton } from "@eleva/ui/components/skeleton"

/**
 * Route-level loading UI for /:locale/experts.
 *
 * The page is a single async server component that awaits translations,
 * categories, and a paginated experts query before any HTML can stream.
 * Without this file, client-side navigations show the previous page until
 * everything resolves; with it, Next.js renders this skeleton instantly
 * inside the [locale] layout's <Suspense> boundary while the data loads.
 *
 * Layout mirrors `experts/page.tsx`:
 *   - hero band: title, subtitle, filter row
 *   - results band: results-count line, card grid (3 cols on lg)
 */
export default function ExpertsLoading() {
  return (
    <div className="min-h-svh bg-muted/30">
      <section className="border-b border-border/60 bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <Skeleton className="h-9 w-64 sm:h-11 sm:w-80" />
          <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
          <Skeleton className="mt-2 h-4 w-3/4 max-w-xl" />
          <div className="mt-8 flex flex-wrap gap-3">
            <Skeleton className="h-10 w-full max-w-sm" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Skeleton className="mb-6 h-4 w-40" />
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <ExpertCardSkeleton />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function ExpertCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-start gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-5 h-9 w-28" />
    </div>
  )
}
