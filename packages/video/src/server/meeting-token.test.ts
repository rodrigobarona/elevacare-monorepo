import { SignJWT } from "jose"
import { describe, expect, it } from "vitest"
import { mintMeetingToken, readMeetingTokenClaims } from "./meeting-token"

const API_KEY = "test-daily-api-key"
const DOMAIN_ID = "11111111-2222-4333-8444-555555555555"

describe("mintMeetingToken", () => {
  it("self-signs a room-scoped HS256 token with recording off", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600
    const token = await mintMeetingToken({
      roomName: "eleva-11111111-1111-4111-8111-111111111111",
      userId: "user_1",
      userName: "Ana",
      isOwner: true,
      exp,
      domainId: DOMAIN_ID,
      apiKey: API_KEY,
    })

    const claims = await readMeetingTokenClaims(token, API_KEY)
    expect(claims.r).toBe("eleva-11111111-1111-4111-8111-111111111111")
    expect(claims.d).toBe(DOMAIN_ID)
    expect(claims.o).toBe(true)
    expect(claims.u).toBe("user_1")
    expect(claims.user_name).toBe("Ana")
    expect(claims.enable_recording).toBe(false)
    expect(claims.eject_at_token_exp).toBe(true)
  })

  it("refuses a token without a room name", async () => {
    await expect(
      mintMeetingToken({
        roomName: "",
        userId: "user_1",
        userName: "Ana",
        isOwner: false,
        exp: Math.floor(Date.now() / 1000) + 60,
        domainId: DOMAIN_ID,
        apiKey: API_KEY,
      })
    ).rejects.toThrow(/room_name/)
  })

  it("rejects verified tokens whose claims do not match the contract", async () => {
    const token = await new SignJWT({
      r: "eleva-x",
      d: DOMAIN_ID,
      o: "yes",
      u: "user_1",
      user_name: "Ana",
      enable_recording: false,
      eject_at_token_exp: true,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(new TextEncoder().encode(API_KEY))

    await expect(readMeetingTokenClaims(token, API_KEY)).rejects.toThrow(
      /malformed/
    )
  })

  it("refuses a token without a domain id", async () => {
    await expect(
      mintMeetingToken({
        roomName: "eleva-x",
        userId: "user_1",
        userName: "Ana",
        isOwner: false,
        exp: Math.floor(Date.now() / 1000) + 60,
        domainId: "",
        apiKey: API_KEY,
      })
    ).rejects.toThrow(/domain id/)
  })
})
