import { env } from "@eleva/config/env"

/**
 * BetterStack heartbeat helper.
 *
 * Called from long-running workflows (auditOutboxDrainer, reminder
 * scheduler, reconciliation crons) to prove liveness on the BetterStack
 * status page. Missing a heartbeat for > N intervals pages the on-call.
 *
 * Never throws \u2014 heartbeat failure is monitored, not propagated.
 */

export async function heartbeat(name: string): Promise<void> {
  const url = env().BETTERSTACK_HEARTBEAT_URL
  if (!url) return // not configured in dev/test
  const endpoint = `${url.replace(/\/$/, "")}/${encodeURIComponent(name)}`
  try {
    await fetch(endpoint, { method: "POST" })
  } catch {
    // Swallow \u2014 the heartbeat itself should not page.
  }
}
