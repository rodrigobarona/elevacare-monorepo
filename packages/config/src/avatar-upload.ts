import { mediaKeyFromUrl } from "./media-host.mjs"

export const AVATAR_UPLOAD = {
  prefix: "avatar",
  kind: "profile",
  contentTypes: ["image/jpeg", "image/png", "image/webp"],
  maxBytes: 2 * 1024 * 1024,
} as const

/** Object key for an account avatar: `avatar/profile/<file>`. */
export const AVATAR_PATHNAME = new RegExp(
  `^${AVATAR_UPLOAD.prefix}/${AVATAR_UPLOAD.kind}/[^/]+$`
)

/** Avatars must be in the public bucket under the avatar path. */
export function isAvatarUrl(url: string): boolean {
  const key = mediaKeyFromUrl(url)
  return key !== null && AVATAR_PATHNAME.test(key)
}
