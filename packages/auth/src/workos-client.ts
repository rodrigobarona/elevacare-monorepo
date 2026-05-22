import { WorkOS } from "@workos-inc/node"

let _workos: WorkOS | null = null

/**
 * Singleton WorkOS SDK client. Reads WORKOS_API_KEY and WORKOS_CLIENT_ID
 * from the environment. The clientId is required so that widget tokens are
 * bound to the correct application (and its allowed-origins CORS list).
 */
export function getWorkOS(): WorkOS {
  if (!_workos) {
    const key = process.env.WORKOS_API_KEY
    if (!key) throw new Error("WORKOS_API_KEY is required")
    const clientId = process.env.WORKOS_CLIENT_ID
    if (!clientId) throw new Error("WORKOS_CLIENT_ID is required")
    _workos = new WorkOS(key, { clientId })
  }
  return _workos
}
