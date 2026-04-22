# Eleva.care — assets inventory

**Status:** Living  
**Source:** MVP snapshot in [`_context/clone-repo/eleva-care-app`](../../../_context/clone-repo/eleva-care-app) (canonical product reference for the monorepo). Paths below are from the monorepo root unless noted.

## Packaged brand pack (recovery)

A **curated copy** of approved assets lives in this repo for direct use:

- [`./assets/`](./assets/) — see [`./assets/README.md`](./assets/README.md)

Use the packaged tree for decks, partner emails, and design imports. When the MVP changes, refresh copies from `_context/clone-repo/eleva-care-app` and update this inventory.

This document lists brand-related files that exist today, their role, and gaps for design handoff.

## Logo and wordmark

| Asset | Path (from repo root) | Role / notes |
| --- | --- | --- |
| Full wordmark (color) | `_context/clone-repo/eleva-care-app/public/eleva-logo-color.png` | Default marketing, light backgrounds |
| Full wordmark (white) | `_context/clone-repo/eleva-care-app/public/eleva-logo-white.png` | Dark or teal/green headers, email branded header |
| Full wordmark (black) | `_context/clone-repo/eleva-care-app/public/eleva-logo-black.png` | Monochrome, print, light neutral backgrounds |
| Symbol / mark (color) | `_context/clone-repo/eleva-care-app/public/eleva-mark-color.png` | Favicon-style mark, app icon, compact UI |
| Symbol / mark (white) | `_context/clone-repo/eleva-care-app/public/eleva-mark-white.png` | On dark or photographic backgrounds |
| Symbol / mark (black) | `_context/clone-repo/eleva-care-app/public/eleva-mark-black.png` | On light fields without full color |
| Web header wordmark (SVG) | Inlined in `_context/clone-repo/eleva-care-app/src/components/layout/header/HeaderContent.tsx` | React component `ElevaCareLogo`; not shipped as a standalone file |
| PWA / favicon set | `_context/clone-repo/eleva-care-app/src/app/` (`favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `android-chrome-192x192.png`, `android-chrome-512x512.png`) | App shell; circular leaf/branch mark |

**Gap:** A single “master” design file (e.g. `.svg` or Figma) for the full logotype, exported to match production PNGs, is not versioned in this tree as a standalone `public` asset. The share SVG and header inline SVG partially cover vector needs.

## Social, SEO, and rich results

| Asset | Path | Role / notes |
| --- | --- | --- |
| Open Graph / share (PNG) | `_context/clone-repo/eleva-care-app/public/img/eleva-care-share.png` | Referenced in home metadata; 1200×680 target in code |
| Open Graph / share (SVG) | `_context/clone-repo/eleva-care-app/public/img/eleva-care-share.svg` | Gradient + mark + wordmark; use for vector exports and slides |
| BIMI / email auth (SVG) | `_context/clone-repo/eleva-care-app/public/img/eleva-care-bimi-logo.svg` | Domain/email authentication branding where applicable |

## Photography and people

| Asset | Path | Role / notes |
| --- | --- | --- |
| Home / services | `_context/clone-repo/eleva-care-app/public/img/` (`Pregnant-Woman-Flowers.jpg`, `Woman-Working-Out-Living-Room.jpg`, `Smiling-Women-Photo.jpg`, `Three-Women-Posing-Photo.jpg`, `cancer-journey.jpg`) | Marketing and services sections |
| Team / story | `_context/clone-repo/eleva-care-app/public/img/about/team-photo.png` | Founders, narrative |
| Advisor & leadership portraits | `_context/clone-repo/eleva-care-app/public/img/about/team/` | Board, team, about pages |

**Direction inferred:** Real people, life-stage and wellness contexts, professional but warm; not stock-clinical.

## Product UI and trust

| Asset | Path | Role / notes |
| --- | --- | --- |
| Expert verified | `_context/clone-repo/eleva-care-app/public/img/expert-verified-icon.svg` | In-product badge / trust signal |

## Design tokens (code)

| System | Path | What is defined |
| --- | --- | --- |
| Eleva palette + shadcn semantic colors | `_context/clone-repo/eleva-care-app/src/app/globals.css` | `--eleva-primary`, primaries, secondaries, neutrals, highlight accents, radius |
| Font families and loading | `_context/clone-repo/eleva-care-app/src/app/layout.tsx` | `Lora`, `DM Sans`, `IBM Plex Mono` via `next/font` |

## Verbal and content source files

| Resource | Path |
| --- | --- |
| Tone of voice | `_context/clone-repo/eleva-care-app/_docs/04-development/tone-of-voice-guide.md` |
| English UI copy (hero, footer, compliance strings) | `_context/clone-repo/eleva-care-app/src/messages/en.json` |
| About, story, and marketing MDX | `_context/clone-repo/eleva-care-app/src/content/` (`about/`, `history/`, `for-organizations/`, `become-expert/`, etc.) |
| Workspace / partner branding help | `_context/clone-repo/eleva-care-app/src/content/help/workspace/**/branding.mdx` |

## Naming convention (recommended)

- **Eleva.care** — brand/org and domain in legal and product disclaimers.  
- **Eleva Care** — product and marketing name in most user-facing copy (matches MVP strings).

Keep both aligned with the [Verbal identity](./README.md#2-verbal-identity) section of the main handbook.
