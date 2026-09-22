import type { Value } from "platejs"

import { toSanitizedHtml } from "./sanitize"
import { toPlainTextFromNodes, type PlateValue } from "./types"

/**
 * Escape text for HTML text nodes.
 */
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function serializeLeaf(node: Record<string, unknown>): string {
  let text = escapeHtml(typeof node.text === "string" ? node.text : "")
  if (node.bold) text = `<strong>${text}</strong>`
  if (node.italic) text = `<em>${text}</em>`
  if (node.underline) text = `<u>${text}</u>`
  if (node.strikethrough) text = `<s>${text}</s>`
  return text
}

function serializeNode(node: unknown): string {
  if (!node || typeof node !== "object") return ""
  const record = node as Record<string, unknown>

  if (typeof record.text === "string") {
    return serializeLeaf(record)
  }

  const children = Array.isArray(record.children)
    ? record.children.map(serializeNode).join("")
    : ""

  const type = typeof record.type === "string" ? record.type : "p"

  switch (type) {
    case "h1":
      return `<h1>${children}</h1>`
    case "h2":
      return `<h2>${children}</h2>`
    case "h3":
      return `<h3>${children}</h3>`
    case "blockquote":
      return `<blockquote>${children}</blockquote>`
    case "ul":
      return `<ul>${children}</ul>`
    case "ol":
      return `<ol>${children}</ol>`
    case "li":
      return `<li>${children}</li>`
    case "a": {
      const url =
        typeof record.url === "string" && /^https?:\/\//u.test(record.url)
          ? record.url
          : "#"
      return `<a href="${escapeHtml(url)}" rel="noopener noreferrer">${children}</a>`
    }
    default:
      return `<p>${children}</p>`
  }
}

/**
 * Derive plain text from Plate JSON (FTS / previews).
 */
export function toPlainText(value: PlateValue | Value): string {
  return toPlainTextFromNodes(value as PlateValue)
}

/**
 * Derive sanitized HTML from Plate JSON. Never trust client HTML.
 */
export function toSanitizedHtmlFromValue(value: PlateValue | Value): string {
  const raw = (value as PlateValue).map(serializeNode).join("")
  return toSanitizedHtml(raw)
}
