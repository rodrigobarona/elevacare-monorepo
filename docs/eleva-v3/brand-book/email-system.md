# Eleva.care email system

**Status:** Living  
**Source-of-truth tokens:** [`assets/tokens/email-brand-constants.ts`](./assets/tokens/email-brand-constants.ts) (copied from MVP `src/emails/utils/brand-constants.ts`)  
**Reference components:** [`assets/email-components/`](./assets/email-components/) (copies of `EmailLayout`, `EmailHeader`, `EmailFooter`, `EmailButton`)

The email system is a **distinct brand surface** with its own, more constrained token set because email clients don’t support the full web typography and color stack. It must stay aligned with the master brand but optimize for cross-client rendering.

## Relationship to master brand

- **Same brand spirit** — teal primary (`#006D77`), warm and clear, platform-vs-expert clarity.  
- **Different implementation reality** — web fonts and modern CSS are unreliable in email; tokens here use system fonts and extra color stops for dark mode and states.

## Email color palette (from `ELEVA_COLORS`)

| Role | Hex | Notes |
| --- | --- | --- |
| `primary` | `#006D77` | Same as master brand |
| `primaryLight` | `#00A8B8` | Email-only: higher contrast for dark themes |
| `primaryDark` | `#004D54` | Hover/active/button variants |
| `secondary` | `#F0FDFF` | Information sections / cards |
| `secondaryDark` | `#E0F8FF` | Borders on info sections |
| `success` | `#22C55E` | Confirmations |
| `warning` | `#F59E0B` | Alerts |
| `error` | `#EF4444` | Urgent |
| `neutral.dark` | `#4A5568` | Body text |
| `neutral.medium` | `#6B7280` | Secondary content |
| `neutral.light` | `#718096` | Muted |
| `neutral.extraLight` | `#F7FAFC` | Subtle fills |
| `neutral.border` | `#E2E8F0` | Dividers |
| `background` | `#F9FAFB` | Email canvas |
| `surface` | `#FFFFFF` | Cards |

## Typography (email-safe stack)

- **Family:** `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.  
- **Headings:** H1 28/1.2, H2 24/1.3, H3 20/1.4, H4 18/1.4 — all weight **600**.  
- **Body:** large 18, regular 16, small 14, caption 12 — all line-height ~1.5–1.6.

## Header and footer rules

- **Header variants** (see `EmailHeader.tsx`): `default` (white), `minimal` (transparent), `branded` (teal background, white logo).  
- **Branded header** uses `eleva-logo-white.png` at 180×50 max.  
- **Minimal** for internal-looking, low-ceremony messages (e.g. compact system notices).  
- **Default** for most transactional mail.

## Button rules

- **Primary:** teal fill, white text, 600 weight, `padding: 16px 32px`, radius 8px.  
- **Secondary:** white fill, teal text and teal 2px border.  
- **Success:** green fill for confirmations; don’t mix with primary in the same email.

## Cards / sections

- **Default card:** white surface, neutral border, radius 12, subtle shadow.  
- **Branded card:** light-teal (`secondary`) fill with teal border — use for “info” or highlight.  
- **Success / warning:** pale status fill + matching border.

## Layout constants

- Container max width: **600px**.  
- Content padding: 24px; card padding: 28px; section margin: 24 0.  
- Mobile breakpoint: 600px.

## Themes and localization

- **Dark theme:** enabled per recipient (when supported); uses `ELEVA_COLORS_DARK` variant (brighter teal on darker surfaces).  
- **Languages:** EN, ES, PT, PT-BR via the i18n system; preserve voice per [`messaging-framework.md`](./messaging-framework.md).

## Don’ts

- No web fonts (Lora / DM Sans / IBM Plex) in email bodies — they drop in Outlook and some Gmail clients.  
- No raw SVG logos inlined in emails (clients vary); use the PNGs in `../assets/logos/` and `../assets/marks/`.  
- No full-bleed hero gradients that rely on modern CSS — render them as pre-baked PNG headers when needed.

## Quick reference files

- Palette + type: [`assets/tokens/email-brand-constants.ts`](./assets/tokens/email-brand-constants.ts)  
- Layout / header / footer / button: [`assets/email-components/`](./assets/email-components/)  
- Live templates in MVP: `_context/clone-repo/eleva-care-app/src/emails/` (appointments, payments, users, experts, notifications)
