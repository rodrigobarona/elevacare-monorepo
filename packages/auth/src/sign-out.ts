export type SignOutOutcome = "left" | "failed"

/**
 * Sign out, then leave the page. A 401 means there was no session, which
 * counts as signed out. Any other error, or a network failure, stays put
 * so the page can say it did not work.
 */
export async function signOutAndLeave(deps: {
  signOut: () => Promise<{ error?: { status?: number } | null }>
  leave: () => void
}): Promise<SignOutOutcome> {
  try {
    const { error } = await deps.signOut()
    if (error && error.status !== 401) return "failed"
  } catch {
    return "failed"
  }
  deps.leave()
  return "left"
}
