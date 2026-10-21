# Google OAuth + Calendar setup (operator)

Status: **operator-gated** (console checkboxes below). Repo SSOT for this
flow landed 2026-10-20: this guide, `pnpm check:google-oauth`, and corrected
callback URLs in [`environment-matrix.md`](../environment-matrix.md). Eleva
code already wires one Better Auth Google provider for social login and
calendar `linkSocial`. Run the console + env steps to close Phase **02**
(real Google OAuth + `trustedOrigins`) and exercise Phase **03–04B** Google
calendar connect / busy. Do **not** stamp 04B “proven” — founder waived
human evidence 2026-09-25; this only produces engineering proof.

SSOT for scopes: `@eleva/auth` `CALENDAR_OAUTH_SCOPES.google` in
[`packages/auth/src/client.ts`](../../../packages/auth/src/client.ts).
SSOT for trusted origins: [`packages/auth/src/trusted-origins.ts`](../../../packages/auth/src/trusted-origins.ts)
(not Google Cloud).

Print the exact URIs to paste into Google Cloud:

```bash
pnpm check:google-oauth
```

## Architecture (one client, one callback)

| Concern             | Value                                        |
| ------------------- | -------------------------------------------- |
| OAuth host          | `apps/api` Better Auth (`/auth/*`)           |
| Google redirect URI | `{BETTER_AUTH_URL}/callback/google`          |
| Social login        | `signIn.social({ provider: "google" })`      |
| Calendar connect    | `linkSocial` + calendar scopes               |
| Token storage       | Better Auth `account` (`encryptOAuthTokens`) |

**Do not register** stale paths (removed from the environment matrix):

- `…/calendar/oauth/google/callback`
- `https://eleva.care/calendar/google/callback`

---

## Step 1 — Google Cloud project

