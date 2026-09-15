import { describe, expect, it } from "vitest"
import {
  ACCOUNTING_OAUTH_STATE_TTL_MS,
  createAccountingOAuthNonce,
  encodeAccountingOAuthState,
  parseAccountingOAuthState,
  storedAccountingOAuthNonce,
  verifyStoredAccountingOAuthNonce,
} from "./oauth-state"

const PROFILE_ID = "00000000-0000-0000-0000-000000000001"
const USER_ID = "00000000-0000-0000-0000-000000000003"

describe("accounting OAuth state", () => {
  it("round-trips a nonce-bound state string", () => {
    const nonce = createAccountingOAuthNonce()
    const encoded = encodeAccountingOAuthState({
      provider: "toconline",
      expertProfileId: PROFILE_ID,
      nonce,
    })
    expect(parseAccountingOAuthState(encoded)).toEqual({
      provider: "toconline",
      expertProfileId: PROFILE_ID,
      nonce,
    })
  })

  it("rejects predictable two-part states", () => {
    expect(parseAccountingOAuthState(`toconline:${PROFILE_ID}`)).toBeNull()
  })

  it("rejects a stored nonce that does not match the callback", () => {
    const nonce = createAccountingOAuthNonce()
    const other = createAccountingOAuthNonce()
    const stored = storedAccountingOAuthNonce({
      accountingOAuth: {
        nonce,
        provider: "toconline",
        userId: USER_ID,
        expertProfileId: PROFILE_ID,
        exp: Date.now() + ACCOUNTING_OAUTH_STATE_TTL_MS,
      },
    })
    expect(
      verifyStoredAccountingOAuthNonce({
        stored,
        state: {
          provider: "toconline",
          expertProfileId: PROFILE_ID,
          nonce: other,
        },
        userId: USER_ID,
      })
    ).toBe(false)
  })

  it("rejects an expired nonce even when the value matches", () => {
    const nonce = createAccountingOAuthNonce()
    const stored = storedAccountingOAuthNonce({
      accountingOAuth: {
        nonce,
        provider: "toconline",
        userId: USER_ID,
        expertProfileId: PROFILE_ID,
        exp: Date.now() - 1,
      },
    })
    expect(
      verifyStoredAccountingOAuthNonce({
        stored,
        state: {
          provider: "toconline",
          expertProfileId: PROFILE_ID,
          nonce,
        },
        userId: USER_ID,
      })
    ).toBe(false)
  })

  it("rejects a nonce reused against a different expert profile", () => {
    const nonce = createAccountingOAuthNonce()
    const stored = storedAccountingOAuthNonce({
      accountingOAuth: {
        nonce,
        provider: "toconline",
        userId: USER_ID,
        expertProfileId: PROFILE_ID,
        exp: Date.now() + ACCOUNTING_OAUTH_STATE_TTL_MS,
      },
    })
    expect(
      verifyStoredAccountingOAuthNonce({
        stored,
        state: {
          provider: "toconline",
          expertProfileId: "00000000-0000-0000-0000-000000000099",
          nonce,
        },
        userId: USER_ID,
      })
    ).toBe(false)
  })

  it("accepts a matching unexpired nonce bound to the same user", () => {
    const nonce = createAccountingOAuthNonce()
    const stored = storedAccountingOAuthNonce({
      accountingOAuth: {
        nonce,
        provider: "toconline",
        userId: USER_ID,
        expertProfileId: PROFILE_ID,
        exp: Date.now() + ACCOUNTING_OAUTH_STATE_TTL_MS,
      },
    })
    expect(
      verifyStoredAccountingOAuthNonce({
        stored,
        state: {
          provider: "toconline",
          expertProfileId: PROFILE_ID,
          nonce,
        },
        userId: USER_ID,
      })
    ).toBe(true)
  })
})
