import * as React from 'react';
import type { EmailContext } from '@/emails/utils/i18n';
import { Column, Container, Img, Link, Row, Section } from '@react-email/components';

export interface EmailHeaderProps {
  variant?: 'default' | 'minimal' | 'branded';
  showLogo?: boolean;
  showNavigation?: boolean;
  theme?: 'light' | 'dark';
  emailContext?: EmailContext;
  userContext?: {
    displayName?: string;
  };
}

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://eleva.care';

/**
 * Shared Email Header Component for Eleva Care
 * Used across all email templates for consistent branding
 */
export function EmailHeader({
  variant = 'default',
  showLogo = true,
  showNavigation = false,
  theme = 'light',
  emailContext,
  userContext,
}: EmailHeaderProps) {
  // For branded variant, force dark theme for white logo visibility
  const effectiveTheme = variant === 'branded' ? 'dark' : theme;
  const isDark = effectiveTheme === 'dark';

  // Get logo based on effective theme - white logo for branded (green) backgrounds
  const logoSrc = isDark
    ? `${DEFAULT_BASE_URL}/eleva-logo-white.png`
    : `${DEFAULT_BASE_URL}/eleva-logo-color.png`;

  // Use theme colors from emailContext if available
  const themeColors = emailContext?.theme?.colors;

  // Variant-specific styles with theme support
  const variantStyles = {
    default: {
      backgroundColor: themeColors?.background || '#FFFFFF',
      borderBottom: `1px solid ${themeColors?.border || '#F3F4F6'}`,
      padding: '24px 0',
    },
    minimal: {
      backgroundColor: 'transparent',
      borderBottom: 'none',
      padding: '16px 0',
    },
    branded: {
      backgroundColor: themeColors?.primary || '#006D77',
      borderBottom: 'none',
      padding: '24px 0',
    },
  };

  const styles = variantStyles[variant];
  const textColor =
    variant === 'branded'
      ? 'rgba(255, 255, 255, 0.9)'
      : themeColors?.text.primary || (isDark ? '#E5E7EB' : '#374151');

  // Navigation labels (could be internationalized)
  const navLabels = {
    dashboard: 'Dashboard',
    support: 'Support',
  };

  return (
    <Section style={styles}>
      <Container
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '0 24px',
        }}
      >
        <Row>
          <Column style={{ textAlign: 'left', verticalAlign: 'middle' }}>
            {showLogo && (
              <Link
                href={DEFAULT_BASE_URL}
                style={{ display: 'inline-block', textDecoration: 'none' }}
              >
                <Img
                  src={logoSrc}
                  alt="Eleva Care"
                  width="180"
                  height="50"
                  style={{
                    display: 'block',
                    outline: 'none',
                    border: 'none',
                    maxWidth: '180px',
                    height: 'auto',
                  }}
                />
              </Link>
            )}
          </Column>

          <Column style={{ textAlign: 'right', verticalAlign: 'middle' }}>
            {userContext?.displayName && (
              <div
                style={{
                  fontSize: '14px',
                  color: textColor,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontWeight: '500',
                }}
              >
                {userContext.displayName}
              </div>
            )}

            {showNavigation && (
              <div style={{ fontSize: '14px', marginTop: '8px' }}>
                <Link
                  href={`${DEFAULT_BASE_URL}/dashboard`}
                  style={{
                    color: textColor,
                    textDecoration: 'none',
                    marginRight: '16px',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontWeight: '500',
                  }}
                >
                  {navLabels.dashboard}
                </Link>
                <Link
                  href={`${DEFAULT_BASE_URL}/support`}
                  style={{
                    color: textColor,
                    textDecoration: 'none',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontWeight: '500',
                  }}
                >
                  {navLabels.support}
                </Link>
              </div>
            )}
          </Column>
        </Row>
      </Container>
    </Section>
  );
}
