# Brand book recovery — gap analysis

**Status:** Living  
**Date:** 2025-04-22

This file records what the first “Markdown-only” pass delivered versus what a full **Eleva.care** brand book needs, and how the recovery run addresses the gap.

## What the first pass delivered

| Delivered | Location |
| --- | --- |
| Prose brand handbook (essence, verbal, visual, application, governance) | [`README.md`](./README.md) |
| Asset list pointing at MVP paths | [`assets-inventory.md`](./assets-inventory.md) |
| Usage patterns (web, product, email, partners) | [`usage-examples.md`](./usage-examples.md) |
| v3 index link | [`../README.md`](../README.md) |

## Gaps the recovery run fills

| Gap | Recovery |
| --- | --- |
| No centralized, copy-pasteable asset pack | [`assets/`](./assets/) with logos, social, favicons, curated imagery, and [`assets/README.md`](./assets/README.md) |
| No derived vector for full wordmark in repo as a file | [`assets/derived/eleva-wordmark-full--derived-from-header.svg`](./assets/derived/eleva-wordmark-full--derived-from-header.svg) (paths from `HeaderContent.tsx`) |
| No machine-readable palette export in brand-book | [`assets/palette/eleva-palette-tokens.json`](./assets/palette/eleva-palette-tokens.json), [`eleva-css-variables-snippet.css`](./assets/palette/eleva-css-variables-snippet.css) |
| Limited “at a glance” visual review in docs | [`previews/`](./previews/) boards (logos, color, imagery, application) |
| Weaker separate messaging and art-direction docs | [`messaging-framework.md`](./messaging-framework.md), [`art-direction.md`](./art-direction.md) |

## Still a design-team gap (not faked in repo)

| Item | Note |
| --- | --- |
| Figma or designer-owned master with grid and optical corrections | The derived SVG is **technical export** from code paths, not a design audit. |
| PMS/CMYK print proofs | Add when print work starts; hex/RGB in JSON are from MVP `globals.css`. |
| New illustration system | Product uses Lucide + a few SVGS; a full custom illustration set is a separate initiative. |
