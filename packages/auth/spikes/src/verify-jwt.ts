import { createRemoteJWKSet, jwtVerify } from "jose"

const token = process.argv[2]
const jwksUrl = process.argv[3]
if (!token || !jwksUrl) {
  console.error("usage: verify-jwt <token> <jwks-url>")
  process.exit(2)
}

const issuer = process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:8787"
const jwks = createRemoteJWKSet(new URL(jwksUrl))
const { payload, protectedHeader } = await jwtVerify(token, jwks, {
  issuer,
  audience: issuer,
  algorithms: ["EdDSA"],
})
console.log(
  JSON.stringify({
    alg: protectedHeader.alg,
    kid: protectedHeader.kid,
    sub: payload.sub,
    claims: Object.keys(payload),
  })
)
