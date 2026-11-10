import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@eleva/ui/components/avatar"
import { getAvatarInitials } from "@eleva/ui/lib/avatar-utils"
import { cn } from "@eleva/ui/lib/utils"

export function ExpertAvatar({
  displayName,
  avatarUrl,
  isPriority = false,
  className,
}: {
  displayName: string
  avatarUrl: string | null
  /** Above-the-fold avatar (profile hero): load eagerly for LCP. */
  isPriority?: boolean
  className?: string
}) {
  return (
    <Avatar className={cn("size-14", className)}>
      {avatarUrl ? (
        <AvatarImage
          src={avatarUrl}
          alt=""
          loading={isPriority ? "eager" : "lazy"}
          fetchPriority={isPriority ? "high" : "auto"}
          decoding="async"
          width={160}
          height={160}
        />
      ) : null}
      {/* The same monogram as profiles and directory tiles: one expert
          avatar style everywhere. */}
      <AvatarFallback
        className="border border-teal-200 bg-linear-to-br from-sand-50 via-sand-100 to-teal-50 font-display text-teal-800 dark:border-teal-800 dark:from-teal-950 dark:via-neutral-900 dark:to-teal-950 dark:text-teal-200"
        aria-hidden
      >
        {getAvatarInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  )
}
