import { consoleReturnTo } from "@eleva/auth/return-to"

/**
 * Signing in again in the middle of a task, and coming back to it with
 * what was entered. The rules only; the screen is `sign-in-again.tsx`.
 *
 * A task that needs a recent sign-in (a staff decision) must not cost the
 * person what they typed: the draft is kept in this tab's session storage
 * while they sign in, and given back to the same person on the same task.
 */

/** The part of `Storage` a draft needs. */
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

/** What a person had entered when they left to sign in. */
export interface KeptDraft {
  /** Who entered it. Nothing is given back to anyone else. */
  ownerId: string
  /**
   * What the ticks were made on (a filing's `submittedAt`). Ticks say "I
   * checked these details", so they are not carried over to new ones.
   */
  version: string
  ticks: string[]
  text: string
}

/** What a returning person gets back. */
export type DraftReturn =
  /** No draft for this task, or it was someone else's. */
  | { kind: "none" }
  /** They left to sign in with nothing entered. */
  | { kind: "empty" }
  | { kind: "restored"; ticks: string[]; text: string }
  /** The details changed while they were away: the ticks are dropped. */
  | { kind: "changed"; ticks: []; text: string }

const PROBE_KEY = "eleva.draft-probe"

/** The tab's session storage, or null where the browser refuses it. */
export function sessionDraftStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage
  } catch {
    return null
  }
}

/**
 * True when a draft written now can be read back: storage can be missing,
 * blocked or full, and a page must not promise to keep what it cannot.
 */
export function canKeepDrafts(storage: DraftStorage | null): boolean {
  if (!storage) return false
  try {
    storage.setItem(PROBE_KEY, "1")
    const kept = storage.getItem(PROBE_KEY) === "1"
    storage.removeItem(PROBE_KEY)
    return kept
  } catch {
    return false
  }
}

/** Keeps a draft for this task. False when the browser would not take it. */
export function keepDraft(
  storage: DraftStorage | null,
  key: string,
  draft: KeptDraft
): boolean {
  if (!storage) return false
  try {
    storage.setItem(key, JSON.stringify(draft))
    return storage.getItem(key) !== null
  } catch {
    return false
  }
}

/** Removes the draft for this task, if there is one. */
export function dropDraft(storage: DraftStorage | null, key: string): void {
  try {
    storage?.removeItem(key)
  } catch {
    // Nothing was kept, so there is nothing to remove.
  }
}

function isDraft(value: unknown): value is KeptDraft {
  if (typeof value !== "object" || value === null) return false
  const draft = value as Record<string, unknown>
  return (
    typeof draft.ownerId === "string" &&
    typeof draft.version === "string" &&
    typeof draft.text === "string" &&
    Array.isArray(draft.ticks) &&
    draft.ticks.every((tick) => typeof tick === "string")
  )
}

/**
 * Takes the draft for this task out of storage: it is given back once, and
 * what the person does next lives on the page. Null when there is none or
 * it cannot be read.
 */
export function takeDraft(
  storage: DraftStorage | null,
  key: string
): KeptDraft | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (raw === null) return null
    storage.removeItem(key)
    const parsed: unknown = JSON.parse(raw)
    return isDraft(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * What to give back to the person now on the page. Someone else's draft is
 * never given back. The text always is; the ticks only when they were made
 * on the details now shown, and only those the form still has.
 */
export function returnDraft(
  draft: KeptDraft | null,
  now: {
    ownerId: string
    version: string
    ticks: readonly string[]
    maxText: number
  }
): DraftReturn {
  if (!draft || draft.ownerId !== now.ownerId) return { kind: "none" }
  const text = draft.text.slice(0, now.maxText)
  const ticks = draft.ticks.filter((tick) => now.ticks.includes(tick))
  if (ticks.length === 0 && text.trim() === "") return { kind: "empty" }
  if (draft.version !== now.version) return { kind: "changed", ticks: [], text }
  return { kind: "restored", ticks, text }
}

/** Milliseconds until `deadline`, never negative. Null when it is not a date. */
export function msUntil(deadline: string | null, now: number): number | null {
  if (!deadline) return null
  const at = Date.parse(deadline)
  if (Number.isNaN(at)) return null
  return Math.max(0, at - now)
}

/**
 * The sign-in address that brings a staff member back to the console page
 * they were on. `consolePath` is a path on the console, without a query:
 * the gateway's `/dashboard` resolves it against the console's own address
 * on the server, so nothing here can point a redirect anywhere else.
 */
export function signInAgainUrl(input: {
  loginUrl: string
  consolePath: string
  email: string
}): string {
  const query = new URLSearchParams({
    returnTo: consoleReturnTo(input.consolePath),
    email: input.email,
  })
  return `${input.loginUrl}?${query.toString()}`
}
