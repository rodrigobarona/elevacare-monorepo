import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@eleva/ui/components/avatar"
import {
  getAvatarFallbackStyle,
  getAvatarInitials,
} from "@eleva/ui/lib/avatar-utils"
import { cn } from "@eleva/ui/lib/utils"

export function ExpertAvatar({
  displayName,
  username,
  avatarUrl,
  isPriority = false,
  className,
}: {
  displayName: string
  username: string
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
      <AvatarFallback
        className="font-semibold text-white"
        style={getAvatarFallbackStyle(username)}
        aria-hidden
      >
        {getAvatarInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  )
}
