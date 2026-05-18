/**
 * Vercel BotID server-side check. Wraps `checkBotId()` from `botid/server`.
 *
 * Returns null if the request is from a human (or BotID is not configured).
 * Returns a 403 Response if the request is from a bot.
 *
 * BotID is opt-in: if the `botid` package is not installed or the
 * environment does not support it (e.g. local dev), requests pass through.
 *
 * Install BotID: `pnpm --filter @eleva/api add botid`
 * Then add <BotIdClient> in the consuming app's root layout.
 */
export async function checkBot(options?: {
  checkLevel?: "basic" | "deepAnalysis"
}): Promise<Response | null> {
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

    if (verification.isBot) {
      return Response.json({ error: "blocked" }, { status: 403 })
    }
  } catch {
    // `botid` not installed or not in a Vercel environment -- pass through
  }

  return null
}
