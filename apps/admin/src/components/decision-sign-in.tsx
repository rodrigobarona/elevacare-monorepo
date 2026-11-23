"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { authClient, readBrowserSession } from "@eleva/auth/client"
import { signOutAndLeave } from "@eleva/auth/sign-out"
import {
  SignedInAgainNotice,
  SignInAgainNotice,
} from "@eleva/dashboard/sign-in-again"
import {
  canKeepDrafts,
  dropDraft,
  keepDraft,
  returnDraft,
  sessionDraftStorage,
  signInAgainUrl,
  sweepDrafts,
  takeDraft,
  type DraftReturn,
} from "@eleva/dashboard/sign-in-again-model"
import { DECISION_DRAFT_PREFIX } from "@/lib/decision-draft-key"
import { DECISION_TITLE_ID } from "@/lib/decision-title"

/** What a review page knows, on the server, about the reviewer's sign-in. */
export interface DecisionSignIn {
  /**
   * How long this sign-in was still good for a decision when the server
   * drew the page, in milliseconds: zero or less when it was already too
   * old, null when the page could not read when it started. A length of
   * time, not a moment, so the browser's own clock being wrong cannot turn
   * a good sign-in into an old one. The API decides either way: this only
   * lets the page say so before the reviewer writes.
   */
  msLeft: number | null
  /** When that sign-in started, to tell a newer one from it. */
  startedAt: string | null
  /** The rule in hours, from the shared constant, for the sentences. */
  hours: number
  /** The reviewer, and the staff workspace the page was drawn in. */
  reviewer: { id: string; email: string; orgId: string }
  /** The gateway's sign-in page. */
  loginUrl: string
  /** Where this review's draft is kept while the reviewer signs in. */
  draftKey: string
  /** Who sent the details under review, for "sent new details" sentences. */
  subject: "clinic" | "expert"
}

/** What the form has on it now: what a draft is made of. */
export interface DecisionEntries {
  version: string
  ticks: string[]
  text: string
}

/** Which of the two notices a "Sign in again" press came from. */
type Pressed = "banner" | "refusal"

interface DecisionSignInState {
  signIn: DecisionSignIn
  /** True once the sign-in is too old to decide with. */
  expired: boolean
  /** True when it became too old while the page was open. */
  expiredWhileOpen: boolean
  /** How many newer sign-ins this page has learned of since it opened. */
  renewed: number
  /** Whether this browser will keep a draft. Null until the page has looked. */
  canKeep: boolean | null
  leaving: boolean
  /** What went wrong on the last press, and on which notice's button. */
  trouble: { on: Pressed; kind: "signOut" | "write" } | null
  signInAgain: (from: Pressed) => void
  /** The form says how to read what is on it; a draft is made from that. */
  registerEntries: (read: (() => DecisionEntries) | null) => void
}

// Whether this browser keeps a draft: looked at once, in the browser only.
let keepsDrafts: boolean | null = null
const readKeepsDrafts = () =>
  (keepsDrafts ??= canKeepDrafts(sessionDraftStorage()))
const neverChanges = () => () => {}

// The session is asked at most this often, however often the tab is shown.
const PROBE_GAP_MS = 5_000

const DecisionSignInContext = React.createContext<DecisionSignInState | null>(
  null
)

function useDecisionSignInState(): DecisionSignInState {
  const state = React.useContext(DecisionSignInContext)
  if (!state) {
    throw new Error("DecisionSignInScope is missing above this component")
  }
  return state
}

/**
 * Around a review: knows when the reviewer's sign-in stops being good for
 * a decision, and takes them to sign in again without losing what they
 * entered. The banner and the form share it.
 */
