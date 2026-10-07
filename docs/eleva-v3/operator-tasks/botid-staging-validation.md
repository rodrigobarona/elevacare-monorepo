# BotID staging validation (AUD-017)

Goal: turn on Vercel BotID for the public booking funnel without collapsing the
per-IP public rate limit (`RATE_LIMITS.public`, 10/min). Production stays
`BOTID_MODE=off` until every step below passes on staging (`dev.eleva.care`).

## Why the funnel needs a same-origin rewrite

`botid@1.5.11` only signs same-origin `fetch`/XHR calls (it skips any request
whose origin differs from the page). The funnel on `eleva.care` calls
`api.eleva.care` directly, so those calls are never signed. `extraAllowedHosts`
on the server doesn't change that; it only lets the API accept signed requests
that a frontend host proxied. The fix is to route the funnel through
`eleva.care/api/*`, which `apps/web/next.config.mjs` rewrites to `apps/api`.

## Flags

The same-origin path turns on only when both web variables are set; without
`NEXT_PUBLIC_API_URL` the funnel keeps calling apps/api directly.

| Variable                            | Project       | Staging value               | Production    |
| ----------------------------------- | ------------- | --------------------------- | ------------- |
| `NEXT_PUBLIC_BOTID_SAME_ORIGIN_API` | elevacare-web | `true` (needs a rebuild)    | unset         |
| `NEXT_PUBLIC_API_URL`               | elevacare-web | apps/api origin (required)  | unchanged     |
| `BOTID_MODE`                        | elevacare-api | `monitor`, then `enforce`   | unset (`off`) |
| `BOTID_EXTRA_ALLOWED_HOSTS`         | elevacare-api | `dev.eleva.care`            | unset         |
| `RATE_LIMIT_IP_DEBUG`               | elevacare-api | `true` during the test only | unset         |

BotID must also be enabled for both projects in the Vercel dashboard
(Firewall → Bot Management → BotID).

## Steps

1. Set the staging flags above with `BOTID_MODE=monitor` and redeploy web and api.
2. **Two-network IP test.** From two different public networks (for example
   office Wi-Fi and a phone hotspot), open the same staging booking page
   (seed `fisiomota` / `first-visit`) and reach the reserve step.
3. In the api runtime logs, filter `rate_limit.ip_source` for
   `/bookings/reserve`. Pass when:
   - the two networks produce **two different `keyHash` values**, and
   - `matchesVercelForwarded` (or `matchesRealIp`) is `true`, so the key is the
     member's own IP and not the gateway's.
4. In the same logs, filter `botid.verdict`. Pass when real browser bookings log
   `isBot: false` and a scripted `curl` POST to `/api/bookings/reserve` logs
   `isBot: true`.
5. Switch staging to `BOTID_MODE=enforce`. Repeat step 2 (it must still book)
   and the `curl` POST (it must get `403 {"error":"blocked"}`).
6. Turn `RATE_LIMIT_IP_DEBUG` off, record the evidence in the audit register
   (AUD-017 row), and only then plan the production change as its own PR.

Fail any step: set `BOTID_MODE=off` and `NEXT_PUBLIC_BOTID_SAME_ORIGIN_API`
unset (rebuild web) to return to today's behaviour, and record what you saw.
