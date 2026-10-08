import { hkdfSync } from "node:crypto"
import { SignJWT, jwtVerify } from "jose"
import { z } from "zod"
import { JOIN_TRAIL_MS } from "./join-window"

const PURPOSE = "session-join"
const KEY_INFO = "eleva:session-join-grant:v1"

export const joinGrantRoleSchema = z.enum(["member", "expert"])

export type JoinGrantRole = z.infer<typeof joinGrantRoleSchema>

export const joinGrantClaimsSchema = z.object({
  purpose: z.literal(PURPOSE),
  bookingId: z.string().uuid(),
  role: joinGrantRoleSchema,
  scheduleRevision: z.number().int().nonnegative(),
})

export type JoinGrantClaims = z.infer<typeof joinGrantClaimsSchema>

export type MintJoinGrantInput = {
  bookingId: string
  role: JoinGrantRole
  endsAt: Date
  scheduleRevision: number
  now?: Date
  secret?: string
}

function grantKey(secret = process.env.BETTER_AUTH_SECRET): Uint8Array {
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required for join grants")
  }
  return new Uint8Array(hkdfSync("sha256", secret, "", KEY_INFO, 32))
}

export function joinGrantExpUnix(endsAt: Date): number {
  return Math.floor((endsAt.getTime() + JOIN_TRAIL_MS) / 1000)
}

export async function mintJoinGrant(
  input: MintJoinGrantInput
): Promise<string> {
  const now = input.now ?? new Date()
  const iat = Math.floor(now.getTime() / 1000)
  const exp = joinGrantExpUnix(input.endsAt)
  if (exp <= iat) {
    throw new Error("join grant exp must be in the future")
  }

  return new SignJWT({
    purpose: PURPOSE,
    bookingId: input.bookingId,
    role: input.role,
    scheduleRevision: input.scheduleRevision,
  } satisfies JoinGrantClaims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(grantKey(input.secret))
}

export async function verifyJoinGrant(
  token: string,
  options?: { secret?: string; now?: Date }
): Promise<JoinGrantClaims | null> {
  try {
    const { payload } = await jwtVerify(token, grantKey(options?.secret), {
      algorithms: ["HS256"],
      typ: "JWT",
      clockTolerance: 60,
      currentDate: options?.now,
    })
    const parsed = joinGrantClaimsSchema.safeParse(payload)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function sessionJoinPath(bookingId: string, grant: string): string {
  const params = new URLSearchParams({ g: grant })
  return `/join/${bookingId}?${params.toString()}`
}
