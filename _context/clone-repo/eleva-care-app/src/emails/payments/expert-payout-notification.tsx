import * as React from 'react';
import { EmailButton, EmailLayout } from '@/components/emails';
import type { SupportedLocale } from '@/emails/utils/i18n';
import { Heading, Hr, Section, Text } from '@react-email/components';

// Eleva Care Brand Colors (Premium Healthcare Design System)
const ELEVA_COLORS = {
  primary: '#006D77', // Eleva Primary Teal
  primaryLight: '#00A8B8', // Enhanced contrast for dark themes
  secondary: '#F0FDFF', // Secondary Light Teal
  success: '#22C55E', // Success Green
  warning: '#F59E0B', // Warning Yellow
  error: '#EF4444', // Error Red
  neutral: {
    dark: '#4A5568', // Neutral Dark (Body text)
    light: '#718096', // Neutral Light (Secondary text)
    extraLight: '#F7FAFC', // Extra light for backgrounds
  },
  background: '#F9FAFB', // Main background
  surface: '#FFFFFF', // Surface color
  border: '#E2E8F0', // Border color
} as const;

// Eleva Care Typography System
const ELEVA_TYPOGRAPHY = {
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  headings: {
    h1: { fontSize: '28px', fontWeight: '600', lineHeight: '1.2' },
    h2: { fontSize: '24px', fontWeight: '600', lineHeight: '1.3' },
    h3: { fontSize: '20px', fontWeight: '600', lineHeight: '1.4' },
  },
  body: {
    large: { fontSize: '18px', lineHeight: '1.6' },
    regular: { fontSize: '16px', lineHeight: '1.6' },
    small: { fontSize: '14px', lineHeight: '1.5' },
  },
} as const;

interface ExpertPayoutNotificationProps {
  expertName?: string;
  payoutAmount?: string;
  currency?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  clientName?: string;
  serviceName?: string;
  payoutId?: string;
  expectedArrivalDate?: string;
  bankLastFour?: string;
  dashboardUrl?: string;
  supportUrl?: string;
  _locale?: string; // For i18n support
}

