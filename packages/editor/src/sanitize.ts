import sanitizeHtml from "sanitize-html"

/**
 * Sanitizer allow-list for Plate-derived HTML (ADR-023).
 * Clients never send HTML; this runs on server-derived markup only.
 *
 * `sanitize-html` parses with htmlparser2, so it needs no DOM. A DOM-based
 * sanitizer pulled jsdom into server bundles, and jsdom's ESM-only
 * dependencies failed to load in Vercel functions (public profiles and
 * `PATCH /expert/profile` returned 500).
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
]

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  // Drop the contents of these, not just the tags.
  nonTextTags: ["script", "style", "textarea", "option", "noscript"],
  // Every link gets a safe rel, so a new tab never gets `window.opener`
  // and links in expert-written text pass no ranking.
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: "noopener noreferrer nofollow ugc" },
    }),
  },
}

export function toSanitizedHtml(dirtyHtml: string): string {
  return sanitizeHtml(dirtyHtml, OPTIONS)
}
