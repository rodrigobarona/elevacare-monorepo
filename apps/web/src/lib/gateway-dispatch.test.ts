import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import {
  buildAdminRedirect,
  buildRootRedirect,
  isDocumentNavigation,
  isRscRequest,
} from "./gateway-dispatch"

function makeRequest(
  url: string,
  init?: {
    headers?: Record<string, string>
    cookies?: Record<string, string>
  }
): NextRequest {
  const req = new NextRequest(new URL(url, "http://localhost:3000"), {
    headers: init?.headers,
  })
  if (init?.cookies) {
    for (const [name, value] of Object.entries(init.cookies)) {
      vi.spyOn(req.cookies, "get").mockImplementation((cookieName) =>
        cookieName === name ? { name, value } : undefined
      )
    }
  }
  return req
}

describe("isRscRequest", () => {
  it("detects RSC header", () => {
    const req = makeRequest("http://localhost:3000/pt", {
      headers: { RSC: "1" },
    })
    expect(isRscRequest(req)).toBe(true)
  })

  it("detects prefetch header", () => {
    const req = makeRequest("http://localhost:3000/pt", {
      headers: { "Next-Router-Prefetch": "1" },
    })
    expect(isRscRequest(req)).toBe(true)
  })

  it("detects Next-Router-State-Tree header", () => {
    const req = makeRequest("http://localhost:3000/pt", {
      headers: { "Next-Router-State-Tree": "[]" },
    })
    expect(isRscRequest(req)).toBe(true)
  })

  it("detects _rsc query param", () => {
    const req = makeRequest("http://localhost:3000/pt?_rsc=abc")
    expect(isRscRequest(req)).toBe(true)
  })

  it("returns false for plain document requests", () => {
    const req = makeRequest("http://localhost:3000/pt")
    expect(isRscRequest(req)).toBe(false)
  })
})

describe("isDocumentNavigation", () => {
  it("returns true for Sec-Fetch-Mode navigate + document dest", () => {
    const req = makeRequest("http://localhost:3000/", {
      headers: {
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Dest": "document",
      },
    })
    expect(isDocumentNavigation(req)).toBe(true)
  })

  it("returns false for cors mode (RSC fetches)", () => {
    const req = makeRequest("http://localhost:3000/", {
      headers: {
        RSC: "1",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
      },
    })
    expect(isDocumentNavigation(req)).toBe(false)
  })

  it("falls back to !isRscRequest when Sec-Fetch headers absent", () => {
    const doc = makeRequest("http://localhost:3000/")
    const rsc = makeRequest("http://localhost:3000/", { headers: { RSC: "1" } })
    expect(isDocumentNavigation(doc)).toBe(true)
    expect(isDocumentNavigation(rsc)).toBe(false)
  })
})

describe("buildRootRedirect", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("redirects to last active org when cookie is valid", () => {
    const req = makeRequest("http://localhost:3000/", {
      cookies: { "eleva-last-org": "clinica-mota" },
    })
    const res = buildRootRedirect(req)
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/clinica-mota"
    )
  })

  it("redirects to /dashboard when no last-org cookie", () => {
    const req = makeRequest("http://localhost:3000/")
    const res = buildRootRedirect(req)
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard")
  })

  it("redirects to /dashboard when last-org cookie is reserved", () => {
    const req = makeRequest("http://localhost:3000/", {
      cookies: { "eleva-last-org": "admin" },
    })
    const res = buildRootRedirect(req)
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard")
  })
})

describe("buildAdminRedirect", () => {
  const originalAdminUrl = process.env.ADMIN_URL

  beforeEach(() => {
    process.env.ADMIN_URL = "http://localhost:3007"
  })

  afterEach(() => {
    if (originalAdminUrl === undefined) {
      delete process.env.ADMIN_URL
    } else {
      process.env.ADMIN_URL = originalAdminUrl
    }
  })

  it("redirects /admin to admin origin root", () => {
    const req = makeRequest("http://localhost:3000/admin")
    const res = buildAdminRedirect(req)
    expect(res.headers.get("location")).toBe("http://localhost:3007/")
  })

  it("strips /admin prefix for nested paths", () => {
    const req = makeRequest("http://localhost:3000/admin/payments?tab=open")
    const res = buildAdminRedirect(req)
    expect(res.headers.get("location")).toBe(
      "http://localhost:3007/payments?tab=open"
    )
  })
})