- [ ] Open [Google Cloud Console](https://console.cloud.google.com/)
- [ ] Create or select a project (e.g. `eleva-care`). One project with
      local + staging + prod redirect URIs is fine for launch.

## Step 2 — Enable APIs

**APIs & Services → Library**

- [ ] Enable **Google Calendar API** (list / freeBusy / events)

OAuth does not require a separate “Google+” API. Wait until Calendar shows
as Enabled.

## Step 3 — OAuth consent screen

**APIs & Services → OAuth consent screen**

- [ ] User type: **External**
- [ ] App name: `Eleva` (or `Eleva Care`)
- [ ] Support email + developer contact: founder/ops
- [ ] Homepage: `https://eleva.care` (privacy/terms when available)
- [ ] Scopes:
  - `openid`, `email`, `profile`
  - `https://www.googleapis.com/auth/calendar.readonly`
  - `https://www.googleapis.com/auth/calendar.events`
- [ ] **Publishing**
  - **Testing** (local/staging proof): add every Google account that will
    complete OAuth (founder, demo experts). In Testing mode Google expires
    refresh tokens after **7 days** when calendar scopes are granted, so
    expect to reconnect calendars weekly; a first successful connection is
    not proof of a durable calendar integration.
  - **In production** (public experts/members): Google may require
    verification for calendar scopes — start early; until then keep
    Testing + test users.

## Step 4 — OAuth Web client

**APIs & Services → Credentials → Create credentials → OAuth client ID →
Web application**

Name: e.g. `Eleva Better Auth`.

### Authorized JavaScript origins

| Env        | Origins                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Local      | `http://localhost:3000` … `http://localhost:3009` (safe set; at least account/app/api/expert ports you use) |
| Staging    | `https://dev.eleva.care`, `https://api.dev.eleva.care`                                                      |
| Production | `https://eleva.care`, `https://www.eleva.care`, `https://api.eleva.care`                                    |

### Authorized redirect URIs (exact)

| Env        | Redirect URI                                      |
| ---------- | ------------------------------------------------- |
| Local      | `http://localhost:3002/auth/callback/google`      |
| Staging    | `https://api.dev.eleva.care/auth/callback/google` |
| Production | `https://api.eleva.care/auth/callback/google`     |

- [ ] Create client → copy **Client ID** and **Client secret**

## Step 5 — Eleva env vars

Set on **`elevacare-api`** (and local `.env.local` via approved pull/copy).
Both ID and secret must be present or the Google button stays hidden.

| Variable                     | Local                        | Staging                                   | Production                    |
| ---------------------------- | ---------------------------- | ----------------------------------------- | ----------------------------- |
| `GOOGLE_OAUTH_CLIENT_ID`     | from Console                 | same client or staging client             | same                          |
| `GOOGLE_OAUTH_CLIENT_SECRET` | from Console                 | same                                      | same                          |
| `BETTER_AUTH_URL`            | `http://localhost:3002/auth` | `https://api.dev.eleva.care/auth`         | `https://api.eleva.care/auth` |
| `ELEVA_COOKIE_DOMAIN`        | usually unset locally        | `.eleva.care`                             | `.eleva.care`                 |
| `ELEVA_TRUSTED_ORIGINS`      | empty unless extra origin    | empty unless extra `https://*.eleva.care` | same                          |

- [ ] Local `.env.local` has ID + secret
- [ ] Vercel `elevacare-api` preview + production have ID + secret
- [ ] Redeploy API after setting secrets
- [ ] `pnpm check:google-oauth` exits 0

There is no live `GOOGLE_OAUTH_REDIRECT` env — Better Auth builds the
callback from `BETTER_AUTH_URL`.

`trustedOrigins` defaults already include prod, `dev.eleva.care`, admin
hosts, and local `3000–3009`. Only set `ELEVA_TRUSTED_ORIGINS` for an
extra approved HTTPS Eleva origin.

## Step 6 — Prove Phase 02 (AUD-049 real Google path)

Loopback passkey + `/login?error=account_not_linked` UI are done. Stamp
only after a **live** Google round-trip.

- [ ] Open account login (local gateway or `https://dev.eleva.care` / prod)
- [ ] Network: `accounts.google.com` → `…/auth/callback/google`
- [ ] Happy path: Google account that maps to an Eleva user (or intended
      signup) → session cookie lands
- [ ] `account_not_linked`: Google account whose verified email **already
      belongs to an Eleva user** with no linked Google account →
      `/login?error=account_not_linked` guidance (implicit linking is off).
      An email with no Eleva user tests signup, not this path.
- [ ] No CSRF / origin reject in API logs

## Step 7 — Prove Phase 03–04B Google calendar (unproven stamp)

Keep docs as **waived / unproven**. This is engineering evidence only.

- [ ] Expert practice → `/{orgSlug}/calendars`
- [ ] **Connect Google** → consent shows calendar scopes → return to page
- [ ] Integration syncs (`google-calendar`); refresh token present
      (`prompt=consent` + `accessType=offline` in auth server)
- [ ] Toggle `use_for_busy` + set destination calendar
- [ ] Busy block on that Google calendar shrinks public slots (freeBusy)
- [ ] Optional: second Google account; only enabled busy sources affect slots
- [ ] Publish offer → public booking → confirm destination write or ICS
      fallback per ADR-004

Microsoft uses a separate Azure app (`MICROSOFT_OAUTH_*`) — out of scope
here.

## Common failures

| Symptom                        | Likely cause                                                     |
| ------------------------------ | ---------------------------------------------------------------- |
| `redirect_uri_mismatch`        | Stale `/calendar/...` URI or `BETTER_AUTH_URL` ≠ registered host |
| No Google button               | Missing ID or secret on API process                              |
| `access_denied` / not verified | Testing mode; user not a test user                               |
| Connect OK, no busy            | Calendar API off, missing scopes, or `use_for_busy` off          |
| Works local, fails staging     | Missing staging redirect / JS origin / Vercel env; redeploy      |
| CSRF after redirect            | Frontend origin not in `trustedOrigins()`                        |

## Related

- [`environment-matrix.md`](../environment-matrix.md)
- [`adrs/ADR-004-scheduling-and-calendar-oauth.md`](../adrs/ADR-004-scheduling-and-calendar-oauth.md)
- [`adrs/ADR-017-better-auth-identity.md`](../adrs/ADR-017-better-auth-identity.md)
- [`audits/2026-10-phases-01-10-audit.md`](../audits/2026-10-phases-01-10-audit.md) (AUD-049)
- [`daily-setup.md`](./daily-setup.md)
