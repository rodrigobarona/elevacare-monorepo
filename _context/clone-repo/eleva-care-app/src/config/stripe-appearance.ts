/**
 * Stripe Connect Embedded Components -- Centralized Appearance
 *
 * Maps Eleva Care design tokens to Stripe's appearance API.
 * Used by StripeConnectProvider and any future embedded component consumer.
 *
 * Design tokens sourced from globals.css:
 *   --eleva-primary:        #006D77  (Deep Teal)
 *   --eleva-primary-light:  #83C5BE  (Sage Green)
 *   --eleva-secondary:      #E29578  (Soft Coral)
 *   --eleva-secondary-light:#FFDDD2  (Warm Sand)
 *   --eleva-accent:         #E0FBFC  (Pale Lavender)
 *   --eleva-neutral-900:    #333333  (Charcoal)
 *   --eleva-neutral-200:    #D1D1D1  (Light Grey)
 *   --eleva-neutral-50:     #FCFDFD  (Lightest White)
 *   --eleva-highlight-red:  #EE4266  (Vibrant Rose)
 *
 * Fonts: DM Sans (UI), Lora (editorial), IBM Plex Mono (code)
 * Border radius: 0.5rem (8px) -- var(--radius) in globals.css
 */

export const STRIPE_CONNECT_APPEARANCE = {
  overlays: 'dialog' as const,
  variables: {
    // Typography -- DM Sans matches the app UI font
    fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
    fontSizeBase: '14px',

    // Spacing & shape
    spacingUnit: '8px',
    borderRadius: '8px',

    // Brand colors
    colorPrimary: '#006D77',
    colorBackground: '#FCFDFD',
    colorText: '#333333',
    colorDanger: '#EE4266',

    // Buttons
    buttonPrimaryColorBackground: '#006D77',
    buttonPrimaryColorBorder: '#006D77',
    buttonPrimaryColorText: '#FFFFFF',
    buttonSecondaryColorBackground: '#E0FBFC',
    buttonSecondaryColorBorder: '#83C5BE',
    buttonSecondaryColorText: '#006D77',

    // Text hierarchy
    colorSecondaryText: '#717171',
    actionPrimaryColorText: '#006D77',
    actionSecondaryColorText: '#333333',

    // Badges
    badgeSuccessColorBackground: '#E0FBFC',
    badgeSuccessColorText: '#006D77',
    badgeSuccessColorBorder: '#83C5BE',
    badgeWarningColorBackground: '#FFDDD2',
    badgeWarningColorText: '#A82C00',
    badgeWarningColorBorder: '#E29578',
    badgeDangerColorBackground: '#FDE8ED',
    badgeDangerColorText: '#EE4266',
    badgeDangerColorBorder: '#EE4266',
    badgeNeutralColorBackground: '#F7F9F9',
    badgeNeutralColorText: '#717171',
    badgeNeutralColorBorder: '#D1D1D1',

    // Form elements
    colorBorder: '#D1D1D1',
    formHighlightColorBorder: '#83C5BE',
    formAccentColor: '#006D77',
    formBackgroundColor: '#FFFFFF',
    formBorderRadius: '6px',

    // Misc
    buttonBorderRadius: '8px',
    badgeBorderRadius: '6px',
    overlayBorderRadius: '12px',
    offsetBackgroundColor: '#F7F9F9',
  },
};
