# Eleva brand v2: evolution board

**Status: proposal, awaiting founder approval.** Nothing in this folder is applied to
`@eleva/ui` yet. After approval, the kit PR maps these tokens into
`packages/ui/src/styles/globals.css` (WP2b of the phases 01–08 production pass).

This is an **evolution**, not a rebrand. The logo, wordmark, name, teal `#006D77` and
coral `#E29578` stay. What changes is that the brand colours become full scales and
semantic tokens, so components stop using the generic shadcn defaults (grey secondary,
grey accent, lime charts).

Machine-readable values: [`tokens.json`](./tokens.json) (OKLCH, sRGB hex fallback and
WCAG 2.1 contrast for every step).

## 1. Palette scales (OKLCH, 11 steps)

Lightness is fixed per step across every hue, so `teal-600` and `coral-600` have the
same visual weight. Chroma tapers at both ends and is gamut-mapped to sRGB. **Bold** marks
the existing brand colour, kept exactly.

| Scale       | 50      | 100     | 200     | 300     | 400         | 500     | 600     | 700         | 800     | 900     | 950     |
| ----------- | ------- | ------- | ------- | ------- | ----------- | ------- | ------- | ----------- | ------- | ------- | ------- |
| **teal**    | #edfafc | #d8f4f8 | #b3e7ee | #83d5e0 | #45bcca     | #00a2b1 | #008594 | **#006d77** | #00535d | #003b44 | #00252c |
| **coral**   | #fff4ef | #ffe7dc | #ffcfbd | #fbb196 | **#e29578** | #d36d45 | #b45128 | #973c12     | #782902 | #591900 | #3c0900 |
| **neutral** | #f6f8f8 | #ebeeef | #d8dddf | #bfc7c9 | #a1abae     | #859093 | #6a7578 | #545e61     | #3f484a | #2c3335 | #1a1f21 |
| **success** | #effbf2 | #dcf6e2 | #bceac7 | #92d9a5 | #62c17f     | #30a75e | #008b43 | #007130     | #00581f | #004011 | #002905 |
| **warning** | #fff6ea | #ffead1 | #fbd5a8 | #f2ba74 | #df9931     | #c77a00 | #a36200 | #854e00     | #683a00 | #4c2800 | #311600 |
| **danger**  | #fff2ef | #ffe2de | #ffc9c3 | #ffa69e | #ff766f     | #ef4c4b | #ce2930 | #ae061c     | #8b000c | #680002 | #460000 |
| **info**    | #eef9ff | #daf1ff | #b8e2ff | #8ccdff | #59b1f6     | #2494e2 | #0078c4 | #0060a6     | #004985 | #003364 | #001f45 |

- **Neutral** is tinted toward the teal hue (215°, very low chroma) instead of the current
  pure/zinc greys, so surfaces feel part of the brand.
- The highlight colours from v1 (red `#EE4266`, purple `#540D6E`, yellow `#FFD23F`) are
  kept for marketing illustration only. They are not UI tokens.

### Contrast rules (checked, WCAG 2.1 AA)

| Use                           | Light mode                                                | Dark mode (on ink)                             |
| ----------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| Brand text and primary fill   | teal-700 `#006d77`: 6.08 : 1                              | teal-400 `#45bcca`: 8.59 : 1                   |
| Coral as text                 | coral-700 `#973c12`: 7.09 : 1                             | coral-300 `#fbb196`: 10.96 : 1                 |
| Coral brand `#e29578`         | **decorative only** (2.39 : 1)                            | text-safe (8.13 : 1)                           |
| Muted text                    | neutral-700 `#545e61`: 6.64 : 1 (5.72 : 1 on neutral-100) | neutral-400 `#a1abae`: 5.49 : 1 on neutral-900 |
| Danger text / fill            | danger-600 `#ce2930`: 5.26 : 1                            | danger-400 `#ff766f`: 7.43 : 1                 |
| Success / warning / info text | 700 step (≥ 6.1 : 1)                                      | 400 step (≥ 8.0 : 1)                           |

Every foreground/background pair in section 2 was checked: all reach ≥ 4.5 : 1, and the lowest is
danger-400 on a neutral-900 card at 4.95 : 1. Neutral-600 on neutral-100 (4.07 : 1) failed, which
is why muted text uses the 700 step. Teal-600 (4.40 : 1) and every 500 step fail AA for body text on white. They are allowed
for large text, icons and fills with white foreground only when ≥ 3 : 1.

## 2. Semantic token mapping

The kit PR rewrites these shadcn tokens. Component code keeps using the semantic names.

| Token                    | Light       | Dark        |
| ------------------------ | ----------- | ----------- |
| `--background`           | white       | neutral-950 |
| `--foreground`           | neutral-950 | neutral-50  |
| `--card` / `--popover`   | white       | neutral-900 |
| `--primary`              | teal-700    | teal-400    |
| `--primary-foreground`   | teal-50     | teal-950    |
| `--secondary`            | coral-100   | coral-900   |
| `--secondary-foreground` | coral-800   | coral-100   |
| `--accent`               | teal-50     | teal-900    |
| `--accent-foreground`    | teal-800    | teal-100    |
| `--muted`                | neutral-100 | neutral-900 |
| `--muted-foreground`     | neutral-700 | neutral-400 |
| `--border` / `--input`   | neutral-200 | neutral-800 |
| `--ring`                 | teal-500    | teal-400    |
| `--destructive`          | danger-600  | danger-400  |
| `--success` (new)        | success-700 | success-400 |
| `--warning` (new)        | warning-700 | warning-400 |
| `--info` (new)           | info-700    | info-400    |
| `--sidebar`              | neutral-50  | neutral-900 |
| `--sidebar-primary`      | teal-700    | teal-400    |
| `--sidebar-accent`       | teal-50     | teal-900    |

