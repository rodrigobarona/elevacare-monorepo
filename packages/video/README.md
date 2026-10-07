# `@eleva/video`

Daily.co boundary (ADR-018). **Standard domain only until D-07.** Not HIPAA.
Recording off. Room names are `eleva-{bookingId}`.

This slice (09.1) ships the server primitives: room option builder, REST
rooms, self-signed meeting tokens, webhook HMAC. Join pages and
`@daily-co/daily-react` land in the next slice.

Never log `DAILY_API_KEY` or meeting tokens.
