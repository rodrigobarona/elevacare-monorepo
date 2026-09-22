import DOMPurify from "isomorphic-dompurify"

/**
 * Sanitizer allow-list for Plate-derived HTML (ADR-023).
 * Clients never send HTML; this runs on server-derived markup only.
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
] as const

const ALLOWED_ATTR = ["href", "target", "rel"] as const

export function toSanitizedHtml(dirtyHtml: string): string {
  return DOMPurify.sanitize(dirtyHtml, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    ALLOW_DATA_ATTR: false,
  })
}
