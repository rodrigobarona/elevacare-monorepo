/**
 * Vercel BotID server-side check. Wraps `checkBotId()` from `botid/server`.
 *
 * Returns `{ isBot: true }` if the request is from a bot.
 * Returns `{ isBot: false }` if the request is from a human.
 * Returns `null` if BotID is not configured or unavailable.
 *
 * Callers are responsible for building the appropriate Response
 * (e.g. via secureJson with CORS headers).
 *
 * BotID is opt-in: if the `botid` package is not installed or the
 * environment does not support it (e.g. local dev), requests pass through.
 *
 * Install BotID: `pnpm --filter @eleva/api add botid`
 * Then add <BotIdClient> in the consuming app's root layout.
 */
export interface BotVerdict {
  isBot: boolean
}

export async function checkBot(options?: {
  checkLevel?: "basic" | "deepAnalysis"
}): Promise<BotVerdict | null> {
  try {
    const mod = await (Function('return import("botid/server")')() as Promise<{
      checkBotId: (opts: {
        advancedOptions?: { checkLevel?: string }
      }) => Promise<{ isBot: boolean }>
    }>)

    const verification = await mod.checkBotId({
      advancedOptions: {
        checkLevel: options?.checkLevel ?? "basic",
      },
    })

    return { isBot: verification.isBot }
  } catch {
    // `botid` not installed or not in a Vercel environment -- pass through
  }

  return null
}