export function DecisionSignInScope({
  signIn,
  children,
}: {
  signIn: DecisionSignIn
  children: React.ReactNode
}) {
  // What this page has learned since the server drew it: time gained from
  // a newer sign-in made in another tab, and whether the time has run out.
  // Started over whenever the server draws the page again.
  const [seen, setSeen] = React.useState({
    drawn: signIn,
    gained: 0,
    renewed: 0,
    passed: false,
  })
  if (seen.drawn !== signIn) {
    setSeen({ drawn: signIn, gained: 0, renewed: 0, passed: false })
  }
  const drawnOld = signIn.msLeft !== null && signIn.msLeft + seen.gained <= 0
  const expired = drawnOld || seen.passed
  const expiredWhileOpen = seen.passed

  const probed = React.useSyncExternalStore<boolean | null>(
    neverChanges,
    readKeepsDrafts,
    () => null
  )
  const [leaving, setLeaving] = React.useState(false)
  const [trouble, setTrouble] =
    React.useState<DecisionSignInState["trouble"]>(null)
  // A write that failed at the press, after the probe had said yes.
  const canKeep = trouble?.kind === "write" ? false : probed
  const entriesRef = React.useRef<(() => DecisionEntries) | null>(null)
  const registerEntries = React.useCallback(
    (read: (() => DecisionEntries) | null) => {
      entriesRef.current = read
    },
    []
  )

  // Drafts nobody came back for do not stay in the tab.
  React.useEffect(() => {
    sweepDrafts(sessionDraftStorage(), DECISION_DRAFT_PREFIX, Date.now())
  }, [])

  const gained = seen.gained
  React.useEffect(() => {
    const { msLeft, startedAt, reviewer } = signIn
    if (msLeft === null) return
    const since = Date.now()
    const left = () => msLeft + gained - (Date.now() - since)
    let probing = false
    let probedAt = 0
    let stopped = false

    // Another tab may have signed in again. The session says so without
    // reading the filing again (a read of a filing is recorded) and
    // without touching what is on the form. Only a newer sign-in of the
    // same person, in the same staff workspace, counts.
    const newerSignIn = async (): Promise<number | null> => {
      if (!startedAt || probing || Date.now() - probedAt < PROBE_GAP_MS) {
        return null
      }
      probing = true
      probedAt = Date.now()
      try {
        const now = await readBrowserSession()
        if (
          !now?.startedAt ||
          now.userId !== reviewer.id ||
          now.activeOrganizationId !== reviewer.orgId
        ) {
          return null
        }
        const delta = now.startedAt.getTime() - Date.parse(startedAt)
        return Number.isFinite(delta) && delta > gained ? delta : null
      } finally {
        probing = false
      }
    }

    // A timer alone is not enough: it does not count the hours a laptop
    // slept, which is the "console left open" the rule is about. The page
    // looks again whenever it is shown or comes to the front.
    const look = async (timeIsUp = false) => {
      if (stopped || document.visibilityState !== "visible") return
      if (!timeIsUp && left() > 0) return
      const delta = await newerSignIn()
      if (stopped) return
      setSeen((now) => {
        if (now.drawn !== signIn) return now
        if (delta !== null) {
          return {
            ...now,
            gained: delta,
            renewed: now.renewed + 1,
            passed: false,
          }
        }
        // Old when it was drawn is not "became old while open".
        return msLeft + now.gained <= 0 || now.passed
          ? now
          : { ...now, passed: true }
      })
    }
    const onShown = () => void look()
    const onRestored = (event: PageTransitionEvent) => {
      if (event.persisted) void look()
    }
    // A timer cannot wait longer than about 24 days; 12 hours fits.
    const timer =
      left() > 0 ? window.setTimeout(() => void look(true), left()) : null
    document.addEventListener("visibilitychange", onShown)
    window.addEventListener("focus", onShown)
    window.addEventListener("pageshow", onRestored)
    return () => {
      stopped = true
      if (timer !== null) window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", onShown)
      window.removeEventListener("focus", onShown)
      window.removeEventListener("pageshow", onRestored)
    }
  }, [signIn, gained])

  // Back from the sign-in page to a page the browser kept as it was: the
  // button must not stay on "Opening...".
  React.useEffect(() => {
    const shown = (event: PageTransitionEvent) => {
      if (event.persisted) setLeaving(false)
    }
    window.addEventListener("pageshow", shown)
    return () => window.removeEventListener("pageshow", shown)
  }, [])

  const signInAgain = React.useCallback(
    (from: Pressed) => {
      if (leaving) return
      const storage = sessionDraftStorage()
      const now = entriesRef.current?.()
      const kept = keepDraft(storage, signIn.draftKey, {
        ownerId: signIn.reviewer.id,
        version: now?.version ?? "",
        ticks: now?.ticks ?? [],
        text: now?.text ?? "",
        keptAt: Date.now(),
      })
      const entered = Boolean(now && (now.ticks.length > 0 || now.text.trim()))
      // The browser took no draft although the page had said it would: the
      // reviewer is told to copy their reason, and leaves on the next press.
      if (!kept && entered && canKeep !== false) {
        setTrouble({ on: from, kind: "write" })
        return
      }
      setTrouble(null)
      setLeaving(true)
      // The old session ends first: the sign-in page then starts a new one.
      // The same tab, because the draft does not follow a new tab.
      void signOutAndLeave({
        signOut: () => authClient.signOut(),
        leave: () =>
          window.location.assign(
            signInAgainUrl({
              loginUrl: signIn.loginUrl,
              consolePath: window.location.pathname,
              email: signIn.reviewer.email,
            })
          ),
      }).then((outcome) => {
        if (outcome === "failed") {
          // Still signed in and still on the review: what is on the form
          // is the only copy that matters, so no draft is left behind to
          // come back later under "you're signed in again".
          dropDraft(storage, signIn.draftKey)
          setTrouble({ on: from, kind: "signOut" })
          setLeaving(false)
        }
      })
    },
    [leaving, signIn, canKeep]
  )

  const state = React.useMemo(
    () => ({
      signIn,
      expired,
      expiredWhileOpen,
      renewed: seen.renewed,
      canKeep,
      leaving,
      trouble,
      signInAgain,
      registerEntries,
    }),
    [
      signIn,
      expired,
      expiredWhileOpen,
      seen.renewed,
      canKeep,
      leaving,
      trouble,
      signInAgain,
      registerEntries,
    ]
  )
  return (
    <DecisionSignInContext.Provider value={state}>
      {children}
    </DecisionSignInContext.Provider>
  )
}

