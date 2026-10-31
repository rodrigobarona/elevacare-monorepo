import { mediaKeyFromUrl } from "@eleva/config/media-host"
import {
  UploadRejectedError,
  verifyUpload,
} from "@eleva/storage/upload-handler"

/**
 * Replaces Blob's upload-completed callback for public objects. Routes that
 * record a public URL call this first, so a caller cannot skip the size and
 * type check by going straight to the recording route.
 */
export async function isVerifiedPublicUpload(
  url: string,
  limits: { contentTypes: readonly string[]; maxBytes: number },
  isOwnUrl: (url: string) => boolean
): Promise<boolean> {
  const pathname = mediaKeyFromUrl(url)
  if (!pathname || !isOwnUrl(url)) return false
  try {
    await verifyUpload({
      store: "public",
      pathname,
      allowedContentTypes: limits.contentTypes,
      maxBytes: limits.maxBytes,
    })
    return true
  } catch (err) {
    if (err instanceof UploadRejectedError) return false
    throw err
  }
}
