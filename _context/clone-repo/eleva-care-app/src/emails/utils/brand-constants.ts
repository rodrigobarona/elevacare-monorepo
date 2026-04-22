/**
 * Eleva Care Email Brand Constants
 * Centralized brand system for all email templates
 * Ensures premium healthcare branding consistency across all communications
 */

// Eleva Care Official Color Palette (Premium Healthcare Design System)
export const ELEVA_COLORS = {
  // Primary Brand Colors
  primary: '#006D77', // Eleva Primary Teal - Main brand color
  primaryLight: '#00A8B8', // Enhanced contrast for dark themes
  primaryDark: '#004D54', // Darker teal for hover states

  // Secondary Colors
  secondary: '#F0FDFF', // Secondary Light Teal - Information sections
  secondaryDark: '#E0F8FF', // Darker secondary for borders

  // Status Colors
  success: '#22C55E', // Success Green - Confirmations & success states
  successLight: '#DCFCE7', // Light success background
  warning: '#F59E0B', // Warning Yellow - Alerts & warnings
  warningLight: '#FEF3C7', // Light warning background
  error: '#EF4444', // Error Red - Error messages & urgent alerts
  errorLight: '#FEE2E2', // Light error background

  // Neutral Palette
  neutral: {
    dark: '#4A5568', // Neutral Dark - Primary body text
    medium: '#6B7280', // Medium neutral - Secondary content
    light: '#718096', // Neutral Light - Secondary text & muted content
    extraLight: '#F7FAFC', // Extra light - Subtle backgrounds
    border: '#E2E8F0', // Standard borders & dividers
  },

  // Background System
  background: '#F9FAFB', // Main email background
  surface: '#FFFFFF', // Card/section surfaces
  overlay: 'rgba(0, 109, 119, 0.05)', // Subtle overlay with brand color

  // Interactive States
  hover: {
    primary: '#005A63', // Primary button hover
    secondary: '#E6F9FF', // Secondary button hover
  },
} as const;

// Eleva Care Typography System (Premium Healthcare Standards)
export const ELEVA_TYPOGRAPHY = {
  // Font Stack - System fonts for optimal cross-platform rendering
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',

  // Heading Hierarchy
  headings: {
    h1: {
      fontSize: '28px',
      fontWeight: '600',
      lineHeight: '1.2',
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '24px',
      fontWeight: '600',
      lineHeight: '1.3',
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '20px',
      fontWeight: '600',
      lineHeight: '1.4',
    },
    h4: {
      fontSize: '18px',
      fontWeight: '600',
      lineHeight: '1.4',
    },
  },

  // Body Text System
  body: {
    large: {
      fontSize: '18px',
      lineHeight: '1.6',
      fontWeight: '400',
    },
    regular: {
      fontSize: '16px',
      lineHeight: '1.6',
      fontWeight: '400',
    },
    small: {
      fontSize: '14px',
      lineHeight: '1.5',
      fontWeight: '400',
    },
    caption: {
      fontSize: '12px',
      lineHeight: '1.4',
      fontWeight: '400',
    },
  },

  // Weight System
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

// Eleva Care Spacing System (8px grid system)
export const ELEVA_SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '40px',
  '3xl': '48px',
  '4xl': '64px',
} as const;

// Eleva Care Border Radius System
export const ELEVA_RADIUS = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

// Email-Specific Layout Constants
export const ELEVA_EMAIL_LAYOUT = {
  containerMaxWidth: '600px',
  contentPadding: '24px',
  sectionMargin: '24px 0',
  cardPadding: '28px',
  buttonPadding: '16px 32px',
  mobileBreakpoint: '600px',
} as const;

// Premium Button Styles
export const ELEVA_BUTTON_STYLES = {
  primary: {
    backgroundColor: ELEVA_COLORS.primary,
    color: ELEVA_COLORS.surface,
    border: `2px solid ${ELEVA_COLORS.primary}`,
    padding: ELEVA_EMAIL_LAYOUT.buttonPadding,
    borderRadius: ELEVA_RADIUS.md,
    fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
    fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
    fontWeight: ELEVA_TYPOGRAPHY.weights.semibold,
    textDecoration: 'none',
    display: 'inline-block',
    transition: 'all 0.2s ease-in-out',
  },
  secondary: {
    backgroundColor: ELEVA_COLORS.surface,
    color: ELEVA_COLORS.primary,
    border: `2px solid ${ELEVA_COLORS.primary}`,
    padding: ELEVA_EMAIL_LAYOUT.buttonPadding,
    borderRadius: ELEVA_RADIUS.md,
    fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
    fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
    fontWeight: ELEVA_TYPOGRAPHY.weights.semibold,
    textDecoration: 'none',
    display: 'inline-block',
  },
  success: {
    backgroundColor: ELEVA_COLORS.success,
    color: ELEVA_COLORS.surface,
    border: `2px solid ${ELEVA_COLORS.success}`,
    padding: ELEVA_EMAIL_LAYOUT.buttonPadding,
    borderRadius: ELEVA_RADIUS.md,
    fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
    fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
    fontWeight: ELEVA_TYPOGRAPHY.weights.semibold,
    textDecoration: 'none',
    display: 'inline-block',
  },
} as const;

