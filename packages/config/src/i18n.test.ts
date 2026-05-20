import { describe, expect, it } from "vitest"
import {
  appI18nConfig,
  cookieName,
  defaultLocale,
  i18nConfig,
  isLocale,
  locales,
  localeNames,
  getLocaleCookieDomain,
  getLocaleCookieOptions,
  normalizeLocale,
  normalizeWorkOSLocale,
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

  it("normalizes region-specific locale values", () => {
    expect(normalizeLocale("pt-PT")).toBe("pt")
    expect(normalizeLocale("es-MX")).toBe("es")
    expect(normalizeLocale("EN-us")).toBe("en")
    expect(normalizeWorkOSLocale("pt-BR")).toBe("pt")
    expect(normalizeLocale("fr-FR")).toBeNull()
    expect(normalizeLocale(null)).toBeNull()
  })

  it("scopes locale cookies to Eleva hosts only", () => {
    expect(getLocaleCookieDomain("account.eleva.care")).toBe(".eleva.care")
    expect(getLocaleCookieDomain("eleva.care")).toBe(".eleva.care")
    expect(getLocaleCookieDomain("localhost:3000")).toBeUndefined()
    expect(getLocaleCookieDomain("127.0.0.1:3000")).toBeUndefined()
  })

  it("builds shared locale cookie options", () => {
    expect(getLocaleCookieOptions("app.eleva.care")).toEqual({
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      domain: ".eleva.care",
    })
    expect(
      getLocaleCookieOptions("localhost:3000", { httpOnly: false })
    ).toEqual({
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      httpOnly: false,
    })
  })
})

describe("resolveLocaleFromHeaders", () => {
  it("returns locale from ELEVA_LOCALE cookie", () => {
    expect(
      resolveLocaleFromHeaders({ cookie: "ELEVA_LOCALE=pt-PT; other=value" })
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
