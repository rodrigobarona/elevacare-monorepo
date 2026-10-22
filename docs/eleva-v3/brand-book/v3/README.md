# Eleva brand v3: warm editorial

Status: **proposed**, 2026-10-19. The founder chose option B (allow a brand
evolution) on 2026-10-19 and reviews it on a preview deploy before any
production deploy. The logo, wordmark and name are unchanged.

Tokens: [`tokens.json`](./tokens.json). Implementation:
`packages/ui/src/styles/globals.css` and `packages/ui/src/fonts.ts`. The living
kit is at `/design-system` in `apps/docs`.

## 1. Why v3

v2 (2026-10-06) fixed the scales and contrast. The product still felt
barebone: white surfaces, grey hairlines, small type and few images. v3 keeps
every v2 colour scale and changes how the brand feels:

- **Warm paper, not clinical white.** Page backgrounds use `sand-50`, muted
  panels and the sidebar use `sand-100`, and hairlines use `sand-200`. Cards
  stay white, so content lifts off the paper.
- **Editorial serif with character.** Fraunces replaces Lora for display and
  headings. It is a variable font: the optical size axis keeps hero sizes
  elegant and small headings sturdy, and its italic gives the
  "on-demand."-style accent that the live eleva.care hero already uses.
  DM Sans stays for UI and body text, and IBM Plex Mono for eyebrows and data.
- **Bigger, calmer type.** Fluid steps: `text-display`, `text-headline`,
  `text-title`, `text-lead` and the `eyebrow` utility. Headings balance their
  line breaks and paragraphs avoid orphans.
- **Softer shapes.** The base radius goes from 0.625rem to 0.75rem. Marketing
  CTAs and chips are pills, and media sits in 1.35–1.95rem rounded frames,
  as in the live hero.
- **Warm depth.** Shadows are tinted with warm brown (`oklch(0.32 0.03 60)`)
  instead of teal ink, so lifted cards look like paper, not glass.
- **Motion with care.** `ease-spring` and `duration-slower` are for reveals
  only. Everything collapses under `prefers-reduced-motion`.

Dark mode keeps the v2 teal-tinted ink surfaces. They already read as calm,
and warm-brown dark themes lose the teal identity.

## 2. Contrast (WCAG 2.1, computed from OKLCH)

| Text on surface                  | Ratio |
| -------------------------------- | ----- |
| `neutral-950` on `sand-50`       | 15.9  |
| `neutral-700` on `sand-100`      | 6.0   |
| `teal-700` on `sand-50` (links)  | 5.8   |
| `teal-50` on `teal-700` (button) | 5.7   |
| `coral-800` on `coral-100`       | 8.4   |
| `coral-700` on `sand-50`         | 6.8   |
| `neutral-400` on `neutral-900`   | 5.5   |

The full list is in `tokens.json` under `contrastPairs`. `coral-400`
(`#E29578`) stays a decorative fill, never text.

## 3. Atomic kit structure

| Level     | Lives in                        | Examples                                                                 |
| --------- | ------------------------------- | ------------------------------------------------------------------------ |
| Tokens    | `@eleva/ui/globals.css`         | colour, type steps, radius, shadow, motion                               |
| Atoms     | `@eleva/ui/components/*`        | Button, Input, Badge, Avatar, Eyebrow, Heading                           |
| Molecules | `@eleva/ui/components/*`        | Field, StatCard, EmptyState, ExpertCard, PriceTag                        |
| Organisms | `@eleva/ui/blocks/*`            | Hero, FeatureGrid, Testimonial, CTA band, FAQ, Footer, ExpertCarousel    |
| Templates | `@eleva/dashboard`, `@eleva/ui` | AppShell, PageHeader, loading, error and not-found states, MarketingPage |
| Pages     | apps                            | compose templates only; no per-app copies of atoms                       |

Media atoms (`ElevaImage`, `ElevaVideo`) and the curated photo manifest live
in `@eleva/media`, with licence and attribution recorded per asset.

## 4. Imagery

Unchanged from `../art-direction.md`: real women, natural light, warm homes and
clinics, no stock clichés (stethoscope close-ups, clip-art, staged handshakes).
v3 adds:

- MVP photos and the hero intro video (public Blob) are reused first.
- Gaps are filled from Pexels (the only stock API key available), using
  specific queries such as "pregnant woman natural light home" rather than
  "health". Each import records the photographer, source URL and licence in
  the media manifest.
- Members and health data never appear in public imagery. Product screenshots
  use seeded demo data only.

## 5. Out of scope

- Logo or wordmark changes.
- A new accent hue. Coral stays the single warm accent, and sand is a neutral.
- Dark-mode re-tint.
- Email templates follow in their own slice, using the same tokens.
