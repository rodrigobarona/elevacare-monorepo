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
        throw new CalendarTokenError("needs_reauthorization")
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
