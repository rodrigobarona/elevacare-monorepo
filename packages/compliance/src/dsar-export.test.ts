import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  ensurePhase5DsarCollectors,
  PHASE5_DSAR_COLLECTOR_IDS,
} from "./dsar-phase5-collectors"
import {
  listDsarCollectors,
  registerDsarCollector,
  resetDsarCollectorsForTests,
} from "./dsar-collectors"
import {
  DSAR_SIGNED_URL_TTL_SECONDS,
  buildDsarDownloadUrl,
  dsarExport,
  signDsarDownloadToken,
  verifyDsarDownloadToken,
} from "./dsar-export"

const uploadPrivateBlob = vi.fn()

vi.mock("@eleva/storage", () => ({
  uploadPrivateBlob: (...args: unknown[]) => uploadPrivateBlob(...args),
}))

vi.mock("@eleva/db", () => ({
  getMemberProfile: async () => ({
    id: "user-1",
    email: "ada@eleva.care",
    name: "Ada",
    timezone: "Europe/Lisbon",
    locale: "en",
    avatarUrl: null,
  }),
  listMemberBookings: async () => ({ items: [], nextCursor: null }),
  listMemberPayments: async () => ({ items: [], nextCursor: null }),
  listMemberNotificationPreferences: async () => [],
}))

vi.mock("./member-consents", () => ({
  listMemberConsents: async () => [],
}))

afterEach(() => {
  resetDsarCollectorsForTests()
  uploadPrivateBlob.mockReset()
  vi.unstubAllEnvs()
})

describe("Phase 5 DSAR collectors", () => {
  it("registers the five Phase 5 collectors and includes a later extra", () => {
    expect(listDsarCollectors()).toEqual([])
    ensurePhase5DsarCollectors()
    expect(listDsarCollectors().map((collector) => collector.id)).toEqual([
      ...PHASE5_DSAR_COLLECTOR_IDS,
    ])
    registerDsarCollector({
      id: "notes",
      collect: async () => ({ filename: "notes", json: { extra: true } }),
    })
    expect(listDsarCollectors().map((collector) => collector.id)).toEqual([
      ...PHASE5_DSAR_COLLECTOR_IDS,
      "notes",
    ])
  })
})

describe("dsarExport", () => {
  beforeEach(() => {
    uploadPrivateBlob.mockResolvedValue({
      url: "https://private.blob.vercel-storage.com/dsar/user-1/export.zip",
      pathname: "dsar/user-1/export.zip",
    })
  })

  it("zips JSON and CSV from Phase 5 collectors plus a fake extra", async () => {
    ensurePhase5DsarCollectors()
    registerDsarCollector({
      id: "notes",
      collect: async () => ({
        filename: "notes",
        json: { extra: true },
        csv: "extra\ntrue\n",
      }),
    })

    const result = await dsarExport("user-1")
    expect(uploadPrivateBlob).toHaveBeenCalledTimes(1)
    const upload = uploadPrivateBlob.mock.calls[0]![0] as {
      pathname: string
      contentType: string
      body: Buffer
    }
    expect(upload.pathname).toBe("dsar/user-1/export.zip")
    expect(upload.contentType).toBe("application/zip")
    const zip = upload.body.toString("latin1")
    for (const name of [
      "profile.json",
      "profile.csv",
      "bookings.json",
      "bookings.csv",
      "payments.json",
      "payments.csv",
      "consents.json",
      "consents.csv",
      "notification_preferences.json",
      "notification_preferences.csv",
      "notes.json",
      "notes.csv",
    ]) {
      expect(zip).toContain(name)
    }
    expect(result.blobUrl).toContain("export.zip")
  })
})

describe("DSAR signed download token", () => {
  beforeEach(() => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-better-auth-secret")
  })

  it("round-trips and rejects expired signatures", () => {
    const exp = Math.floor(Date.now() / 1000) + DSAR_SIGNED_URL_TTL_SECONDS
    const sig = signDsarDownloadToken("dsar-1", exp)
    expect(verifyDsarDownloadToken("dsar-1", exp, sig)).toBe(true)
    const expiredExp = Math.floor(Date.now() / 1000) - 1
    const expiredSig = signDsarDownloadToken("dsar-1", expiredExp)
    expect(verifyDsarDownloadToken("dsar-1", expiredExp, expiredSig)).toBe(
      false
    )
    const url = buildDsarDownloadUrl({
      apiBaseUrl: "https://api.eleva.care",
      dsarId: "11111111-1111-4111-8111-111111111111",
      expiresAt: new Date(exp * 1000),
    })
    expect(url).toContain(
      "/privacy/dsar/11111111-1111-4111-8111-111111111111/file"
    )
    expect(url).toContain("sig=")
  })
})
