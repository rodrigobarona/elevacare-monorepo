import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  decryptOAuthToken,
  encryptOAuthToken,
  revokeOAuthToken,
} from "@eleva/encryption"
import { resetEnvCache } from "@eleva/config/env"
import { TOC_V1_AUTO_FINALIZE_BLOCKED } from "./issuance-gate"
import {
  ensureToconlineAccessToken,
  needsToconlineTokenRefresh,
  toconlineAdapter,
} from "./index"

vi.mock("@eleva/encryption", () => ({
  encryptOAuthToken: vi.fn().mockResolvedValue("vault-ref"),
  decryptOAuthToken: vi.fn(),
  revokeOAuthToken: vi.fn(),
}))

const validIssueInput = {
  bookingId: "00000000-0000-4000-8000-000000000010",
  expertProfileId: "00000000-0000-4000-8000-000000000001",
  member: {
    fiscalId: "999999990",
    name: "Member",
    country: "PT",
  },
  lines: [
    {
      description: "Session",
      quantity: 1,
      unitPrice: 50,
      taxRate: 23,
      currency: "EUR",
    },
  ],
  date: "2026-09-15",
}

const creds = {
  vaultRef: "vault-ref",
  metadata: {
    orgId: "00000000-0000-4000-8000-000000000002",
    userId: "00000000-0000-4000-8000-000000000003",
  },
}

