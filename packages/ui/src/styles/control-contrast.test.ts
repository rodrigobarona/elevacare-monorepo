import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * WCAG 1.4.11 (non-text contrast): the edge that identifies a form
 * control needs >= 3:1 against the surfaces it sits on. axe does not test
 * this, so compute it from the design tokens themselves.
 */
const css = readFileSync(join(__dirname, "globals.css"), "utf8")

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`missing ${selector} block`)
  return css.slice(start, css.indexOf("}", start))
}

const palette = block("@theme static")
const light = block(":root")
const dark = block(".dark")

function resolve(scope: string, name: string): string {
  const own = new RegExp(`${name}:\\s*([^;]+);`).exec(scope)?.[1]?.trim()
  const raw = own ?? new RegExp(`${name}:\\s*([^;]+);`).exec(palette)?.[1]
  if (!raw) throw new Error(`missing token ${name}`)
  const ref = /^var\((--[\w-]+)\)$/.exec(raw.trim())
  return ref ? resolve(scope, ref[1]!) : raw.trim()
}

/** oklch(L C H) -> relative luminance (sRGB, D65). */
function luminance(oklch: string): number {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(oklch)
  if (!m) throw new Error(`not oklch: ${oklch}`)
  const [L, C, H] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const r = 4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s
  const g = -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s
  const bl = -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(bl)
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x! + 0.05) / (y! + 0.05)
}

describe("form control edges (WCAG 1.4.11)", () => {
  for (const [theme, scope] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    for (const surface of ["--background", "--card", "--muted"]) {
      it(`${theme}: --input-border vs ${surface} is at least 3:1`, () => {
        const ratio = contrast(
          resolve(scope, "--input-border"),
          resolve(scope, surface)
        )
        expect(ratio).toBeGreaterThanOrEqual(3)
      })
    }
  }
})
