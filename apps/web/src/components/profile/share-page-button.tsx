"use client"

import { useEffect, useId, useRef, useState } from "react"
import { CheckIcon, ShareNetworkIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"

/**
 * "Share this page": the system share sheet where the browser has one,
 * otherwise copy the link. If the browser blocks both, the link is shown
 * selected so the reader can copy it by hand. Detection happens on press,
 * so the server and client render the same button.
 */
export function SharePageButton({
  url,
  title,
  label,
  accessibleLabel,
  copiedLabel,
  copyFailedLabel,
}: {
  url: string
  title: string
  label: string
  /** Names the page, e.g. "Share Fisio Mota's page". */
  accessibleLabel: string
  copiedLabel: string
  /** "Copy this link to share the page:" */
  copyFailedLabel: string
}) {
  const [copied, setCopied] = useState(false)
  const [showLink, setShowLink] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const linkRef = useRef<HTMLInputElement>(null)
  const linkLabelId = useId()

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    },
    []
  )

  useEffect(() => {
    if (!showLink) return
    linkRef.current?.focus()
    linkRef.current?.select()
  }, [showLink])

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url })
        return
      } catch (error) {
        // Closing the share sheet is not an error.
        if (error instanceof DOMException && error.name === "AbortError") return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShowLink(false)
      setCopied(true)
      if (resetTimer.current) clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard blocked and no share sheet: hand the link over to copy.
      setShowLink(true)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        className="min-h-11 rounded-full"
        aria-label={copied ? copiedLabel : accessibleLabel}
        onPress={() => void share()}
      >
        {copied ? (
          <CheckIcon data-icon="inline-start" />
        ) : (
          <ShareNetworkIcon data-icon="inline-start" />
        )}
        {copied ? copiedLabel : label}
      </Button>
      <span role="status" className="sr-only">
        {copied ? copiedLabel : ""}
      </span>
      {showLink ? (
        <div className="flex w-full max-w-md flex-col gap-1.5 text-sm">
          <span id={linkLabelId} className="text-muted-foreground">
            {copyFailedLabel}
          </span>
          <input
            ref={linkRef}
            readOnly
            value={url}
            aria-labelledby={linkLabelId}
            onFocus={(event) => event.currentTarget.select()}
            className="h-11 w-full rounded-full border border-input-border bg-background px-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      ) : null}
    </>
  )
}
