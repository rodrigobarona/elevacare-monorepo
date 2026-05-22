import { afterEach, describe, expect, it, vi } from "vitest"
import {
  encodePathSegment,
  getEnvironmentRole,
  parseCliEnv,
  truncateRoleDescription,
  workosRequest,
} from "./workos-api.js"

describe("parseCliEnv", () => {
  it("defaults to staging when --env is omitted", () => {
    expect(parseCliEnv([])).toBe("staging")
  })

  it("accepts staging, production, and development", () => {
    expect(parseCliEnv(["--env=staging"])).toBe("staging")
    expect(parseCliEnv(["--env=production"])).toBe("production")
    expect(parseCliEnv(["--env=development"])).toBe("development")
  })

  it("normalizes prod and dev aliases", () => {
    expect(parseCliEnv(["--env=prod"])).toBe("production")
    expect(parseCliEnv(["--env=dev"])).toBe("development")
  })

  it("throws on invalid environment values", () => {
    expect(() => parseCliEnv(["--env=prodution"])).toThrow(/Invalid --env=/)
    expect(() => parseCliEnv(["--env=local"])).toThrow(/Invalid --env=/)
  })
})

describe("truncateRoleDescription", () => {
  it("passes through descriptions within the limit", () => {
    expect(truncateRoleDescription("short")).toBe("short")
  })

  it("truncates descriptions over 150 characters", () => {
    const long = "a".repeat(160)
    const result = truncateRoleDescription(long)
    expect(result!.length).toBe(150)
    expect(result!.endsWith("…")).toBe(true)
  })

  it("truncates by Unicode code point without splitting surrogate pairs", () => {
    const emoji = "😀".repeat(160)
    const result = truncateRoleDescription(emoji)
    expect([...result!].length).toBe(150)
    expect(result!.endsWith("…")).toBe(true)
    expect([...result!.slice(0, -1)].every((char) => char !== "\uD800")).toBe(
      true
    )
  })

  it("preserves empty string descriptions", () => {
    expect(truncateRoleDescription("")).toBe("")
  })
})

describe("encodePathSegment", () => {
  it("URL-encodes reserved characters in path segments", () => {
    expect(encodePathSegment("foo:bar")).toBe("foo%3Abar")
    expect(encodePathSegment("a b")).toBe("a%20b")
  })
})

describe("workosRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns parsed JSON for non-empty 2xx bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ slug: "admin" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    )

    await expect(
      workosRequest<{ slug: string }>(
        "key",
        "GET",
        "/authorization/roles/admin"
      )
    ).resolves.toEqual({ slug: "admin" })
  })

  it("returns empty object for whitespace-only 2xx bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("   ", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    )

    await expect(
      workosRequest<Record<string, never>>(
        "key",
        "DELETE",
        "/authorization/permissions/x"
      )
    ).resolves.toEqual({})
  })

  it("throws WorkosApiError with HTTP status on failed requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("conflict", {
          status: 409,
          headers: { "Content-Type": "application/json" },
        })
      )
    )

    await expect(
      workosRequest("key", "POST", "/authorization/permissions", { slug: "x" })
    ).rejects.toMatchObject({
      name: "WorkosApiError",
      status: 409,
      method: "POST",
      path: "/authorization/permissions",
    })
  })
})

describe("getEnvironmentRole", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("URL-encodes slug segments in the request path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ slug: "foo:bar" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await getEnvironmentRole("key", "foo:bar")

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.workos.com/authorization/roles/foo%3Abar",
      expect.objectContaining({ method: "GET" })
    )
  })
})
