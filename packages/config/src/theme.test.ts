import { describe, expect, it } from "vitest"
import {
  cookieName,
  getThemeCookieOptions,
  isThemePreference,
  parseThemeFromCookie,
  resolveThemeClass,
  themes,
} from "./theme"

describe("theme config", () => {
  it("uses ELEVA_THEME cookie name", () => {
    expect(cookieName).toBe("ELEVA_THEME")
  })

  it("supports light, dark, and system", () => {
    expect([...themes]).toEqual(["light", "dark", "system"])
  })

  it("parses valid theme from cookie header", () => {
    expect(parseThemeFromCookie("ELEVA_THEME=dark; other=1")).toBe("dark")
    expect(parseThemeFromCookie("foo=1; ELEVA_THEME=light")).toBe("light")
    expect(parseThemeFromCookie("ELEVA_THEME=system")).toBe("system")
  })

  it("defaults to system for missing or invalid cookie", () => {
    expect(parseThemeFromCookie(null)).toBe("system")
    expect(parseThemeFromCookie("")).toBe("system")
    expect(parseThemeFromCookie("ELEVA_THEME=invalid")).toBe("system")
  })

  it("narrows via isThemePreference", () => {
    expect(isThemePreference("dark")).toBe(true)
    expect(isThemePreference("auto")).toBe(false)
  })

  it("sets shared domain on eleva.care hosts", () => {
    expect(getThemeCookieOptions("account.eleva.care").domain).toBe(
      ".eleva.care"
    )
    expect(getThemeCookieOptions("localhost:3006").domain).toBeUndefined()
  })

  it("resolves theme class for SSR", () => {
    expect(resolveThemeClass("light")).toBe("light")
    expect(resolveThemeClass("dark")).toBe("dark")
    expect(resolveThemeClass("system", false)).toBe("light")
    expect(resolveThemeClass("system", true)).toBe("dark")
  })
})
