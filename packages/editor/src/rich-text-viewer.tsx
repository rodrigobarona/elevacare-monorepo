import { cn } from "@eleva/ui/lib/utils"

import { toSanitizedHtml } from "./sanitize"

export type RichTextViewerProps = {
  /** Pre-sanitized HTML from storage (`LocalizedRichTextEntry.html`). */
  html: string
  className?: string
  /**
   * When true, re-sanitize before render (defense in depth for untrusted rows).
   * Default true.
   */
  resanitize?: boolean
}

/**
 * Server-safe viewer for stored rich text. Renders sanitized HTML only.
 */
export function RichTextViewer({
  html,
  className,
  resanitize = true,
}: RichTextViewerProps) {
  const safe = resanitize ? toSanitizedHtml(html) : html
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none text-foreground",
        className
      )}
      // eleva: HTML is server-derived and sanitized (ADR-023); never client-authored.
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}
