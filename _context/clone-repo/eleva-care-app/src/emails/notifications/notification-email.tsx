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

interface NotificationEmailProps {
  title?: string;
  message?: string;
  userName?: string;
  actionUrl?: string;
  actionText?: string;
  locale?: string;
}

export default function NotificationEmail({
  title = 'Notification',
  message = 'You have a new notification from Eleva Care.',
  userName = 'User',
  actionUrl = 'https://eleva.care/dashboard',
  actionText = 'View Dashboard',
  locale = 'en',
}: NotificationEmailProps) {
  const subject = title;
  const previewText = message;

  return (
    <EmailLayout
      subject={subject}
      previewText={previewText}
      headerVariant="branded"
      footerVariant="default"
      locale={locale as SupportedLocale}
    >
      {/* Premium Notification Banner - Eleva Branded */}
      <Section style={ELEVA_CARD_STYLES.branded}>
        <Heading
          style={{
            ...ELEVA_TEXT_STYLES.heading1,
            margin: '0 0 12px 0',
            textAlign: 'center' as const,
          }}
        >
          🔔 {title}
        </Heading>
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            margin: '0',
            textAlign: 'center' as const,
            fontWeight: ELEVA_TYPOGRAPHY.weights.medium,
          }}
        >
          Eleva Care Notification
        </Text>
      </Section>

      {/* Premium Personal Greeting */}
      <Section style={{ margin: '32px 0' }}>
        <Text style={{ ...ELEVA_TEXT_STYLES.bodyLarge, margin: '0 0 16px 0' }}>
          Hello {userName},
        </Text>

        <Text style={ELEVA_TEXT_STYLES.bodyRegular}>{message}</Text>
      </Section>

      {/* Premium Action Section */}
      {actionUrl && actionText && (
        <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
          <EmailButton
            href={actionUrl}
            style={{
              ...ELEVA_BUTTON_STYLES.primary,
              backgroundColor: ELEVA_COLORS.primary,
              borderColor: ELEVA_COLORS.primary,
            }}
          >
            {actionText}
          </EmailButton>
        </Section>
      )}

      {/* Premium Support Information */}
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
          <strong style={{ color: ELEVA_COLORS.primary }}>Need assistance?</strong>
          <br />
          If you have any questions, please contact our support team.
        </Text>
      </Section>

      {/* Premium Thank You Message */}
      <Section
        style={{
          ...ELEVA_CARD_STYLES.branded,
          textAlign: 'center' as const,
          marginTop: '32px',
        }}
      >
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyLarge,
            color: ELEVA_COLORS.primary,
            fontWeight: ELEVA_TYPOGRAPHY.weights.semibold,
            margin: '0',
          }}
        >
          🙏 Thank you for choosing Eleva Care!
        </Text>
      </Section>
    </EmailLayout>
  );
}

// Define preview props for React Email
NotificationEmail.PreviewProps = {
  title: 'Appointment Reminder',
  message:
    'Your appointment with Dr. Smith is scheduled for tomorrow at 2:00 PM. Please arrive 15 minutes early.',
  userName: 'John Doe',
  actionUrl: '/appointments/123',
  actionText: 'View Appointment',
};
