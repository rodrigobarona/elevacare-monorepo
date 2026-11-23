"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { authClient } from "@eleva/auth/client"
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
  takeDraft,
  type DraftReturn,
} from "@eleva/dashboard/sign-in-again-model"
import { DECISION_TITLE_ID } from "@/lib/decision-title"

/** What a review page knows, on the server, about the reviewer's sign-in. */
export interface DecisionSignIn {
  /**
   * How long this sign-in is still good for a decision, in milliseconds,
   * as the server counted it when it drew the page: 0 when it is already
   * too old, null when the page could not read when it started. A length
   * of time, not a moment, so the browser's own clock being wrong cannot
   * turn a good sign-in into an old one. The API decides either way: this
   * only lets the page say so before the reviewer writes.
   */
  msLeft: number | null
  /** The rule in hours, from the shared constant, for the sentences. */
  hours: number
  reviewer: { id: string; email: string }
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

interface DecisionSignInState {
  signIn: DecisionSignIn
  /** True once the sign-in is too old to decide with. */
  expired: boolean
  /** True when it became too old while the page was open. */
  expiredWhileOpen: boolean
  /** Whether this browser will keep a draft. Null until the page has looked. */
  canKeep: boolean | null
  leaving: boolean
  unavailable: boolean
  signInAgain: () => void
  /** The form says how to read what is on it; a draft is made from that. */
  registerEntries: (read: (() => DecisionEntries) | null) => void
}

// Whether this browser keeps a draft: looked at once, in the browser only.
let keepsDrafts: boolean | null = null
const readKeepsDrafts = () =>
  (keepsDrafts ??= canKeepDrafts(sessionDraftStorage()))
const neverChanges = () => () => {}

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
 * Around a review that can be decided: knows when the reviewer's sign-in
 * stops being good for a decision, and takes them to sign in again without
 * losing what they entered. The banner and the form share it.
 */
export function DecisionSignInScope({
  signIn,
  children,
}: {
  signIn: DecisionSignIn
  children: React.ReactNode
}) {
  const router = useRouter()
  // What the page has seen pass since the server counted `msLeft`. Started
  // over whenever the server counts again (a refresh, a new sign-in).
  const [clock, setClock] = React.useState({
    msLeft: signIn.msLeft,
    passed: false,
  })
  if (clock.msLeft !== signIn.msLeft) {
    setClock({ msLeft: signIn.msLeft, passed: false })
  }
  const expired = signIn.msLeft === 0 || clock.passed
  const expiredWhileOpen = clock.passed

  const probed = React.useSyncExternalStore<boolean | null>(
    neverChanges,
    readKeepsDrafts,
    () => null
  )
  // A write that failed at the press, after the probe had said yes.
  const [writeFailed, setWriteFailed] = React.useState(false)
  const canKeep = writeFailed ? false : probed
  const [leaving, setLeaving] = React.useState(false)
  const [unavailable, setUnavailable] = React.useState(false)
  const entriesRef = React.useRef<(() => DecisionEntries) | null>(null)
  const registerEntries = React.useCallback(
    (read: (() => DecisionEntries) | null) => {
      entriesRef.current = read
    },
    []
  )

  React.useEffect(() => {
    const { msLeft } = signIn
    if (msLeft === null) return
    // A timer alone is not enough: it does not count the hours a laptop
    // slept, which is the "console left open" the rule is about. The page
    // looks again whenever it is shown or comes to the front.
    const since = Date.now()
    const look = () => {
      if (document.visibilityState !== "visible") return
      if (msLeft > 0) {
        if (Date.now() - since >= msLeft) {
          setClock((now) => (now.passed ? now : { ...now, passed: true }))
        }
        return
      }
      // Already too old when the page was drawn. The reviewer may have
      // signed in again in another tab since: ask the server, which keeps
      // what is on this form and takes the banner away if so.
      router.refresh()
    }
    // A timer cannot wait longer than about 24 days; 12 hours fits.
    const timer = msLeft > 0 ? window.setTimeout(look, msLeft) : null
    document.addEventListener("visibilitychange", look)
    window.addEventListener("focus", look)
    window.addEventListener("pageshow", look)
    return () => {
      if (timer !== null) window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", look)
      window.removeEventListener("focus", look)
      window.removeEventListener("pageshow", look)
    }
  }, [signIn, router])

  // Back from the sign-in page to a page the browser kept as it was: the
  // button must not stay on "Opening sign-in…".
  React.useEffect(() => {
    const shown = (event: PageTransitionEvent) => {
      if (event.persisted) setLeaving(false)
    }
    window.addEventListener("pageshow", shown)
    return () => window.removeEventListener("pageshow", shown)
  }, [])

  const signInAgain = React.useCallback(() => {
    if (leaving) return
    setUnavailable(false)
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
      setWriteFailed(true)
      return
    }
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
        // Still signed in and still on the review: what is on the form is
        // the only copy that matters, so no draft is left behind to come
        // back later under "you're signed in again".
        dropDraft(storage, signIn.draftKey)
        setUnavailable(true)
        setLeaving(false)
      }
    })
  }, [leaving, signIn, canKeep])

  const state = React.useMemo(
    () => ({
      signIn,
      expired,
      expiredWhileOpen,
      canKeep,
      leaving,
      unavailable,
      signInAgain,
      registerEntries,
    }),
    [
      signIn,
      expired,
      expiredWhileOpen,
      canKeep,
      leaving,
      unavailable,
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

function useAction(state: DecisionSignInState) {
  const t = useTranslations("signInAgain")
  return {
    label: t("action"),
    pendingLabel: t("actionPending"),
    isPending: state.leaving,
    onPress: state.signInAgain,
  }
}

/**
 * At the top of a review, before anything is written: this sign-in is too
 * old to decide with, why, and the one press that fixes it.
 */
export function DecisionSignInBanner() {
  const state = useDecisionSignInState()
  const t = useTranslations("signInAgain")
  const action = useAction(state)
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
          action={action}
          failure={state.unavailable ? t("unavailable") : null}
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
  const action = useAction(state)
  const { hours } = state.signIn
  return (
    <SignInAgainNotice
      action={action}
      failure={state.unavailable ? t("unavailable") : null}
      answersAPress
      data-testid="decision-sign-in-refusal"
    >
      {t("refused", { hours })}{" "}
      {state.canKeep === false ? t("notKept") : t("refusedKept")}
    </SignInAgainNotice>
  )
}

/**
 * For a decision form. Gives back what the reviewer had entered before
 * they left to sign in, once, when the form opens; keeps the page able to
 * make a draft from what is on the form now; and says whether a press
 * should be answered at once because the sign-in is already too old.
 */
export function useDecisionSignIn(input: {
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
  expired: boolean
  /** What came back, for the notice above the form. */
  returned: { kind: DraftReturn["kind"]; withText: boolean }
  /** After a decision went through: nothing of it is kept. */
  forget: () => void
} {
  const state = useDecisionSignInState()
  const { signIn, registerEntries } = state
  const [returned, setReturned] = React.useState<{
    kind: DraftReturn["kind"]
    withText: boolean
  }>({ kind: "none", withText: false })

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
      setReturned({ kind: "empty", withText: false })
      return
    }
    latest.current.restore({ ticks: back.ticks, text: back.text })
    // Said once, about what came back: not about what is typed afterwards.
    setReturned({ kind: back.kind, withText: back.text.trim() !== "" })
  }, [signIn.draftKey, signIn.reviewer.id])

  const forget = React.useCallback(() => {
    dropDraft(sessionDraftStorage(), signIn.draftKey)
  }, [signIn.draftKey])

  return { expired: state.expired, returned, forget }
}

/**
 * Above the form after signing in again: what is back on the form, and
 * that the decision still waits for the reviewer's own press.
 */
export function DecisionRestoredNotice({
  returned,
}: {
  returned: { kind: DraftReturn["kind"]; withText: boolean }
}) {
  const state = useDecisionSignInState()
  const t = useTranslations("signInAgain")
  if (returned.kind !== "restored" && returned.kind !== "changed") return null
  return (
    <SignedInAgainNotice data-testid="decision-restored">
      {returned.kind === "restored"
        ? t("restored")
        : `${t(`changed.${state.signIn.subject}`)}${returned.withText ? ` ${t("reasonKept")}` : ""}`}
    </SignedInAgainNotice>
  )
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
