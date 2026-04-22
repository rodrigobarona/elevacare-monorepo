# Eleva.care OG image system

**Status:** Living  
**Reference:** [`assets/og/og-image-components.tsx`](./assets/og/og-image-components.tsx) (copied from MVP `src/lib/og-images/components.tsx`)  
**Source doc:** `_context/clone-repo/eleva-care-app/_docs/04-development/ui-ux/04-og-image-system.md`

Dynamic Open Graph (OG) images are generated at the edge with `@vercel/og` + Satori. This is the primary **campaign surface** for social link previews.

## Image types

| Type | When | Key params |
| --- | --- | --- |
| `profile` | Expert profile pages | `name`, `username`, `headline`, `image`, `specialties[]` |
| `generic` | About, services, marketing | `title`, `description`, `variant` (`primary` / `secondary` / `accent`) |
| `event` | Consultation / booking | `title`, `expertName`, `expertImage`, `duration`, `price` |

Dimensions: **1200 × 630**. Cache: 1h max-age, 24h stale-while-revalidate.

## Brand palette used in OG

Matches master palette, with gradients defined:

- `primary`: `linear-gradient(135deg, #006D77 0%, #83C5BE 100%)`  
- `secondary`: `linear-gradient(135deg, #E29578 0%, #FFDDD2 100%)`  
- `accent`: `linear-gradient(135deg, #E0FBFC 0%, #F7F9F9 100%)`

Use **one** gradient per variant; don’t mix in a single image.

## Usage rules

- **Logo presence:** Always include Eleva wordmark or mark; keep legible clear space.  
- **Text:** Keep titles short (Satori truncates). Prefer 3–6 words for titles and 8–16 for descriptions.  
- **Images:** Use absolute URLs for profile/expert images; provide graceful fallback when missing.  
- **Variants:** `primary` for core marketing, `secondary` for warmer, human stories, `accent` for light airy content.

## Don’ts

- Don’t bake legal disclaimers into OG images — those belong in page content.  
- Don’t overlay multiple portraits in one OG; pick one clear expert photo.  
- Don’t use highlight colors (red / purple / yellow) as the OG background; reserve them for campaign moments inside the site.

## Related

- [Art direction — Social and campaigns](./art-direction.md#social-and-campaigns)  
- [Usage examples — Social and communities](./usage-examples.md#social-and-communities)
