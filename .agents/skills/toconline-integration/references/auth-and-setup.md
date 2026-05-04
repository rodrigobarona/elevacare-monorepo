# TOConline Authentication and Setup

## Base URLs

| Environment | API                          | OAuth                              |
| ----------- | ---------------------------- | ---------------------------------- |
| Production  | `https://api33.toconline.pt` | `https://app33.toconline.pt/oauth` |

**Do NOT use** `api.toconline.pt` — the correct host is `api33.toconline.pt`.

## OAuth 2.0 Authorization Code + PKCE

TOConline uses Authorization Code flow with PKCE (S256). This is **not** client credentials.

### Authorization request

```
GET https://app33.toconline.pt/oauth/auth
  ?response_type=code
  &client_id={TOCONLINE_CLIENT_ID}
  &redirect_uri={TOCONLINE_REDIRECT_URI}
  &scope=commercial
  &code_challenge={sha256_base64url(verifier)}
  &code_challenge_method=S256
```

### Token exchange

```
POST https://app33.toconline.pt/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code={authorization_code}
&redirect_uri={TOCONLINE_REDIRECT_URI}
&client_id={TOCONLINE_CLIENT_ID}
&client_secret={TOCONLINE_CLIENT_SECRET}
&code_verifier={verifier}
```

Response:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 7200,
  "token_type": "Bearer"
}
```

### Token refresh

```
POST https://app33.toconline.pt/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token={refresh_token}
&client_id={TOCONLINE_CLIENT_ID}
&client_secret={TOCONLINE_CLIENT_SECRET}
```

### Key parameters

| Parameter      | Value                           |
| -------------- | ------------------------------- |
| Grant type     | `authorization_code`            |
| Scope          | `commercial`                    |
| PKCE           | S256 challenge                  |
| Client auth    | Body params (not Basic header)  |
| Token delivery | `Authorization: Bearer {token}` |

### Token storage

Store tokens via WorkOS Vault (`packages/encryption`). Never persist tokens in plain text. The `expert_integration_credentials` table in Neon holds vault-encrypted per-expert credentials for Tier 2 adapters.

## Request Headers

### v1 endpoints (`/api/v1/...`)

```
Authorization: Bearer {access_token}
Content-Type: application/json
Accept: application/json
```

### Legacy endpoints (`/api/...`)

```
Authorization: Bearer {access_token}
Content-Type: application/vnd.api+json
Accept: application/json
```

## Environment Variables

```bash
TOCONLINE_API_URL=https://api33.toconline.pt
TOCONLINE_OAUTH_URL=https://app33.toconline.pt/oauth
TOCONLINE_CLIENT_ID=           # from TOConline support
TOCONLINE_CLIENT_SECRET=       # from TOConline support
TOCONLINE_REDIRECT_URI=        # your app callback URL
TOCONLINE_SERIES_PREFIX=ELEVA  # already configured
```

## Document Series

The `ELEVA` prefix is already configured in TOConline. Retrieve the series ID at startup or cache it:

```
GET /api/commercial_document_series?filter[prefix]=ELEVA&filter[document_type]=FT
```

Response includes `id` — use this as `document_series_id` when creating sales documents in the legacy API, or rely on the prefix-based auto-assignment in the v1 API.

### Series naming

| Series              | Type | Purpose                           |
| ------------------- | ---- | --------------------------------- |
| `ELEVA-FEE-{YYYY}`  | FT   | Per-booking platform fee invoices |
| `ELEVA-SAAS-{YYYY}` | FT   | Monthly clinic SaaS invoices      |
| `ELEVA-NC-{YYYY}`   | NC   | Credit notes (refunds)            |

## Feature Flags

All TOConline integration code must be gated behind feature flags (`packages/flags`):

- `ff.toconline_invoicing_enabled` — master toggle for Tier 1 (Eleva's own invoices)
- `ff.expert_invoicing_apps_enabled` — master toggle for Tier 2 (expert adapters)
- `ff.invoicing.toconline` — TOConline-specific adapter toggle
- `ff.invoicing.moloni` — Moloni adapter toggle

Staged rollout: staging -> 1 pilot expert -> all PT experts -> default on.

## API Client Pattern

```typescript
import { decrypt } from "@eleva/encryption"

class ToconlineClient {
  private baseUrl: string
  private accessToken: string
  private refreshToken: string

  constructor(config: { apiUrl: string; tokens: EncryptedTokens }) {
    this.baseUrl = config.apiUrl
    const decrypted = decrypt(config.tokens)
    this.accessToken = decrypted.access_token
    this.refreshToken = decrypted.refresh_token
  }

  private async request(method: string, path: string, body?: unknown) {
    const isV1 = path.startsWith("/api/v1/")
    const contentType = isV1 ? "application/json" : "application/vnd.api+json"

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": contentType,
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (response.status === 401) {
      await this.refreshAccessToken()
      return this.request(method, path, body)
    }

    if (!response.ok) {
      throw new ToconlineApiError(response.status, await response.text())
    }

    return response.json()
  }

  async get(path: string, params?: Record<string, string>) {
    const url = params ? `${path}?${new URLSearchParams(params)}` : path
    return this.request("GET", url)
  }

  async post(path: string, body: unknown) {
    return this.request("POST", path, body)
  }

  async patch(path: string, body: unknown) {
    return this.request("PATCH", path, body)
  }
}
```
