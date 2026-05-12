import { describe, expect, it } from "vitest"
import {
  appI18nConfig,
  cookieName,
  defaultLocale,
  i18nConfig,
  isLocale,
  locales,
  localeNames,
  resolveLocaleFromHeaders,
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

  it("app config uses never prefix strategy", () => {
    expect(appI18nConfig.localePrefix).toBe("never")
    expect(appI18nConfig.localeCookie.name).toBe("ELEVA_LOCALE")
  })

  it("uses the ELEVA_LOCALE cookie with maxAge", () => {
    expect(cookieName).toBe("ELEVA_LOCALE")
    expect(i18nConfig.localeCookie.name).toBe("ELEVA_LOCALE")
    expect(i18nConfig.localeCookie.maxAge).toBe(31536000)
    expect(appI18nConfig.localeCookie.maxAge).toBe(31536000)
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

describe("resolveLocaleFromHeaders", () => {
  it("returns locale from ELEVA_LOCALE cookie", () => {
    expect(
      resolveLocaleFromHeaders({ cookie: "ELEVA_LOCALE=pt; other=value" })
    ).toBe("pt")
  })

  it("returns locale from Accept-Language when no cookie", () => {
    expect(
      resolveLocaleFromHeaders({ acceptLanguage: "es-ES,es;q=0.9,en;q=0.8" })
    ).toBe("es")
  })

  it("returns locale from geo when no cookie or Accept-Language match", () => {
    expect(resolveLocaleFromHeaders({ country: "PT" })).toBe("pt")
  })

  it("falls back to en when nothing matches", () => {
    expect(resolveLocaleFromHeaders({})).toBe("en")
    expect(
      resolveLocaleFromHeaders({ acceptLanguage: "ja,zh;q=0.9", country: "JP" })
    ).toBe("en")
  })

  it("cookie takes priority over Accept-Language and geo", () => {
    expect(
      resolveLocaleFromHeaders({
        cookie: "ELEVA_LOCALE=es",
        acceptLanguage: "pt-BR,pt;q=0.9",
        country: "PT",
      })
    ).toBe("es")
  })
})