function useNotice(state: DecisionSignInState, on: Pressed) {
  const t = useTranslations("signInAgain")
  return {
    action: {
      label: t("action"),
      pendingLabel: t("actionPending"),
      isPending: state.leaving,
      onPress: () => state.signInAgain(on),
    },
    // Under the button that was pressed, not under both.
    failure:
      state.trouble?.on === on
        ? t(state.trouble.kind === "write" ? "writeFailed" : "unavailable")
        : null,
  }
}

/**
 * At the top of a review, before anything is written: this sign-in is too
 * old to decide with, why, and the one press that fixes it.
 */
export function DecisionSignInBanner() {
  const state = useDecisionSignInState()
  const t = useTranslations("signInAgain")
  const notice = useNotice(state, "banner")
  const { hours } = state.signIn
  return (
    <>
      {/* Always on the page and empty until the moment passes on an open
          page: a screen reader says what is put into a region it already
          knows, and often nothing for one that arrives with its words. */}
      <p role="status" className="sr-only" data-testid="decision-sign-in-said">
        {state.expiredWhileOpen ? t("banner.title") : ""}
      </p>
      {state.expired ? (
        <SignInAgainNotice
          title={t("banner.title")}
          {...notice}
          size="roomy"
          data-testid="decision-sign-in-banner"
        >
          {t("banner.body", { hours })}{" "}
          {state.canKeep === false ? t("notKept") : t("kept")}
        </SignInAgainNotice>
      ) : null}
    </>
  )
}

/**
 * Beside the decision button that was pressed on an old sign-in: the
 * decision was not saved, why, and the same one press.
 */
export function DecisionSignInRefusal() {
  const state = useDecisionSignInState()
  const t = useTranslations("signInAgain")
  const notice = useNotice(state, "refusal")
  const { hours } = state.signIn
  return (
    <SignInAgainNotice
      title={t("refused.title")}
      {...notice}
      answersAPress
      data-testid="decision-sign-in-refusal"
    >
      {t("refused.body", { hours })}{" "}
      {state.canKeep === false ? t("notKept") : t("refused.kept")}
    </SignInAgainNotice>
  )
}

/** What came back to the form after signing in again. */
interface Returned {
  kind: DraftReturn["kind"]
  /** Whether ticks, and a reason, were among it. */
  withTicks: boolean
  withText: boolean
}

/**
 * For a decision form. Gives back what the reviewer had entered before
 * they left to sign in, once, when the form opens; keeps the page able to
 * make a draft from what is on the form now; and answers a decision
 * pressed on a sign-in that is too old, whether the page knew or the API
 * said so. One piece for both forms, so they cannot drift apart.
 */
