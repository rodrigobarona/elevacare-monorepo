"use client"

import { useEffect, useRef, useState } from "react"
import { CheckIcon, ShareNetworkIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"

/**
 * "Share this page": the system share sheet where the browser has one,
 * otherwise copy the link. Detection happens on press, so the server and
 * client render the same button.
 */
export function SharePageButton({
  url,
  title,
  label,
  accessibleLabel,
  copiedLabel,
}: {
  url: string
  title: string
  label: string
  /** Names the page, e.g. "Share Fisio Mota's page". */
  accessibleLabel: string
  copiedLabel: string
}) {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    },
    []
  )

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
      setCopied(true)
      if (resetTimer.current) clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard blocked: nothing useful to do without a share sheet.
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
    </>
  )
}
