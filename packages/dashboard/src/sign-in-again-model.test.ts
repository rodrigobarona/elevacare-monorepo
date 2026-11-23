import { describe, expect, it } from "vitest"
import { consoleReturnPath, toGatewayCallbackURL } from "@eleva/auth/return-to"
import {
  canKeepDrafts,
  DRAFT_MAX_AGE_MS,
  dropDraft,
  keepDraft,
  returnDraft,
  signInAgainUrl,
  sweepDrafts,
  takeDraft,
  type DraftStorage,
  type KeptDraft,
} from "./sign-in-again-model"

function memoryStorage(): DraftStorage & { size: () => number } {
  const kept = new Map<string, string>()
  return {
    getItem: (key) => kept.get(key) ?? null,
    setItem: (key, value) => void kept.set(key, value),
    removeItem: (key) => void kept.delete(key),
    key: (index) => [...kept.keys()][index] ?? null,
    get length() {
      return kept.size
    },
    size: () => kept.size,
  }
}

/** A browser that refuses storage (private mode, blocked site data). */
const refusing: DraftStorage = {
  getItem: () => {
    throw new Error("blocked")
  },
  setItem: () => {
    throw new Error("blocked")
  },
  removeItem: () => {
    throw new Error("blocked")
  },
  key: () => {
    throw new Error("blocked")
  },
  get length(): number {
    throw new Error("blocked")
  },
}

const KEY = "eleva.decision-draft:clinic:1"
const KEPT_AT = Date.parse("2026-11-23T10:00:00.000Z")
const draft: KeptDraft = {
  ownerId: "staff-1",
  version: "2026-11-20T10:00:00.000Z",
  ticks: ["legal_entity_checked", "tax_id_checked"],
  text: "The NIF belongs to another company.",
  keptAt: KEPT_AT,
}
// Two minutes later: the time signing in again takes.
const now = {
  ownerId: "staff-1",
  version: draft.version,
  ticks: ["legal_entity_checked", "tax_id_checked"],
  maxText: 1000,
  now: KEPT_AT + 2 * 60 * 1000,
}

describe("keeping a draft while someone signs in", () => {
  it("keeps it, gives it back once, and leaves nothing behind", () => {
    const storage = memoryStorage()
    expect(keepDraft(storage, KEY, draft)).toBe(true)
    expect(takeDraft(storage, KEY)).toEqual(draft)
    expect(takeDraft(storage, KEY)).toBeNull()
    expect(storage.size()).toBe(0)
  })

  it("is one draft per task", () => {
    const storage = memoryStorage()
    keepDraft(storage, KEY, draft)
    expect(takeDraft(storage, "eleva.decision-draft:clinic:2")).toBeNull()
    expect(takeDraft(storage, KEY)).toEqual(draft)
  })

  it("says so when the browser will not keep it, and never throws", () => {
    expect(canKeepDrafts(memoryStorage())).toBe(true)
    expect(canKeepDrafts(null)).toBe(false)
    expect(canKeepDrafts(refusing)).toBe(false)
    expect(keepDraft(refusing, KEY, draft)).toBe(false)
    expect(keepDraft(null, KEY, draft)).toBe(false)
    expect(takeDraft(refusing, KEY)).toBeNull()
    expect(() => dropDraft(refusing, KEY)).not.toThrow()
  })

  it("the probe leaves nothing in storage", () => {
    const storage = memoryStorage()
    canKeepDrafts(storage)
    expect(storage.size()).toBe(0)
  })

  it("reads nothing from a value that is not a draft, and removes it", () => {
    const storage = memoryStorage()
    for (const value of [
      "not json",
      "null",
      "[]",
      JSON.stringify({ ownerId: "staff-1" }),
      JSON.stringify({ ...draft, ticks: [1, 2] }),
      JSON.stringify({ ...draft, text: 5 }),
      JSON.stringify({ ...draft, keptAt: "yesterday" }),
    ]) {
      storage.setItem(KEY, value)
      expect(takeDraft(storage, KEY), value).toBeNull()
      expect(storage.size(), value).toBe(0)
    }
  })

  it("is dropped after a decision", () => {
    const storage = memoryStorage()
    keepDraft(storage, KEY, draft)
    dropDraft(storage, KEY)
    expect(takeDraft(storage, KEY)).toBeNull()
  })
})

