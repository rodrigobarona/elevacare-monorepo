"use client"

import * as React from "react"
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
  msUntil,
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
   * The moment this sign-in stops being good for a decision (ISO), or null
   * when the page could not read when it started. The API decides either
   * way: this only lets the page say so before the reviewer writes.
   */
  decideBy: string | null
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
  /** Null on a review that cannot be decided: nothing to guard. */
  signIn: DecisionSignIn | null
  children: React.ReactNode
}) {
  if (!signIn) return children
  return (
    <DecisionSignInProvider signIn={signIn}>{children}</DecisionSignInProvider>
  )
}

function DecisionSignInProvider({
  signIn,
  children,
}: {
  signIn: DecisionSignIn
  children: React.ReactNode
}) {
  const [expired, setExpired] = React.useState(
    () => msUntil(signIn.decideBy, Date.now()) === 0
  )
  const [expiredWhileOpen, setExpiredWhileOpen] = React.useState(false)
  const canKeep = React.useSyncExternalStore<boolean | null>(
    neverChanges,
    readKeepsDrafts,
    () => null
  )
  const [leaving, setLeaving] = React.useState(false)
  const [unavailable, setUnavailable] = React.useState(false)
  const entriesRef = React.useRef<(() => DecisionEntries) | null>(null)
  const registerEntries = React.useCallback(
    (read: (() => DecisionEntries) | null) => {
      entriesRef.current = read
    },
    []
  )

  // The banner appears by itself when the moment passes on an open page.
  React.useEffect(() => {
    const left = msUntil(signIn.decideBy, Date.now())
    // Unknown, or already past when the page opened (the first state).
    if (left === null || left === 0) return
    // A timer cannot wait longer than about 24 days; 12 hours fits.
    const timer = window.setTimeout(() => {
      setExpired(true)
      setExpiredWhileOpen(true)
    }, left)
    return () => window.clearTimeout(timer)
  }, [signIn.decideBy])

  const signInAgain = React.useCallback(() => {
    if (leaving) return
    setLeaving(true)
    setUnavailable(false)
    const now = entriesRef.current?.()
    keepDraft(sessionDraftStorage(), signIn.draftKey, {
      ownerId: signIn.reviewer.id,
      version: now?.version ?? "",
      ticks: now?.ticks ?? [],
      text: now?.text ?? "",
    })
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
        setUnavailable(true)
        setLeaving(false)
      }
    })
  }, [leaving, signIn])

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
  if (!state.expired) return null
  const { hours } = state.signIn
  return (
    <SignInAgainNotice
      title={t("banner.title")}
      action={action}
      failure={state.unavailable ? t("unavailable") : null}
      // Present when the page opened: ordinary content. Appeared later: said.
      announce={state.expiredWhileOpen ? "polite" : "off"}
      data-testid="decision-sign-in-banner"
    >
      {t("banner.body", { hours })}{" "}
      {state.canKeep === false ? t("notKept") : t("kept")}
    </SignInAgainNotice>
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
      announce="now"
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
  returned: DraftReturn["kind"]
  /** After a decision went through: nothing of it is kept. */
  forget: () => void
} {
  const state = useDecisionSignInState()
  const { signIn, registerEntries } = state
  const [returned, setReturned] = React.useState<DraftReturn["kind"]>("none")

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
      }
    )
    // Nothing found on a second run means the first run took it.
    if (back.kind === "none") return
    if (back.kind === "empty") {
      // Nothing to give back and nothing to announce: only the place.
      document.getElementById(DECISION_TITLE_ID)?.focus()
    } else {
      latest.current.restore({ ticks: back.ticks, text: back.text })
    }
    setReturned(back.kind)
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
  hasText,
}: {
  returned: DraftReturn["kind"]
  /** Whether a reason came back, for the "new details" sentence. */
  hasText: boolean
}) {
  const state = useDecisionSignInState()
  const t = useTranslations("signInAgain")
  if (returned !== "restored" && returned !== "changed") return null
  return (
    <SignedInAgainNotice data-testid="decision-restored">
      {returned === "restored"
        ? t("restored")
        : `${t(`changed.${state.signIn.subject}`)}${hasText ? ` ${t("reasonKept")}` : ""}`}
    </SignedInAgainNotice>
  )
}
