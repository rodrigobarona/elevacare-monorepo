import * as React from 'react';
import { EmailButton, EmailLayout } from '@/components/emails';
import {
  createEmailContext,
  type EmailContext,
  type SupportedLocale,
  useEmailTranslation,
} from '@/emails/utils/i18n';
import { Heading, Section, Text } from '@react-email/components';

interface WelcomeEmailI18nProps {
  userName?: string;
  firstName?: string;
  dashboardUrl?: string;
  locale?: SupportedLocale;
  theme?: 'light' | 'dark';
  emailContext?: EmailContext;
  nextSteps?: Array<{
    title: string;
    description: string;
    actionUrl: string;
    actionText: string;
  }>;
}

export default function WelcomeEmailI18nTemplate({
  userName = 'User',
  firstName = 'User',
  dashboardUrl = 'https://eleva.care/dashboard',
  locale = 'en',
  theme = 'light',
  emailContext,
  nextSteps,
}: WelcomeEmailI18nProps) {
  // Always call useEmailTranslation with a fallback context to maintain hook order
  const fallbackContext: EmailContext = {
    locale: 'en' as const,
    theme: {
      mode: 'light' as const,
      colors: {
        primary: '#006D77',
        secondary: '#F0FDFF',
        background: '#FFFFFF',
        surface: '#F8F9FA',
        text: {
          primary: '#2D3748',
          secondary: '#4A5568',
          muted: '#718096',
        },
        border: '#E2E8F0',
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
      },
    },
    messages: {},
  };

  const emailTranslation = useEmailTranslation(emailContext || fallbackContext);
  const t = emailContext ? emailTranslation.t : (key: string) => key;

  const contextTheme = emailContext?.theme || null;

  // Use theme colors from context or fallback
  const themeColors = contextTheme?.colors || {
    primary: theme === 'dark' ? '#00A8B8' : '#006D77',
    secondary: theme === 'dark' ? '#1A2F33' : '#F0FDFF',
    text: {
      primary: theme === 'dark' ? '#F7FAFC' : '#2D3748',
      secondary: theme === 'dark' ? '#E2E8F0' : '#4A5568',
      muted: theme === 'dark' ? '#A0AEC0' : '#718096',
    },
    surface: theme === 'dark' ? '#1E2832' : '#F8F9FA',
    border: theme === 'dark' ? '#2D3748' : '#E2E8F0',
  };

  // Get translated content
  const welcomeEmail = {
    subject: t('notifications.welcome.email.subject', { firstName }),
    title: t('notifications.welcome.email.title'),
    greeting: t('notifications.welcome.email.greeting', { firstName }),
    body: t('notifications.welcome.email.body'),
    nextStepsTitle: t('notifications.welcome.email.nextStepsTitle'),
    nextSteps: t('notifications.welcome.email.nextSteps') || [],
    cta: t('notifications.welcome.email.cta'),
  };

  const subject = welcomeEmail.subject || `Welcome to Eleva Care, ${userName}!`;
  const previewText =
    t('notifications.welcome.email.preview') || 'Start your journey to better health';

  // Default next steps if not provided via props or translations
  const defaultNextSteps = nextSteps || [
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
  ];

  return (
    <EmailLayout
      subject={subject}
      previewText={previewText}
      headerVariant="branded"
      footerVariant="default"
      theme={theme}
      locale={locale}
      emailContext={emailContext}
    >
      <Heading
        style={{
          color: themeColors.primary,
          fontSize: '28px',
          marginBottom: '16px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: '600',
        }}
      >
        {welcomeEmail.title || `Welcome to Eleva Care, ${userName}! 🌟`}
      </Heading>

      <Text
        style={{
          color: themeColors.text.secondary,
          fontSize: '18px',
          lineHeight: '1.6',
          textAlign: 'center',
          marginBottom: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {welcomeEmail.body ||
          "We're excited to have you join our community dedicated to women's health and wellness."}
      </Text>

      <Section
        style={{
          backgroundColor: themeColors.secondary,
          padding: '24px',
          borderRadius: '12px',
          margin: '24px 0',
          textAlign: 'center',
        }}
      >
        <Text
          style={{
            color: themeColors.primary,
            fontSize: '16px',
            lineHeight: '1.6',
            marginBottom: '20px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {t('notifications.welcome.email.dashboardPrompt') ||
            'Get started by accessing your personalized dashboard:'}
        </Text>
        <EmailButton href={dashboardUrl} variant="primary" size="lg">
          {welcomeEmail.cta || 'Go to Dashboard'}
        </EmailButton>
      </Section>

      <Heading
        style={{
          color: themeColors.text.primary,
          fontSize: '20px',
          marginTop: '32px',
          marginBottom: '16px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: '600',
        }}
      >
        {welcomeEmail.nextStepsTitle || 'Next Steps to Get Started:'}
      </Heading>

      {defaultNextSteps.map((step, index) => (
        <Section
          key={index}
          style={{
            backgroundColor: theme === 'dark' ? '#374151' : '#FFFFFF',
            border: `1px solid ${themeColors.border}`,
            padding: '20px',
            borderRadius: '8px',
            margin: '16px 0',
          }}
        >
          <Heading
            style={{
              color: themeColors.text.primary,
              fontSize: '16px',
              margin: '0 0 8px 0',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: '600',
            }}
          >
            {index + 1}. {step.title}
          </Heading>
          <Text
            style={{
              color: themeColors.text.muted,
              fontSize: '14px',
              lineHeight: '1.5',
              margin: '0 0 16px 0',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {step.description}
          </Text>
          <EmailButton href={step.actionUrl} variant="outline" size="sm">
            {step.actionText}
          </EmailButton>
        </Section>
      ))}

      <Section
        style={{
          textAlign: 'center',
          marginTop: '32px',
          padding: '24px',
          backgroundColor: themeColors.surface,
          borderRadius: '8px',
        }}
      >
        <Text
          style={{
            color: themeColors.text.secondary,
            fontSize: '16px',
            lineHeight: '1.6',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {t('notifications.welcome.email.supportPrompt') || "Questions? We're here to help!"}
          <br />
          {t('notifications.welcome.email.contactSupport') || 'Contact our support team at'}{' '}
          <a
            href="mailto:support@eleva.care"
            style={{
              color: themeColors.primary,
              textDecoration: 'none',
              fontWeight: '500',
            }}
          >
            support@eleva.care
          </a>
        </Text>
      </Section>
    </EmailLayout>
  );
}

// Function to create an email with proper i18n context
export async function createWelcomeEmailI18n(props: WelcomeEmailI18nProps) {
  const { locale = 'en', theme = 'light', ...otherProps } = props;

  // Create email context with translations and theme
  const emailContext = await createEmailContext(locale, theme);

  return WelcomeEmailI18nTemplate({
    ...otherProps,
    locale,
    theme,
    emailContext,
  });
}

// Sample data for React Email preview - Light theme English
WelcomeEmailI18nTemplate.PreviewProps = {
  userName: 'Dr. Maria Silva',
  firstName: 'Maria',
  dashboardUrl: '/dashboard',
  locale: 'en' as SupportedLocale,
  theme: 'light' as const,
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
} as WelcomeEmailI18nProps;

// Export component for Novu workflow integration
export { WelcomeEmailI18nTemplate as WelcomeEmailWorkflow };
