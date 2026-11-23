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
export type DraftStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>

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
  /** When it was kept (`Date.now()`): a draft is not given back for ever. */
  keptAt: number
}

/**
 * How long a kept draft is given back. Signing in again takes a minute or
 * two; an hour covers a slow one, and after that what is in the tab is an
 * abandoned draft, not a task in progress.
 */
export const DRAFT_MAX_AGE_MS = 60 * 60 * 1000

/** What a returning person gets back. */
export type DraftReturn =
  /** No draft for this task, or it was someone else's. */
  | { kind: "none" }
  /** They left to sign in with nothing entered. */
  | { kind: "empty" }
  /**
   * Their own draft, with something in it, kept too long ago to give
   * back: they are told, so it does not vanish without a word.
   */
  | { kind: "lapsed" }
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
    typeof draft.keptAt === "number" &&
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
 * never given back, nor one kept more than `DRAFT_MAX_AGE_MS` ago (their
 * own is then `lapsed`, so they can be told). The text always is; the
 * ticks only when they were made on the details now shown, and only those
 * the form still has.
 */
export function returnDraft(
  draft: KeptDraft | null,
  now: {
    ownerId: string
    version: string
    ticks: readonly string[]
    maxText: number
    /** The time now (`Date.now()`). */
    now: number
  }
): DraftReturn {
  if (!draft || draft.ownerId !== now.ownerId) return { kind: "none" }
  const text = draft.text.slice(0, now.maxText)
  const ticks = draft.ticks.filter((tick) => now.ticks.includes(tick))
  const nothing = ticks.length === 0 && text.trim() === ""
  const age = now.now - draft.keptAt
  // A draft from the future is a clock that changed: not trusted either.
  if (age < 0 || age > DRAFT_MAX_AGE_MS) {
    return nothing ? { kind: "none" } : { kind: "lapsed" }
  }
  if (nothing) return { kind: "empty" }
  if (draft.version !== now.version) return { kind: "changed", ticks: [], text }
  return { kind: "restored", ticks, text }
}

/**
 * Removes every draft under `prefix` that was kept more than
 * `DRAFT_MAX_AGE_MS` ago, belongs to someone other than `ownerId`, or
 * cannot be read. It runs when a page that uses drafts opens, so a draft
 * nobody came back for stays until then, or until the tab closes: storage
 * cannot be cleaned from a page that is not open. Returns how many were
 * removed.
 */
export function sweepDrafts(
  storage: DraftStorage | null,
  prefix: string,
  now: number,
  ownerId: string
): number {
  if (!storage) return 0
  try {
    const stale: string[] = []
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (!key?.startsWith(prefix)) continue
      let draft: unknown = null
      try {
        draft = JSON.parse(storage.getItem(key) ?? "null")
      } catch {
        // Not a draft: removed below.
      }
      const age =
        isDraft(draft) && draft.ownerId === ownerId
          ? now - draft.keptAt
          : Number.NaN
      if (!(age >= 0 && age <= DRAFT_MAX_AGE_MS)) stale.push(key)
    }
    for (const key of stale) storage.removeItem(key)
    return stale.length
  } catch {
    return 0
  }
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
