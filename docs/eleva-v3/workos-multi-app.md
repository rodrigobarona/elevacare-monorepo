# WorkOS Multi-Application Setup

## Overview

All Eleva web apps (member, expert, team, academy, account, admin)
share a **single WorkOS Application** and a single session cookie
scoped to `.eleva.care`. The Eleva Diary mobile app (future) uses a
**separate WorkOS Application** with its own client ID and token-based
auth.

## Web Platform — Shared Session Architecture

All web apps share the same `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, and
critically the same `WORKOS_COOKIE_PASSWORD`. The AuthKit cookie is
scoped to `.eleva.care`, making it readable across:

- `eleva.care` (gateway + proxy targets: app, expert, team, academy, account)
- `admin.eleva.care` (platform operations)
- `api.eleva.care` (server endpoints)

The account app (`apps/account`) runs behind the gateway proxy at
`eleva.care/signin`, `eleva.care/callback`, `eleva.care/account/*`, and
`eleva.care/onboarding` -- just like the expert, team, and academy apps.

### WorkOS Dashboard Configuration

**Redirect URIs** (AuthKit > Redirects):

| Environment | URI                               |
| ----------- | --------------------------------- |
| Production  | `https://eleva.care/callback`     |
| Staging     | `https://dev.eleva.care/callback` |
| Development | `http://localhost:3000/callback`  |

The gateway at `eleva.care` proxies `/callback` to the account app.
Other apps redirect unauthenticated users to `eleva.care/signin`.

**Allowed Origins** (AuthKit > Allowed Origins):

```
https://eleva.care
https://dev.eleva.care
http://localhost:3000
```

Only the account app (served at `eleva.care/account/*`) uses WorkOS
widgets (profile management, security).

### WorkOS Env Vars per Vercel Project

All 7 auth-using projects need these (same values everywhere):

```
WORKOS_API_KEY=<same key>
WORKOS_CLIENT_ID=<same client ID>
WORKOS_COOKIE_PASSWORD=<same 32+ char password — MUST match>
```

## Eleva Diary — Separate Application (future)

## Setup Steps (WorkOS Dashboard)

1. **Create a second Application** in the WorkOS dashboard
   - Name: `Eleva Diary`
   - Type: Native / Mobile
   - Redirect URI: `elevacare://callback` (deep link) + `https://diary.eleva.care/callback` (universal link)
   - Client ID will be generated automatically

2. **Share the same Environment**
   - Both applications live in the same WorkOS environment
   - Users, organizations, and memberships are shared
   - Directory Sync and SSO connections apply to all apps in the environment

3. **Configure Eleva Diary**
   - Set `WORKOS_CLIENT_ID` to the Diary app's client ID
   - Set `WORKOS_API_KEY` to the same environment API key
   - Use AuthKit's native SDK or PKCE flow for mobile OAuth

4. **API Integration**
   - Diary syncs health data via `api.eleva.care` endpoints
   - Bearer tokens are scoped to the Diary client ID
   - The member app (`apps/app`) reads Diary data from the shared DB

## Environment Variables

| App          | Variable           | Value                          |
| ------------ | ------------------ | ------------------------------ |
| Web platform | `WORKOS_CLIENT_ID` | `client_01H...` (web app ID)   |
| Eleva Diary  | `WORKOS_CLIENT_ID` | `client_01J...` (diary app ID) |
| Both         | `WORKOS_API_KEY`   | Same environment key           |

## Session Isolation

Each WorkOS application issues its own session tokens. A user can be
signed into eleva.care (web cookie) and Eleva Diary (mobile token)
simultaneously with independent session lifecycles.

The web platform cookie is scoped to `.eleva.care` and does not affect
the mobile app's token-based auth.

## Data Flow

```
Eleva Diary (mobile)
  ├── Auth: WorkOS PKCE → Diary client ID → access token
  ├── Sync: POST api.eleva.care/diary/entries (Bearer token)
  └── Read: GET api.eleva.care/diary/summary (Bearer token)

Member Dashboard (apps/app)
  └── Display: reads diary data from shared DB via @eleva/db
```
