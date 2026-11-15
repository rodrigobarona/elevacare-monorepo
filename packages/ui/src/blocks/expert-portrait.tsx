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
 * The profile hero without a photo: the same full-size 4:5 frame as a
 * portrait, filled with a branded teal field and the expert's initials, so
 * the page keeps its weight and layout (PROF-03). Decorative: the name is
 * the page heading.
 */
export function ExpertPortraitFallback({
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
        "relative flex size-full items-center justify-center overflow-hidden bg-linear-to-br from-teal-600 via-teal-700 to-teal-800 text-sand-50",
        className
      )}
    >
      <div className="absolute -top-16 -right-16 size-64 rounded-full bg-teal-500/30 blur-3xl" />
      <div className="absolute -bottom-20 -left-10 size-72 rounded-full bg-amber-200/15 blur-3xl" />
      <span className="relative font-display text-8xl tracking-tight sm:text-9xl">
        {getAvatarInitials(displayName)}
      </span>
    </div>
  )
}
