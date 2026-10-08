import { SignJWT, jwtVerify } from "jose"
import { z } from "zod"

export type MintMeetingTokenInput = {
  roomName: string
  userId: string
  userName: string
  isOwner: boolean
  exp: number
  domainId: string
  apiKey: string
}

/**
 * Self-signed Daily JWT claims use the abbreviations in
 * https://docs.daily.co/docs/guides/privacy-and-security/self-signing-tokens
 * (`ud` = user_id, `u` = user_name, `ejt` = eject_at_token_exp,
 * `erui` = enable_recording_ui). Omit `er` / `sr` so recording stays off.
 */
export const meetingTokenClaimsSchema = z.object({
  r: z.string().min(1),
  d: z.string().min(1),
  o: z.boolean(),
  ud: z.string().min(1),
  u: z.string(),
  ejt: z.literal(true),
  erui: z.literal(false),
})

export type MeetingTokenClaims = z.infer<typeof meetingTokenClaimsSchema>

function encoder() {
  return new TextEncoder()
}

export async function mintMeetingToken(
  input: MintMeetingTokenInput
): Promise<string> {
  if (!input.roomName) {
    throw new Error(
      "room_name is required — a token without it opens every room"
    )
  }
  if (!input.domainId) {
    throw new Error("Daily domain id is required to self-sign a meeting token")
  }
  if (!input.apiKey) {
    throw new Error("Daily API key is required")
  }
  if (!input.userId) {
    throw new Error("user_id is required")
  }

  const now = Math.floor(Date.now() / 1000)
  if (input.exp <= now) {
    throw new Error("token exp must be in the future")
  }

  return new SignJWT({
    r: input.roomName,
    d: input.domainId,
    o: input.isOwner,
    ud: input.userId,
    u: input.userName,
    ejt: true,
    erui: false,
  } satisfies MeetingTokenClaims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(input.exp)
    .sign(encoder().encode(input.apiKey))
}

export async function readMeetingTokenClaims(
  token: string,
  apiKey: string
): Promise<MeetingTokenClaims> {
  const { payload } = await jwtVerify(token, encoder().encode(apiKey), {
    algorithms: ["HS256"],
  })
  const parsed = meetingTokenClaimsSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error("meeting token claims are malformed")
  }
  return parsed.data
}
