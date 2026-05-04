/**
 * Eleva design-token mapping for Stripe Embedded Components Appearance API.
 *
 * Reference:
 * https://stripe.com/docs/connect/embedded-components/customization
 *
 * Tokens come from packages/ui/src/styles/globals.css (--eleva-*).
 * Stripe's Appearance API reads CSS custom properties at mount
 * time; if the consumer mounts components on a page that doesn't
 * include the Eleva tokens, fallback hex values keep the UI usable.
 */

export interface ElevaConnectAppearance {
  variables: Record<string, string>
}

/**
 * Default appearance object passed to <ConnectComponentsProvider>.
 * Hex fallbacks mirror brand-book/assets/palette/eleva-css-variables-snippet.css
 * but use static values so the SDK doesn't need to resolve CSS vars.
 */
export const elevaConnectAppearance: ElevaConnectAppearance = {
  variables: {
    fontFamily: '"DM Sans", system-ui, -apple-system, sans-serif',
    fontSizeBase: "16px",
    spacingUnit: "8px",
    borderRadius: "12px",

    colorPrimary: "#0f7c66",
    colorBackground: "#ffffff",
    colorText: "#0f1419",
    colorSecondaryText: "#535861",

    colorDanger: "#d92d20",
    colorSuccess: "#079455",
    colorWarning: "#f79009",
    colorBorder: "#e4e7ec",

    buttonPrimaryColorBackground: "#0f7c66",
    buttonPrimaryColorBorder: "#0f7c66",
    buttonPrimaryColorText: "#ffffff",

    buttonSecondaryColorBackground: "#ffffff",
    buttonSecondaryColorBorder: "#d0d5dd",
    buttonSecondaryColorText: "#0f1419",

    badgeNeutralColorBackground: "#f2f4f7",
    badgeNeutralColorBorder: "#eaecf0",
    badgeNeutralColorText: "#535861",

    formAccentColor: "#0f7c66",
    formHighlightColorBorder: "#0f7c66",
  },
}
