# Eleva.care brand asset pack

**Status:** Living  
**Purpose:** Single folder designers and marketing can open without chasing paths under `_context/clone-repo/eleva-care-app`.

**Source of truth in code:** [`_context/clone-repo/eleva-care-app`](../../../../_context/clone-repo/eleva-care-app) (MVP clone).  
Files here are **copies** of what ships in that tree; refresh when the MVP updates.

## Layout

| Folder / file | Contents |
| --- | --- |
| [`logos/`](./logos/) | Full wordmark PNG: color, white, black |
| [`marks/`](./marks/) | Symbol-only PNG: color, white, black |
| [`social/`](./social/) | Open Graph / share PNG + SVG, BIMI logo SVG |
| [`imagery/services/`](./imagery/services/) | Curated service/marketing photos (JPG) from MVP `public/img/` |
| [`imagery/team/`](./imagery/team/) | Team and advisor portraits from MVP `public/img/about/team/` |
| [`imagery/founders/`](./imagery/founders/) | Founders team photo (PNG) |
| [`favicons/`](./favicons/) | Favicon and PWA icon set from MVP `src/app/` |
| [`product/`](./product/) | In-product trust SVGs (e.g. expert verified) |
| [`derived/`](./derived/) | **Derived exports** — not design masters; see below |
| [`palette/`](./palette/) | JSON + CSS snippet of Eleva RGB tokens from `globals.css` |

## Derived exports (read this)

| File | What it is |
| --- | --- |
| [`derived/eleva-wordmark-full--derived-from-header.svg`](./derived/eleva-wordmark-full--derived-from-header.svg) | Vector paths copied from `HeaderContent.tsx` inline SVG. Use for slides, static HTML, and agency handoff. **Not** a design-tool master; have design sign off for print. |

## Palette

- [`palette/eleva-palette-tokens.json`](./palette/eleva-palette-tokens.json) — hex + rgb for tools and scripts.
- [`palette/eleva-css-variables-snippet.css`](./palette/eleva-css-variables-snippet.css) — raw `:root` RGB triplets matching MVP.

## Refresh procedure

1. Update assets in the MVP `public/` or `src/app/` as needed.  
2. Re-run copy from MVP into this tree (or copy the specific files that changed).  
3. Update [`../assets-inventory.md`](../assets-inventory.md) and version note in the main [`../README.md`](../README.md) if the brand system changed.
