import { getAuthApi } from "./server/auth"

export interface ProviderAccessTokenInput {
  providerId: string
  accountId: string
  userId: string
}

/**
 * Only Better Auth token API call site. `providerId` is accepted for
 * callers but is not a Better Auth account selector.
 */
export async function getProviderAccessToken(
  input: ProviderAccessTokenInput
): Promise<string> {
  const result = await getAuthApi().getAccessToken({
    body: {
      accountId: input.accountId,
      userId: input.userId,
    },
  })
  const token = result?.accessToken
  if (!token) {
    throw new Error("needs_reauthorization")
  }
  return token
}
