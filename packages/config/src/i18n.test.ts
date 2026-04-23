import { describe, expect, it } from "vitest"
import {
  cookieName,
  defaultLocale,
  i18nConfig,
  isLocale,
  locales,
  localeNames,
} from "./i18n"

describe("i18n config", () => {
  it("has exactly the launch locales", () => {
    expect([...locales].sort()).toEqual(["en", "es", "pt"])
  })

  it("defaults to en and uses as-needed prefix strategy", () => {
    expect(defaultLocale).toBe("en")
    expect(i18nConfig.defaultLocale).toBe("en")
    expect(i18nConfig.localePrefix).toBe("as-needed")
  })

  it("uses the ELEVA_LOCALE cookie", () => {
    expect(cookieName).toBe("ELEVA_LOCALE")
    expect(i18nConfig.localeCookie.name).toBe("ELEVA_LOCALE")
  })

  it("exposes display names for every locale", () => {
    for (const loc of locales) {
      expect(localeNames[loc]).toBeTruthy()
    }
  })

  it("narrows unknown strings via isLocale", () => {
    expect(isLocale("pt")).toBe(true)
    expect(isLocale("en")).toBe(true)
    expect(isLocale("es")).toBe(true)
    expect(isLocale("it")).toBe(false)
    expect(isLocale("")).toBe(false)
  })
})
