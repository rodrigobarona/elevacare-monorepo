import { useTranslations } from "next-intl"
import { Skeleton } from "@eleva/ui/components/skeleton"

/** Route-level loading shell for marketplace and booking pages. */
export function PageSkeleton({ variant }: { variant: "list" | "detail" }) {
  const t = useTranslations("states")

  return (
    <div className="flex min-h-dvh flex-col" role="status" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <div className="h-[69px] border-b" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        {variant === "list" ? (
          <>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-10 w-72" />
            <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-32" />
              ))}
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-3xl">
            <div className="flex gap-5">
              <Skeleton className="size-20 shrink-0 rounded-full" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-5 w-full max-w-md" />
              </div>
            </div>
            <Skeleton className="mt-10 h-24" />
            <Skeleton className="mt-6 h-40" />
          </div>
        )}
      </main>
    </div>
  )
}
