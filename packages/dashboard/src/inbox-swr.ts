import type { BareFetcher, KeyedMutator, ScopedMutator } from "swr"

type InboxMutate = ScopedMutator | KeyedMutator<unknown>

/** Revalidate NavBell + InboxPage caches that share this API origin. */
export async function revalidateInboxCaches(
  mutate: InboxMutate,
  apiBaseUrl: string
): Promise<void> {
  await (mutate as ScopedMutator)(
    (key) =>
      Array.isArray(key) &&
      (key[0] === "inbox-bell" || key[0] === "inbox-page") &&
      key[1] === apiBaseUrl,
    undefined as unknown as BareFetcher,
    { revalidate: true }
  )
}
