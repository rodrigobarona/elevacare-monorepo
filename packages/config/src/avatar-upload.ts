import { mediaKeyFromUrl } from "./media-host.mjs"

export const AVATAR_UPLOAD = {
  prefix: "avatar",
  kind: "profile",
  contentTypes: ["image/jpeg", "image/png", "image/webp"],
  maxBytes: 2 * 1024 * 1024,
} as const

/** Pathname the browser asks for: `avatar/profile/<file>`. */
export const AVATAR_PATHNAME = new RegExp(
  `^${AVATAR_UPLOAD.prefix}/${AVATAR_UPLOAD.kind}/[^/]+$`
)

const avatarFolder = (userId: string) =>
  `${AVATAR_UPLOAD.prefix}/${AVATAR_UPLOAD.kind}/${userId}/`

/**
 * Stored key: `avatar/profile/<userId>/<file>`. The server adds the owner so a
 * profile can only reference (and later delete) its owner's avatar.
 */
export function avatarKey(pathname: string, userId: string): string {
  return `${avatarFolder(userId)}${pathname.slice(pathname.lastIndexOf("/") + 1)}`
}

/** Avatars must be in the public bucket under the owner's avatar folder. */
export function isAvatarUrl(url: string, userId: string): boolean {
  const key = mediaKeyFromUrl(url)
  const folder = avatarFolder(userId)
  return (
    key !== null &&
    key.startsWith(folder) &&
    !key.slice(folder.length).includes("/") &&
    key.length > folder.length
  )
}