describe("drafts nobody came back for", () => {
  it("are removed after an hour, with anything unreadable; the rest stay", () => {
    const storage = memoryStorage()
    const prefix = "eleva.decision-draft:"
    keepDraft(storage, `${prefix}clinic:fresh`, draft)
    keepDraft(storage, `${prefix}clinic:old`, {
      ...draft,
      keptAt: KEPT_AT - DRAFT_MAX_AGE_MS - 1,
    })
    storage.setItem(`${prefix}expert:broken`, "not json")
    storage.setItem("something-else", "kept")
    expect(sweepDrafts(storage, prefix, KEPT_AT)).toBe(2)
    expect(storage.getItem(`${prefix}clinic:fresh`)).not.toBeNull()
    expect(storage.getItem(`${prefix}clinic:old`)).toBeNull()
    expect(storage.getItem(`${prefix}expert:broken`)).toBeNull()
    expect(storage.getItem("something-else")).toBe("kept")
  })

  it("never throws where storage is refused", () => {
    expect(sweepDrafts(refusing, "eleva.decision-draft:", KEPT_AT)).toBe(0)
    expect(sweepDrafts(null, "eleva.decision-draft:", KEPT_AT)).toBe(0)
  })
})

describe("what a returning person gets back", () => {
  it("everything, on the details they checked", () => {
    expect(returnDraft(draft, now)).toEqual({
      kind: "restored",
      ticks: draft.ticks,
      text: draft.text,
    })
  })

  it("nothing when there is no draft", () => {
    expect(returnDraft(null, now)).toEqual({ kind: "none" })
  })

  it("nothing when someone else signed in", () => {
    expect(returnDraft(draft, { ...now, ownerId: "staff-2" })).toEqual({
      kind: "none",
    })
  })

  it("the reason but not the ticks when the details changed meanwhile", () => {
    // Ticks say "I checked these details": never carried onto new ones.
    expect(
      returnDraft(draft, { ...now, version: "2026-11-21T09:00:00.000Z" })
    ).toEqual({ kind: "changed", ticks: [], text: draft.text })
  })

  it("nothing once the draft is an abandoned one", () => {
    // An hour covers a slow sign-in; after that it is not a task in progress.
    expect(
      returnDraft(draft, { ...now, now: KEPT_AT + DRAFT_MAX_AGE_MS })
    ).toMatchObject({ kind: "restored" })
    // Their own draft, with something in it: told, not silently dropped.
    expect(
      returnDraft(draft, { ...now, now: KEPT_AT + DRAFT_MAX_AGE_MS + 1 })
    ).toEqual({ kind: "lapsed" })
    // A draft from the future is a clock that changed: not trusted.
    expect(returnDraft(draft, { ...now, now: KEPT_AT - 1 })).toEqual({
      kind: "lapsed",
    })
    // Nothing had been entered: nothing to say.
    expect(
      returnDraft(
        { ...draft, ticks: [], text: "" },
        { ...now, now: KEPT_AT + DRAFT_MAX_AGE_MS + 1 }
      )
    ).toEqual({ kind: "none" })
    // Someone else's old draft is still nobody's business.
    expect(
      returnDraft(draft, {
        ...now,
        ownerId: "staff-2",
        now: KEPT_AT + DRAFT_MAX_AGE_MS + 1,
      })
    ).toEqual({ kind: "none" })
  })

  it("says nothing was entered when nothing was", () => {
    expect(returnDraft({ ...draft, ticks: [], text: "  " }, now)).toEqual({
      kind: "empty",
    })
  })

  it("only ticks the form still has, and no more text than the field takes", () => {
    expect(
      returnDraft(
        {
          ...draft,
          ticks: ["tax_id_checked", "made_up"],
          text: "x".repeat(50),
        },
        { ...now, maxText: 10 }
      )
    ).toEqual({
      kind: "restored",
      ticks: ["tax_id_checked"],
      text: "x".repeat(10),
    })
  })
})

describe("signInAgainUrl", () => {
  const url = new URL(
    signInAgainUrl({
      loginUrl: "https://eleva.care/login",
      consolePath: "/clinics/00000000-0000-4000-8000-000000000001",
      email: "ana+staff@eleva.care",
    })
  )

  it("goes to the sign-in page with the email filled in", () => {
    expect(`${url.origin}${url.pathname}`).toBe("https://eleva.care/login")
    expect(url.searchParams.get("email")).toBe("ana+staff@eleva.care")
  })

  it("comes back to the same console page through the gateway", () => {
    // What the sign-in page does with it, then what /dashboard reads.
    const callback = new URL(
      toGatewayCallbackURL(
        url.searchParams.get("returnTo"),
        "https://eleva.care"
      )
    )
    expect(`${callback.origin}${callback.pathname}`).toBe(
      "https://eleva.care/dashboard"
    )
    expect(consoleReturnPath(callback.searchParams.get("console"))).toBe(
      "/clinics/00000000-0000-4000-8000-000000000001"
    )
  })
})
