# Daily setup (operator)

Status: **standard domain, recording off, not HIPAA.** Founder 2026-10-07
deferred D-07 (no BAA). Do not enable HIPAA mode or `sessions.eleva.care`
until D-07 is signed. This file is the operator checklist for a working
Daily account — not a HIPAA claim.

## Account

1. Create a **standard** Daily domain (not HIPAA). Recording stays **off**.
2. Copy the domain hostname into `DAILY_DOMAIN` (`{subdomain}.daily.co`).
   Optional: `DAILY_DOMAIN_ID` (domain UUID for the meeting-token `d` claim)
   if GET `/v1` does not return it.
3. Create a Daily REST API key. Store as `DAILY_API_KEY`. Never log it.
4. Room names are deterministic: `eleva-{bookingId}` (ADR-018, standard
   domain). HIPAA random names apply only after D-07. Do not rename rooms in
   the Daily dashboard.

## Webhook

Daily signs a `{ "test": "test" }` POST when creating a webhook. Our
handler returns 200 `ignored` / `endpoint_check` only after HMAC
verifies, so the secret must be on the deployed `elevacare-api` **before**
`POST https://api.daily.co/v1/webhooks`.

1. Generate a base64 HMAC secret (do not commit it). Store as
   `DAILY_WEBHOOK_SECRET` on Vercel `elevacare-api` (preview + production
   sensitive; development non-sensitive) and locally. **Done 2026-10-08.**
2. Redeploy `elevacare-api` so `api.dev.eleva.care` has the secret.
   **Pending** — Daily's create handshake 401s until that deploy.
   A 2026-10-08 redeploy hit Hobby `api-deployments-free-per-day`
   (try again after the quota window).
3. Create the webhook with that same `hmac` and event types
   `meeting.started`, `meeting.ended`, `participant.joined`,
   `participant.left`. URL:

| Environment | URL                                         |
| ----------- | ------------------------------------------- |
| Staging     | `https://api.dev.eleva.care/webhooks/daily` |
| Production  | `https://api.eleva.care/webhooks/daily`     |

Signature failure returns 401. Phase 15 repeats production after staging
evidence. Do not point production at a HIPAA domain until D-07.

## Exit-gate leftover (Eleva join pages)

The 09.0 probe used Daily Prebuilt (`elevacare.daily.co/…?t=`). The
product proof is two browsers on Eleva pages: signed-in expert
`/expert/sessions/{bookingId}/join` and the public member grant URL from
email/ICS (`/join/{bookingId}?g=`). Never Daily `?t=`.

## Join URLs

Confirmation and 1h-reminder emails (and ICS `URL`/`LOCATION`) deep-link to
`/join/{bookingId}?g=` with a signed Eleva grant. Guests without an
account join Daily as `guest:{bookingId}`. In-app CTAs stay
session-based at `/{orgSlug}/sessions/{bookingId}/join`. Never paste a
raw Daily room URL or meeting token into member or expert copy.

## Recording and transcripts

Recording stays off. Transcripts and Notes/History are Phase 10 / 16.8 —
not Phase 09.

## Related

- [`environment-matrix.md`](../environment-matrix.md)
- [`integration-runbooks.md`](../integration-runbooks.md) (Daily outage)
- ADR-018, decision-log D-07 (deferred 2026-10-07)
