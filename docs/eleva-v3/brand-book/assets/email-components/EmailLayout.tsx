import * as React from 'react';
import type { EmailContext, SupportedLocale } from '@/emails/utils/i18n';
import { Body, Container, Head, Html, Preview } from '@react-email/components';

import { EmailFooter } from './EmailFooter';
import { EmailHeader } from './EmailHeader';

export interface EmailLayoutProps {
  children: React.ReactNode;
  subject: string;
  previewText?: string;
  headerVariant?: 'default' | 'minimal' | 'branded';
  footerVariant?: 'default' | 'minimal' | 'branded';
  theme?: 'light' | 'dark';
  locale?: SupportedLocale;
  emailContext?: EmailContext;
  userContext?: {
    displayName?: string;
  };
}

/**
 * Base Email Layout Component for Eleva Care
 * Provides consistent structure for all email templates with header/footer
 */
export function EmailLayout({
  children,
  subject,
  previewText,
  headerVariant = 'default',
  footerVariant = 'default',
  theme = 'light',
  locale = 'en',
  emailContext,
  userContext,
}: EmailLayoutProps) {
  const isDark = theme === 'dark';

  // Use theme colors from emailContext if available, otherwise fallback to defaults
  const themeColors = emailContext?.theme?.colors || {
    background: isDark ? '#1F2937' : '#F9FAFB',
    surface: isDark ? '#374151' : '#FFFFFF',
  };

  return (
    <Html lang={locale} dir="ltr">
      <Head>
        <title>{subject}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta name="color-scheme" content={isDark ? 'dark' : 'light'} />
        <meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
      </Head>

      {previewText && <Preview>{previewText}</Preview>}

      <Body
        style={{
          backgroundColor: themeColors.background,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          margin: 0,
          padding: '20px 0',
        }}
      >
        <Container
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            backgroundColor: themeColors.surface,
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Email Header */}
          <EmailHeader
            variant={headerVariant}
            theme={theme}
            emailContext={emailContext}
            userContext={userContext}
          />

          {/* Main Content */}
          <Container
            style={{
              padding: '32px 24px',
              backgroundColor: themeColors.surface,
            }}
          >
            {children}
          </Container>

          {/* Email Footer */}
          <EmailFooter variant={footerVariant} theme={theme} emailContext={emailContext} />
        </Container>

        {/* Global styles for email clients */}
        <style>{`
          /* Reset styles for email clients */
          body, table, td, p, a, li, blockquote {
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
          }
          
          table, td {
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
          }
          
          img {
            -ms-interpolation-mode: bicubic;
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
          }
          
          /* Outlook specific fixes */
          .outlook-font-fix {
            font-family: Arial, sans-serif !important;
          }
          
          /* Mobile responsive */
          @media screen and (max-width: 600px) {
            .mobile-full-width {
              width: 100% !important;
              max-width: 100% !important;
            }
            
            .mobile-padding {
              padding: 16px !important;
            }
            
            .mobile-text-center {
              text-align: center !important;
            }
          }
        `}</style>
      </Body>
    </Html>
  );
}
