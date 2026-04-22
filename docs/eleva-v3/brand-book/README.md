# Eleva.care brand handbook

**Status:** Living  
**Version:** 1.1 (recovery: asset pack + derived exports + previews)  
**Scope:** Master brand for **Eleva.care** and the **Eleva Care** product family. Distinct from workspace white-label and partner-only branding (see [Application system](#5-application-system)).

## Brand-book package (use this folder end-to-end)

| Resource | Purpose |
| --- | --- |
| [Handbook (this file)](./README.md) | Essence, verbal + visual system, application, governance |
| [Asset pack](./assets/) | **Copied** logos, marks, social, favicons, imagery, palette JSON — no need to open `_context/clone-repo/eleva-care-app` for day-to-day use |
| [Previews](./previews/) | Logo, color, imagery, and application reference boards |
| [Gap analysis](./GAP-ANALYSIS.md) | What the first pass missed and how recovery addresses it |
| [Messaging framework](./messaging-framework.md) | Message map, audiences, proof points |
| [Art direction](./art-direction.md) | Photography, layout, motion, campaign guardrails |
| [Asset inventory](./assets-inventory.md) | Full lineage: packaged paths + MVP source paths |
| [Usage examples](./usage-examples.md) | Web, product, email, partners |

This handbook elevates the identity already present in the Eleva Care MVP (see [`_context/clone-repo/eleva-care-app`](../../../_context/clone-repo/eleva-care-app)) into explicit rules for product, marketing, and partnerships.

---

## 1. Brand essence

### Brand purpose

**Make expert, evidence-grounded women’s health care easier to find and trust**—across life stages—through a secure platform that connects people with independent specialists.

*Grounded in product copy: mission, “bridge” narrative, and home positioning in `src/content/about/en.mdx`, `src/content/history/en.mdx`, and `src/messages/en.json`.*

### Mission (working)

We connect women with **independent, licensed care experts** through technology we stand behind. We provide the **platform**; your chosen expert provides your **care**.

### Vision (working)

A trusted digital way to access **world-class women’s health expertise**—**on your schedule**, with clarity about who does what.

### Brand promise

- **Clarity** — Plain language about the platform vs. the expert.  
- **Trust** — Security, compliance posture, and honest boundaries (no overclaiming).  
- **Human warmth** — Conversational, never cold-clinical.  
- **Agency** — The client chooses; the expert leads care.

### Brand pillars

| Pillar | Meaning | Express it through |
| --- | --- | --- |
| **Bridge** | Science and care, platform and person | Story, evidence content, “how it works” |
| **Trust** | Security, credentials, transparent roles | Disclaimers, trust UI, expert profiles |
| **Warm expertise** | Knowledgeable but approachable | Voice, photography, typographic pair |
| **Lifelong** | Stages, not a single visit | Service framing, inclusive imagery |

### Positioning statement

**For** women seeking specialized women’s health support and the experts who serve them, **Eleva Care** is a **trusted digital health platform** that **connects clients with independent care experts**—unlike a clinic or hospital brand, we **do not deliver clinical care ourselves**; we make booking, video, and payments work so experts can focus on people.

### Design principles (premium expression)

These align the visual system with the pillars:

1. **Editorial calm** — Generous space, serif-led headlines for story; sans for UI.  
2. **Nature + precision** — Organic emblem (leaf/branch) with disciplined layout and accessible contrast.  
3. **Restrained color** — Teal/sage as the core; coral and highlights as **accents**, not noise.  
4. **Clarity over cleverness** — Obvious navigation, readable type, no gimmicky health tropes.

---

## 2. Verbal identity

**Canonical reference:** [`_context/clone-repo/eleva-care-app/_docs/04-development/tone-of-voice-guide.md`](../../../_context/clone-repo/eleva-care-app/_docs/04-development/tone-of-voice-guide.md).

### Voice attributes

| Attribute | In practice |
| --- | --- |
| **Warm** | Friendly, human; avoid institutional coldness |
| **Clear** | Short sentences, active voice, no jargon for its own sake |
| **Empowering** | “Your expert,” “your schedule,” choice-forward |
| **Trustworthy** | Explicit: platform provides technology; expert provides care |

### Core line

> **We’re not a hospital. We’re a bridge.**

### Terminology (approved)

| Use | Avoid (for public UX copy) | Notes |
| --- | --- | --- |
| Expert, care expert | Practitioner, provider (as generic), “healthcare professional” (corporate) | Matches marketplace clarity |
| Client | Patient, user | Unless clinical context requires “patient” |
| Trusted platform | Technology marketplace (feature-y) | Emotion + role |
| Experts on Eleva Care | — | Platform identity line (see tone guide) |

**Naming:** **Eleva Care** = product name in UI and most marketing. **eleva.care** = domain and legal-style references (see footer disclaimers in `en.json`).

### Messaging hierarchy

1. **Category** — Women’s health experts, on-demand / on your schedule.  
2. **Role clarity** — We connect you; experts deliver care.  
3. **Proof** — Licensed, independent, secure platform (where substantiated).  
4. **Action** — Find an expert, book, get care.

### Tone by context

- **Marketing / hero:** Inspiring, specific, benefit-led (see `hero` strings in `en.json`).  
- **Product / UI:** Direct, scannable, supportive errors.  
- **Legal / policies:** Clear and readable; may be more formal but not hostile.  
- **Clinical safety:** Direct warnings (e.g. emergencies) without panic tone.

### Localization

English, Spanish, Portuguese variants follow the same terminology intent; formality in PT/ES for healthcare is respected in the tone guide.

---

## 3. Visual identity

### Logo system

**Elements**

1. **Full wordmark** — “eleva” + “care” logotype; primary brand signature for marketing and most headers.  
2. **Symbol** — Circular leaf/branch mark; for favicons, app icons, tight UI, and social avatars.  
3. **Header implementation** — Inline SVG wordmark + mark in `HeaderContent.tsx` for performance; PNG set in `/public` for email and static use.

**Variants (from `public/`)**

- **Color** — Default on light backgrounds.  
- **White** — On teal/dark/photography; email branded header.  
- **Black** — Single-color print, monotone decks.

**Clear space (minimum)**

- Treat **1× the cap height of the “e” in “eleva”** as padding around the full lockup when placing next to other elements. *If marketing needs a stricter spec, use the height of the circular mark beside the wordmark as the unit of measure.*

**Minimum digital sizes (from production usage)**

- **Header wordmark:** ~160×32 px (mobile) to 240×48 px (desktop) as implemented. Do not go below **128×26 px** for legibility.  
- **Symbol alone:** Favicon and app icon sizes 16–512 px supplied; for standalone mark in UI, prefer **≥ 24 px** when shown next to text.

**Do**

- Use approved files from the [asset inventory](./assets-inventory.md).  
- Prefer **full wordmark** for first impression; **mark** when space is constrained.  
- Keep colors from the defined palette; **one foreground logo color** per lockup (no random gradients on the mark).

**Don’t**

- Squeeze, skew, rotate, or re-draw the mark.  
- Add outlines, drop shadows, or “badge” effects that break minimal identity.  
- Place color logo on clashing low-contrast backgrounds.  
- Lock up with partner logos without following [cobranding](./usage-examples.md#cobranding-and-partners).

### Color

**Core palette** (from `src/app/globals.css` RGB tokens, shown as hex for spec work)

| Token | Hex | Role |
| --- | --- | --- |
| `eleva-primary` | `#006D77` | Deep teal — primary brand, primary buttons, key headings |
| `eleva-primary-light` | `#83C5BE` | Sage / light teal — secondary surfaces, gradients, supportive UI |
| `eleva-secondary` | `#E29578` | Soft coral — warmth, secondary CTAs, highlights |
| `eleva-secondary-light` | `#FFDDD2` | Warm sand — soft backgrounds, cards |
| `eleva-accent` | `#E0FBFC` | Pale cool tint — subtle fills, airiness |
| `eleva-neutral-50`–`200`, `900` | `#FCFDFD` … `#D1D1D1` … `#333333` | Neutrals for text, borders, backgrounds |
| `eleva-highlight-red` | `#EE4266` | Accent (use sparingly) |
| `eleva-highlight-purple` | `#540D6E` | Accent (sparingly; e.g. footer gradient zones) |
| `eleva-highlight-yellow` | `#FFD23F` | Accent (sparingly) |

**Usage rules**

- **Default UI:** Teal primary + warm neutrals; use coral as a **deliberate** warm accent, not a second primary everywhere.  
- **Gradient moments:** The product uses **diagonal multi-stop gradients** (e.g. footer CTA) as a **brand energy** tool—keep to **one** per screen and pair with **simple** typography.  
- **Accessibility:** Text on `eleva-primary` should be **white**; check contrast for any custom pairings. Secondary warm tints: prefer **charcoal** (`#333` / neutral 900) body text, not light gray on light coral.

**Semantic UI colors** in the app also map through shadcn (`--background`, `--primary`, etc.); new surfaces should **derive** from the Eleva tokens above for brand consistency.

### Typography

| Role | Family | Weights in use | Where |
| --- | --- | --- | --- |
| **Editorial / hero** | Lora (serif) | 400, 600 | Big headlines, story, emotional sections |
| **UI / body** | DM Sans | 400, 500, 700 | App UI, marketing body, buttons |
| **Data / code / IDs** | IBM Plex Mono | 400, 500 | Transaction IDs, technical labels (load on demand) |

- **Headline formula:** `font-serif` + light/tracking-tight for **premium, editorial** feel.  
- **Overlines / labels:** `font-mono` + uppercase + wide tracking = **structured, app-like** without coldness.  
- **Line length:** Prefer ~60–80 characters for body in marketing.

*Rationale in code comments: `src/app/layout.tsx`.*

### Shape, motif, and motion

- **Motif** — The **olive/branch** in the mark suggests growth, care, and calm strength; use **organic, soft** photography and rounded UI (`--radius` scale) in line with the product.  
- **Layout** — Marketing uses **soft gradients, rounded-2xl/3xl/5xl** cards; not harsh tech grids.  
- **Motion** — Respects `prefers-reduced-motion` for scroll behavior (`globals.css`); brand motion should stay **subtle** (hover lifts, not flashy loops).

### Iconography

- Prefer **lucide**-style simple icons in product (current stack).  
- `expert-verified-icon.svg` is a **trust** asset, not a decorative pattern.

---

## 4. Imagery and art direction

### Photography

- **True-to-life** women, diverse life stages, **warm light**, real environments when possible.  
- **Avoid** generic stock that feels like “hospital advertising” or over-smiling crowd shots with no context.  
- **Services imagery** in MVP maps services to relatable scenes (e.g. pregnancy, movement, support).

### Portraits (team, experts)

- **Professional, approachable**; current site uses team and advisor headshots in **natural or neutral** treatment. *Future premium standard: align with a single spec (lighting, crop, color vs. B/W) if marketing scales.*

### Social and campaigns

- Use `eleva-care-share.svg` / `.png` as the **baseline** for OG; refresh campaign art should keep **logo, teal gradient, and enough clear space** consistent with the share spec.

---

## 5. Application system

### Product (authenticated)

- **Primary actions:** `eleva-primary` buttons, DM Sans, clear short labels.  
- **Trust:** Platform disclaimer patterns from `en.json` and modal copy—**never** remove safety framing for a “fun” tone.

### Marketing

- **Hero:** Serif headline + proof-led subline + two CTAs max (as on home).  
- **Long-form** (about, history): Editorial serif headings, human story, stats used sparingly.

### Email

- **Branded** headers use `eleva-logo-white.png` on `#006D77` (see `EmailHeader.tsx`).  
- Body: system or web-safe fallbacks; keep **plain language** and **contrast** high.

### Partners and workspaces

Workspace customization (logo, cover, brand colors) is **tenant-level**, not a replacement for Eleva master brand rules. See:

[`_context/clone-repo/eleva-care-app/src/content/help/workspace/en/getting-started/branding.mdx`](../../../_context/clone-repo/eleva-care-app/src/content/help/workspace/en/getting-started/branding.mdx)

**Rule:** When Eleva and a partner both appear, Eleva remains **identifiable**; white-label/enterprise is a **contractual** mode, not the default in public docs.

---

## 6. Asset governance

| Action | Owner | Cadence |
| --- | --- | --- |
| Update this handbook and inventory | Brand + product | On major brand or MVP sync |
| Add or replace logo files | Design + eng | When assets ship in `public/` |
| Voice compliance | Content | Per release; quarterly audit of key flows |

**Missing masters (to add when design has bandwidth)**

- Standalone **SVG/FIGMA** for full logotype (matching production) for external agencies.  
- **PMS/CMYK** for print, if not already in design files.  
- Unified **expert/team headshot** spec (background, aspect ratio) for a premium, consistent about section.

**Versioning:** When the MVP in `_context/clone-repo/eleva-care-app` changes logos or core tokens, update the [asset inventory](./assets-inventory.md) and this file in the same change train.

---

## Cross-references

- v3 product/engineering context: [Eleva v3 README](../README.md)  
- Packaged files: [asset pack](./assets/) · [previews](./previews/)  
- Recovery notes: [GAP-ANALYSIS.md](./GAP-ANALYSIS.md)  
- MVP product reference: [`_context/clone-repo/eleva-care-app`](../../../_context/clone-repo/eleva-care-app)
