"use client"

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react"

import { Button } from "@eleva/ui/components/button"
import { cn } from "@eleva/ui/lib/utils"

/**
 * A reference we are willing to show, copy and put in an email subject: the
 * numeric digest Next gives a server error, never one of its internal names.
 */
const REFERENCE_PATTERN = /^\d{1,32}$/

/**
 * The server's reference for an error. Next passes whatever was thrown, which
 * may not be an `Error`, so nothing is read before it is narrowed.
 */
export function errorDigest(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return undefined
  }
  const { digest } = error
  return typeof digest === "string" && REFERENCE_PATTERN.test(digest)
    ? digest
    : undefined
}

/** How long a retry is remembered for the page it happened on. */
const RETRY_MEMORY_MS = 60_000

interface RetryRecord {
  path: string
  at: number
}

// Kept outside React: a retry unmounts the error page (a dashboard shows its
// loading skeleton meanwhile), and the page that comes back when the retry
// fails is a new one that still has to know the reader already tried. Next
// gives every failed render its own reference, so the page is all there is
// to go by: an error on the same page within a minute of a retry counts as
// "still not loading", even if the page loaded in between.
let lastRetry: RetryRecord | null = null
/** Where focus was put while the page loaded again. */
let parkedFocus: HTMLElement | null = null

const noopSubscribe = () => () => {}

/** Whether `record` is a recent retry of the page at `path`. */
export function isRecentRetry(
  record: RetryRecord | null,
  path: string,
  now: number
): boolean {
  return (
    record !== null && record.path === path && now - record.at < RETRY_MEMORY_MS
  )
}

function retriedHereRecently(): boolean {
  return isRecentRetry(lastRetry, window.location.pathname, Date.now())
}

function subscribeToConnection(onChange: () => void) {
  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)
  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}

/** True when the browser reports no connection. Always false on the server. */
function useIsOffline(): boolean {
  return useSyncExternalStore(
    subscribeToConnection,
    () => !navigator.onLine,
    () => false
  )
}

/** Marks the "Try again" button, so focus can find it after a failed retry. */
const RETRY_BUTTON = "data-error-retry"

/** True when focus was dropped because the element that had it is gone. */
function focusWasLost(): boolean {
  const active = document.activeElement
  return !active || active === document.body
}

/**
 * Runs Next's `retry` for a "Try again" button: pending while the page loads
 * again, "still failing" when the error comes back, and focus kept in a
 * useful place: on the page while it loads, back on the button (a new one)
 * when the error returns.
 *
 * Offline, the button is disabled: Next answers a failed refresh with a full
 * page load, which would swap this page for the browser's own offline one.
 *
 * Spread `retryButtonProps` on the button.
 */
export function useErrorRetry(retry: () => void) {
  const [isPending, startTransition] = useTransition()
  const offline = useIsOffline()
  const retried = useSyncExternalStore(
    noopSubscribe,
    retriedHereRecently,
    () => false
  )
  const pressed = useRef(false)

  useEffect(() => {
    // The error came back after a retry: give focus back to "Try again",
    // unless the reader has moved it somewhere of their own choosing.
    if (retried && (focusWasLost() || document.activeElement === parkedFocus)) {
      document.querySelector<HTMLElement>(`[${RETRY_BUTTON}]`)?.focus()
    }
    return () => {
      if (!pressed.current) return
      requestAnimationFrame(() => {
        if (!focusWasLost()) return
        const retryButton = document.querySelector<HTMLElement>(
          `[${RETRY_BUTTON}]`
        )
        if (retryButton) {
          retryButton.focus()
          return
        }
        // The button is gone while the page loads: keep focus on the page.
        const main = document.querySelector<HTMLElement>("main")
        const target = main?.querySelector<HTMLElement>("h1") ?? main
        if (!target) return
        if (!target.hasAttribute("tabindex")) {
          target.setAttribute("tabindex", "-1")
        }
        target.focus({ preventScroll: true })
        parkedFocus = target
      })
    }
    // On mount and unmount only: `retried` is read once, for the first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onPress() {
    pressed.current = true
    lastRetry = { path: window.location.pathname, at: Date.now() }
    startTransition(() => {
      retry()
    })
  }

  return {
    offline,
    stillFailing: retried && !isPending && !offline,
    retryButtonProps: {
      onPress,
      isPending,
      isDisabled: offline,
      // Same width for "Try again" and "Trying again…", so the row stays put.
      className: "data-pending:cursor-wait sm:min-w-40",
      [RETRY_BUTTON]: "",
    },
  }
}

/** The support address inside an error page's sentence. */
export const errorSupportLinkClassName =
  "rounded-sm font-medium text-foreground underline underline-offset-4 hover:text-primary"

interface ErrorReferenceProps {
  /** Visible label, read with the code: "Reference 3912845570". */
  label: string
  reference: string
  copyLabel: string
  copiedLabel: string
  /** Announced to assistive tech when the copy worked. */
  copiedAnnouncement: string
  /** Announced when the browser refused: the code is selected instead. */
  copyFailedAnnouncement: string
  className?: string
}

/** The reference of an error, with a button that copies it. */
export function ErrorReference({
  label,
  reference,
  copyLabel,
  copiedLabel,
  copiedAnnouncement,
  copyFailedAnnouncement,
  className,
}: ErrorReferenceProps) {
  const [outcome, setOutcome] = useState<"copied" | "failed" | null>(null)
  const code = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!outcome) return
    const timer = setTimeout(() => setOutcome(null), 2000)
    return () => clearTimeout(timer)
  }, [outcome])

  async function copy() {
    try {
      await navigator.clipboard.writeText(reference)
      setOutcome("copied")
    } catch {
      // The clipboard is blocked: select the code so it can be copied by hand.
      if (code.current) window.getSelection()?.selectAllChildren(code.current)
      setOutcome("failed")
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-3 gap-y-2",
        className
      )}
    >
      <p className="text-sm text-muted-foreground">
        {label}{" "}
        <code
          ref={code}
          data-slot="error-reference"
          className="font-mono break-all text-foreground select-all"
        >
          {reference}
        </code>
      </p>
      <Button
        variant="outline"
        size="sm"
        className="border-input-border"
        onPress={copy}
      >
        {/* Both labels share one cell, so the row keeps its width. */}
        <span className="grid">
          <span
            className={cn(
              "col-start-1 row-start-1",
              outcome === "copied" && "invisible"
            )}
          >
            {copyLabel}
          </span>
          <span
            className={cn(
              "col-start-1 row-start-1",
              outcome !== "copied" && "invisible"
            )}
          >
            {copiedLabel}
          </span>
        </span>
      </Button>
      {/* Always mounted, so a message put into it is announced. A refusal is
          also shown: the selection alone is easy to miss. */}
      <span
        role="status"
        className={
          outcome === "failed"
            ? "basis-full text-sm text-foreground"
            : "sr-only"
        }
      >
        {outcome === "copied" ? copiedAnnouncement : null}
        {outcome === "failed" ? copyFailedAnnouncement : null}
      </span>
    </div>
  )
}