describe("toconlineAdapter", () => {
  beforeEach(() => {
    resetEnvCache()
    vi.clearAllMocks()
    vi.stubEnv("TOCONLINE_CLIENT_ID", "test-client-id")
    vi.stubEnv("TOCONLINE_CLIENT_SECRET", "test-secret")
    vi.stubEnv("TOCONLINE_OAUTH_BASE_URL", "https://app33.toconline.pt/oauth")
    vi.stubEnv("TOCONLINE_API_BASE_URL", "https://api33.toconline.pt")
    vi.stubEnv(
      "TOCONLINE_OAUTH_REDIRECT",
      "http://localhost:3002/accounting/callback"
    )
    vi.stubEnv("TOCONLINE_SERIES_PREFIX", "TEST")
    vi.stubEnv("TOCONLINE_ALLOW_V1_AUTO_FINALIZE", "")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    resetEnvCache()
  })

  it("emits a simplified authorization URL without PKCE", async () => {
    const result = await toconlineAdapter.buildAuthUrl?.({
      state: "toconline:00000000-0000-4000-8000-000000000001",
      expertProfileId: "00000000-0000-4000-8000-000000000001",
    })
    expect(result).not.toBeNull()
    expect(result).not.toHaveProperty("codeVerifier")

    const url = new URL(result!.url)
    expect(url.host).toBe("app33.toconline.pt")
    expect(url.pathname).toBe("/oauth/auth")
    expect(url.searchParams.get("code_challenge")).toBeNull()
  })

  it("exchanges the code and persists looked-up document_series_id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "at",
          refresh_token: "rt",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ type: "commercial_document_series", id: "337" }],
        }),
      })
    vi.stubGlobal("fetch", fetchMock)

    const result = await toconlineAdapter.connect({
      expertProfileId: "00000000-0000-4000-8000-000000000001",
      orgId: "00000000-0000-4000-8000-000000000002",
      userId: "00000000-0000-4000-8000-000000000003",
      payload: { code: "auth-code" },
    })

    expect(result.vaultRef).toBe("vault-ref")
    expect(result.metadata?.document_series_id).toBe("337")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [tokenUrl] = fetchMock.mock.calls[0] as [string]
    expect(tokenUrl).toBe("https://app33.toconline.pt/oauth/token")
    const [seriesUrl, seriesInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit,
    ]
    expect(seriesUrl).toContain("/api/commercial_document_series?")
    expect(seriesUrl).toContain("filter%5Bdocument_type%5D=FT")
    expect(seriesUrl).toContain("filter%5Bprefix%5D=TEST")
    expect(seriesInit.method).toBe("GET")
  })

  it("does not fail OAuth when series lookup fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "at",
          refresh_token: "rt",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      })
    vi.stubGlobal("fetch", fetchMock)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    const result = await toconlineAdapter.connect({
      expertProfileId: "00000000-0000-4000-8000-000000000001",
      orgId: "00000000-0000-4000-8000-000000000002",
      userId: "00000000-0000-4000-8000-000000000003",
      payload: { code: "auth-code" },
    })

    expect(result.vaultRef).toBe("vault-ref")
    expect(result.metadata?.document_series_id).toBeUndefined()
    expect(warn).toHaveBeenCalled()
    expect(revokeOAuthToken).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it("fails OAuth when the access token is rejected during series lookup", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "at",
          refresh_token: "rt",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      toconlineAdapter.connect({
        expertProfileId: "00000000-0000-4000-8000-000000000001",
        orgId: "00000000-0000-4000-8000-000000000002",
        userId: "00000000-0000-4000-8000-000000000003",
        payload: { code: "auth-code" },
      })
    ).rejects.toMatchObject({ kind: "credentials" })
    expect(revokeOAuthToken).toHaveBeenCalledWith("vault-ref")
  })

  it("refuses issueInvoice by default because v1 auto-finalizes", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      toconlineAdapter.issueInvoice(creds, validIssueInput)
    ).rejects.toMatchObject({
      name: "AdapterError",
      kind: "fatal",
      providerCode: TOC_V1_AUTO_FINALIZE_BLOCKED,
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(decryptOAuthToken).not.toHaveBeenCalled()
  })

  it("still refuses issueInvoice when the allow flag is set", async () => {
    vi.stubEnv("TOCONLINE_ALLOW_V1_AUTO_FINALIZE", "true")
    resetEnvCache()
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      toconlineAdapter.issueInvoice(creds, validIssueInput)
    ).rejects.toMatchObject({
      providerCode: TOC_V1_AUTO_FINALIZE_BLOCKED,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refuses mixed-currency lines before any sales POST", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      toconlineAdapter.issueInvoice(creds, {
        ...validIssueInput,
        lines: [
          validIssueInput.lines[0]!,
          {
            description: "Travel",
            quantity: 1,
            unitPrice: 10,
            taxRate: 23,
            currency: "USD",
          },
        ],
      })
    ).rejects.toMatchObject({ kind: "validation" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not refresh a token that is still valid", async () => {
    vi.mocked(decryptOAuthToken).mockResolvedValue({
      accessToken: "live-at",
      refreshToken: "rt",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const loaded = await ensureToconlineAccessToken(
      "vault-ref",
      creds.metadata.orgId,
      creds.metadata.userId
    )
    expect(loaded).toMatchObject({
      accessToken: "live-at",
      vaultRef: "vault-ref",
      rotated: false,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refreshes an expired token with HTTP Basic and re-encrypts", async () => {
    vi.mocked(decryptOAuthToken).mockResolvedValue({
      accessToken: "stale-at",
      refreshToken: "rt",
      expiresAt: new Date(Date.now() - 1000),
    })
    vi.mocked(encryptOAuthToken).mockResolvedValue("vault-ref-rotated")
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-at",
        refresh_token: "new-rt",
        expires_in: 3600,
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const loaded = await ensureToconlineAccessToken(
      "vault-ref",
      creds.metadata.orgId,
      creds.metadata.userId
    )
    expect(loaded.rotated).toBe(true)
    expect(loaded.accessToken).toBe("new-at")
    expect(loaded.vaultRef).toBe("vault-ref-rotated")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toMatch(/^Basic /)
    expect(String(init.body)).toContain("grant_type=refresh_token")
    expect(encryptOAuthToken).toHaveBeenCalled()
  })

  it("treats tokens inside the refresh skew as expired", () => {
    expect(needsToconlineTokenRefresh(new Date(Date.now() + 10_000))).toBe(true)
    expect(
      needsToconlineTokenRefresh(new Date(Date.now() + 10 * 60 * 1000))
    ).toBe(false)
  })
})
