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

interface WelcomeEmailProps {
  userName?: string;
  dashboardUrl?: string;
  nextSteps?: Array<{
    title: string;
    description: string;
    actionUrl: string;
    actionText: string;
  }>;
  locale?: string;
}

export default function WelcomeEmailTemplate({
  userName = 'User',
  dashboardUrl = 'https://eleva.care/dashboard',
  nextSteps = [
    {
      title: 'Complete Your Profile',
      description: 'Add your personal information and health details',
      actionUrl: 'https://eleva.care/profile',
      actionText: 'Complete Profile',
    },
    {
      title: 'Browse Healthcare Experts',
      description: 'Find and connect with qualified care experts',
      actionUrl: 'https://eleva.care/experts',
      actionText: 'Find Experts',
    },
  ],
  locale = 'en',
}: WelcomeEmailProps) {
  const subject = `Welcome to Eleva Care, ${userName}!`;
  const previewText = `Start your journey to better health with personalized expert care`;

  return (
    <EmailLayout
      subject={subject}
      previewText={previewText}
      headerVariant="branded"
      footerVariant="default"
      locale={locale as SupportedLocale}
    >
      {/* Premium Welcome Banner */}
      <Section style={ELEVA_CARD_STYLES.branded}>
        <Heading
          style={{
            ...ELEVA_TEXT_STYLES.heading1,
            textAlign: 'center' as const,
            margin: '0 0 16px 0',
          }}
        >
          Welcome to Eleva Care, {userName}! 🌟
        </Heading>

        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyLarge,
            textAlign: 'center' as const,
            margin: '0',
            fontWeight: ELEVA_TYPOGRAPHY.weights.medium,
          }}
        >
          We&apos;re excited to have you join our community dedicated to premium healthcare and
          wellness.
        </Text>
      </Section>

      {/* Premium Dashboard Access Section */}
      <Section style={ELEVA_CARD_STYLES.success}>
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            color: ELEVA_COLORS.success,
            textAlign: 'center' as const,
            marginBottom: '24px',
            fontWeight: ELEVA_TYPOGRAPHY.weights.medium,
          }}
        >
          🚀 Get started by accessing your personalized dashboard:
        </Text>

        <Section style={{ textAlign: 'center' as const }}>
          <EmailButton
            href={dashboardUrl}
            style={{
              ...ELEVA_BUTTON_STYLES.success,
              fontSize: '18px',
              padding: '20px 40px',
            }}
          >
            Go to Dashboard
          </EmailButton>
        </Section>
      </Section>

      {/* Premium Next Steps Section */}
      <Section style={{ margin: '32px 0' }}>
        <Heading style={ELEVA_TEXT_STYLES.heading2}>🎯 Next Steps to Get Started:</Heading>

        {nextSteps.map((step, index) => (
          <Section
            key={index}
            style={{
              ...ELEVA_CARD_STYLES.default,
              margin: '20px 0',
            }}
          >
            <Heading
              style={{
                ...ELEVA_TEXT_STYLES.heading3,
                margin: '0 0 12px 0',
                color: ELEVA_COLORS.primary,
              }}
            >
              {index + 1}. {step.title}
            </Heading>

            <Text
              style={{
                ...ELEVA_TEXT_STYLES.bodyRegular,
                margin: '0 0 20px 0',
              }}
            >
              {step.description}
            </Text>

            <EmailButton href={step.actionUrl} style={ELEVA_BUTTON_STYLES.secondary}>
              {step.actionText}
            </EmailButton>
          </Section>
        ))}
      </Section>

      {/* Premium Support Section */}
      <Section
        style={{
          ...ELEVA_CARD_STYLES.branded,
          textAlign: 'center' as const,
          marginTop: '32px',
        }}
      >
        <Heading
          style={{
            ...ELEVA_TEXT_STYLES.heading3,
            margin: '0 0 16px 0',
          }}
        >
          💬 Questions? We&apos;re here to help!
        </Heading>

        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            margin: '0',
          }}
        >
          Contact our support team at{' '}
          <a
            href="mailto:support@eleva.care"
            style={{
              color: ELEVA_COLORS.primary,
              textDecoration: 'underline',
              fontWeight: ELEVA_TYPOGRAPHY.weights.semibold,
            }}
          >
            support@eleva.care
          </a>
        </Text>
      </Section>

      {/* Premium Thank You Message */}
      <Section
        style={{
          textAlign: 'center' as const,
          margin: '32px 0',
          padding: '24px',
          backgroundColor: ELEVA_COLORS.overlay,
          borderRadius: '12px',
        }}
      >
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyLarge,
            color: ELEVA_COLORS.primary,
            fontWeight: ELEVA_TYPOGRAPHY.weights.semibold,
            margin: '0 0 8px 0',
          }}
        >
          🙏 Thank you for choosing Eleva Care
        </Text>
        <Text
          style={{
            ...ELEVA_TEXT_STYLES.bodyRegular,
            margin: '0',
          }}
        >
          Your journey to better health starts here.
        </Text>
      </Section>
    </EmailLayout>
  );
}

// Sample data for React Email preview
WelcomeEmailTemplate.PreviewProps = {
  userName: 'Dr. João Silva',
  dashboardUrl: '/dashboard',
  nextSteps: [
    {
      title: 'Complete your health profile',
      description: 'Help us personalize your care experience with detailed health information',
      actionUrl: '/profile/complete',
      actionText: 'Complete Profile',
    },
    {
      title: 'Browse experts',
      description: 'Find care experts that match your specific needs and preferences',
      actionUrl: '/providers',
      actionText: 'View Experts',
    },
  ],
} as WelcomeEmailProps;
