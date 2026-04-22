import * as React from 'react';
import { EmailButton, EmailLayout } from '@/components/emails';
import {
  ELEVA_BUTTON_STYLES,
  ELEVA_CARD_STYLES,
  ELEVA_COLORS,
  ELEVA_TEXT_STYLES,
  ELEVA_TYPOGRAPHY,
} from '@/emails/utils/brand-constants';
import type { SupportedLocale } from '@/emails/utils/i18n';
import { Heading, Section, Text } from '@react-email/components';

interface SecurityAlertEmailProps {
  userName?: string;
  alertType?: string;
  message?: string;
  deviceInfo?: string;
  location?: string;
  timestamp?: string;
  actionUrl?: string;
  locale?: string;
}

export default function SecurityAlertEmail({
  userName = 'User',
  alertType = 'Security Alert',
  message = 'We detected unusual activity on your account.',
  deviceInfo = 'Unknown device',
  location,
  timestamp,
  actionUrl = 'https://eleva.care/account/security',
  locale = 'en',
}: SecurityAlertEmailProps) {
  const subject = `🔒 Security Alert - ${alertType}`;
  const previewText = message;

  return (
    <EmailLayout
      subject={subject}
      previewText={previewText}
      headerVariant="branded"
      footerVariant="default"
      locale={locale as SupportedLocale}
    >
      {/* Security Alert Banner - High Priority */}
      <Section
        style={{
          ...ELEVA_CARD_STYLES.branded,
          backgroundColor: '#fef2f2',
          borderLeft: `4px solid #ef4444`,
        }}
      >
        <Heading
          style={{
            ...ELEVA_TEXT_STYLES.heading1,
            margin: '0 0 12px 0',
            textAlign: 'center' as const,
            color: '#dc2626',
          }}
        >
          🔒 Security Alert
        </Heading>
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            margin: '0',
            textAlign: 'center' as const,
            fontWeight: ELEVA_TYPOGRAPHY.weights.medium,
            color: '#dc2626',
          }}
        >
          {alertType}
        </Text>
      </Section>

      {/* Personal Greeting */}
      <Section style={{ margin: '32px 0' }}>
        <Text style={{ ...ELEVA_TEXT_STYLES.bodyLarge, margin: '0 0 16px 0' }}>Hi {userName},</Text>

        <Text style={{ ...ELEVA_TEXT_STYLES.bodyRegular, margin: '0 0 24px 0' }}>
          <strong>{message}</strong>
        </Text>
      </Section>

      {/* Event Details */}
      <Section
        style={{
          ...ELEVA_CARD_STYLES.default,
          backgroundColor: '#f9fafb',
          margin: '24px 0',
        }}
      >
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            margin: '0 0 16px 0',
            fontWeight: ELEVA_TYPOGRAPHY.weights.semibold,
          }}
        >
          Event Details:
        </Text>

        <Text style={{ ...ELEVA_TEXT_STYLES.bodySmall, margin: '0 0 8px 0' }}>
          <strong>Event type:</strong> {alertType}
        </Text>

        <Text style={{ ...ELEVA_TEXT_STYLES.bodySmall, margin: '0 0 8px 0' }}>
          <strong>Time:</strong> {timestamp || new Date().toLocaleString()}
        </Text>

        <Text style={{ ...ELEVA_TEXT_STYLES.bodySmall, margin: '0 0 8px 0' }}>
          <strong>Device:</strong> {deviceInfo}
        </Text>

        {location && (
          <Text style={{ ...ELEVA_TEXT_STYLES.bodySmall, margin: '0 0 8px 0' }}>
            <strong>Location:</strong> {location}
          </Text>
        )}
      </Section>

      {/* Action Section */}
      <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <Text style={{ ...ELEVA_TEXT_STYLES.bodyRegular, margin: '0 0 16px 0' }}>
          If this was you, you can safely ignore this message. If not, please review your account
          security immediately.
        </Text>

        <EmailButton
          href={actionUrl}
          style={{
            ...ELEVA_BUTTON_STYLES.primary,
            backgroundColor: '#dc2626',
            borderColor: '#dc2626',
          }}
        >
          Review Account Security
        </EmailButton>
      </Section>

      {/* Security Tips */}
      <Section
        style={{
          ...ELEVA_CARD_STYLES.default,
          backgroundColor: '#f0f9ff',
          margin: '32px 0',
        }}
      >
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            margin: '0 0 16px 0',
            fontWeight: ELEVA_TYPOGRAPHY.weights.semibold,
            color: '#0369a1',
          }}
        >
          🛡️ Security Tips:
        </Text>

        <Text style={{ ...ELEVA_TEXT_STYLES.bodySmall, margin: '0 0 8px 0' }}>
          • Use a strong, unique password for your account
        </Text>
        <Text style={{ ...ELEVA_TEXT_STYLES.bodySmall, margin: '0 0 8px 0' }}>
          • Enable two-factor authentication when available
        </Text>
        <Text style={{ ...ELEVA_TEXT_STYLES.bodySmall, margin: '0 0 8px 0' }}>
          • Always log out from shared or public devices
        </Text>
        <Text style={{ ...ELEVA_TEXT_STYLES.bodySmall, margin: '0' }}>
          • Contact support if you notice any suspicious activity
        </Text>
      </Section>

      {/* Support Information */}
      <Section
        style={{
          ...ELEVA_CARD_STYLES.default,
          textAlign: 'center' as const,
          marginTop: '32px',
        }}
      >
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodySmall,
            margin: '0',
          }}
        >
          <strong style={{ color: ELEVA_COLORS.primary }}>Need immediate assistance?</strong>
          <br />
          Contact our security team at security@eleva.care or through your dashboard.
        </Text>
      </Section>

      {/* Footer Note */}
      <Section
        style={{
          textAlign: 'center' as const,
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: `1px solid #e5e7eb`,
        }}
      >
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodySmall,
            color: '#6b7280',
            margin: '0',
          }}
        >
          This is an automated security notification from Eleva Care.
          <br />
          You received this because security monitoring is enabled on your account.
        </Text>
      </Section>
    </EmailLayout>
  );
}

// Define preview props for React Email
SecurityAlertEmail.PreviewProps = {
  userName: 'John Doe',
  alertType: 'New Device Login',
  message: 'We detected a login from a new device on your account.',
  deviceInfo: 'Chrome on macOS (IP: 192.168.1.100)',
  location: 'San Francisco, CA, USA',
  timestamp: new Date().toLocaleString(),
  actionUrl: '/account/security',
};
