// Internationalization utilities
import * as React from 'react';

import type { EmailContext, EmailTheme, EmailTranslations, SupportedLocale } from './utils/i18n';
import {
  commonEmailPaths,
  createEmailContext,
  emailThemes,
  getEmailMessage,
  loadEmailMessages,
  useEmailTranslation,
} from './utils/i18n';

// Email Components
export { EmailLayout } from '@/components/emails/EmailLayout';
export { EmailHeader } from '@/components/emails/EmailHeader';
export { EmailFooter } from '@/components/emails/EmailFooter';
export { EmailButton } from '@/components/emails/EmailButton';

// Re-export types and utilities
export type { SupportedLocale, EmailTheme, EmailContext, EmailTranslations };
export {
  emailThemes,
  loadEmailMessages,
  getEmailMessage,
  createEmailContext,
  useEmailTranslation,
  commonEmailPaths,
};

// Novu workflow integration with i18n
// TODO: Implement Novu workflow integration
// export type {
//   EmailTriggerData,
//   WelcomeEmailTriggerData,
//   AppointmentReminderTriggerData,
//   ExpertNotificationTriggerData,
//   PaymentConfirmationTriggerData,
//   MultibancoPaymentTriggerData,
// } from './utils/novu-i18n';

// export {
//   EMAIL_WORKFLOWS,
//   triggerEmail,
//   triggerWelcomeEmail,
//   triggerAppointmentReminder,
//   triggerExpertNotification,
//   triggerPaymentConfirmation,
//   triggerMultibancoBookingPending,
//   triggerMultibancoPaymentReminder,
//   detectUserLocale,
//   detectUserTheme,
//   sendWelcomeEmailAuto,
//   novu,
// } from './utils/novu-i18n';

// Email Templates - Standard versions
export { default as WelcomeEmailTemplate } from './users/welcome-email';
export { default as AppointmentConfirmationTemplate } from './appointments/appointment-confirmation';
export { default as AppointmentReminderTemplate } from './appointments/appointment-reminder';
export { default as ExpertNotificationTemplate } from './experts/expert-notification';
export { default as NotificationEmailTemplate } from './notifications/notification-email';
export { default as SecurityAlertEmailTemplate } from './notifications/security-alert';
export { default as PaymentConfirmationTemplate } from './payments/payment-confirmation';
export { default as MultibancoBookingPendingTemplate } from './payments/multibanco-booking-pending';
export { default as MultibancoPaymentReminderTemplate } from './payments/multibanco-payment-reminder';

// Email Templates - Internationalized versions
export {
  default as WelcomeEmailI18nTemplate,
  createWelcomeEmailI18n,
  WelcomeEmailWorkflow,
} from './users/welcome-email-i18n';

// Template type definitions
export interface EmailTemplateProps {
  locale?: SupportedLocale;
  theme?: 'light' | 'dark';
  emailContext?: EmailContext;
}

export interface WelcomeEmailProps extends EmailTemplateProps {
  userName?: string;
  firstName?: string;
  dashboardUrl?: string;
  nextSteps?: Array<{
    title: string;
    description: string;
    actionUrl: string;
    actionText: string;
  }>;
}

export interface AppointmentEmailProps extends EmailTemplateProps {
  userName?: string;
  expertName?: string;
  appointmentType?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  meetingUrl?: string;
  timeUntilAppointment?: string;
}

export interface PaymentEmailProps extends EmailTemplateProps {
  customerName?: string;
  amount?: string;
  currency?: string;
  transactionId?: string;
  appointmentDetails?: {
    service: string;
    expert: string;
    date: string;
    time: string;
  };
}

export interface MultibancoEmailProps extends EmailTemplateProps {
  customerName?: string;
  entity?: string;
  reference?: string;
  amount?: string;
  expiresAt?: string;
  appointmentDetails?: {
    service: string;
    expert: string;
    date: string;
    time: string;
    duration: string;
  };
  customerNotes?: string;
}

export interface SecurityAlertEmailProps extends EmailTemplateProps {
  userName?: string;
  alertType?: string;
  message?: string;
  deviceInfo?: string;
  location?: string;
  timestamp?: string;
  actionUrl?: string;
}

// Email creation helpers with i18n support
export async function createEmailWithI18n<T extends EmailTemplateProps>(
  TemplateComponent: React.ComponentType<T>,
  props: T,
): Promise<React.ReactElement> {
  const { locale = 'en', theme = 'light', ...otherProps } = props;

  // Create email context with translations and theme
  const emailContext = await createEmailContext(locale, theme);

  return React.createElement(TemplateComponent, {
    ...(otherProps as T),
    locale,
    theme,
    emailContext,
  });
}

// Email preview helpers for development
export const EMAIL_PREVIEW_URLS = {
  welcome: '/emails/users/welcome-email',
  welcomeI18n: '/emails/users/welcome-email-i18n',
  appointmentConfirmation: '/emails/appointments/appointment-confirmation',
  appointmentReminder: '/emails/appointments/appointment-reminder',
  expertNotification: '/emails/experts/expert-notification',
  notification: '/emails/notifications/notification-email',
  securityAlert: '/emails/notifications/security-alert',
  paymentConfirmation: '/emails/payments/payment-confirmation',
  multibancoBookingPending: '/emails/payments/multibanco-booking-pending',
  multibancoPaymentReminder: '/emails/payments/multibanco-payment-reminder',
} as const;

// Email theme variants for testing
export const EMAIL_THEME_VARIANTS = {
  lightEn: { locale: 'en' as SupportedLocale, theme: 'light' as const },
  darkEn: { locale: 'en' as SupportedLocale, theme: 'dark' as const },
  lightPt: { locale: 'pt' as SupportedLocale, theme: 'light' as const },
  darkPt: { locale: 'pt' as SupportedLocale, theme: 'dark' as const },
  lightEs: { locale: 'es' as SupportedLocale, theme: 'light' as const },
  darkEs: { locale: 'es' as SupportedLocale, theme: 'dark' as const },
  lightBr: { locale: 'br' as SupportedLocale, theme: 'light' as const },
  darkBr: { locale: 'br' as SupportedLocale, theme: 'dark' as const },
} as const;
