# Eleva.care — usage examples

**Status:** Living  
**Companion:** [Main brand handbook](./README.md) · [Asset inventory](./assets-inventory.md) · [Asset pack](./assets/)

Concrete patterns for applying the Eleva.care system. Prefer files from [`./assets/`](./assets/) over hunting in the MVP clone. *Examples are illustrative; product strings may evolve—align with [`tone-of-voice-guide.md`](../../../_context/clone-repo/eleva-care-app/_docs/04-development/tone-of-voice-guide.md) and `src/messages`.*

---

## Web marketing

### Homepage hero (pattern)

- **Headline (serif):** Benefit + specificity + control (e.g. world-class experts, on-demand / on your schedule).  
- **Subline (sans, light):** What you can do on the platform in one sentence.  
- **Disclaimer (small, linked):** Platform vs. expert, non-emergency, link to “learn more”.

**Do:** One primary CTA to find/book; secondary optional (e.g. quiz) if it reduces friction.  
**Don’t:** Stack more than two competing primary actions in the first viewport.

### Section structure ( pattern from Services / About)

1. `font-mono` overline, uppercase, tracked (structure).  
2. `font-serif` large headline (emotion + topic).  
3. Sans body, balanced line length.

### Gradients and energy

- **Footer CTA** uses a multi-color gradient; treat as a **hero-level** element—**one** per page section max.  
- On the same page, keep mid-body sections **teal + neutral** to avoid “rainbow fatigue.”

---

## Product UI

### Primary button

- Background: `eleva-primary` ( e.g. `#006D77` ).  
- Text: white.  
- Label: short verb + object (“Book session”, “Find an expert”).

**Don’t:** use highlight red/purple for default primary actions—reserve for alerts or rare emphasis.

### Surfaces and borders

- Cards: `eleva-neutral-100/50` with subtle border `eleva-neutral-200` where the product does today.  
- Focus rings: align to accessible ring color (see `ring` in `globals.css`); don’t remove focus styles for “minimalism”.

### Trust and experts

- Use **expert** language; **verified** badge is a **credential/trust** signal, not a decorative sticker.  
- Reuse the standard **platform disclaimer** block from messaging JSON—**don’t** invent softer legal claims in the UI.

---

## Email (transactional and lifecycle)

**Reference implementation:** `src/components/emails/EmailHeader.tsx` in the MVP.

| Variant | Background | Logo |
| --- | --- | --- |
| `default` / `minimal` | White or light neutral | `eleva-logo-color.png` |
| `branded` | `primary` or `#006D77` | `eleva-logo-white.png` |

**Practices**

- **Subject:** Human, specific (“Your appointment is {time}”).  
- **Preheader:** Complement, don’t repeat, the subject.  
- **CTA button:** Teal, high contrast; one primary CTA.  
- **Monospace** for IDs, amounts, and codes only—short spans.

**Don’t:** Rely on webfonts in email; design for system fallbacks.

---

## Social and communities

- **Profile / avatar:** Symbol mark (color on light, or white on teal) at readable sizes.  
- **Link previews:** Use `img/eleva-care-share.png` (or the SVG in internal tools) so **logo + gradient** stay consistent.  
- **Post copy:** First line = the hook; then link; avoid clinical jargon in organic posts.

---

## Sales and B2B (“For organizations”)

- **Lead with outcomes** for the organization and its clients, then **how the platform** fits (not the reverse).  
- **Brand separation:** their logo + Eleva in **powered by / in partnership** layouts, not mixed into one mark.

---

## Cobranding and partners

**Principles**

1. **Equal dignity** — no shrinking Eleva to illegibility next to a partner.  
2. **Clear roles** — “eleva.care powers booking for {Partner}” vs. clinical claims by the partner.  
3. **Single system** — partner colors in **their** zone; Eleva UI stays in Eleva tokens in product flows we own.

**Layout sketch**

- Horizontal: `Partner mark` — gap — `Eleva Care` wordmark (height-aligned).  
- Stacked: Partner on top, Eleva “Powered by” in smaller line below, using **DM Sans**-style or neutral sans, not the serif.

---

## What “premium” does *not* mean

- Heavier copy, more adjectives, or “luxury” for its own sake.  
- Denser UI or smaller type to look “sophisticated.”  
- Replacing the teal anchor with a rainbow of accents on every block.

**Premium, for Eleva, =** calm clarity, trusted expertise, and **human** warmth in line with the [Brand pillars](./README.md#brand-pillars).
