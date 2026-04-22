# Application UI reference (from MVP behavior)

The live product in [`_context/clone-repo/eleva-care-app`](../../../../_context/clone-repo/eleva-care-app) is the best UI reference. This page lists **which brand rules show up in code** so designers can align without a running server.

## Header (marketing)

- **Logo:** Inline SVG in `src/components/layout/header/HeaderContent.tsx` — default color follows `currentColor`; white on transparent hero.  
- **Size:** `h-8` / `w-[160px]` mobile, `lg:h-12` / `lg:w-[240px]` desktop.

## Primary action

- **Color:** `eleva-primary` / `#006D77` (see `globals.css` and component usage).  
- **Type:** `font-sans` (DM Sans stack).

## Trust in product

- **Expert verified** asset:  
  [`../assets/product/expert-verified-icon.svg`](../assets/product/expert-verified-icon.svg)

## Email

- **Branded header** uses white logo on teal: see `src/components/emails/EmailHeader.tsx` in the MVP (also described in [Usage examples](../usage-examples.md)).

## Footer CTA (marketing)

- **Gradient energy band** (yellow / red / purple) — one **strong** brand moment; keep rest of page calmer. Implementation: `src/components/layout/footer/Footer.tsx`.

## Related

- [Usage examples — Product UI](../usage-examples.md#product-ui)  
- [Main handbook — Application system](../README.md#5-application-system)