export function useDecisionSignIn<Decision extends string>(input: {
  /** What the ticks are made on: the filing's `submittedAt`. */
  version: string
  /** The checks this form has. */
  items: readonly string[]
  maxText: number
  /** What is on the form now. */
  read: () => { ticks: string[]; text: string }
  /** Puts a returned draft on the form. */
  restore: (draft: { ticks: string[]; text: string }) => void
}): {
  /**
   * True when the page already knows this press cannot be saved: the form
   * calls `refuse` and does not ask the API for a refusal it is sure to
   * give (an old session that tries to decide is a line in the API's log
   * worth keeping for the ones nobody expected).
   */
  expired: boolean
  /** Shows the "not saved, sign in again" message for this decision. */
  refuse: (decision: Decision) => void
  /** A new press: the last answer no longer stands. */
  clearRefusal: () => void
  /** The message to show beside `decision`'s button, if it was refused. */
  refusalFor: (shown: (decision: Decision) => boolean) => React.ReactNode
  /** The notice above the form after signing in again, if any. */
  notice: React.ReactNode
  /** After a decision went through: nothing of it is kept. */
  forget: () => void
} {
  const state = useDecisionSignInState()
  const t = useTranslations("signInAgain")
  const { signIn, registerEntries, renewed } = state
  const [returned, setReturned] = React.useState<Returned>({
    kind: "none",
    withTicks: false,
    withText: false,
  })
  const [refused, setRefused] = React.useState<{
    decision: Decision
    /** Counts the presses, so a second refusal is said again. */
    press: number
    /** A refusal from before a newer sign-in was learned of is over. */
    renewed: number
  } | null>(null)
  const presses = React.useRef(0)

  // The newest `read` and `restore`, without re-running the effects.
  const latest = React.useRef(input)
  React.useEffect(() => {
    latest.current = input
  })

  React.useEffect(() => {
    registerEntries(() => ({
      version: latest.current.version,
      ...latest.current.read(),
    }))
    return () => registerEntries(null)
  }, [registerEntries])

  React.useEffect(() => {
    const back = returnDraft(
      takeDraft(sessionDraftStorage(), signIn.draftKey),
      {
        ownerId: signIn.reviewer.id,
        version: latest.current.version,
        ticks: latest.current.items,
        maxText: latest.current.maxText,
        now: Date.now(),
      }
    )
    // Nothing found on a second run means the first run took it.
    if (back.kind === "none") return
    if (back.kind === "empty") {
      // Nothing to give back and nothing to announce: only the place.
      document.getElementById(DECISION_TITLE_ID)?.focus()
      setReturned({ kind: "empty", withTicks: false, withText: false })
      return
    }
    if (back.kind === "lapsed") {
      setReturned({ kind: "lapsed", withTicks: false, withText: false })
      return
    }
    latest.current.restore({ ticks: back.ticks, text: back.text })
    // Said once, about what came back: not about what is typed afterwards.
    setReturned({
      kind: back.kind,
      withTicks: back.ticks.length > 0,
      withText: back.text.trim() !== "",
    })
  }, [signIn.draftKey, signIn.reviewer.id])

  const refuse = React.useCallback(
    (decision: Decision) => {
      presses.current += 1
      setRefused({ decision, press: presses.current, renewed })
    },
    [renewed]
  )
  const clearRefusal = React.useCallback(() => setRefused(null), [])
  const forget = React.useCallback(() => {
    dropDraft(sessionDraftStorage(), signIn.draftKey)
  }, [signIn.draftKey])

  const standing = refused && refused.renewed === renewed ? refused : null
  const refusalFor = (shown: (decision: Decision) => boolean) =>
    standing && shown(standing.decision) ? (
      <DecisionSignInRefusal key={standing.press} />
    ) : null

  let words: string | null = null
  if (returned.kind === "restored") {
    words =
      returned.withTicks && returned.withText
        ? t("restored")
        : t("restoredSome")
  } else if (returned.kind === "changed") {
    words = `${t(`changed.${signIn.subject}`)}${returned.withText ? ` ${t("reasonKept")}` : ""}`
  } else if (returned.kind === "lapsed") {
    words = t("lapsed")
  }
  const notice = words ? (
    <SignedInAgainNotice
      tone={returned.kind === "lapsed" ? "plain" : "good"}
      data-testid="decision-restored"
    >
      {words}
    </SignedInAgainNotice>
  ) : null

  return {
    expired: state.expired,
    refuse,
    clearRefusal,
    refusalFor,
    notice,
    forget,
  }
}

/**
 * On a review that can no longer be decided (someone decided it while the
 * reviewer was signing in): nothing of a draft for it stays in the tab.
 */
export function ForgetDecisionDraft({ draftKey }: { draftKey: string }) {
  React.useEffect(() => {
    dropDraft(sessionDraftStorage(), draftKey)
  }, [draftKey])
  return null
}
