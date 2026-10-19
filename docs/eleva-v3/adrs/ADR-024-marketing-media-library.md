# ADR-024: Curated marketing media on Blob and Mux

## Status

Accepted

## Date

2026-10-19

## Context

The v3 redesign (brand v3, `brand-book/v3/`) needs real photography and an ambient hero
video across public and product surfaces. The MVP used ad-hoc `public/img` files and a
cookie-gated Mux player. v3 needs one reusable source with licence records, localized alt
text and no consent banner for decorative video.

## Decision

1. **One library.** `@eleva/media` (`packages/media/src/library.json`) is the only source of
   marketing images and video. Each entry carries localized alt text, licence
   (`eleva-owned` or `pexels`), credit and source URL. Apps render through `ElevaImage` and
   `ElevaVideo`; they never hardcode media URLs.
2. **Images** are curated with the `media:*` scripts (Pexels API) and uploaded to the
   **public** Vercel Blob store through `@eleva/storage`. They are served via `next/image`.
   No member, expert or health data ever goes in this library.
3. **Video** stays on Mux, HLS only. `ElevaVideo` disables Mux Data tracking and cookies, so
   decorative video needs no consent. Reduced motion shows the poster only.
4. **CSP.** The `mux` vendor block allows `https://stream.mux.com` and `https://*.mux.com` in
   `connect-src` and `media-src` for HLS manifests and segments. Images already pass
   `img-src https:`.

## Consequences

- Blocks in `@eleva/ui/blocks` take media as slots, so `@eleva/ui` never depends on
  `@eleva/media`.
- Adding a Pexels image without a credit fails the library test. `/credits` (linked from
  the footer) renders every Pexels photographer from `creditedMedia()`.
- Adding another video host needs a new vendor block and an update to this ADR.
