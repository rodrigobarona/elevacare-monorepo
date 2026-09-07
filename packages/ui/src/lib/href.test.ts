import { describe, expect, it } from "vitest"
import { classifyHref } from "./href"

describe("classifyHref", () => {
  it("routes relative hrefs through the app router", () => {
    expect(classifyHref("/account/settings")).toEqual({
      kind: "internal",
      href: "/account/settings",
    })
    expect(classifyHref("settings?tab=2")).toEqual({
      kind: "internal",
      href: "settings?tab=2",
    })
  })

  it("hands safe absolute and protocol-relative hrefs to the browser", () => {
    for (const href of [
      "https://app.eleva.care/dashboard",
      "http://localhost:3000",
      "mailto:hello@eleva.care",
      "tel:+351911111111",
      "sms:+351911111111",
      "//cdn.eleva.care/asset.png",
    ]) {
      expect(classifyHref(href)).toEqual({ kind: "external", href })
    }
  })

  it("blocks executable and opaque schemes", () => {
    for (const href of [
      "javascript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "blob:https://eleva.care/uuid",
      "vbscript:msgbox",
    ]) {
      expect(classifyHref(href).kind).toBe("blocked")
    }
  })

  it("normalizes surrounding whitespace before the scheme check", () => {
    expect(classifyHref("\njavascript:alert(1)").kind).toBe("blocked")
    expect(classifyHref("  javascript:alert(1)  ").kind).toBe("blocked")
    expect(classifyHref("\thttps://eleva.care")).toEqual({
      kind: "external",
      href: "https://eleva.care",
    })
    expect(classifyHref(" /dashboard ")).toEqual({
      kind: "internal",
      href: "/dashboard",
    })
  })
})
