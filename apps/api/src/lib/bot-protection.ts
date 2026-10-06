import { checkBotId } from "botid/server"

/**
 * Vercel BotID server-side check.
 *
 * `BOTID_MODE` controls rollout (default `off`):
 * - `off`: no check, returns `null` (local dev, production until staging proof).
 * - `monitor`: runs the check and logs the verdict, never blocks.
 * - `enforce`: blocks bots on `enforceable` routes; a failed check is treated
 *   as a bot. Non-enforceable routes stay in monitor behaviour, because they
 *   are also called server-to-server (Server Actions) without BotID headers.
 *
 * The booking funnel reaches the API through the gateway's same-origin
 * `/api/*` rewrite (BotID only signs same-origin requests), so the frontend
 * hosts must be listed in `BOTID_EXTRA_ALLOWED_HOSTS`.
 */
export interface BotVerdict {
  isBot: boolean
}

export type BotIdMode = "off" | "monitor" | "enforce"

export function resolveBotIdMode(
  value: string | undefined = process.env.BOTID_MODE
): BotIdMode {
  return value === "monitor" || value === "enforce" ? value : "off"
}

export function resolveExtraAllowedHosts(
  value: string | undefined = process.env.BOTID_EXTRA_ALLOWED_HOSTS
): string[] {
  return (value ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean)
}

export async function checkBot(options?: {
  checkLevel?: "basic" | "deepAnalysis"
  enforceable?: boolean
}): Promise<BotVerdict | null> {
  const mode = resolveBotIdMode()
  if (mode === "off") return null

  const checkLevel = options?.checkLevel ?? "basic"
  const enforce = mode === "enforce" && options?.enforceable === true

  let isBot: boolean
  try {
    const verification = await checkBotId({
      advancedOptions: {
        checkLevel,
        extraAllowedHosts: resolveExtraAllowedHosts(),
      },
    })
    isBot = verification.isBot
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "botid.error",
        mode,
        enforce,
        message: err instanceof Error ? err.message : String(err),
      })
    )
    return enforce ? { isBot: true } : null
  }

  console.info(
    JSON.stringify({ event: "botid.verdict", mode, enforce, checkLevel, isBot })
  )
  return enforce ? { isBot } : null
}