export const ExpertPayoutNotificationEmail = ({
  expertName = 'Dr. Maria Santos',
  payoutAmount = '52.50',
  currency = 'EUR',
  appointmentDate = 'Monday, February 19, 2024',
  appointmentTime = '2:30 PM - 3:30 PM',
  clientName = 'João Silva',
  serviceName = 'Mental Health Consultation',
  payoutId = 'po_1ABCDEF2ghijklmn',
  expectedArrivalDate = 'February 21, 2024',
  bankLastFour = '••••4242',
  dashboardUrl = 'https://eleva.care/dashboard/earnings',
  supportUrl = 'https://eleva.care/support',
  _locale = 'en',
}: ExpertPayoutNotificationProps) => {
  const subject = `💰 Payout sent: ${currency} ${payoutAmount} for your appointment with ${clientName}`;
  const previewText = `Your earnings from the appointment on ${appointmentDate} have been sent to your bank account. Expected arrival: ${expectedArrivalDate}.`;

  return (
    <EmailLayout
      subject={subject}
      previewText={previewText}
      headerVariant="branded"
      footerVariant="default"
      locale={_locale as SupportedLocale}
    >
      {/* Premium Success Banner - Eleva Brand Colors */}
      <Section
        style={{
          backgroundColor: ELEVA_COLORS.secondary,
          border: `1px solid ${ELEVA_COLORS.primary}`,
          padding: '24px',
          borderRadius: '12px',
          margin: '24px 0',
          textAlign: 'center' as const,
        }}
      >
        <Heading
          style={{
            ...ELEVA_TYPOGRAPHY.headings.h2,
            fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
            margin: '0 0 12px 0',
            color: ELEVA_COLORS.primary,
          }}
        >
          💰 Payout Sent Successfully!
        </Heading>
        <Text
          style={{
            ...ELEVA_TYPOGRAPHY.body.regular,
            fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
            color: ELEVA_COLORS.primary,
            margin: '0',
            fontWeight: '500',
          }}
        >
          Your earnings have been sent to your bank account
        </Text>
      </Section>

      {/* Premium Personal Greeting */}
      <Section style={{ margin: '32px 0' }}>
        <Heading
          style={{
            ...ELEVA_TYPOGRAPHY.headings.h1,
            fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
            margin: '0 0 16px 0',
            color: ELEVA_COLORS.neutral.dark,
          }}
        >
          Hello {expertName}! 👋
        </Heading>
        <Text
          style={{
            ...ELEVA_TYPOGRAPHY.body.large,
            fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
            color: ELEVA_COLORS.neutral.dark,
            margin: '0 0 16px 0',
          }}
        >
          Great news! Your earnings from the consultation with{' '}
          <strong style={{ color: ELEVA_COLORS.primary }}>{clientName}</strong> have been processed
          and sent to your bank account.
        </Text>
      </Section>

      {/* Premium Payout Summary - Enhanced Eleva Design */}
      <Section
        style={{
          backgroundColor: ELEVA_COLORS.surface,
          border: `1px solid ${ELEVA_COLORS.border}`,
          padding: '28px',
          borderRadius: '12px',
          margin: '24px 0',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        }}
      >
        <Heading
          style={{
            ...ELEVA_TYPOGRAPHY.headings.h3,
            fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
            margin: '0 0 24px 0',
            color: ELEVA_COLORS.primary,
            borderBottom: `2px solid ${ELEVA_COLORS.secondary}`,
            paddingBottom: '12px',
          }}
        >
          💰 Payout Details
        </Heading>

        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
          <tr>
            <td
              style={{
                padding: '12px 0',
                fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
                fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
                color: ELEVA_COLORS.neutral.light,
                fontWeight: '500',
              }}
            >
              Payout Amount:
            </td>
            <td
              style={{
                padding: '12px 0',
                fontSize: '20px',
                fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
                fontWeight: '700',
                color: ELEVA_COLORS.success,
                textAlign: 'right' as const,
              }}
            >
              {currency} {payoutAmount}
            </td>
          </tr>
          <tr>
            <td
              style={{
                padding: '12px 0',
                fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
                fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
                color: ELEVA_COLORS.neutral.light,
                fontWeight: '500',
              }}
            >
              Service:
            </td>
            <td
              style={{
                padding: '12px 0',
                fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
                fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
                color: ELEVA_COLORS.neutral.dark,
                textAlign: 'right' as const,
                fontWeight: '600',
              }}
            >
              {serviceName}
            </td>
          </tr>
          <tr>
            <td
              style={{
                padding: '12px 0',
                fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
                fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
                color: ELEVA_COLORS.neutral.light,
                fontWeight: '500',
              }}
            >
              Appointment Date:
            </td>
            <td
              style={{
                padding: '12px 0',
                fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
                fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
                color: ELEVA_COLORS.neutral.dark,
                textAlign: 'right' as const,
                fontWeight: '600',
              }}
            >
              {appointmentDate}
            </td>
          </tr>
          <tr>
            <td
              style={{
                padding: '12px 0',
                fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
                fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
                color: ELEVA_COLORS.neutral.light,
                fontWeight: '500',
              }}
            >
              Appointment Time:
            </td>
            <td
              style={{
                padding: '12px 0',
                fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
                fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
                color: ELEVA_COLORS.neutral.dark,
                textAlign: 'right' as const,
                fontWeight: '600',
              }}
            >
              {appointmentTime}
            </td>
          </tr>
          <tr>
            <td
              style={{
                padding: '12px 0',
                fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
                fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
                color: ELEVA_COLORS.neutral.light,
                fontWeight: '500',
              }}
            >
              Client:
            </td>
            <td
              style={{
                padding: '12px 0',
                fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
                fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
                color: ELEVA_COLORS.primary,
                textAlign: 'right' as const,
                fontWeight: '600',
              }}
            >
              {clientName}
            </td>
          </tr>
        </table>
      </Section>

      {/* Premium Bank Transfer Details - Eleva Branded */}
      <Section
        style={{
          backgroundColor: ELEVA_COLORS.secondary,
          border: `1px solid ${ELEVA_COLORS.primary}`,
          padding: '28px',
          borderRadius: '12px',
          margin: '24px 0',
        }}
      >
        <Heading
          style={{
            ...ELEVA_TYPOGRAPHY.headings.h3,
            fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
            margin: '0 0 24px 0',
            color: ELEVA_COLORS.primary,
            borderBottom: `2px solid ${ELEVA_COLORS.primary}`,
            paddingBottom: '12px',
          }}
        >
          🏦 Bank Transfer Information
        </Heading>

        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
          <tr>
            <td
              style={{
                padding: '12px 0',
                fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
                fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
                color: ELEVA_COLORS.primary,
                fontWeight: '500',
              }}
            >
              Destination Account:
            </td>
            <td
              style={{
                padding: '12px 0',
                fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
                fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
                color: ELEVA_COLORS.neutral.dark,
                textAlign: 'right' as const,
                fontWeight: '600',
              }}
            >
              {bankLastFour}
            </td>
          </tr>
          <tr>
            <td
              style={{
                padding: '12px 0',
                fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
                fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
                color: ELEVA_COLORS.primary,
                fontWeight: '500',
              }}
            >
              Expected Arrival:
            </td>
            <td
              style={{
                padding: '12px 0',
                fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
                fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
                fontWeight: '700',
                color: ELEVA_COLORS.success,
                textAlign: 'right' as const,
              }}
            >
              {expectedArrivalDate}
            </td>
          </tr>
          <tr>
            <td
              style={{
                padding: '12px 0',
                fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
                fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
                color: ELEVA_COLORS.primary,
                fontWeight: '500',
              }}
            >
              Payout ID:
            </td>
            <td
              style={{
                padding: '12px 0',
                fontSize: ELEVA_TYPOGRAPHY.body.small.fontSize,
                fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
                color: ELEVA_COLORS.neutral.light,
                textAlign: 'right' as const,
              }}
            >
              {payoutId}
            </td>
          </tr>
        </table>

        <Text
          style={{
            ...ELEVA_TYPOGRAPHY.body.small,
            fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
            color: ELEVA_COLORS.primary,
            margin: '20px 0 0 0',
            fontStyle: 'italic',
            padding: '16px',
            backgroundColor: ELEVA_COLORS.surface,
            borderRadius: '8px',
            border: `1px solid ${ELEVA_COLORS.border}`,
          }}
        >
          💡 <strong style={{ color: ELEVA_COLORS.primary }}>Note:</strong> Bank processing times
          may vary. Most transfers arrive within 1-2 business days.
        </Text>
      </Section>

      <Hr style={{ margin: '40px 0', borderColor: ELEVA_COLORS.border }} />

      {/* Premium Action Buttons - Eleva Branded */}
      <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <EmailButton
          href={dashboardUrl}
          style={{
            backgroundColor: ELEVA_COLORS.primary,
            color: ELEVA_COLORS.surface,
            padding: '16px 32px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
            fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
            fontWeight: '600',
            display: 'inline-block',
            margin: '0 8px 16px 8px',
            border: `2px solid ${ELEVA_COLORS.primary}`,
            transition: 'all 0.2s ease-in-out',
          }}
        >
          📊 View Earnings Dashboard
        </EmailButton>

        <EmailButton
          href={supportUrl}
          style={{
            backgroundColor: ELEVA_COLORS.surface,
            color: ELEVA_COLORS.primary,
            padding: '16px 32px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: ELEVA_TYPOGRAPHY.body.regular.fontSize,
            fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
            fontWeight: '600',
            display: 'inline-block',
            margin: '0 8px 16px 8px',
            border: `2px solid ${ELEVA_COLORS.primary}`,
          }}
        >
          💬 Contact Support
        </EmailButton>
      </Section>

      {/* Premium Next Steps Section */}
      <Section style={{ margin: '32px 0' }}>
        <Heading
          style={{
            ...ELEVA_TYPOGRAPHY.headings.h3,
            fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
            margin: '0 0 20px 0',
            color: ELEVA_COLORS.primary,
          }}
        >
          🎯 What&apos;s Next?
        </Heading>

        {[
          {
            title: 'Track your transfer:',
            text: `The funds should appear in your bank account by ${expectedArrivalDate}`,
          },
          {
            title: 'View earnings history:',
            text: 'Check your dashboard for detailed earnings reports',
          },
          {
            title: 'Questions?',
            text: 'Our support team is here to help with any payout inquiries',
          },
        ].map((item, index) => (
          <Text
            key={index}
            style={{
              ...ELEVA_TYPOGRAPHY.body.regular,
              fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
              color: ELEVA_COLORS.neutral.dark,
              margin: '0 0 16px 0',
              paddingLeft: '8px',
              borderLeft: `3px solid ${ELEVA_COLORS.secondary}`,
            }}
          >
            • <strong style={{ color: ELEVA_COLORS.primary }}>{item.title}</strong> {item.text}
          </Text>
        ))}
      </Section>

      {/* Premium Appreciation Message - Eleva Brand */}
      <Section
        style={{
          backgroundColor: ELEVA_COLORS.secondary,
          border: `2px solid ${ELEVA_COLORS.primary}`,
          padding: '28px',
          borderRadius: '12px',
          margin: '32px 0',
          textAlign: 'center' as const,
        }}
      >
        <Text
          style={{
            ...ELEVA_TYPOGRAPHY.body.large,
            fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
            color: ELEVA_COLORS.primary,
            margin: '0 0 12px 0',
            fontWeight: '700',
          }}
        >
          🙏 Thank you for providing excellent care through Eleva!
        </Text>
        <Text
          style={{
            ...ELEVA_TYPOGRAPHY.body.regular,
            fontFamily: ELEVA_TYPOGRAPHY.fontFamily,
            color: ELEVA_COLORS.neutral.dark,
            margin: '0',
            fontWeight: '500',
          }}
        >
          Your dedication to helping patients makes a real difference in the healthcare community.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default ExpertPayoutNotificationEmail;
