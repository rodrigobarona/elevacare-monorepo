import { WorkOS } from "@workos-inc/node"
import { env, requireAuthEnv } from "@eleva/config/env"

/**
 * Single WorkOS SDK instance used by every @eleva/encryption helper.
 *
 * Vault operations funnel through here; direct `@workos-inc/node`
 * imports elsewhere in the monorepo are blocked by
 * @eleva/eslint-config/boundaries. The matching boundary rule for
 * the auth-only WorkOS surface lives in @eleva/auth.
 */

let _client: WorkOS | null = null

export function workos(): WorkOS {
  if (_client) return _client
  const { WORKOS_API_KEY } = requireAuthEnv()
  _client = new WorkOS(WORKOS_API_KEY)
  return _client
}

export function vaultNamespace(): string {
  return env().WORKOS_VAULT_NAMESPACE
}

export function __resetWorkosClientForTests() {
  _client = null
}
