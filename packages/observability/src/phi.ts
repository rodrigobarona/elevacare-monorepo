import { AsyncLocalStorage } from "node:async_hooks"
import { createHash } from "node:crypto"

/**
 * Structural PHI guards (Phase 10 observability spec).
 *
 * - `Decrypted<T>` wraps plaintext produced by decryption. It serializes
 *   to "[redacted]" through JSON, `util.inspect` and string coercion, so an
 *   accidental `console.error({ record })` or Sentry extra prints nothing.
 *   Callers must `reveal()` explicitly when mapping into a response DTO.
 * - The PHI registry remembers every plaintext produced inside a scope
 *   (one request or one job) so free-form strings such as `Error.message`
 *   can be scrubbed even when the value is not under a known key. Values
 *   live only in that scope's memory and are dropped when it ends.
 */

const DECRYPTED_MARKER = Symbol.for("eleva.decrypted")
const INSPECT_CUSTOM = Symbol.for("nodejs.util.inspect.custom")
const REDACTED = "[redacted]"
export const PHI_PLACEHOLDER = "[phi]"

export class Decrypted<T> {
  readonly [DECRYPTED_MARKER] = true
  readonly #value: T

  constructor(value: T) {
    this.#value = value
  }

  reveal(): T {
    return this.#value
  }

  toJSON(): string {
    return REDACTED
  }

  toString(): string {
    return REDACTED
  }

  [INSPECT_CUSTOM](): string {
    return REDACTED
  }
}

export function isDecrypted(value: unknown): value is Decrypted<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[DECRYPTED_MARKER] === true
  )
}

/** Shorter values match too many ordinary words to scrub safely. */
const MIN_REGISTERED_LENGTH = 6
const PREFIX_LENGTH = 64

type PhiEntry = { value: string; prefix: string }

const registry = new AsyncLocalStorage<Map<string, PhiEntry>>()

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

export function withPhiScope<T>(fn: () => T): T {
  return registry.run(new Map(), fn)
}

/**
 * Remember plaintext for the current scope. Outside a scope this is a
 * no-op so values can never leak between requests.
 */
export function registerPhi(value: string | null | undefined): void {
  const store = registry.getStore()
  if (!store || typeof value !== "string") return
  const trimmed = value.trim()
  if (trimmed.length < MIN_REGISTERED_LENGTH) return
  const hash = digest(trimmed)
  if (store.has(hash)) return
  store.set(hash, { value: trimmed, prefix: trimmed.slice(0, PREFIX_LENGTH) })
}

export function registeredPhiCount(): number {
  return registry.getStore()?.size ?? 0
}

/**
 * Replace every registered plaintext found in `value` with "[phi]". If
 * only the opening of a registered value remains (a truncated copy), the
 * whole string is replaced because its tail cannot be located reliably.
 */
export function scrubRegisteredPhi(value: string): string {
  const store = registry.getStore()
  if (!store || store.size === 0) return value
  if (store.has(digest(value.trim()))) return PHI_PLACEHOLDER
  const entries = [...store.values()].sort(
    (a, b) => b.value.length - a.value.length
  )
  let out = value
  for (const entry of entries) {
    if (out.includes(entry.value)) {
      out = out.split(entry.value).join(PHI_PLACEHOLDER)
    }
  }
  for (const entry of entries) {
    if (out.includes(entry.prefix)) return PHI_PLACEHOLDER
  }
  return out
}