// Premium Card/Section Styles
export const ELEVA_CARD_STYLES = {
  default: {
    backgroundColor: ELEVA_COLORS.surface,
    border: `1px solid ${ELEVA_COLORS.neutral.border}`,
    padding: ELEVA_EMAIL_LAYOUT.cardPadding,
    borderRadius: ELEVA_RADIUS.lg,
    margin: ELEVA_EMAIL_LAYOUT.sectionMargin,
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  },
  branded: {
    backgroundColor: ELEVA_COLORS.secondary,
    border: `1px solid ${ELEVA_COLORS.primary}`,
    padding: ELEVA_EMAIL_LAYOUT.cardPadding,
    borderRadius: ELEVA_RADIUS.lg,
    margin: ELEVA_EMAIL_LAYOUT.sectionMargin,
  },
  success: {
    backgroundColor: ELEVA_COLORS.successLight,
    border: `1px solid ${ELEVA_COLORS.success}`,
    padding: ELEVA_EMAIL_LAYOUT.cardPadding,
    borderRadius: ELEVA_RADIUS.lg,
    margin: ELEVA_EMAIL_LAYOUT.sectionMargin,
  },
  warning: {
    backgroundColor: ELEVA_COLORS.warningLight,
    border: `1px solid ${ELEVA_COLORS.warning}`,
    padding: ELEVA_EMAIL_LAYOUT.cardPadding,
    borderRadius: ELEVA_RADIUS.lg,
    margin: ELEVA_EMAIL_LAYOUT.sectionMargin,
  },
} as const;

// Accessibility-Compliant Text Styles
export const ELEVA_TEXT_STYLES = {
  heading1: {
    ...ELEVA_TYPOGRAPHY.headings.h1,
    fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
    color: ELEVA_COLORS.neutral.dark,
  },
  heading2: {
    ...ELEVA_TYPOGRAPHY.headings.h2,
    fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
    color: ELEVA_COLORS.primary,
  },
  heading3: {
    ...ELEVA_TYPOGRAPHY.headings.h3,
    fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
    color: ELEVA_COLORS.primary,
  },
  bodyLarge: {
    ...ELEVA_TYPOGRAPHY.body.large,
    fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
    color: ELEVA_COLORS.neutral.dark,
  },
  bodyRegular: {
    ...ELEVA_TYPOGRAPHY.body.regular,
    fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
    color: ELEVA_COLORS.neutral.dark,
  },
  bodySmall: {
    ...ELEVA_TYPOGRAPHY.body.small,
    fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
    color: ELEVA_COLORS.neutral.light,
  },
  caption: {
    ...ELEVA_TYPOGRAPHY.body.caption,
    fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
    color: ELEVA_COLORS.neutral.light,
  },
  brandAccent: {
    ...ELEVA_TYPOGRAPHY.body.regular,
    fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
    color: ELEVA_COLORS.primary,
    fontWeight: ELEVA_TYPOGRAPHY.weights.semibold,
  },
} as const;

// Helper function to generate table cell styles
export const createTableCellStyle = (
  isLabel: boolean = false,
  alignment: 'left' | 'center' | 'right' = 'left',
) =>
  ({
    padding: '12px 0',
    fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
    fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
    color: isLabel ? ELEVA_COLORS.neutral.light : ELEVA_COLORS.neutral.dark,
    fontWeight: isLabel ? ELEVA_TYPOGRAPHY.weights.medium : ELEVA_TYPOGRAPHY.weights.semibold,
    textAlign: alignment,
  }) as const;

// Dark mode color variants (for future implementation)
export const ELEVA_COLORS_DARK = {
  primary: ELEVA_COLORS.primaryLight,
  background: '#1F2937',
  surface: '#374151',
  text: {
    primary: '#F7FAFC',
    secondary: '#A0AEC0',
  },
} as const;

// Export type definitions for TypeScript
export type ElevaColors = typeof ELEVA_COLORS;
export type ElevaTypography = typeof ELEVA_TYPOGRAPHY;
export type ElevaSpacing = typeof ELEVA_SPACING;
export type ElevaButtonStyles = typeof ELEVA_BUTTON_STYLES;
export type ElevaCardStyles = typeof ELEVA_CARD_STYLES;
export type ElevaTextStyles = typeof ELEVA_TEXT_STYLES;
