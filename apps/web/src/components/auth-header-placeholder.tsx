import { Skeleton } from "@eleva/ui/components/skeleton"

/** Matches UserMenu avatar size to avoid header layout shift while auth resolves. */
export function AuthHeaderPlaceholder() {
  return (
    <Skeleton className="size-8 shrink-0 rounded-full" aria-hidden="true" />
  )
}
