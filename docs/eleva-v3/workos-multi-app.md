# WorkOS Multiple Applications — Eleva Diary

## Overview

WorkOS "Multiple Applications" lets the Eleva Diary mobile app have its
own client ID, redirect URIs, and session policy while sharing the same
user pool and organizations as the web platform.

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
