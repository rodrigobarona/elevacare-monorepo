# ADR-024: Curated marketing media on public Blob

## Status

Accepted (amended 2026-10-24 — dual progressive WebM + MP4, AVIF/WebP/JPEG poster)

## Date

2026-10-19

## Context

The v3 redesign (brand v3, `brand-book/v3/`) needs real photography and an ambient hero
video across public and product surfaces. The MVP used ad-hoc `public/img` files and a
cookie-gated Mux player. v3 needs one reusable source with licence records, localized alt
text and no consent banner for decorative video.

Mux was only used for one muted looping hero clip. Keeping it would add a DPA/sub-processor
for visitor CDN traffic without HLS benefits on a single ambient asset.

## Decision

1. **One library.** `@eleva/media` (`packages/media/src/library.json`) is the only source of
   marketing images and video. Each entry carries localized alt text, licence
   (`eleva-owned` or `pexels`), credit and source URL. Apps render through `ElevaImage` and
   `ElevaVideo`; they never hardcode media URLs.
2. **Images** are curated with the `media:*` scripts (Pexels API) and uploaded to the
   **public** Vercel Blob store through `@eleva/storage`. They are served via `next/image`.
   No member, expert or health data ever goes in this library.
3. **Video** uses the same **public** Blob store: progressive **WebM (VP9)** when curated,
   with progressive **MP4 (H.264)** as the required Safari/universal fallback, plus a poster
   (AVIF preferred; WebP/JPEG/PNG also allowed). `ElevaVideo` renders native `<video>` with
   ordered `<source>` elements (muted, autoplay, loop, no controls). Reduced motion shows the
   poster only. No third-party player or analytics.
4. **CSP.** Marketing video and posters are served from `https://*.public.blob.vercel-storage.com`.
   Posters and images need the Blob host under `img-src`; video needs it under `media-src`
   (`img-src` does not cover `<video>`). No Mux vendor block.

## Consequences

- Blocks in `@eleva/ui/blocks` take media as slots, so `@eleva/ui` never depends on
  `@eleva/media`.
- Adding a Pexels image without a credit fails the library test. `/credits` (linked from
  the footer) renders every Pexels photographer from `creditedMedia()`.
- Academy/course streaming (Phase 16) may choose Blob signed URLs or another host in a
  separate ADR; this decision covers marketing ambient video only.

## Supersedes

- 2026-10-19 decision to host hero video on Mux HLS with `@mux/mux-video-react`.
