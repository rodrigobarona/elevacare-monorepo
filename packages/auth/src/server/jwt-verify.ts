import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose"

const JWKS_CACHE = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

/**
 * Better Auth serves its keys under its own base path (`…/auth/jwks`). A
 * relative "jwks" keeps that path; "/jwks" would resolve from the domain
 * root and 404, so every bearer JWT would fail to verify.
 */
export function jwksUrlFor(issuer: string): URL {
  return new URL("jwks", issuer.endsWith("/") ? issuer : `${issuer}/`)
}

export async function verifyBetterAuthJwt(token: string): Promise<JWTPayload> {
  const issuer = process.env.BETTER_AUTH_URL
  if (!issuer) {
    throw new Error("BETTER_AUTH_URL is required to verify JWTs")
  }

  const jwksUrl = jwksUrlFor(issuer)
  const cacheKey = jwksUrl.toString()
  let jwks = JWKS_CACHE.get(cacheKey)
  if (!jwks) {
    jwks = createRemoteJWKSet(jwksUrl)
    JWKS_CACHE.set(cacheKey, jwks)
  }

  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience: issuer,
    algorithms: ["EdDSA"],
  })
  return payload
}
