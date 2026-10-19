import { ExpertCardInitials } from "@eleva/ui/blocks/expert-card"
import {
  getAvatarFallbackStyle,
  getAvatarInitials,
} from "@eleva/ui/lib/avatar-utils"
import { cn } from "@eleva/ui/lib/utils"

/** Fills its parent with the expert photo, or a large initials tile. */
export function ExpertPortrait({
  displayName,
  username,
  avatarUrl,
  isPriority = false,
  className,
}: {
  displayName: string
  username: string
  avatarUrl: string | null
  /** Above-the-fold portrait (profile hero): load eagerly for LCP. */
  isPriority?: boolean
  className?: string
}) {
  if (!avatarUrl) {
    return (
      <ExpertCardInitials
        initials={getAvatarInitials(displayName)}
        style={getAvatarFallbackStyle(username)}
        className={className}
      />
    )
  }
  return (
    // Expert avatars are user uploads on Blob; sizes vary, so a plain img.
    // eslint-disable-next-line @next/next/no-img-element
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
