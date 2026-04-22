import * as React from 'react';
import type { EmailContext } from '@/emails/utils/i18n';
import { Column, Container, Hr, Link, Row, Section, Text } from '@react-email/components';

export interface EmailFooterProps {
  variant?: 'default' | 'minimal' | 'branded';
  showLogo?: boolean;
  showSocialLinks?: boolean;
  showUnsubscribe?: boolean;
  showContactInfo?: boolean;
  theme?: 'light' | 'dark';
  emailContext?: EmailContext;
  companyName?: string;
  tagline?: string;
  supportEmail?: string;
  unsubscribeUrl?: string;
}

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://eleva.care';

/**
 * Shared Email Footer Component for Eleva Care
 * Includes legal compliance, unsubscribe, and contact information
 */
export function EmailFooter({
  variant = 'default',
  showLogo: _showLogo = true,
  showSocialLinks: _showSocialLinks = false,
  showUnsubscribe = true,
  showContactInfo = true,
  theme: _theme = 'light',
  emailContext,
  companyName = 'Eleva Care',
  tagline = "Expert care for women's health",
  supportEmail = 'support@eleva.care',
  unsubscribeUrl,
}: EmailFooterProps) {
  const currentYear = new Date().getFullYear();

  // Use theme colors from emailContext if available
  const themeColors = emailContext?.theme?.colors;

  // Final unsubscribe URL with fallback
  const finalUnsubscribeUrl = unsubscribeUrl || `${DEFAULT_BASE_URL}/unsubscribe`;

  // Variant-specific styling with theme support
  const variantStyles = {
    default: {
      backgroundColor: themeColors?.surface || '#FAFBFC',
      borderTop: `1px solid ${themeColors?.border || '#F3F4F6'}`,
      padding: '40px 0 32px 0',
      marginTop: '40px',
    },
    minimal: {
      backgroundColor: 'transparent',
      borderTop: 'none',
      padding: '24px 0',
      marginTop: '24px',
    },
    branded: {
      backgroundColor: themeColors?.primary || '#006D77',
      borderTop: 'none',
      padding: '40px 0 32px 0',
      marginTop: '40px',
    },
  };

  const styles = variantStyles[variant];
  const isBranded = variant === 'branded';

  // Text colors based on variant and theme
  const textColors = {
    primary: isBranded ? 'rgba(255, 255, 255, 0.95)' : themeColors?.text.primary || '#374151',
    secondary: isBranded ? 'rgba(255, 255, 255, 0.8)' : themeColors?.text.secondary || '#6B7280',
    muted: isBranded ? 'rgba(255, 255, 255, 0.6)' : themeColors?.text.muted || '#9CA3AF',
    link: isBranded ? 'rgba(255, 255, 255, 0.9)' : themeColors?.primary || '#006D77',
  };

  // Footer labels (could be internationalized)
  const footerLabels = {
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
    unsubscribe: 'Unsubscribe',
    copyright: `© ${currentYear} ${companyName}. All rights reserved.`,
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
        {/* Main Footer Content */}
        <Row>
          {/* Company Info */}
          <Column
            style={{
              width: '60%',
              verticalAlign: 'top',
              paddingRight: '24px',
            }}
          >
            <Text
              style={{
                margin: '0 0 8px 0',
                fontSize: '16px',
                lineHeight: '1.5',
                color: textColors.primary,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '600',
              }}
            >
              {companyName}
            </Text>

            <Text
              style={{
                margin: '0 0 16px 0',
                fontSize: '14px',
                lineHeight: '1.6',
                color: textColors.secondary,
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {tagline}
            </Text>

            {showContactInfo && (
              <Text
                style={{
                  margin: '0',
                  fontSize: '14px',
                  color: textColors.secondary,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                <Link
                  href={`mailto:${supportEmail}`}
                  style={{
                    color: textColors.link,
                    textDecoration: 'none',
                    fontWeight: '500',
                  }}
                  aria-label={`Contact support at ${supportEmail}`}
                >
                  {supportEmail}
                </Link>
              </Text>
            )}
          </Column>

          {/* Links */}
          <Column
            style={{
              width: '40%',
              verticalAlign: 'top',
              textAlign: 'right',
            }}
          >
            {/* Legal Links */}
            <div style={{ marginBottom: '20px' }}>
              <Link
                href={`${DEFAULT_BASE_URL}/legal/privacy`}
                style={{
                  display: 'block',
                  fontSize: '13px',
                  color: textColors.secondary,
                  textDecoration: 'none',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  marginBottom: '8px',
                  fontWeight: '500',
                }}
                aria-label="Privacy Policy"
              >
                {footerLabels.privacyPolicy}
              </Link>
              <Link
                href={`${DEFAULT_BASE_URL}/legal/terms`}
                style={{
                  display: 'block',
                  fontSize: '13px',
                  color: textColors.secondary,
                  textDecoration: 'none',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  marginBottom: '8px',
                  fontWeight: '500',
                }}
                aria-label="Terms of Service"
              >
                {footerLabels.termsOfService}
              </Link>
            </div>
          </Column>
        </Row>

        {/* Divider */}
        <Hr
          style={{
            border: 'none',
            borderTop: `1px solid ${isBranded ? 'rgba(255, 255, 255, 0.2)' : themeColors?.border || '#F3F4F6'}`,
            margin: '32px 0 24px 0',
            width: '100%',
          }}
        />

        {/* Bottom Row */}
        <Row>
          <Column
            style={{
              width: '70%',
              textAlign: 'left',
              verticalAlign: 'middle',
            }}
          >
            <Text
              style={{
                margin: '0',
                fontSize: '12px',
                color: textColors.muted,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                lineHeight: '1.5',
              }}
            >
              {footerLabels.copyright}
            </Text>
          </Column>

          <Column
            style={{
              width: '30%',
              textAlign: 'right',
              verticalAlign: 'middle',
            }}
          >
            {showUnsubscribe && (
              <Link
                href={finalUnsubscribeUrl}
                style={{
                  fontSize: '12px',
                  color: textColors.muted,
                  textDecoration: 'none',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontWeight: '500',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: `1px solid ${isBranded ? 'rgba(255, 255, 255, 0.2)' : themeColors?.border || '#E5E7EB'}`,
                  backgroundColor: isBranded ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                }}
                aria-label="Unsubscribe from email notifications"
              >
                {footerLabels.unsubscribe}
              </Link>
            )}
          </Column>
        </Row>
      </Container>
    </Section>
  );
}
