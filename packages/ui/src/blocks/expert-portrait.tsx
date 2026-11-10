import { ExpertCardInitials } from "@eleva/ui/blocks/expert-card"
import { getAvatarInitials } from "@eleva/ui/lib/avatar-utils"
import { cn } from "@eleva/ui/lib/utils"

/** Fills its parent with the expert photo, or a calm monogram tile. */
export function ExpertPortrait({
  displayName,
  avatarUrl,
  isPriority = false,
  className,
}: {
  displayName: string
  avatarUrl: string | null
  /** Above-the-fold portrait (profile hero): load eagerly for LCP. */
  isPriority?: boolean
  className?: string
}) {
  if (!avatarUrl) {
    return (
      <ExpertCardInitials
        initials={getAvatarInitials(displayName)}
        className={className}
      />
    )
  }
  return (
    // Expert avatars are user uploads on Blob; sizes vary, so a plain img.
    <img
      src={avatarUrl}
      alt=""
      loading={isPriority ? "eager" : "lazy"}
      fetchPriority={isPriority ? "high" : "auto"}
      decoding="async"
      width={640}
      height={480}
      className={cn("size-full object-cover", className)}
    />
  )
}

/**
 * A round monogram for an expert with no photo, sized by its parent's
 * class (the profile hero uses 112 px). Replaces a full-size empty frame.
 */
export function ExpertMonogram({
  displayName,
  className,
}: {
  displayName: string
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-28 shrink-0 items-center justify-center rounded-full border border-teal-200 bg-linear-to-br from-sand-50 via-sand-100 to-teal-50 font-display text-4xl text-teal-800 shadow-2 dark:border-teal-800 dark:from-teal-950 dark:via-neutral-900 dark:to-teal-950 dark:text-teal-200",
        className
      )}
    >
      {getAvatarInitials(displayName)}
    </div>
  )
}
