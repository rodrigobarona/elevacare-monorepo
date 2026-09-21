import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { handleTwilioStatusWebhook } from "./handle-twilio-status"
import {
  adoptTwilioMessage,
  appendSmsRef,
  hashSmsBody,
  smsRefToken,
  twilioSignedUrl,
  validateTwilioSignature,
} from "./send-sms"

const DELIVERY_ID = "00000000-0000-4000-8000-000000000099"

describe("sms body uniqueness", () => {
  it("appends an 8-char base32 ref derived from the delivery id", () => {
    const token = smsRefToken(DELIVERY_ID)
    expect(token).toMatch(/^[A-Z2-7]{8}$/)
    expect(appendSmsRef("Tomorrow at 10:00", DELIVERY_ID)).toBe(
      `Tomorrow at 10:00\nRef ${token}`
    )
  })

  it("adopts only a Twilio message whose body hash matches", () => {
    const body = appendSmsRef("Tomorrow at 10:00", DELIVERY_ID)
    const hash = hashSmsBody(body)
    expect(
      adoptTwilioMessage(
        [
          { sid: "SM_other", body: "different" },
          { sid: "SM_match", body },
        ],
        hash
      )?.sid
    ).toBe("SM_match")
    expect(adoptTwilioMessage([{ sid: "SM_other", body: "nope" }], hash)).toBe(
      null
    )
  })
})

function expectedTwilioSignature(
  token: string,
  url: string,
  params: Record<string, string>
): string {
  const data = [...Object.keys(params)]
    .sort()
    .reduce((acc: string, key: string) => acc + key + params[key], url)
  return createHmac("sha1", token)
    .update(Buffer.from(data, "utf8"))
    .digest("base64")
}

describe("Twilio signature URL", () => {
  const previousApi = process.env.API_URL
  const previousToken = process.env.TWILIO_AUTH_TOKEN

  function restoreEnv() {
    if (previousApi === undefined) delete process.env.API_URL
    else process.env.API_URL = previousApi
    if (previousToken === undefined) delete process.env.TWILIO_AUTH_TOKEN
    else process.env.TWILIO_AUTH_TOKEN = previousToken
  }

  it("keeps percent-encoded query bytes and rejects a sorted reconstruction", () => {
    process.env.API_URL = "https://api.eleva.care"
    process.env.TWILIO_AUTH_TOKEN = "test-token"
    try {
      const incoming = new Request(
        "https://internal.example/webhooks/twilio/status?deliveryId=abc%2Fdef&z=1"
      )
      const signed = twilioSignedUrl(incoming)
      expect(signed).toBe(
        "https://api.eleva.care/webhooks/twilio/status?deliveryId=abc%2Fdef&z=1"
      )
      const params = { MessageSid: "SM1", MessageStatus: "sent" }
      const signature = expectedTwilioSignature("test-token", signed!, params)
      expect(validateTwilioSignature({ signature, url: signed!, params })).toBe(
        true
      )

      const sorted =
        "https://api.eleva.care/webhooks/twilio/status?z=1&deliveryId=abc%2Fdef"
      expect(validateTwilioSignature({ signature, url: sorted, params })).toBe(
        false
      )
    } finally {
      restoreEnv()
    }
  })

  it("rejects a missing or invalid StatusCallback signature", async () => {
    process.env.API_URL = "https://api.eleva.care"
    process.env.TWILIO_AUTH_TOKEN = "test-token"
    try {
      const missing = await handleTwilioStatusWebhook(
        new Request(
          "https://api.eleva.care/webhooks/twilio/status?deliveryId=x",
          { method: "POST", body: new URLSearchParams({ MessageSid: "SM1" }) }
        )
      )
      expect(missing.status).toBe(401)

      const invalid = await handleTwilioStatusWebhook(
        new Request(
          "https://api.eleva.care/webhooks/twilio/status?deliveryId=x",
          {
            method: "POST",
            headers: { "X-Twilio-Signature": "not-valid" },
            body: new URLSearchParams({
              MessageSid: "SM1",
              MessageStatus: "sent",
            }),
          }
        )
      )
      expect(invalid.status).toBe(401)
    } finally {
      restoreEnv()
    }
  })
})
