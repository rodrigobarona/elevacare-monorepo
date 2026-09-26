import type { CalendarProvider } from "./types"
import { CalendarTokenError } from "./errors"

export { CalendarTokenError }

export interface GetProviderAccessTokenInput {
  providerId: string
  accountId: string
  userId: string
}

export type GetProviderAccessToken = (
  input: GetProviderAccessTokenInput
) => Promise<string>

const PROVIDER_ID: Record<CalendarProvider, string> = {
  google: "google",
  microsoft: "microsoft",
}

/**
 * Better Auth folds revoked grants and transient refresh failures into one
 * `FAILED_TO_GET_ACCESS_TOKEN`, so only an unlinked account or a missing
 * token is a confirmed reauthorization; everything else is `token_unavailable`.
 */
function tokenFailureCode(err: unknown): string {
  if (err instanceof Error && err.message === "needs_reauthorization") {
    return "needs_reauthorization"
  }
  const body =
    err && typeof err === "object" && "body" in err ? err.body : undefined
  const code =
    body && typeof body === "object" && "code" in body ? String(body.code) : ""
  return code === "ACCOUNT_NOT_FOUND"
    ? "account_not_found"
    : "token_unavailable"
}

export function createCredentialManager(deps: {
  getProviderAccessToken: GetProviderAccessToken
}) {
  return {
    async getCalendarToken(
      userId: string,
      provider: CalendarProvider,
      accountId: string
    ): Promise<string> {
      try {
        return await deps.getProviderAccessToken({
          providerId: PROVIDER_ID[provider],
          accountId,
          userId,
        })
      } catch (err) {
        if (err instanceof CalendarTokenError) throw err
        throw new CalendarTokenError(tokenFailureCode(err))
      }
    },
  }
}

export function requireAuthAccountId(
  accountId: string | null | undefined
): string {
  if (!accountId) {
    throw new CalendarTokenError("not_installed")
  }
  return accountId
}