Each status colour also gets a `-subtle` background (the 50 step in light mode, the 950 step in dark mode) for
alerts, badges and banners.

## 3. Data-visualisation palette

Replaces the lime `--chart-1…5`. Ordered so that the first two series are always
the brand pair, and adjacent series differ in lightness as well as hue (readable for
colour-blind members and in greyscale print).

| Token       | Light       | Dark        |
| ----------- | ----------- | ----------- |
| `--chart-1` | teal-700    | teal-400    |
| `--chart-2` | coral-500   | coral-400   |
| `--chart-3` | teal-300    | teal-200    |
| `--chart-4` | coral-300   | coral-200   |
| `--chart-5` | neutral-500 | neutral-400 |

Money states in finance views use semantic colours, never chart colours: paid/available
= success, pending = warning, refunded/failed = danger.

## 4. Typography

Families are already self-hosted in `@eleva/ui/fonts` (no change). What's new is the scale, and
applying it in `apps/web` and `apps/docs`, which currently render in the fallback stack.

| Role       | Family        | Size / line-height (rem)    | Weight | Use                                  |
| ---------- | ------------- | --------------------------- | ------ | ------------------------------------ |
| display-xl | Lora          | 3.5 / 1.1 (mobile 2.5)      | 500    | Marketing hero only                  |
| display    | Lora          | 2.5 / 1.15 (mobile 2)       | 500    | Marketing section titles             |
| h1         | Lora          | 1.875 / 1.2                 | 600    | Page title in product apps           |
| h2         | DM Sans       | 1.375 / 1.3                 | 600    | Section title                        |
| h3         | DM Sans       | 1.125 / 1.4                 | 600    | Card title                           |
| body-lg    | DM Sans       | 1.125 / 1.6                 | 400    | Marketing body, expert bios          |
| body       | DM Sans       | 0.9375 / 1.55               | 400    | Default UI text                      |
| small      | DM Sans       | 0.8125 / 1.45               | 400    | Help text, captions                  |
| label      | DM Sans       | 0.8125 / 1.3, +0.01em       | 500    | Form labels, table headers           |
| mono       | IBM Plex Mono | 0.8125 / 1.45, tabular-nums | 400    | Amounts, invoice numbers, IDs, times |

Rules: Lora only for page-level headings and marketing (never inside dense UI); maximum two
families on any one screen plus mono for data; prices and times always use tabular numbers.

## 5. Spacing, radius, elevation, motion

- **Spacing:** keep Tailwind's 4 px base. Layout rhythm tokens: `--space-section` 4rem
  (mobile 2.5rem), `--space-card` 1.5rem (mobile 1rem), `--space-stack` 1rem.
- **Radius:** keep `--radius: 0.625rem` (10 px) and the existing sm/md/lg/xl derivations.
  Pills (badges, avatars, mode chips) use `rounded-full`. No sharp corners on interactive
  elements.
- **Elevation:** three levels, all tinted with teal-950 at low alpha instead of black:
  `--shadow-1` (cards at rest), `--shadow-2` (popovers, dropdowns), `--shadow-3` (dialogs,
  sheets). In dark mode, shadows are replaced by a one-step-lighter surface plus border.
- **Motion:** `--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1)`, durations 120 ms (hover, press),
  200 ms (popover, toast), 320 ms (sheet, dialog). Every animation respects
  `prefers-reduced-motion: reduce` (opacity-only fallback).

## 6. Dark mode

Dark mode is ink-teal, not pure black: background neutral-950 `#1a1f21`, cards neutral-900.
Brand teal shifts up to teal-400 so it keeps contrast, and coral becomes text-safe at 400. Status colours use the 400 step on the 950 subtle background. The `ELEVA_THEME`
cookie and `ElevaThemeProvider` don't change.

## 7. Logo (light refinement only)

No redesign. The kit adds `Logo`, `Wordmark` and `LogoMark` components in `@eleva/ui` with
`currentColor` fills so they follow the theme, plus a `VerifiedBadge`.

Source assets (mined 2026-10-06):

- Wordmark: [`../assets/derived/eleva-wordmark-full--derived-from-header.svg`](../assets/derived/eleva-wordmark-full--derived-from-header.svg)
  (vector, already `currentColor`).
- Mark: only PNG exists ([`../assets/marks`](../assets/marks)). The kit traces it to SVG at
  the same geometry. Vectorising it is the only "refinement".
- Verified badge: `_context/clone-repo/eleva-care-app/public/img/expert-verified-icon.svg`, copied
  into `@eleva/ui` (never imported from `_context/`).

## Decisions requested from the founder

1. Approve the scales, or ask for a different coral strength (the current proposal keeps
   your exact `#E29578` and derives everything else).
2. Approve `--secondary` = soft coral (coral-100 fill / coral-800 text). This is the most
   visible change: secondary buttons and badges become warm instead of grey.
3. Approve Lora for product-app page titles (h1). The alternative is DM Sans everywhere in
   product apps and Lora only on marketing.
