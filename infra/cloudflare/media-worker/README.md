# elevacare-media Worker

Read-only delivery for the public R2 bucket (ADR-025). It answers GET and HEAD
with Range and conditional requests, so `<video>` and HLS players can seek. It
never lists keys and cannot reach the private bucket.

Live at `https://elevacare-media.rbarona.workers.dev`, which is the value of
`R2_PUBLIC_BASE_URL` and `NEXT_PUBLIC_MEDIA_BASE_URL` in production.

Deploy with `npx wrangler deploy` from this folder.

Responses are cached for a day unless the object sets `Cache-Control`, so a
deleted public object can stay reachable for up to 24 hours.
