# Eleva UI fonts (self-hosted)

WOFF2 files vendored for `next/font/local` in `../fonts.ts`.

Source: Google Fonts (SIL Open Font License / Apache 2.0 as published by Google Fonts).
Fetched from `fonts.gstatic.com` latin subsets for Fraunces (variable `opsz` +
`wght`, roman and italic), DM Sans, IBM Plex Mono, and Google Sans Medium
(SIL OFL; used only by the Sign in with Google button per Google's branding
guidelines).

Brand v3 (`docs/eleva-v3/brand-book/v3/`) replaces Lora with Fraunces for
display and headings.

Do not switch back to `next/font/google` without verifying Turbopack CI builds
across parallel app builds (see comment in `fonts.ts`).
