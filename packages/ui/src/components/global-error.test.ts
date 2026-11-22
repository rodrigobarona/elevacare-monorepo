import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cookieName } from "@eleva/config/i18n"
import { errorDigest, isRecentRetry } from "./error-recovery"
import {
  GLOBAL_ERROR_COPY,
  GlobalError,
  GlobalErrorContent,
  LOCALE_COOKIE,
  readGlobalErrorLocale,
} from "./global-error"

// `next/font/local` only works under the Next compiler.
vi.mock("@eleva/ui/fonts", () => ({ fontClassName: "fonts" }))
const button = vi.hoisted(() => ({
  props: [] as { onPress?: () => void }[],
}))
vi.mock("@eleva/ui/components/button", () => ({
  Button: (props: { onPress?: () => void; children?: unknown }) => {
    button.props.push(props)
    return createElement("button", null, props.children as string)
  },
}))
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>()
  return {
    ...react,
    useTransition: () => [false, (run: () => void) => run()] as const,
  }
})

function render(error: unknown) {
  const retry = vi.fn()
  const reset = vi.fn()
  // Next passes all three; the component must use `retry`.
  const html = renderToStaticMarkup(
    createElement(GlobalError, { error, retry, reset } as never)
  )
  return { html, retry, reset }
}

describe("GlobalError", () => {
  beforeEach(() => {
    button.props.length = 0
    vi.stubGlobal("window", { location: { pathname: "/" } })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("asks the server again on Try again, and never only resets", () => {
    const { retry, reset } = render(new Error("boom"))
    expect(button.props[0]?.onPress).toBeTypeOf("function")
    button.props[0]!.onPress!()
    expect(retry).toHaveBeenCalledTimes(1)
    expect(reset).not.toHaveBeenCalled()
  })

  it("shows the reference with a way to copy it and to write to us", () => {
    const { html } = render(
      Object.assign(new Error("boom"), { digest: "77120" })
    )
    expect(html).toContain(">77120</code>")
    expect(html).toContain("Copy reference")
    expect(html).toMatch(
      /href="mailto:[^"?]+\?subject=Eleva%20reference%2077120"/
    )
    expect(html).not.toContain("boom")
    expect(html).not.toContain("{email}")
  })

  it("still renders when what was thrown is not an error", () => {
    for (const thrown of ["text", null, undefined, 42]) {
      const { html } = render(thrown)
      expect(html).toContain("<h1")
      expect(html).not.toContain("<code")
    }
  })
})

describe("the fallback's copy", () => {
  it.each(Object.keys(GLOBAL_ERROR_COPY) as (keyof typeof GLOBAL_ERROR_COPY)[])(
    "renders whole in %s, with the address where the sentence wants it",
    (locale) => {
      const t = GLOBAL_ERROR_COPY[locale]
      for (const sentence of [t.support, t.supportNoReference]) {
        expect(sentence.split("{email}")).toHaveLength(2)
      }
      expect(t.emailSubject.split("{reference}")).toHaveLength(2)
      for (const error of [{ digest: "77120" }, null]) {
        const html = renderToStaticMarkup(
          createElement(GlobalErrorContent, { error, retry: vi.fn(), locale })
        )
        expect(html).toContain(`>${t.title}</h1>`)
        expect(html).not.toMatch(/[{}]/)
      }
    }
  )

  it("has a page title", () => {
    expect(render(null).html).toContain("<title>We couldn’t load Eleva</title>")
  })
})

describe("the fallback's language", () => {
  function locale(cookie: string, browser: string) {
    vi.stubGlobal("document", { cookie })
    vi.stubGlobal("navigator", { language: browser })
    return readGlobalErrorLocale()
  }

  it("is the one chosen in Eleva, before the browser's", () => {
    expect(LOCALE_COOKIE).toBe(cookieName)
    expect(locale(`theme=dark; ${cookieName}=pt`, "en-GB")).toBe("pt")
    expect(locale("", "es-ES")).toBe("es")
    expect(locale("", "fr-FR")).toBe("en")
  })

  it.each(["constructor", "toString", "__proto__", "valueOf", "fr", ""])(
    "ignores a cookie that says %j",
    (value) => {
      expect(locale(`${cookieName}=${value}`, "pt-PT")).toBe("pt")
      expect(locale(`${cookieName}=${value}`, "constructor")).toBe("en")
    }
  )
})

describe("isRecentRetry", () => {
  const path = "/space/sessions"
  const record = { path, at: 1_000_000 }

  it("remembers a retry of the same page for a minute", () => {
    expect(isRecentRetry(record, path, 1_000_000 + 59_999)).toBe(true)
    expect(isRecentRetry(record, path, 1_000_000 + 60_000)).toBe(false)
  })

  it("says nothing on another page, or when nobody retried", () => {
    expect(isRecentRetry(record, "/space", 1_000_001)).toBe(false)
    expect(isRecentRetry(null, path, 1_000_001)).toBe(false)
  })
})

describe("errorDigest", () => {
  it("reads a digest only from an object that carries a plain one", () => {
    expect(errorDigest({ digest: "3912845570" })).toBe("3912845570")
    expect(errorDigest(Object.assign(new Error("x"), { digest: "77" }))).toBe(
      "77"
    )
    for (const thrown of [
      null,
      undefined,
      "digest",
      { digest: 12 },
      { digest: "" },
      { digest: "two words" },
      { digest: "DYNAMIC_SERVER_USAGE" },
      { digest: "1".repeat(33) },
      { digest: "a&subject=b" },
    ]) {
      expect(errorDigest(thrown)).toBeUndefined()
    }
  })
})
