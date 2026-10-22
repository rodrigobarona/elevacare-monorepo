import en from "../messages/en.json"
import es from "../messages/es.json"
import pt from "../messages/pt.json"
import { describe, expect, it } from "vitest"

const BANNED = [
  /\bpatient\b/i,
  /\bpatients\b/i,
  /\bworkspace\b/i,
  /\bTop Expert\b/i,
  /\bClerk\b/,
  /\bWorkOS\b/,
  /\bHIPAA\b/,
] as const

function collectStrings(value: unknown, out: string[]) {
  if (typeof value === "string") {
    out.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out)
    return
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectStrings(v, out)
  }
}

function scanNamespace(
  messages: typeof en,
  namespace: "becomeExpert" | "forClinics"
) {
  const strings: string[] = []
  collectStrings(messages[namespace], strings)
  return strings.join("\n")
}

describe("marketing landing copy", () => {
  for (const locale of [
    { name: "en", messages: en },
    { name: "pt", messages: pt },
    { name: "es", messages: es },
  ] as const) {
    for (const namespace of ["becomeExpert", "forClinics"] as const) {
      it(`${locale.name}/${namespace} avoids banned public terms`, () => {
        const text = scanNamespace(locale.messages, namespace)
        for (const pattern of BANNED) {
          expect(text, pattern.source).not.toMatch(pattern)
        }
      })
    }
  }
})
