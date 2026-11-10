import { ConsentBanner, ConsentDialog } from "c15t/next"

/**
 * Compact bottom bar. c15t keeps its own CSS in `@layer components`, so
 * these unlayered rules win without specificity tricks. They key on the
 * stable `data-testid` hooks c15t renders, never on its hashed classes.
 *
 * - Desktop: one row (c15t default at ≥1024px), under 80px tall.
 * - Phone: title hidden visually (it stays the region's accessible name),
 *   both choices in one row and "Customize" as a text link, under 160px.
 * - While the bar shows, the page gets matching bottom padding and
 *   `scroll-padding-bottom`, so focus and the last button on the page can
 *   always move clear of it (WCAG 2.4.11).
 */
const BAR = '[data-testid="consent-banner-root"][data-variant="bar"]'

const COMPACT_BAR_CSS = `
html:has(${BAR}) {
  --eleva-consent-bar-space: 9rem;
  scroll-padding-bottom: var(--eleva-consent-bar-space);
}
html:has(${BAR}) body {
  padding-bottom: var(--eleva-consent-bar-space);
}
@media (min-width: 640px) {
  html:has(${BAR}) { --eleva-consent-bar-space: 10rem; }
}
@media (min-width: 1024px) {
  html:has(${BAR}) { --eleva-consent-bar-space: 5.5rem; }
}
@media (max-width: 639.98px) {
  ${BAR} [data-testid="consent-banner-title"] {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  ${BAR} [data-testid="consent-banner-header"] {
    padding: 0.625rem 1rem 0.375rem;
  }
  ${BAR} [data-testid="consent-banner-description"] {
    font-size: 0.8125rem;
    line-height: 1.125rem;
  }
  ${BAR} [data-testid="consent-banner-footer"] {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.125rem 0.5rem;
    padding: 0.375rem 1rem 0.625rem;
    background-color: transparent;
  }
  ${BAR} [data-testid="consent-banner-footer-sub-group"] {
    flex: 1 1 auto;
    width: auto;
    gap: 0.5rem;
  }
  ${BAR} [data-testid="consent-banner-footer"] button[data-action] {
    padding-inline: 0.75rem;
    white-space: nowrap;
  }
  ${BAR} [data-testid="consent-banner-footer"] button[data-action="customize"] {
    flex: none;
    width: auto;
    height: auto;
    min-height: 1.5rem;
    padding: 0.125rem 0.25rem;
    border-color: transparent;
    background: transparent;
    box-shadow: none;
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
}
`

/** Banner + preferences dialog; mount inside `ConsentRoot` in the app root layout. */
export function ConsentChrome() {
  return (
    <>
      <style>{COMPACT_BAR_CSS}</style>
      <ConsentBanner variant="bar" position="bottom" />
      <ConsentDialog />
    </>
  )
}
